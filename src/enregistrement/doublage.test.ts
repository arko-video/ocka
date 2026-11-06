// Doublage automatique, mesuré : chaque copie est désaccordée de ±8 cents et retardée de 15 à 30 ms.
import { describe, expect, it } from 'vitest';
import { copieDecalee, doubler, DOUBLAGE_AUTO, parametresDoublage } from './doublage-calcul';

const FS = 48000;

/** Fréquence d'un sinus (passages par zéro montants, interpolés) entre deux instants. */
function frequence(x: Float32Array, a: number, b: number): number {
  const z: number[] = [];
  for (let i = Math.round(a * FS); i < Math.round(b * FS); i++) if (x[i - 1]! < 0 && x[i]! >= 0) z.push(i - 1 + -x[i - 1]! / (x[i]! - x[i - 1]!));
  return ((z.length - 1) * FS) / (z[z.length - 1]! - z[0]!);
}
/** Retard (s) de y par rapport à x, par intercorrélation de 0 à 50 ms autour de l'instant t. */
function retard(x: Float32Array, y: Float32Array, t: number): number {
  let best = 0;
  let bestV = -Infinity;
  const i0 = Math.round(t * FS);
  for (let d = 0; d < 0.05 * FS; d++) {
    let s = 0;
    for (let i = i0; i < i0 + 2048; i++) s += x[i - d]! * y[i]!;
    if (s > bestV) (bestV = s), (best = d);
  }
  return best / FS;
}

describe('doublage', () => {
  it('réglages par défaut : retard moyen 22,5 ms (15 à 30 ms), ±8 cents', () => {
    const p = parametresDoublage(DOUBLAGE_AUTO);
    expect(p.ecartMs).toBeCloseTo(22.5, 1);
    expect(p.cents).toBeCloseTo(8, 1);
  });

  it('copies mesurées : ±8 cents, retards entre 15 et 30 ms', { timeout: 30_000 }, () => {
    const f0 = 440;
    const x = Float32Array.from({ length: 8 * FS }, (_, i) => Math.sin((2 * Math.PI * f0 * i) / FS));
    // Un bruit à large bande pour mesurer le retard (le sinus est périodique).
    let g = 3;
    const b = Float32Array.from({ length: 8 * FS }, () => (g = (g * 16807) % 2147483647) / 2147483647 - 0.5);
    for (const cents of [8, -8]) {
      const y = copieDecalee(x, FS, cents, 0.015, 0.03);
      // Mesure là où une lecture domine (milieu de chaque demi-période de la dent de scie).
      const periode = (0.015 * FS) / Math.abs(1 - 2 ** (cents / 1200)) / FS;
      const cMesure = [periode / 2, periode].map((t) => 1200 * Math.log2(frequence(y, t - 0.2, t + 0.2) / f0)).reduce((a, c) => a + c) / 2;
      const yb = copieDecalee(b, FS, cents, 0.015, 0.03);
      const retards = [0.3, 1.2, 2.5].map((t) => retard(b, yb, t) * 1000);
      console.log(`copie ${cents > 0 ? '+' : ''}${cents} cents : mesuré ${cMesure.toFixed(2)} cents, retards ${retards.map((r) => r.toFixed(1)).join(' / ')} ms`);
      expect(Math.abs(cMesure - cents)).toBeLessThan(0.5);
      for (const r of retards) {
        expect(r).toBeGreaterThanOrEqual(14.9);
        expect(r).toBeLessThanOrEqual(30.1);
      }
    }
  });

  it('la voix doublée garde la longueur, contient la voix, et sa sonie reste proche', () => {
    let g = 5;
    const x = Float32Array.from({ length: 3 * FS }, () => (g = (g * 16807) % 2147483647) / 2147483647 - 0.5);
    const y = doubler(x, FS, DOUBLAGE_AUTO);
    expect(y.length).toBe(x.length);
    const e = (v: Float32Array) => v.reduce((s, a) => s + a * a, 0);
    expect(Math.abs(10 * Math.log10(e(y) / e(x)))).toBeLessThan(1.5);
    expect(doubler(x, FS, { ...DOUBLAGE_AUTO, niveau: 0 })).toEqual(x);
  });
});
