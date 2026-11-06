// Rendu de l'autotune avancé : justesse, curseur simple = préréglage, recalcul partiel, formants, vitesse.
import { describe, expect, it } from 'vitest';
import type { AutotunePrise } from '../morceau/types';
import { reechantillonner } from '../moteur/reechantillonner';
import { corrigerVoix } from './correction';
import { analyserCourbe, decouperNotes } from './notes';
import { reglagesDeForce, reglagesPreset } from './reglages';
import { rendreComplet, rendrePartiel } from './rendu-avance';
import { voixLiee } from './voix-liee';
import { voixSynthese } from './voix-synthese';
import { analyserHauteur } from './yin';

const FS = 48000;
const LA_MINEUR = { tonique: 'A', mode: 'mineur' } as const;

/** Courbe fine (24 kHz) de la hauteur d'un signal : temps (s) et cents. */
function courbeFine(pcm: Float32Array): { t: number[]; c: number[] } {
  const h = analyserHauteur(reechantillonner(pcm, FS, 24000), 24000);
  const t: number[] = [];
  const c: number[] = [];
  for (let i = 0; i < h.cents.length; i++) {
    t.push(i * h.pas + h.centre);
    c.push(h.cents[i]!);
  }
  return { t, c };
}

/** Médiane de la hauteur entre deux temps (sans les NaN). */
function medianeEntre(k: { t: number[]; c: number[] }, a: number, b: number): number {
  const v = k.c.filter((x, i) => k.t[i]! > a && k.t[i]! < b && !Number.isNaN(x)).sort((x, y) => x - y);
  return v.length ? v[v.length >> 1]! : NaN;
}

/** Écart (dB) entre deux signaux, relatif au premier, sur [a, b[ (échantillons). */
function ecartDb(x: Float32Array, y: Float32Array, a = 0, b = x.length): number {
  let e = 0;
  let r = 0;
  for (let i = a; i < b; i++) {
    e += (x[i]! - y[i]!) ** 2;
    r += x[i]! ** 2;
  }
  return e === 0 ? -Infinity : 10 * Math.log10(e / Math.max(r, 1e-12));
}

function rendre(pcm: Float32Array, r: AutotunePrise) {
  const { h } = analyserCourbe(pcm, FS);
  return { h, rendu: rendreComplet(pcm, FS, h, r, LA_MINEUR) };
}

describe('autotune avancé : justesse', () => {
  const { pcm, notes } = voixSynthese(12, FS);
  for (const preset of ['pop', 'robot', 'hyperpop'] as const) {
    it(`préréglage ${preset} : une voix fausse de 30 à 40 cents ressort à ±10 cents`, () => {
      const { rendu } = rendre(pcm, reglagesPreset(preset));
      expect(rendu.applique).toBe(true);
      expect(rendu.pcm.length).toBe(pcm.length);
      const k = courbeFine(rendu.pcm);
      const ecarts = notes.map((n) => medianeEntre(k, n.debut + 0.12, n.debut + n.duree - 0.06) - n.midi * 100);
      console.log(`${preset} — écarts après (cents) :`, ecarts.map((e) => Math.round(e)).join(' '));
      for (const e of ecarts) expect(Math.abs(e)).toBeLessThanOrEqual(10);
    });
  }
});

describe('le curseur simple est un préréglage', () => {
  it('Naturel = curseur à 0,3, Pop = curseur à 0,9 (mêmes réglages)', () => {
    expect(reglagesDeForce(0.3)).toEqual(reglagesPreset('naturel'));
    expect(reglagesDeForce(0.9)).toEqual(reglagesPreset('pop'));
    expect(reglagesDeForce(0.5).preset).toBe('perso');
  });

  it('même son que corrigerVoix(force), du 0,1 au 1 (≤ −90 dB)', () => {
    const { pcm } = voixSynthese(4, FS);
    const { h } = analyserCourbe(pcm, FS);
    for (const f of [0.1, 0.3, 0.6, 0.9, 1]) {
      const a = corrigerVoix(pcm, FS, f, LA_MINEUR).pcm;
      const b = rendreComplet(pcm, FS, h, reglagesDeForce(f), LA_MINEUR).pcm;
      const db = ecartDb(a, b);
      console.log(`curseur ${f} : écart ${db.toFixed(1)} dB`);
      expect(db).toBeLessThan(-90);
    }
  });
});

