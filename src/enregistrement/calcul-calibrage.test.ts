import { describe, expect, it } from 'vitest';
import { fabriquerChirp, fft, intercorreler, medianeAvecRejet, signalSuffisant } from './calcul-calibrage';

const FE = 48000;

/** Bruit blanc reproductible (graine fixe). */
function bruit(n: number, niveau: number, graine = 1): Float32Array {
  let x = graine;
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2 ** 31;
    b[i] = niveau * ((x / 2 ** 31) * 2 - 1) * Math.sqrt(3);
  }
  return b;
}

/** Ce que « le micro entend » : le chirp retardé de `retard` échantillons, atténué, plus du bruit. */
function entendu(chirp: Float32Array, retard: number, gain: number, niveauBruit: number, longueur = 26000): Float32Array {
  const s = bruit(longueur, niveauBruit, 7);
  for (let i = 0; i < chirp.length; i++) s[retard + i]! += gain * chirp[i]!;
  return s;
}

describe('chirp', () => {
  it('dure 50 ms, reste sous son amplitude et commence en douceur', () => {
    const c = fabriquerChirp(FE, 0.5);
    expect(c.length).toBe(2400);
    expect(Math.max(...c.map(Math.abs))).toBeLessThanOrEqual(0.5);
    expect(Math.abs(c[0]!)).toBeLessThan(1e-6);
    expect(Math.abs(c[c.length - 1]!)).toBeLessThan(0.01);
  });
});

describe('fft', () => {
  it('aller-retour : on retrouve le signal', () => {
    const re = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i) + i / 10);
    const im = new Float64Array(64);
    const avant = [...re];
    fft(re, im);
    fft(re, im, true);
    re.forEach((v, i) => expect(v).toBeCloseTo(avant[i]!, 9));
  });
});

describe('intercorrélation', () => {
  const chirp = fabriquerChirp(FE);

  it('retrouve un retard connu (183 ms) à l’échantillon près, malgré du bruit', () => {
    const retard = Math.round(0.183 * FE);
    const r = intercorreler(entendu(chirp, retard, 0.2, 0.05), chirp);
    expect(Math.abs(r.retard - retard)).toBeLessThan(1);
    expect(signalSuffisant(r)).toBe(true);
  });

  it('marche aussi si le micro inverse la polarité', () => {
    const r = intercorreler(entendu(chirp, 5000, -0.3, 0.02), chirp);
    expect(Math.abs(r.retard - 5000)).toBeLessThan(1);
    expect(signalSuffisant(r)).toBe(true);
  });

  it('du bruit seul est refusé (signal faible)', () => {
    const r = intercorreler(bruit(26000, 0.1, 3), chirp);
    expect(signalSuffisant(r)).toBe(false);
  });

  it('un chirp noyé dans beaucoup de bruit est refusé', () => {
    const r = intercorreler(entendu(chirp, 9000, 0.005, 0.2), chirp);
    expect(signalSuffisant(r)).toBe(false);
  });

  it('des clics (pas un chirp) sont refusés', () => {
    const s = new Float32Array(26000);
    for (let i = 0; i < s.length; i += 10000) s[i] = 0.9;
    expect(signalSuffisant(intercorreler(s, chirp))).toBe(false);
  });
});

describe('médiane avec rejet', () => {
  it('7 mesures serrées : la médiane', () => {
    expect(medianeAvecRejet([0.101, 0.1, 0.102, 0.1005, 0.1015, 0.0995, 0.1])).toBeCloseTo(0.1005, 6);
  });
  it('écarte une ou deux mesures aberrantes', () => {
    expect(medianeAvecRejet([0.1, 0.101, 0.25, 0.1005, 0.102, 0.03, 0.1])).toBeCloseTo(0.1005, 6);
  });
  it('trop dispersé (écart > 3 ms) : null, il faut refaire', () => {
    expect(medianeAvecRejet([0.1, 0.104, 0.108, 0.112, 0.116, 0.12, 0.124])).toBeNull();
  });
  it('simulation complète : 7 essais avec délai connu et bruit', () => {
    const chirp = fabriquerChirp(FE);
    const vrai = 0.0423;
    const mesures = [1, 2, 3, 4, 5, 6, 7].map((k) => {
      const s = bruit(26000, 0.05, k);
      const retard = Math.round(vrai * FE) + (k % 3) - 1; // ±1 échantillon de gigue
      for (let i = 0; i < chirp.length; i++) s[retard + i]! += 0.15 * chirp[i]!;
      return intercorreler(s, chirp).retard / FE;
    });
    expect(medianeAvecRejet(mesures)! - vrai).toBeLessThan(0.0002);
  });
});
