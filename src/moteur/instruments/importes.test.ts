// Sons importés : boucle calée (durée exacte, à l'échantillon près), écart de hauteur, pads (silence coupé, crête).
import { describe, expect, it } from 'vitest';
import { dureePas } from '../../morceau/temps';
import { caler, debutDuSon, ecartCalage, longueurCalee, preparerPad } from './importes';

function sinus(n: number, fs: number, f = 440, a = 0.5): Float32Array {
  return Float32Array.from({ length: n }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / fs));
}

describe('boucle calée', () => {
  it('dure exactement N mesures, à l’échantillon près (44,1 et 48 kHz, tempos variés, swing sans effet)', () => {
    for (const fs of [44100, 48000]) {
      for (const tempo of [60, 85, 140, 142, 200]) {
        for (const mesures of [1, 2, 4, 8]) {
          const n = longueurCalee(mesures, tempo, fs);
          expect(n).toBe(Math.round(mesures * 16 * dureePas(tempo) * fs));
          expect(Math.abs(n / fs - (mesures * 240) / tempo)).toBeLessThanOrEqual(0.5 / fs);
        }
      }
    }
    // Rééchantillonné UNE fois (sinc) vers cette longueur exacte, stéréo compris.
    const fs = 48000;
    const n = longueurCalee(2, 142, fs);
    const son = [sinus(Math.round(3.1 * fs), fs), sinus(Math.round(3.1 * fs), fs, 660)];
    const cale = caler(son, n);
    expect(cale.map((c) => c.length)).toEqual([n, n]);
  });

  it('change la hauteur comme un sampler : écart en demi-tons (avertissement au-delà de 1)', () => {
    // 2 mesures à 120 BPM = 4 s : un son de 4 s ne bouge pas ; un son de 4,5 s calé sur 4 s monte de ~2 demi-tons.
    expect(ecartCalage(4, 2, 120)).toBeCloseTo(0, 12);
    expect(ecartCalage(4.5, 2, 120)).toBeCloseTo(12 * Math.log2(4.5 / 4), 12);
    expect(ecartCalage(4 * Math.pow(2, -1 / 12), 2, 120)).toBeCloseTo(-1, 9);
    expect(ecartCalage(0, 2, 120)).toBe(0);
    // Vérifié sur le son : un sinus de 440 Hz de 4,5 s calé sur 4 s sonne à 440 × 4,5 / 4 = 495 Hz.
    const fs = 8000;
    const cale = caler([sinus(Math.round(4.5 * fs), fs)], 4 * fs)[0]!;
    let passages = 0;
    for (let i = fs; i < 3 * fs; i++) if (cale[i - 1]! < 0 && cale[i]! >= 0) passages++;
    expect(passages / 2).toBeCloseTo(495, 0);
  });
});

describe('pads perso', () => {
  it('silence de début coupé (1 ms gardée en fondu), crête du kit, rééchantillonné', () => {
    const de = 44100;
    const silence = Math.round(0.3 * de);
    const son = new Float32Array(silence + de);
    son.set(sinus(de, de, 220, 0.25), silence);
    for (let i = 0; i < silence; i++) son[i] = 0.0002 * Math.sin(i); // souffle sous le seuil
    expect(debutDuSon([son])).toBe(silence + 1);
    const pad = preparerPad([son], de, 48000, 0.8)[0]!;
    // Plus de 0,3 s de silence : le son commence dans les 2 premières ms.
    const premier = pad.findIndex((x) => Math.abs(x) > 0.01);
    expect(premier).toBeLessThan(0.002 * 48000);
    expect(pad.length).toBeCloseTo(((de - 1 + 44) * 48000) / de, -1);
    expect(Math.max(...pad.map(Math.abs))).toBeCloseTo(0.8, 2);
    expect(Math.abs(pad[0]!)).toBeLessThan(1e-3);
    expect(Math.abs(pad[pad.length - 1]!)).toBeLessThan(1e-3);
  });
});