describe('recalcul partiel', () => {
  // 6 notes liées (une seule région voisée), chantées faux.
  const chant = [57, 60, 62, 64, 62, 60].map((midi, i) => ({ midi, faux: i % 2 ? -35 : 32, duree: 0.45 }));
  const { pcm } = voixLiee(chant, FS);
  const { h, courbe } = analyserCourbe(pcm, FS);
  const detectees = decouperNotes(courbe, pcm.length / FS);

  it('les notes liées sont découpées aux sauts de hauteur', () => {
    expect(detectees.map((n) => n.midi)).toEqual(chant.map((n) => n.midi));
  });

  it('une note déplacée de 2 demi-tons tombe à ±5 cents ; hors de la zone, rien ne bouge (≤ −60 dB)', () => {
    const base = reglagesPreset('pop');
    const avant = rendreComplet(pcm, FS, h, base, LA_MINEUR);
    const n = detectees[3]!;
    const notes = [{ debut: n.debut, fin: n.fin, midi: n.midi + 2, cents: 0, vibrato: 0 }];
    const t0 = performance.now();
    const apres = rendrePartiel(pcm, FS, h, avant, { ...base, notes }, LA_MINEUR);
    const ms = performance.now() - t0;
    expect(apres).not.toBeNull();
    expect(apres!.zones).toEqual([[n.debut - 0.1, n.fin + 0.1]]);
    const za = Math.round((n.debut - 0.1) * FS);
    const zb = Math.round((n.fin + 0.1) * FS);
    const dehors = Math.max(ecartDb(avant.pcm, apres!.pcm, 0, za), ecartDb(avant.pcm, apres!.pcm, zb, pcm.length));
    const k = courbeFine(apres!.pcm);
    const e = medianeEntre(k, n.debut + 0.1, n.fin - 0.1) - (n.midi + 2) * 100;
    // Comparé à un rendu complet des mêmes réglages : la note sonne pareil.
    const complet = rendreComplet(pcm, FS, h, { ...base, notes }, LA_MINEUR);
    const eComplet = medianeEntre(courbeFine(complet.pcm), n.debut + 0.1, n.fin - 0.1) - (n.midi + 2) * 100;
    console.log(`partiel : ${ms.toFixed(0)} ms, note à ${e.toFixed(1)} cents (complet ${eComplet.toFixed(1)}), hors zone ${dehors} dB`);
    expect(Math.abs(e)).toBeLessThanOrEqual(5);
    expect(dehors).toBeLessThanOrEqual(-60);
    // Les autres notes de la zone gardent leur hauteur (marges) : la note d'avant et d'après n'ont pas bougé.
    for (const j of [2, 4]) {
      const m = detectees[j]!;
      const ka = courbeFine(avant.pcm);
      expect(Math.abs(medianeEntre(k, m.debut + 0.12, m.fin - 0.12) - medianeEntre(ka, m.debut + 0.12, m.fin - 0.12))).toBeLessThan(3);
    }
  });

  it('réglages globaux changés : pas de partiel', () => {
    const avant = rendreComplet(pcm, FS, h, reglagesPreset('pop'), LA_MINEUR);
    expect(rendrePartiel(pcm, FS, h, avant, reglagesPreset('robot'), LA_MINEUR)).toBeNull();
  });
});

/** Enveloppe spectrale moyenne (dB) d'un signal voisé : LPC d'ordre 16 à 16 kHz, de 100 à 4 000 Hz par pas de 25 Hz. */
function enveloppe(pcm: Float32Array): number[] {
  const x = reechantillonner(pcm, FS, 16000);
  const N = 512;
  const ordre = 16;
  const grille = Array.from({ length: 157 }, (_, i) => 100 + 25 * i);
  const somme = new Array<number>(grille.length).fill(0);
  let trames = 0;
  for (let t0 = 0; t0 + N < x.length; t0 += 256) {
    const f = new Float64Array(N);
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = (x[t0 + i]! - 0.9 * (x[t0 + i - 1] ?? 0)) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
      f[i] = v;
      e += v * v;
    }
    if (e < 1e-3) continue;
    const r = Array.from({ length: ordre + 1 }, (_, k) => f.reduce((s, v, i) => (i + k < N ? s + v * f[i + k]! : s), 0));
    // Levinson-Durbin.
    let a = [1];
    let err = r[0]!;
    for (let i = 1; i <= ordre; i++) {
      let acc = r[i]!;
      for (let j = 1; j < i; j++) acc += a[j]! * r[i - j]!;
      const k = -acc / err;
      const b = a.slice();
      b.push(0);
      for (let j = 1; j < i; j++) b[j] = a[j]! + k * a[i - j]!;
      b[i] = k;
      a = b;
      err *= 1 - k * k;
    }
    grille.forEach((hz, g) => {
      const w = (2 * Math.PI * hz) / 16000;
      let re = 0;
      let im = 0;
      a.forEach((c, j) => {
        re += c * Math.cos(w * j);
        im -= c * Math.sin(w * j);
      });
      somme[g]! += -10 * Math.log10(re * re + im * im);
    });
    trames++;
  }
  return somme.map((v) => v / trames);
}

