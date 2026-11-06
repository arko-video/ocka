// Sons fabriqués (L) : kick (recette → son, bornes, chute de hauteur), bruitages sfxr (même graine = même recette,
// chaque catégorie sonne), recettes relues par le normaliseur sans changement, enregistrement dans « Tes sons ».
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normaliserMorceau } from '../../../morceau/normaliser';
import { nouveauMorceau } from '../../../morceau/styles';
import type { RecetteSon } from '../../../morceau/types';
import { installerNavigateur } from '../../../projets/test-factices';
import { CATEGORIES_SFXR } from '../../api-synthes';
import { lireWav } from '../../wav';
import { crete } from '../outils-notes';
import { enregistrerSonFabrique, fabriquerSon, kickParDefaut, sfxrAuHasard, wavDe } from './sons-courts';

describe('fabricant de kick', () => {
  it('48 kHz mono, longueur de la recette, crête à −1 dBFS, fin sans clic', () => {
    const r = kickParDefaut();
    const s = fabriquerSon(r);
    expect(s.frequence).toBe(48000);
    expect(s.canaux).toHaveLength(1);
    const c = s.canaux[0]!;
    expect(c.length).toBe(Math.round(r.duree * 48000));
    expect(crete([c])).toBeCloseTo(0.89, 3);
    expect(Math.abs(c[c.length - 1]!)).toBeLessThan(1e-3);
  }, 60_000);

  it('la hauteur tombe du départ à la fin (passages par zéro)', () => {
    const c = fabriquerSon({
      ...kickParDefaut(),
      claquement: 0,
      saturation: 0,
      duree: 1,
      hauteur: 45,
      depart: 400,
      chute: 0.05,
    }).canaux[0]!;
    const passages = (de: number, a: number) => {
      let n = 0;
      for (let i = Math.round(de * 48000) + 1; i < Math.round(a * 48000); i++)
        if (c[i - 1]! < 0 !== c[i]! < 0) n++;
      return n / 2 / (a - de);
    };
    expect(passages(0, 0.01)).toBeGreaterThan(150);
    expect(passages(0.4, 0.7)).toBeCloseTo(45, -1);
  }, 60_000);

  it('une recette hors bornes reste jouable ; mêmes réglages = même son', () => {
    const fou = {
      type: 'kick',
      hauteur: 1e6,
      depart: -5,
      chute: Number.NaN,
      duree: 99,
      claquement: 7,
      saturation: -1,
    } as const;
    const c = fabriquerSon(fou).canaux[0]!;
    expect(c.every(Number.isFinite)).toBe(true);
    expect(c.length).toBe(2 * 48000);
    expect(fabriquerSon(kickParDefaut()).canaux[0]).toEqual(fabriquerSon(kickParDefaut()).canaux[0]);
  }, 60_000);
});

describe('bruitages sfxr', () => {
  it('chaque catégorie : même graine = même recette, autre graine = autre recette ; un son de 5 s au plus', () => {
    for (const cat of CATEGORIES_SFXR) {
      const a = sfxrAuHasard(cat, 42);
      expect(sfxrAuHasard(cat, 42), cat).toEqual(a);
      expect(sfxrAuHasard(cat, 43), cat).not.toEqual(a);
      for (const g of [1, 2, 3, 99, 2 ** 31 - 1]) {
        const c = fabriquerSon(sfxrAuHasard(cat, g)).canaux[0]!;
        expect(c.length, `${cat} ${g}`).toBeGreaterThan(400);
        expect(c.length).toBeLessThanOrEqual(5 * 48000 + 1);
        expect(c.every(Number.isFinite)).toBe(true);
        expect(crete([c])).toBeGreaterThan(0.5);
        expect(crete([c])).toBeLessThanOrEqual(0.8901);
      }
    }
  }, 60_000);

  it('la recette passe le normaliseur sans changement (son importé, kick et sfxr)', () => {
    const recettes: RecetteSon[] = [kickParDefaut(), ...CATEGORIES_SFXR.map((c) => sfxrAuHasard(c, 1234))];
    const m = nouveauMorceau('trap');
    m.sons = recettes.map((recette, i) => ({
      id: `s${i}`,
      nom: `Son ${i}`,
      fichier: `son-s${i}.f32`,
      frequence: 48000,
      duree: 0.5,
      canaux: 1 as const,
      recette,
    }));
    const r = normaliserMorceau(JSON.parse(JSON.stringify(m)));
    expect(r.problemes).toEqual([]);
    expect(JSON.parse(JSON.stringify(r.morceau.sons!.map((s) => s.recette)))).toEqual(
      JSON.parse(JSON.stringify(recettes)),
    );
  }, 60_000);
});

describe('enregistrerSonFabrique', () => {
  beforeEach(() => {
    installerNavigateur(vi.stubGlobal);
    // Décodeur simulé : lit VRAIMENT le WAV flottant écrit par wavDe (en-tête + données).
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        constructor(_c: number, _n: number, public sampleRate: number) {} // prettier-ignore
        async decodeAudioData(b: ArrayBuffer) {
          const t = lireWav(new Uint8Array(b), b.byteLength)!;
          const d = new Float32Array(b.slice(t.donnees), 0, t.trames);
          return { length: t.trames, sampleRate: t.frequence, numberOfChannels: 1, getChannelData: () => d };
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('un WAV 32 bits flottants lisible, puis un son importé qui garde sa recette', async () => {
    const recette = kickParDefaut();
    const pcm = fabriquerSon(recette);
    const w = wavDe(pcm);
    const t = lireWav(w, w.length)!;
    expect([t.format, t.canaux, t.frequence, t.trames]).toEqual([3, 1, 48000, pcm.canaux[0]!.length]);
    const son = await enregistrerSonFabrique(recette, '  Mon kick  ', nouveauMorceau('trap'));
    expect(son.nom).toBe('Mon kick');
    expect(son.recette).toEqual(recette);
    expect(son.canaux).toBe(1);
    expect(son.duree).toBeCloseTo(0.7, 3);
  }, 60_000);
});
