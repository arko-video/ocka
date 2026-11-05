// Sons de la mélodie et notes sans durée : justesse du pluck (Karplus-Strong à retard fractionnaire), niveaux
// cohérents entre les 6 sons, boucles sans clic des sons tenus, longueurs fixes (indépendantes du tempo).
import { describe, expect, it } from 'vitest';
import { SONS_MELODIE, type SonMelodie } from '../../morceau/types';
import { frequenceMidi } from '../../morceau/theorie';
import { mesurerSonie } from '../sonie';
import { avecFrequence } from '../synthese/briques';
import { coefficientPasseTout, piano, pluck } from './melodie';
import { synthetiserNote } from './notes';

/**
 * Fréquence du fondamental, très précise : on démodule à la fréquence attendue, puis on mesure la rotation de
 * phase entre deux fenêtres de Hann (les harmoniques, à ≥ f d'écart, sont rejetées par les fenêtres).
 */
function frequenceMesuree(s: Float32Array, fs: number, f: number): number {
  const fenetre = Math.min(Math.round((24 * fs) / f), Math.floor(s.length / 4));
  const phaseA = (debut: number) => {
    let re = 0;
    let im = 0;
    for (let k = 0; k < fenetre; k++) {
      const n = debut + k;
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / fenetre);
      re += w * s[n]! * Math.cos((2 * Math.PI * f * n) / fs);
      im -= w * s[n]! * Math.sin((2 * Math.PI * f * n) / fs);
    }
    return Math.atan2(im, re);
  };
  const a = Math.round(0.02 * fs);
  // Écart choisi pour que la rotation reste bien sous ±π même à 5 cents (et assez grand pour être précise).
  const ecart = Math.min(s.length - fenetre - a - 1, Math.round(fs / (f * 0.003 * 2.5)));
  let d = phaseA(a + ecart) - phaseA(a);
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return f + (d * fs) / (2 * Math.PI * ecart);
}

const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);

describe('pluck Karplus-Strong', () => {
  it('le passe-tout a EXACTEMENT le retard de phase voulu à la fondamentale', () => {
    for (const w of [0.01, 0.3, 1.2]) {
      for (const retard of [0.5, 0.9, 1.4]) {
        const C = coefficientPasseTout(retard, w);
        // Phase de (C + e^{-jw}) / (1 + C e^{-jw}).
        const num = Math.atan2(-Math.sin(w), C + Math.cos(w));
        const den = Math.atan2(-C * Math.sin(w), 1 + C * Math.cos(w));
        expect(-(num - den) / w).toBeCloseTo(retard, 9);
      }
    }
  });

  for (const fs of [44100, 48000]) {
    it(`juste à ±2 cents de C2 à C7 (et au-delà) à ${fs} Hz`, () => {
      let pire = 0;
      for (let midi = 36; midi <= 100; midi += 1) {
        const s = avecFrequence(fs, () => pluck(midi));
        const ecart = Math.abs(cents(frequenceMesuree(s, fs, frequenceMidi(midi)), frequenceMidi(midi)));
        pire = Math.max(pire, ecart);
        expect(ecart, `midi ${midi}`).toBeLessThanOrEqual(2);
      }
      console.log(`pluck à ${fs} Hz : écart max ${pire.toFixed(3)} cent`);
    });
  }

  it('sans retard fractionnaire, C7 serait faux de plusieurs cents (le test voit bien la différence)', () => {
    // Retard entier seulement (ligne + 0,5) : la note monte ou descend nettement.
    const fs = 44100;
    const f = frequenceMidi(96);
    const N = Math.round(fs / f - 0.5);
    expect(Math.abs(cents(fs / (N + 0.5), f))).toBeGreaterThan(5);
  });
});

