// Tests des synthés de C3 (L) : justesse (YIN, ±5 cents), pas de repliement (onde dessinée, supersaw, jusqu'à C7),
// 303 stable résonance au maximum, mêmes réglages = même son (empreintes relevées à la livraison : un synthé livré ne
// change plus, sinon @2). Les 6 sons v1 sont gardés par registre-synthes.test.ts (contrat).
import { describe, expect, it } from 'vitest';
import { frequenceMidi } from '../../../morceau/theorie';
import { CATEGORIES_SFXR } from '../../api-synthes';
import { avecFrequence } from '../briques';
import { crete } from '../outils-notes';
import { reglagesLus, synthe } from '../registre-synthes';
import { rendre303 } from './303';
import { cents, empreinte, hauteurMediane, repliementDb } from './mesures-test';
import { FORMES_NES } from './nes';
import { fabriquerSon, kickParDefaut, sfxrAuHasard } from './sons-courts';
import { frequencesSupersaw } from './supersaw';
import { MOTIF_TEST } from './synthes.donnees-test';

const EMPREINTES: Record<string, string> = {
  '44100|nes|60': 'c627f45b:88200|1.2000,2.0000',
  '48000|nes|60': '1c52a112:96000|1.2000,2.0000',
  '44100|onde|60': '15aac56f:114660|1.6000,2.6000',
  '48000|onde|60': 'fc672b1e:124800|1.6000,2.6000',
  '44100|supersaw|60': 'cb0f419f:132300/132300|1.0000,3.0000',
  '48000|supersaw|60': '1a4d8a4d:144000/144000|1.0000,3.0000',
  '44100|choeurs|60': 'f4b8aca2:141120/141120|1.6000,3.2000',
  '48000|choeurs|60': '9cbe4887:153600/153600|1.6000,3.2000',
  '44100|logdrum|60': '6f61f89c:36052',
  '48000|logdrum|60': 'e25a0651:39240',
  '44100|cuivres|60': '1d095c6f:132300/132300|1.4000,3.0000',
  '48000|cuivres|60': '34000ec0:144000/144000|1.4000,3.0000',
  '44100|rhodes|60': 'fde1f6e0:176400/176400',
  '48000|rhodes|60': 'bec71058:192000/192000',
  '44100|wurlitzer|60': '2007d77c:154350',
  '48000|wurlitzer|60': '53e21b80:168000',
  '44100|pianojouet|60': '8e55ae26:110250',
  '48000|pianojouet|60': '83c815a7:120000',
  '44100|celesta|60': '50694848:132300',
  '48000|celesta|60': 'fb1490d8:144000',
  '44100|steeldrum|60': '8b37a43d:110250',
  '48000|steeldrum|60': '26941113:120000',
  '48000|303|motif': 'b8f79a70:99840',
  kick: 'f7d69f23:33600',
  'sfxr|piece|7': 'd7508cdf:5741',
  'sfxr|laser|7': '5ff5883c:15177',
  'sfxr|explosion|7': '574f700e:8101',
  'sfxr|bonus|7': 'ef1477f6:11642',
  'sfxr|coup|7': 'ba83b9b:5144',
  'sfxr|saut|7': 'a4c84981:10954',
  'sfxr|bip|7': '2f241b53:5190',
};

/** Synthés à hauteur (mode « note ») et leurs tessitures testées. */
const A_HAUTEUR: Record<string, number[]> = {
  nes: [36, 48, 60, 72, 84, 96],
  onde: [36, 48, 60, 72, 84, 96],
  supersaw: [36, 48, 60, 72, 84, 96],
  choeurs: [43, 48, 60, 72, 79],
  logdrum: [28, 36, 48, 60],
  cuivres: [40, 48, 60, 72, 84],
  rhodes: [33, 48, 60, 72, 84, 96],
  wurlitzer: [36, 48, 60, 72, 84],
  pianojouet: [60, 72, 84, 96],
  celesta: [60, 72, 84, 96],
  steeldrum: [48, 60, 72, 84],
};

function note(id: string, midi: number, params?: Record<string, number>, fs = 48000) {
  const d = synthe(id)!;
  return avecFrequence(fs, () => d.rendreNote!(midi, reglagesLus(d, params ? { params } : undefined), ''));
}

describe('synthés de C3 : justesse', () => {
  it('chaque synthé à hauteur est juste à ±5 cents (YIN, médiane de 0,3 à 1 s)', () => {
    const ecarts: string[] = [];
    for (const [id, notes] of Object.entries(A_HAUTEUR)) {
      expect(synthe(id)?.pret, id).toBe(true);
      for (const midi of notes) {
        const f = frequenceMidi(midi);
        const h = hauteurMediane(
          note(id, midi).canaux[0]!,
          48000,
          id === 'logdrum' ? 0.08 : 0.3,
          id === 'logdrum' ? 0.3 : 1,
          Math.min(30, f * 0.6),
        );
        const e = cents(h, f);
        if (!(Math.abs(e) <= 5)) ecarts.push(`${id} ${midi} : ${e.toFixed(1)} cents`);
      }
    }
    expect(ecarts).toEqual([]);
  }, 120_000);

  it('chiptune : impulsions 12,5 / 25 / 50 % et triangle justes ; le bruit n’est jamais vide', () => {
    FORMES_NES.forEach((forme, i) => {
      const r = note('nes', 57, { forme: i / (FORMES_NES.length - 1), decroissance: 0, tenue: 1 });
      if (forme.startsWith('bruit')) expect(crete(r.canaux), forme).toBeGreaterThan(0.01);
      else
        expect(
          Math.abs(cents(hauteurMediane(r.canaux[0]!, 48000, 0.3, 1), frequenceMidi(57))),
          forme,
        ).toBeLessThan(5);
    });
  }, 60_000);

  it('303 : une note longue est juste (scie et carré)', () => {
    for (const onde of [0, 1])
      for (const midi of [33, 45, 57]) {
        const c = avecFrequence(48000, () =>
          rendre303([{ t: 0, duree: 1.5, midi, vel: 0.5 }], 1.5, {
            onde,
            coupure: 1,
            resonance: 0,
            enveloppe: 0.2,
            decroissance: 0.5,
            accent: 0.6,
            saturation: 0,
          }),
        );
        expect(
          Math.abs(cents(hauteurMediane(c, 48000, 0.2, 1.2), frequenceMidi(midi))),
          `${onde} ${midi}`,
        ).toBeLessThan(5);
      }
  }, 60_000);
});