/** Facteur α qui recale le mieux l'enveloppe `apres(f)` sur `avant(f / α)` (corrélation, 300 à 3 500 Hz). */
function facteurFormants(avant: number[], apres: number[]): number {
  const auHz = (env: number[], hz: number) => {
    const p = (hz - 100) / 25;
    const i = Math.max(0, Math.min(env.length - 2, Math.floor(p)));
    return env[i]! + (p - i) * (env[i + 1]! - env[i]!);
  };
  let meilleur = -Infinity;
  let alpha = 1;
  for (let a = 0.6; a <= 1.6; a += 0.005) {
    const u: number[] = [];
    const v: number[] = [];
    for (let hz = 300; hz <= 3500; hz += 25) {
      u.push(auHz(apres, hz));
      v.push(auHz(avant, hz / a));
    }
    const mu = u.reduce((s, x) => s + x, 0) / u.length;
    const mv = v.reduce((s, x) => s + x, 0) / v.length;
    let num = 0;
    let du = 0;
    let dv = 0;
    u.forEach((x, i) => {
      num += (x - mu) * (v[i]! - mv);
      du += (x - mu) ** 2;
      dv += (v[i]! - mv) ** 2;
    });
    const c = num / Math.sqrt(du * dv);
    if (c > meilleur) {
      meilleur = c;
      alpha = a;
    }
  }
  return alpha;
}

describe('formants et vitesse', () => {
  it('décalage des formants mesuré sur l’enveloppe spectrale (−3, 0, +3, +6 demi-tons)', () => {
    const { pcm } = voixSynthese(6, FS);
    const { h } = analyserCourbe(pcm, FS);
    const ref = enveloppe(rendreComplet(pcm, FS, h, reglagesPreset('robot'), LA_MINEUR).pcm);
    for (const formants of [-3, 0, 3, 6]) {
      const out = rendreComplet(pcm, FS, h, { ...reglagesPreset('robot'), formants }, LA_MINEUR).pcm;
      const alpha = facteurFormants(ref, enveloppe(out));
      const attendu = 2 ** (formants / 12);
      console.log(`formants ${formants} : α mesuré ${alpha.toFixed(3)} (attendu ${attendu.toFixed(3)})`);
      expect(Math.abs(alpha / attendu - 1)).toBeLessThan(0.04);
    }
    // Et la hauteur, elle, ne bouge pas avec les formants (Hyperpop = Robot + 3 demi-tons de formants).
    const k = courbeFine(rendreComplet(pcm, FS, h, reglagesPreset('hyperpop'), LA_MINEUR).pcm);
    const { notes } = voixSynthese(6, FS);
    for (const n of notes) expect(Math.abs(medianeEntre(k, n.debut + 0.12, n.debut + n.duree - 0.06) - n.midi * 100)).toBeLessThanOrEqual(10);
  });

  it('vitesse 0 contre 200 ms : la transition est mesurablement plus lente', () => {
    const { pcm, debuts } = voixLiee([{ midi: 57, faux: 40, duree: 0.6 }, { midi: 59, faux: -40, duree: 0.8 }], FS, 0);
    const { h } = analyserCourbe(pcm, FS);
    const temps = (vitesse: number) => {
      const k = courbeFine(rendreComplet(pcm, FS, h, { ...reglagesPreset('robot'), vitesse }, LA_MINEUR).pcm);
      // Premier instant après le changement de note où la voix reste à 10 cents de mi (6 400) pendant 50 ms.
      for (let i = 0; i < k.t.length; i++) {
        if (k.t[i]! < debuts[1]!) continue;
        const ok = (j: number) => Math.abs(k.c[j]! - 5900) <= 10;
        let tenu = true;
        for (let j = i; j < i + 10 && j < k.c.length; j++) tenu &&= ok(j);
        if (tenu) return k.t[i]! - debuts[1]!;
      }
      return Infinity;
    };
    const t0 = temps(0);
    const t200 = temps(200);
    console.log(`juste après ${Math.round(t0 * 1000)} ms (vitesse 0) contre ${Math.round(t200 * 1000)} ms (vitesse 200)`);
    expect(t0).toBeLessThan(0.08);
    expect(t200).toBeGreaterThan(t0 + 0.15);
  });
});
