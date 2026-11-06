import { describe, expect, it } from 'vitest';
import { appliquerOperation, pcmVersWav } from './edition-pcm';
import { accordsLaMineur, boucleBatterie, cents, tonHarmonique, yin } from './signaux-test';
import { detecterBpm, detecterTonaliteSon } from './tempo-tonalite';
import { etirerBeat, etirerPcm } from './wsola';

const SR = 44100;

describe('éditeur (copie, l’original ne bouge pas)', () => {
  const x = Float32Array.from({ length: SR }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 220 * i) / SR));
  const pcm = { frequence: SR, canaux: [x, x.map((v) => -v)] };
  const avant = x.slice();
  it('couper retire le passage', () => {
    const r = appliquerOperation(pcm, { type: 'couper', de: 0.25, a: 0.5 });
    expect(r.canaux[0]!.length).toBe(SR * 0.75);
    expect(r.canaux).toHaveLength(2);
  });
  it('fondu, normaliser, inverser', () => {
    const f = appliquerOperation(pcm, { type: 'fondu', de: 0, a: 0.5, sens: 'entree' });
    expect(Math.abs(f.canaux[0]![10]!)).toBeLessThan(1e-3);
    expect(f.canaux[0]![SR * 0.75]).toBeCloseTo(x[SR * 0.75]!, 6);
    const s = appliquerOperation(pcm, { type: 'fondu', de: 0.5, a: 1, sens: 'sortie' });
    expect(Math.abs(s.canaux[0]![SR - 3]!)).toBeLessThan(1e-3);
    const n = appliquerOperation(pcm, { type: 'normaliser' });
    expect(Math.max(...n.canaux[0]!.map(Math.abs))).toBeCloseTo(Math.pow(10, -1 / 20), 3);
    const i = appliquerOperation(pcm, { type: 'inverser' });
    expect(i.canaux[0]![0]).toBeCloseTo(x[SR - 1]!, 6);
    expect(x).toEqual(avant);
  });
  it('refuse proprement un passage vide ou un son silencieux', () => {
    expect(() => appliquerOperation(pcm, { type: 'couper', de: 0.3, a: 0.3 })).toThrow(/passage/);
    expect(() => appliquerOperation({ frequence: SR, canaux: [new Float32Array(100)] }, { type: 'normaliser' })).toThrow(/silencieux/);
  });
  it('WAV flottant : en-tête de 58 octets puis les échantillons entrelacés', () => {
    const w = pcmVersWav(pcm);
    expect(w.length).toBe(58 + SR * 2 * 4);
    expect(new DataView(w.buffer).getFloat32(58 + 5 * 4, true)).toBeCloseTo(-x[2]!, 6);
  });
});

describe('WSOLA (hauteur gardée, durée exacte)', () => {
  for (const rapport of [0.8, 1.2]) {
    it(`rapport ${rapport} : durée à 1 ms près, hauteur à 5 cents près (YIN)`, () => {
      const f = 196;
      const pcm = { frequence: SR, canaux: [tonHarmonique(f, 2, SR)] };
      const t0 = performance.now();
      const r = etirerPcm(pcm, rapport);
      const ms = performance.now() - t0;
      const duree = r.canaux[0]!.length / SR;
      expect(Math.abs(duree - 2 * rapport)).toBeLessThan(0.001);
      for (const pos of [0.3, 0.5, 0.7]) {
        const h = yin(r.canaux[0]!, SR, 60, 1000, Math.round(r.canaux[0]!.length * pos));
        expect(Math.abs(cents(h, f))).toBeLessThan(5);
      }
      expect(ms).toBeLessThan(2000); // 2 s de son
    });
  }
  it('beat : découpé aux attaques et repositionné (durée exacte, attaques déplacées × rapport)', () => {
    const pcm = boucleBatterie(92, 2);
    const r = etirerBeat(pcm, 1.15);
    expect(r.canaux[0]!.length).toBe(Math.round(pcm.canaux[0]!.length * 1.15));
    const bpm = detecterBpm(r)!;
    expect(Math.abs(bpm.bpm - 92 / 1.15)).toBeLessThan(0.6);
  });
  it('refuse au-delà de ±20 % environ', () => {
    expect(() => etirerPcm({ frequence: SR, canaux: [new Float32Array(1000)] }, 2)).toThrow(/20 %/);
  });
});

describe('BPM et tonalité', () => {
  it('boucle de batterie à 92 BPM : 92 (± 0,5), avec le double et la moitié', () => {
    const b = detecterBpm(boucleBatterie(92, 4))!;
    expect(Math.abs(b.bpm - 92)).toBeLessThanOrEqual(0.5);
    expect(b.double).toBeCloseTo(b.bpm * 2, 1);
    expect(b.moitie).toBeCloseTo(b.bpm / 2, 1);
    expect(b.confiance).toBeGreaterThan(0.2);
  });
  it('d’autres tempos (70, 128, 140)', () => {
    for (const t of [70, 128, 140]) {
      const b = detecterBpm(boucleBatterie(t, 4))!;
      const proche = [b.bpm, b.double, b.moitie].some((x) => Math.abs(x - t) <= 0.6);
      expect(proche, `${t} → ${b.bpm}`).toBe(true);
    }
  });
  it('trop court ou silencieux : null', () => {
    expect(detecterBpm({ frequence: SR, canaux: [new Float32Array(SR)] })).toBeNull();
    expect(detecterBpm({ frequence: SR, canaux: [new Float32Array(SR * 4)] })).toBeNull();
  });
  it('suite d’accords en la mineur : la mineur d’abord, 2 choix, confiance', () => {
    const t = detecterTonaliteSon(accordsLaMineur());
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ tonique: 'A', mode: 'mineur' });
    expect(t[0]!.confiance).toBeGreaterThan(t[1]!.confiance);
    expect(t[0]!.confiance).toBeGreaterThan(0.3);
  });
  it('batterie seule ou silence : pas de tonalité', () => {
    expect(detecterTonaliteSon({ frequence: SR, canaux: [new Float32Array(SR * 2)] })).toEqual([]);
  });
});
