// Effets de performance (R) : chaque effet MESURÉ sur des signaux simples, même longueur, déterministe, sans clic aux bords.
import { describe, expect, it } from 'vitest';
import { appliquerEffetPerf } from '../effets-perf';
import type { EffetPerf } from '../../morceau/types';

const FS = 48000;
const SPP = 0.125; // 120 BPM : un pas = 1/8 s, un temps = 0,5 s

function sinus(f: number, duree: number, enveloppe: (t: number) => number = () => 1): Float32Array[] {
  const x = Float32Array.from(
    { length: Math.round(duree * FS) },
    (_, i) => 0.5 * enveloppe(i / FS) * Math.sin((2 * Math.PI * f * i) / FS),
  );
  return [x, x.slice()];
}

/** Fréquence par passages à zéro (montants) sur [de, a[ (s). */
function frequence(x: Float32Array, de: number, a: number): number {
  let n = 0;
  const i0 = Math.round(de * FS);
  const i1 = Math.round(a * FS);
  for (let i = i0 + 1; i < i1; i++) if (x[i - 1]! < 0 && x[i]! >= 0) n++;
  return n / (a - de);
}

function rms(x: Float32Array, de: number, a: number): number {
  let s = 0;
  const i0 = Math.round(de * FS);
  const i1 = Math.round(a * FS);
  for (let i = i0; i < i1; i++) s += x[i]! ** 2;
  return Math.sqrt(s / Math.max(1, i1 - i0));
}

/** Plus grand saut entre deux échantillons voisins. */
function sautMax(x: Float32Array): number {
  let m = 0;
  for (let i = 1; i < x.length; i++) m = Math.max(m, Math.abs(x[i]! - x[i - 1]!));
  return m;
}

const effet = (type: EffetPerf['type'], plus: Partial<EffetPerf> = {}): EffetPerf => ({
  type,
  pas: 0,
  duree: 8,
  ...plus,
});

describe('effets de performance (registre EFFETS_PERF)', () => {
  it('même longueur, mêmes canaux, déterministe, bords = l’original (aucun clic de raccord)', () => {
    const x = sinus(440, 1);
    for (const type of ['stutter', 'demi-tempo', 'tape-stop', 'gate', 'reverse'] as const) {
      const y = appliquerEffetPerf(x, FS, effet(type), SPP);
      expect(y.length, type).toBe(2);
      expect(y[0]!.length, type).toBe(x[0]!.length);
      expect(appliquerEffetPerf(x, FS, effet(type), SPP)[0], type).toEqual(y[0]);
      expect(y[0]![0], type).toBeCloseTo(x[0]![0]!, 3);
      expect(y[0]![y[0]!.length - 1], type).toBeCloseTo(x[0]![x[0]!.length - 1]!, 3);
      // Aucun saut plus fort que ceux d'un sinus à 440 Hz (0,5 × 2π × 440 / 48000 ≈ 0,029), avec de la marge.
      expect(sautMax(y[0]!), type).toBeLessThan(0.06);
    }
  });

  it('stutter : la 1re tranche (1/16 = 0,125 s à 120 BPM) revient en rafale ; 1/8 et 1/32 suivent la division', () => {
    const x = sinus(440, 1, (t) => 1 - t); // amplitude qui baisse : la répétition se voit
    for (const [division, tranche] of [
      [2, 0.25],
      [4, 0.125],
      [8, 0.0625],
    ] as const) {
      const y = appliquerEffetPerf(x, FS, effet('stutter', { division }), SPP)[0]!;
      const n = Math.round(tranche * FS);
      // Chaque répétition (hors rampes) = le début du passage.
      for (const k of [1, 2, 3])
        for (const i of [n / 4, n / 2]) expect(y[k * n + i]).toBeCloseTo(x[0]![i]!, 5);
      expect(rms(y, 0.75, 0.95)).toBeGreaterThan(rms(x[0]!, 0.75, 0.95) * 2.5);
    }
  });

  it('demi-tempo : la hauteur est divisée par 2 (440 → 220 Hz)', () => {
    const y = appliquerEffetPerf(sinus(440, 1), FS, effet('demi-tempo'), SPP)[0]!;
    expect(frequence(y, 0.05, 0.95)).toBeGreaterThan(210);
    expect(frequence(y, 0.05, 0.95)).toBeLessThan(230);
  });

  it('tape stop : la hauteur descend (début ≈ 440 Hz, fin < 100 Hz), puis le son s’éteint', () => {
    const y = appliquerEffetPerf(sinus(440, 2), FS, effet('tape-stop'), SPP)[0]!;
    const debut = frequence(y, 0.0, 0.2);
    const milieu = frequence(y, 0.9, 1.1);
    const fin = frequence(y, 1.6, 1.8);
    expect(debut).toBeGreaterThan(380);
    expect(milieu).toBeLessThan(debut * 0.6);
    expect(fin).toBeLessThan(100);
    expect(rms(y, 1.9, 1.995)).toBeLessThan(rms(y, 0, 0.2) * 0.5);
  });

  it('gate : ouvert la 1re moitié de chaque 1/16, fermé l’autre moitié', () => {
    const x = sinus(440, 1);
    const y = appliquerEffetPerf(x, FS, effet('gate', { division: 4 }), SPP)[0]!;
    for (let k = 1; k < 7; k++) {
      const t = k * 0.125;
      expect(rms(y, t + 0.01, t + 0.05)).toBeGreaterThan(0.3);
      expect(rms(y, t + 0.065, t + 0.12)).toBeLessThan(1e-6);
    }
  });

  it('reverse : l’enveloppe est inversée (un son qui décroît monte)', () => {
    const x = sinus(440, 1, (t) => Math.exp(-t / 0.2));
    const y = appliquerEffetPerf(x, FS, effet('reverse'), SPP)[0]!;
    expect(rms(x[0]!, 0.05, 0.15)).toBeGreaterThan(rms(x[0]!, 0.85, 0.95) * 10);
    expect(rms(y, 0.85, 0.95)).toBeGreaterThan(rms(y, 0.05, 0.15) * 10);
    expect(y[1000]).toBeCloseTo(x[0]![x[0]!.length - 1001]!, 6);
  });

  it('passage vide : rien ne plante', () => {
    expect(
      appliquerEffetPerf([new Float32Array(0), new Float32Array(0)], FS, effet('reverse'), SPP)[0]!.length,
    ).toBe(0);
  });
});
