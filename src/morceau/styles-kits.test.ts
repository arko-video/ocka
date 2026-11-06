// Les kits @1 ne changent JAMAIS de son : empreinte (FNV-1a sur les échantillons) des frappes de trap@1, drill@1,
// lofi@1 et des 808 de ces styles, relevée AVANT la vague B (même valeurs que le code des phases 0 à 3).
// Les kits de la vague B (phonk, pop, boom bap) : sons propres, sans dépassement, et reproductibles.
import { describe, expect, it } from 'vitest';
import { cowbellAccordee, synthetiserFrappe } from '../moteur/instruments/batterie';
import { synthetiser808 } from '../moteur/instruments/melodiques';
import { synthetiserNote, varianteNote } from '../moteur/instruments/notes';
import { avecFrequence } from '../moteur/synthese/briques';
import { INSTRUMENTS_BATTERIE } from './types';

function fnv(h: number, a: Float32Array): number {
  const u = new Uint32Array(a.buffer, a.byteOffset, a.length);
  h = Math.imul(h ^ a.length, 16777619) >>> 0;
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i]!, 16777619) >>> 0;
  return h;
}

/** Empreinte de tout un kit (chaque instrument, dans l'ordre) à une fréquence. */
function empreinteKit(kit: string, f: number): string {
  return avecFrequence(f, () => INSTRUMENTS_BATTERIE.reduce((h, i) => fnv(h, synthetiserFrappe(kit, i)), 2166136261)).toString(16);
}

/** Empreinte de quelques notes de 808 (avec et sans glissé) d'un style. */
function empreinte808(style: string, f: number): string {
  const notes: [number, number, number | undefined][] = [[29, 0.5, undefined], [36, 1.2, 41], [41, 0.2, undefined]];
  return avecFrequence(f, () => notes.reduce((h, [m, d, c]) => fnv(h, synthetiser808(style, m, d, c)), 2166136261)).toString(16);
}

const AVANT: Record<string, string> = {
  'kit|trap|44100': '7d423d9f',
  '808|trap|44100': '71670242',
  'kit|drill|44100': '73a69375',
  '808|drill|44100': 'cf68fea0',
  'kit|lofi|44100': '307f1f59',
  '808|lofi|44100': 'f9b86c03',
  'kit|trap|48000': '66f679a7',
  '808|trap|48000': '94641dd7',
  'kit|drill|48000': '41550a9b',
  '808|drill|48000': '348291d4',
  'kit|lofi|48000': '2d1c7942',
  '808|lofi|48000': '13515d2a',
};

describe('kits @1 d’avant : son identique', () => {
  for (const f of [44100, 48000]) {
    for (const s of ['trap', 'drill', 'lofi']) {
      it(`${s}@1 à ${f} Hz`, () => expect(empreinteKit(`${s}@1`, f)).toBe(AVANT[`kit|${s}|${f}`]));
      it(`808 ${s} à ${f} Hz`, () => expect(empreinte808(s, f)).toBe(AVANT[`808|${s}|${f}`]));
    }
  }
});

describe('kits de la vague B', () => {
  for (const s of ['phonk', 'pop', 'boombap']) {
    it(`${s}@1 : chaque son est fini, borné, différent de trap@1, et reproductible`, () => {
      for (const i of INSTRUMENTS_BATTERIE.filter((x) => !x.startsWith('perso'))) {
        const a = avecFrequence(48000, () => synthetiserFrappe(`${s}@1`, i));
        // Une seule assertion par son (pas une par échantillon : des centaines de milliers d'`expect`, trop lents
        // quand toute la suite tourne en parallèle) ; mêmes exigences.
        let max = 0;
        let nonFinis = 0;
        for (const v of a) {
          if (!Number.isFinite(v)) nonFinis++;
          else max = Math.max(max, Math.abs(v));
        }
        expect(nonFinis, `${s} ${i}`).toBe(0);
        expect(max).toBeGreaterThan(0.1);
        expect(max).toBeLessThanOrEqual(1.0001);
        expect(fnv(1, a)).toBe(fnv(1, avecFrequence(48000, () => synthetiserFrappe(`${s}@1`, i))));
      }
      expect(empreinteKit(`${s}@1`, 48000)).not.toBe(AVANT['kit|trap|48000']);
      expect(empreinte808(s, 48000)).not.toBe(AVANT['808|trap|48000']);
    }, 30_000);
  }
  it('cloche accordée : sa fondamentale est bien la note demandée (énergie à f bien plus forte qu’à f × 0,75)', () => {
    const f = 440;
    const s = avecFrequence(48000, () => cowbellAccordee(f, 0.3, 0.2, 1));
    const energie = (x: number) => {
      let re = 0, im = 0;
      for (let i = 0; i < s.length; i++) {
        re += s[i]! * Math.cos((2 * Math.PI * x * i) / 48000);
        im += s[i]! * Math.sin((2 * Math.PI * x * i) / 48000);
      }
      return Math.hypot(re, im);
    };
    expect(energie(f)).toBeGreaterThan(5 * energie(f * 0.75));
  });
  it('cloche du phonk = cloche 808 accordée ; les autres styles gardent leur son', () => {
    expect(varianteNote('cloche', 'phonk')).toBe('cowbell');
    for (const st of ['trap', 'drill', 'lofi', 'pop', 'boombap']) expect(varianteNote('cloche', st)).toBe('');
    expect(varianteNote('epiano', 'lofi')).toBe('lofi');
    expect(varianteNote('epiano', 'phonk')).toBe('');
    avecFrequence(48000, () => {
      const cow = synthetiserNote('cloche', 'cowbell', 69).canaux[0]!;
      const normale = synthetiserNote('cloche', '', 69).canaux[0]!;
      expect(cow.length).toBeLessThan(normale.length);
      expect(cow.some((v) => Math.abs(v) > 0.1)).toBe(true);
      expect(cow[cow.length - 1]).toBe(0);
    });
  });
});
