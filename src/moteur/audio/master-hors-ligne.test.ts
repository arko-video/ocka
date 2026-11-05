import { describe, expect, it } from 'vitest';
import { appliquerMaster, fonduFin, gainFondu } from './master-hors-ligne';
import { MasterFlux } from './master-flux';

const FS = 44100;

/** Un signal qui fait travailler la colle et le limiteur (basse forte + aigus + pics). */
function signal(n: number): [Float32Array, Float32Array] {
  const g = new Float32Array(n);
  const d = new Float32Array(n);
  let x = 1;
  for (let i = 0; i < n; i++) {
    x = (x * 16807) % 2147483647;
    const bruit = x / 2147483647 - 0.5;
    const s = 0.9 * Math.sin((2 * Math.PI * 55 * i) / FS) + 0.4 * Math.sin((2 * Math.PI * 3150 * i) / FS) + 0.3 * bruit;
    g[i] = s * (i % 9000 < 300 ? 1.8 : 1);
    d[i] = 0.8 * s;
  }
  return [g, d];
}

/** Ce que fait le worklet : blocs de 128, entrée et sortie séparées, réglé à chaque bloc. */
function commeLeWorklet(e: [Float32Array, Float32Array], r: { chaine: 1 | 2; seuilColle: number; colle: number }): [Float32Array, Float32Array] {
  const n = e[0].length;
  const s: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  const f = new MasterFlux(FS, Math.pow(10, -1 / 20), r);
  for (let i = 0; i < n; i += 128) {
    f.regler(r.chaine, r.seuilColle, r.colle);
    const m = Math.min(128, n - i);
    f.traiter(e[0].subarray(i, i + m), e[1].subarray(i, i + m), s[0].subarray(i, i + m), s[1].subarray(i, i + m), m);
  }
  return s;
}

describe('master hors ligne (en JS, sans worklet)', () => {
  for (const chaine of [1, 2] as const) {
    it(`chaîne ${chaine} : au bit près le calcul du worklet, en place`, async () => {
      const r = { chaine, seuilColle: -17, colle: 1 };
      const e = signal(FS * 2 + 77);
      const attendu = commeLeWorklet(e, r);
      await appliquerMaster(e, r, FS, null);
      expect(e[0]).toEqual(attendu[0]);
      expect(e[1]).toEqual(attendu[1]);
    });
  }

  it('fondu de fin : 1, puis rampe linéaire jusqu’à 0, puis 0', async () => {
    const f = fonduFin(0.1, 1, 0.5);
    expect(f.debut).toBeCloseTo(0.6, 12);
    expect(f.fin).toBeCloseTo(1.1, 12);
    expect(gainFondu(f, Math.floor(0.6 * FS) - 1, FS)).toBe(1);
    expect(gainFondu(f, Math.round(0.85 * FS), FS)).toBeCloseTo(0.5, 4);
    expect(gainFondu(f, Math.round(1.1 * FS), FS)).toBe(0);
    expect(fonduFin(0, 2, 0).debut).toBeCloseTo(1.99, 12); // mini-fondu de 10 ms
    const e = signal(FS * 2);
    const attendu = commeLeWorklet(e, { chaine: 2, seuilColle: -17, colle: 1 });
    await appliquerMaster(e, { chaine: 2, seuilColle: -17, colle: 1 }, FS, f);
    for (const k of [100, Math.round(0.85 * FS), Math.round(1.5 * FS)]) {
      expect(e[0][k]).toBe(Math.fround(attendu[0][k]! * gainFondu(f, k, FS)));
    }
  });
});