describe('synthés de C3 : repliement', () => {
  const C7 = frequenceMidi(96);
  for (const fs of [44100, 48000]) {
    it(`onde dessinée (dessin dur) et supersaw : repliement sous −60 dB jusqu'à C7 (${fs} Hz)`, () => {
      const dur = Array.from({ length: 64 }, (_, i) =>
        i < 20 ? 1 : i < 40 ? -0.6 : ((i * 37) % 11) / 5.5 - 1,
      );
      const o = synthe('onde')!;
      for (const midi of [84, 96]) {
        const r = avecFrequence(fs, () => o.rendreNote!(midi, reglagesLus(o, { onde: dur }), ''));
        expect(repliementDb(r.canaux[0]!, fs, 0.2, [frequenceMidi(midi)]), `onde ${midi}`).toBeLessThan(-60);
        const s = note('supersaw', midi, { desaccord: 0.4 }, fs);
        for (const c of s.canaux)
          expect(
            repliementDb(c, fs, 0.2, frequencesSupersaw(frequenceMidi(midi), 0.4)),
            `supersaw ${midi}`,
          ).toBeLessThan(-60);
      }
      expect(C7).toBeCloseTo(2093, 0);
    }, 60_000);
  }
});

describe('303 : stable', () => {
  it('résonance au maximum, toutes coupures et saturations : fini, borné, pas d’emballement', () => {
    for (const coupure of [0, 0.3, 0.7, 1])
      for (const saturation of [0, 1])
        for (const decroissance of [0, 1]) {
          const c = avecFrequence(48000, () =>
            rendre303(MOTIF_TEST, 2, {
              onde: 0,
              coupure,
              resonance: 1,
              enveloppe: 1,
              decroissance,
              accent: 1,
              saturation,
            }),
          );
          expect(c.every(Number.isFinite)).toBe(true);
          expect(crete([c])).toBeLessThan(0.5);
        }
  }, 60_000);

  it('l’accent est plus fort ; un passage vide est silencieux ; la queue dépasse un peu', () => {
    const rms = (c: Float32Array) => Math.sqrt(c.reduce((s, x) => s + x * x, 0) / c.length);
    const p = {
      onde: 0,
      coupure: 0.3,
      resonance: 0.6,
      enveloppe: 0.5,
      decroissance: 0.4,
      accent: 0.8,
      saturation: 0,
    };
    const fort = avecFrequence(48000, () => rendre303([{ t: 0, duree: 0.2, midi: 36, vel: 1 }], 0.3, p));
    const doux = avecFrequence(48000, () => rendre303([{ t: 0, duree: 0.2, midi: 36, vel: 0.6 }], 0.3, p));
    expect(rms(fort)).toBeGreaterThan(rms(doux) * 1.3);
    const vide = avecFrequence(48000, () => rendre303([], 1, p));
    expect(crete([vide])).toBe(0);
    expect(vide.length).toBeGreaterThan(48000);
  }, 60_000);
});

describe('mêmes réglages = même son', () => {
  it('empreintes relevées à la livraison (44,1 et 48 kHz)', () => {
    const vu: Record<string, string> = {};
    for (const cle of Object.keys(EMPREINTES)) {
      const [a, b] = cle.split('|');
      if (cle === 'kick') vu[cle] = empreinte(fabriquerSon(kickParDefaut()).canaux);
      else if (a === 'sfxr')
        vu[cle] = empreinte(fabriquerSon(sfxrAuHasard(b as (typeof CATEGORIES_SFXR)[number], 7)).canaux);
      else if (b === '303') {
        const d = synthe('303')!;
        vu[cle] = empreinte(
          avecFrequence(48000, () => d.rendreMotif!(MOTIF_TEST, 2, reglagesLus(d, undefined))),
        );
      } else {
        const r = avecFrequence(Number(a), () =>
          synthe(b!)!.rendreNote!(60, reglagesLus(synthe(b!)!, undefined), ''),
        );
        vu[cle] = empreinte(r.canaux) + (r.boucle ? `|${r.boucle.map((x) => x.toFixed(4)).join(',')}` : '');
      }
    }
    expect(vu).toEqual(EMPREINTES);
  }, 60_000);

  it('deux rendus identiques ; un réglage change le son', () => {
    for (const id of Object.keys(A_HAUTEUR)) {
      const d = synthe(id)!;
      const cle = Object.keys(d.params)[0]!;
      const a = empreinte(note(id, 55, { [cle]: 0.2 }).canaux);
      expect(empreinte(note(id, 55, { [cle]: 0.2 }).canaux), id).toBe(a);
      expect(empreinte(note(id, 55, { [cle]: 0.9 }).canaux), id).not.toBe(a);
    }
  }, 60_000);
});
