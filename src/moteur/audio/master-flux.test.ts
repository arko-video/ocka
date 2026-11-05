import { describe, expect, it } from 'vitest';
import { creteVraie, enDb } from '../crete';
import { ColleFlux, REDUCTION_MAX_DB, SEUILS_COLLE } from './colle';
import { ATTAQUE_MASTER_S, LimiteurFlux } from './limiteur-flux';
import { MasterFlux, type ReglagesFlux } from './master-flux';
import { retardMaster, SEUIL_MASTER } from './worklet';

const FS = 44100;

/** Le worklet des phases 0 et 1, recopié tel quel : la référence du test nul. */
function phase1(g: Float32Array, d: Float32Array | undefined, fs = FS): [Float32Array, Float32Array] {
  const lim = new LimiteurFlux(fs, SEUIL_MASTER, ATTAQUE_MASTER_S);
  const lg = new Float32Array(lim.retard + 1);
  const ld = new Float32Array(lim.retard + 1);
  const sg = new Float32Array(g.length);
  const sd = new Float32Array(g.length);
  let pos = 0;
  for (let b = 0; b < g.length; b += 128) {
    for (let i = b; i < Math.min(g.length, b + 128); i++) {
      const gauche = g[i] ?? 0;
      const droite = d?.[i] ?? gauche;
      const gain = lim.pousser(Math.max(Math.abs(gauche), Math.abs(droite)));
      const lecture = (pos + 1) % lg.length;
      lg[pos] = gauche;
      ld[pos] = droite;
      sg[i] = lg[lecture]! * gain;
      sd[i] = ld[lecture]! * gain;
      pos = lecture;
    }
  }
  return [sg, sd];
}

/** Passe un signal dans MasterFlux par blocs de 128 (comme le worklet). `avant(i)` règle avant le bloc i. */
function master(g: Float32Array, d: Float32Array | undefined, r: ReglagesFlux, avant?: (flux: MasterFlux, bloc: number) => void, fs = FS) {
  const flux = new MasterFlux(fs, SEUIL_MASTER, r);
  const sg = new Float32Array(g.length);
  const sd = new Float32Array(g.length);
  const reductions: number[] = [];
  for (let b = 0, k = 0; b < g.length; b += 128, k++) {
    avant?.(flux, k);
    const n = Math.min(128, g.length - b);
    flux.traiter(g.subarray(b, b + n), d?.subarray(b, b + n), sg.subarray(b, b + n), sd.subarray(b, b + n), n);
    reductions.push(flux.reductionColle);
  }
  return { sg, sd, reductions, flux };
}

/** Bruit pseudo-aléatoire reproductible. */
function bruit(n: number, niveau: number, graine = 1): Float32Array {
  const x = new Float32Array(n);
  let s = graine;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    x[i] = niveau * ((s / 2 ** 32) * 2 - 1);
  }
  return x;
}

function sinus(n: number, f: number, a: number, fs = FS): Float32Array {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = a * Math.sin((2 * Math.PI * f * i) / fs);
  return x;
}

const CH1: ReglagesFlux = { chaine: 1, seuilColle: SEUILS_COLLE.neutre, colle: 1 };
const CH2: ReglagesFlux = { chaine: 2, seuilColle: SEUILS_COLLE.neutre, colle: 1 };

describe('master, chaîne 1 = phases 0 et 1 (test nul)', () => {
  it('bit pour bit identique au worklet de la phase 1 (stéréo fort, mono, silence)', () => {
    const g = bruit(3 * FS, 1.6, 7);
    const d = bruit(3 * FS, 1.2, 9);
    for (const [x, y] of [[g, d], [g, undefined]] as const) {
      const [rg, rd] = phase1(x, y);
      const m = master(x, y, CH1);
      expect(m.sg).toEqual(rg);
      expect(m.sd).toEqual(rd);
    }
  });
  it('les retards : le même en chaîne 1 et en chaîne 2 (44,1 et 48 kHz)', () => {
    for (const fs of [44100, 48000]) {
      expect(new MasterFlux(fs, SEUIL_MASTER, CH1).retard).toBe(retardMaster(fs));
      expect(new MasterFlux(fs, SEUIL_MASTER, CH2).retard).toBe(retardMaster(fs));
    }
  });
});

describe('master : un clic au temps 0 ressort au temps 0 (latence retirée), à l’échantillon près', () => {
  for (const fs of [44100, 48000]) {
    for (const r of [CH1, CH2]) {
      it(`chaîne ${r.chaine} à ${fs} Hz`, () => {
        const x = new Float32Array(fs / 2);
        x[0] = 0.5;
        const { sg, flux } = master(x, x, r, undefined, fs);
        let max = 0;
        let ou = -1;
        sg.forEach((v, i) => {
          if (Math.abs(v) > max) [max, ou] = [Math.abs(v), i];
        });
        expect(ou - flux.retard).toBe(0);
        expect(max).toBeGreaterThan(0.49);
      });
    }
  }
});