describe('notes sans durée', () => {
  /** Sonie (LUFS, BS.1770) d'une petite phrase : 4 notes d'une seconde (do mi sol do), comme dans le graphe. */
  function sonieSon(son: SonMelodie, gain = 1, fs = 48000): number {
    const g = new Float32Array(Math.round(4.4 * fs));
    const d = new Float32Array(g.length);
    [60, 64, 67, 72].forEach((midi, k) => {
      const note = avecFrequence(fs, () => synthetiserNote(son, '', midi));
      const [cg, cd] = [note.canaux[0]!, note.canaux[1] ?? note.canaux[0]!]; // mono → gauche = droite = mono
      const debut = Math.round(k * fs);
      const n = fs;
      for (let i = 0; i < n; i++) {
        // Relâchement de 30 ms (ordre de grandeur du graphe), sinon la note coupe net.
        const r = gain * (i < n - 1440 ? 1 : (n - i) / 1440);
        g[debut + i] += r * cg[i]!;
        d[debut + i] += r * cd[i]!;
      }
    });
    return mesurerSonie([g, d], fs);
  }

  it("volumes cohérents : chaque son à ±3 LU du piano électrique des accords (la cloche des accords est de la phase 1)", () => {
    const ref = sonieSon('epiano');
    const ecarts: Record<string, number> = {};
    for (const son of SONS_MELODIE) ecarts[son] = Math.round((sonieSon(son) - ref) * 10) / 10;
    console.log('sonie par rapport au piano électrique (LU) :', JSON.stringify(ecarts));
    for (const son of SONS_MELODIE) expect(Math.abs(ecarts[son]!), son).toBeLessThanOrEqual(3);
  });

  it('crêtes raisonnables (≤ 0,6) et tampons mono, sauf la nappe', () => {
    for (const son of SONS_MELODIE) {
      for (const midi of [36, 60, 84]) {
        const n = avecFrequence(48000, () => synthetiserNote(son, '', midi));
        expect(n.canaux.length, son).toBe(son === 'nappe' ? 2 : 1);
        let crete = 0;
        for (const c of n.canaux) for (const x of c) crete = Math.max(crete, Math.abs(x));
        expect(crete, `${son} ${midi}`).toBeLessThanOrEqual(0.6 + 1e-6);
        expect(crete, `${son} ${midi}`).toBeGreaterThan(0.05);
        // Longueur fixe, finie par un silence (fondu) ou une boucle.
        if (!n.boucle) for (const c of n.canaux) expect(Math.abs(c[c.length - 1]!)).toBeLessThan(1e-3);
      }
    }
  });

  it('sons tenus : la boucle enchaîne sans saut (fin de boucle ≈ juste avant le début)', () => {
    for (const son of ['nappe', 'lead'] as const) {
      for (const midi of [45, 69, 81]) {
        const n = avecFrequence(48000, () => synthetiserNote(son, '', midi));
        const [a, b] = n.boucle!;
        const S = Math.round(a * 48000);
        const E = Math.round(b * 48000);
        for (const c of n.canaux) {
          expect(c.length).toBe(E);
          // Le saut E−1 → S doit ressembler au pas S−1 → S (même signal, à peu près au même endroit).
          let pasMax = 0;
          for (let i = S - 2000; i < S + 2000; i++) pasMax = Math.max(pasMax, Math.abs(c[i + 1]! - c[i]!));
          expect(Math.abs(c[E - 1]! - c[S - 1]!), `${son} ${midi}`).toBeLessThan(0.02 * pasMax + 1e-6);
          expect(Math.abs(c[S]! - c[E - 1]!), `${son} ${midi}`).toBeLessThanOrEqual(1.05 * pasMax);
        }
      }
    }
  });

  it('piano par résonateurs : décroissance qui dépend de la hauteur, synthèse rapide', () => {
    const fs = 48000;
    const energie = (s: Float32Array, de: number, a: number) => {
      let e = 0;
      for (let i = Math.round(de * fs); i < Math.round(a * fs); i++) e += s[i]! * s[i]!;
      return e;
    };
    const t0 = performance.now();
    const grave = avecFrequence(fs, () => piano(48));
    const aigu = avecFrequence(fs, () => piano(84));
    const ms = (performance.now() - t0) / 2;
    // Rapport fin / début : le grave tient bien plus longtemps que l'aigu.
    const tenueGrave = energie(grave, 1.5, 2) / energie(grave, 0, 0.5);
    const tenueAigu = energie(aigu, 1.5, 2) / energie(aigu, 0, 0.5);
    expect(tenueGrave).toBeGreaterThan(5 * tenueAigu);
    console.log(`piano : ${ms.toFixed(1)} ms par note (Node), tenue grave/aigu ${(tenueGrave / tenueAigu).toFixed(1)}`);
    expect(ms).toBeLessThan(150);
  });
});
