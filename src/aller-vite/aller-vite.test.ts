// Boucles OCKA (toujours dans la gamme) et idée au hasard (reproductible avec la même graine).
import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from '../morceau/normaliser';
import { nouveauMorceau, REGLAGES_STYLE, suitesAccords } from '../morceau/styles';
import { demiTonsDegre, hauteurTonique, TONIQUES } from '../morceau/theorie';
import { STYLES, type Morceau, type MotifMelodie } from '../morceau/types';
import { boucles, TYPES_BOUCLES } from './boucles';
import { autreIdeeMelodie, ideeAuHasard, poserMelodie, varierMelodie } from './hasard';

const gamme = (m: Morceau) => {
  const t = hauteurTonique(m.tonalite.tonique);
  return new Set(Array.from({ length: 7 }, (_, d) => (t + demiTonsDegre(m.tonalite.mode, d)) % 12));
};
const horsGamme = (m: Morceau, motif: MotifMelodie) => motif.notes.filter((n) => !gamme(m).has(n.midi % 12));

describe('Boucles OCKA', () => {
  for (const s of STYLES) {
    it(`${s} : 6 boucles de types différents, dans la gamme, pour les 12 toniques et les 3 suites`, () => {
      for (const tonique of TONIQUES) {
        for (const suite of suitesAccords(s)) {
          const m: Morceau = { ...nouveauMorceau(s), tonalite: { tonique, mode: REGLAGES_STYLE[s].mode } };
          m.motifs.accords = suite.motif;
          const liste = boucles(m, 'refrain');
          expect(liste).toHaveLength(6);
          expect(new Set(liste.map((b) => b.type)).size).toBe(6);
          for (const b of liste) {
            expect(b.motif.notes.length, `${s} ${b.type}`).toBeGreaterThan(3);
            expect(horsGamme(m, b.motif), `${s} ${tonique} ${suite.nom} ${b.type}`).toEqual([]);
            for (const n of b.motif.notes) expect(n.pas + n.duree).toBeLessThanOrEqual(b.motif.pas);
          }
        }
      }
    });
  }
  it('une boucle posée donne un morceau valide (normaliseur sans problème), en une seule opération', () => {
    const m = nouveauMorceau('pop');
    for (const b of boucles(m, 'couplet')) {
      const avec = poserMelodie(m, 'couplet', b.motif);
      expect(avec).not.toBe(m);
      expect(m.sections.find((x) => x.id === 'couplet')!.motifs.melodie).toBeUndefined(); // l'original ne bouge pas
      const r = normaliserMorceau(avec);
      expect(r.problemes).toEqual([]);
      const id = avec.sections.find((x) => x.id === 'couplet')!.motifs.melodie!;
      expect(r.morceau.motifs[id]).toEqual(b.motif);
      expect(poserMelodie(avec, 'couplet', b.motif)).toBe(avec); // même boucle : rien ne change
    }
  });
  it('mêmes accords → mêmes boucles ; les boucles suivent les accords de la section', () => {
    const m = nouveauMorceau('trap');
    expect(boucles(m, 'refrain')).toEqual(boucles(m, 'refrain'));
    const autre = { ...m, motifs: { ...m.motifs, accords: suitesAccords('trap')[1]!.motif } };
    expect(boucles(autre, 'refrain')[0]!.motif).not.toEqual(boucles(m, 'refrain')[0]!.motif);
    expect(TYPES_BOUCLES).toHaveLength(6);
  });
});

describe('Idée au hasard', () => {
  it('même graine → exactement la même idée ; autre graine → autre idée', () => {
    for (const g of [1, 42, 123456789]) expect(ideeAuHasard(g)).toEqual(ideeAuHasard(g));
    const idees = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((g) => JSON.stringify(ideeAuHasard(g).morceau)));
    expect(idees.size).toBe(8);
  });
  it('tempo dans la plage du style, morceau valide, mélodie dans la gamme', () => {
    const vus = new Set<string>();
    for (let g = 0; g < 60; g++) {
      const i = ideeAuHasard(g);
      vus.add(i.style);
      const [bas, haut] = REGLAGES_STYLE[i.style].plage;
      expect(i.tempo).toBeGreaterThanOrEqual(bas);
      expect(i.tempo).toBeLessThanOrEqual(haut);
      expect(i.morceau.tempo).toBe(i.tempo);
      expect(i.morceau.tonalite).toEqual({ tonique: i.tonique, mode: REGLAGES_STYLE[i.style].mode });
      const r = normaliserMorceau(i.morceau);
      expect(r.problemes, `graine ${g}`).toEqual([]);
      const mels = Object.values(i.morceau.motifs).filter((x): x is MotifMelodie => x.type === 'melodie');
      expect(mels.length).toBeGreaterThan(0);
      for (const mel of mels) expect(horsGamme(i.morceau, mel)).toEqual([]);
    }
    expect(vus.size).toBe(6);
  });
  it('style imposé : il est gardé', () => {
    for (const s of STYLES) expect(ideeAuHasard(9, s).style).toBe(s);
  });
  it('« Une autre idée » (mélodie) : reproductible, dans la gamme, et autre chose que l’originale', () => {
    const m = ideeAuHasard(5, 'lofi').morceau;
    const id = m.sections.find((s) => s.id === 'refrain')!.motifs.melodie!;
    const motif = m.motifs[id] as MotifMelodie;
    const a = varierMelodie(motif, 77, m);
    expect(a).toEqual(varierMelodie(motif, 77, m));
    expect(horsGamme(m, a)).toEqual([]);
    const differentes = [1, 2, 3, 4, 5].filter((g) => JSON.stringify(varierMelodie(motif, g, m)) !== JSON.stringify(motif));
    expect(differentes.length).toBeGreaterThan(3);
    // Section sans mélodie : une boucle tirée au hasard.
    const vide = autreIdeeMelodie(m, 'couplet', 3);
    expect(vide.notes.length).toBeGreaterThan(0);
    expect(autreIdeeMelodie(m, 'couplet', 3)).toEqual(vide);
    expect(normaliserMorceau(poserMelodie(m, 'couplet', vide)).problemes).toEqual([]);
  });
});