describe('master, chaîne 2 : colle puis limiteur à crête vraie', () => {
  it('signal fort : la colle réduit d’au plus 3 dB (et le limiteur tient −1 dBTP)', () => {
    const x = bruit(4 * FS, 1.4, 3);
    const { sg, sd, reductions } = master(x, x, CH2);
    expect(Math.max(...reductions)).toBeLessThanOrEqual(REDUCTION_MAX_DB + 1e-9);
    expect(Math.max(...reductions)).toBeGreaterThan(2.9);
    expect(enDb(creteVraie([sg.subarray(FS), sd.subarray(FS)]))).toBeLessThanOrEqual(-0.9);
  });
  it('signal faible (−40 dBFS) : 0 dB de réduction, la sortie est l’entrée retardée, au bit près', () => {
    const x = sinus(2 * FS, 1000, 0.01);
    const { sg, reductions, flux } = master(x, x, CH2);
    expect(Math.max(...reductions)).toBe(0);
    expect(sg.subarray(flux.retard)).toEqual(x.subarray(0, x.length - flux.retard));
  });
  it('la 808 seule ne fait pas pomper un charley (détecteur passe-haut 100 Hz)', () => {
    const n = 4 * FS;
    const bas = new Float32Array(n);
    const charley = new Float32Array(n);
    const hasard = bruit(n, 1, 5);
    for (let i = 0; i < n; i++) {
      const t = (i % (FS / 2)) / FS; // une note de 808 toutes les 0,5 s, très forte (crête 0,95)
      bas[i] = 0.95 * Math.exp(-t / 0.35) * (Math.sin(2 * Math.PI * 50 * t) + 0.1 * Math.sin(2 * Math.PI * 100 * t)) / 1.1;
      const th = (i % (FS / 8)) / FS; // un charley discret toutes les croches
      charley[i] = 0.05 * Math.exp(-th / 0.01) * hasard[i]!;
    }
    const mix = bas.map((v, i) => v + charley[i]!);
    const { reductions } = master(mix, mix, CH2);
    expect(Math.max(...reductions)).toBeLessThan(0.1);
    // Le même niveau à 1 kHz, lui, est bien compressé : c'est le passe-haut qui protège la 808.
    const aigu = sinus(n, 1000, 0.6);
    expect(Math.max(...master(aigu, aigu, CH2).reductions)).toBeGreaterThan(2);
  });
  it('2:1 au-dessus du seuil, genou doux, plafond 3 dB', () => {
    expect(ColleFlux.reductionPour(-40, -17)).toBe(0);
    expect(ColleFlux.reductionPour(-17 + 5, -17)).toBeCloseTo(2.5, 6);
    expect(ColleFlux.reductionPour(-17, -17)).toBeCloseTo(0.375, 6);
    expect(ColleFlux.reductionPour(0, -17)).toBe(3);
  });
});

describe('master : changements sans clic', () => {
  /** Plus grand saut du gain appliqué d'une trame à l'autre (sur un sinus stable). */
  function sautMax(x: Float32Array, y: Float32Array, retard: number): number {
    let pire = 0;
    let avant = NaN;
    for (let i = retard + 2000; i < y.length; i++) {
      const e = x[i - retard]!;
      if (Math.abs(e) < 0.3) continue; // gain lisible seulement près des crêtes
      const gain = y[i]! / e;
      if (!Number.isNaN(avant)) pire = Math.max(pire, Math.abs(gain - avant));
      avant = gain;
    }
    return pire;
  }
  it('chaîne 1 → 2 → 1 en cours de lecture : le gain glisse, ne saute pas', () => {
    const x = sinus(3 * FS, 220, 1.3);
    const { sg, flux } = master(x, x, CH1, (f, k) => {
      if (k === 300) f.regler(2, SEUILS_COLLE.neutre, 1);
      if (k === 700) f.regler(1, SEUILS_COLLE.neutre, 1);
    });
    expect(sautMax(x, sg, flux.retard)).toBeLessThan(0.02);
  });
  it('A/B : la colle se coupe en rampe (30 ms) puis revient', () => {
    const x = sinus(3 * FS, 440, 0.8);
    const { reductions, sg, flux } = master(x, x, CH2, (f, k) => {
      if (k === 400) f.regler(2, SEUILS_COLLE.neutre, 0);
      if (k === 800) f.regler(2, SEUILS_COLLE.neutre, 1);
    });
    expect(reductions[399]).toBeGreaterThan(2);
    expect(reductions[400 + 12]).toBe(0); // 30 ms ≈ 10,3 blocs
    expect(reductions[1000]).toBeGreaterThan(2);
    expect(sautMax(x, sg, flux.retard)).toBeLessThan(0.02);
  });
});
