import { describe, expect, it } from 'vitest';
import { pisteDe } from '../../morceau/acces';
import type { Cible, Morceau } from '../../morceau/types';
import { ciblesPossibles, deplacerPoint, effacerCourbe, poserPoint, pointsDe, reglerLfo, retirerPoint, valeurAuPas, valeurNeutre } from './automation';
import { ajouterInsert } from './mixage';
import { base, propre } from './exemple-u2';

const VOL: Cible = { type: 'volume' };
const pts = (m: Morceau, s = 'couplet', c: Cible = VOL, p = 'basse') => pointsDe(m, p, c, s);

describe('points de courbe', () => {
  it('ajoute triés, sur la grille du 1/24, dans les bornes de la section', () => {
    let m = base();
    m = poserPoint(m, 'basse', VOL, 'couplet', { pas: 64, valeur: 0.2 });
    m = poserPoint(m, 'basse', VOL, 'couplet', { pas: 0.013, valeur: 1.4 });
    m = poserPoint(m, 'basse', VOL, 'couplet', { pas: 999, valeur: -1 });
    m = poserPoint(m, 'basse', VOL, 'couplet', { pas: 32.5, valeur: 0.33333 });
    // couplet = 8 mesures → fin au pas 128.
    expect(pts(m)).toEqual([
      { pas: 0, valeur: 1 },
      { pas: 32.5, valeur: 0.333 },
      { pas: 64, valeur: 0.2 },
      { pas: 128, valeur: 0 },
    ]);
    expect(Object.getPrototypeOf(pisteDe(m, 'basse')!.auto![0]!.sections)).toBeNull();
    propre(m);
  });

  it('remplace le point du même pas ; 64 au plus ; même objet sinon', () => {
    let m = poserPoint(base(), 'basse', VOL, 'intro', { pas: 4, valeur: 0.5 });
    m = poserPoint(m, 'basse', VOL, 'intro', { pas: 4, valeur: 0.7 });
    expect(pts(m, 'intro')).toEqual([{ pas: 4, valeur: 0.7 }]);
    expect(poserPoint(m, 'basse', VOL, 'intro', { pas: 4, valeur: 0.7 })).toBe(m);
    for (let i = 0; i < 70; i++) m = poserPoint(m, 'basse', VOL, 'intro', { pas: i * 0.5, valeur: 0.5 });
    expect(pts(m, 'intro')).toHaveLength(64);
    propre(m);
  });

  it('déplace (reste trié, refuse un pas déjà pris) et supprime', () => {
    let m = base();
    for (const [pas, valeur] of [[0, 0], [16, 0.5], [32, 1]] as const) m = poserPoint(m, 'basse', VOL, 'couplet', { pas, valeur });
    m = deplacerPoint(m, 'basse', VOL, 'couplet', 0, { pas: 40, valeur: 0.25 });
    expect(pts(m).map((p) => p.pas)).toEqual([16, 32, 40]);
    expect(deplacerPoint(m, 'basse', VOL, 'couplet', 0, { pas: 32, valeur: 0 })).toBe(m);
    expect(deplacerPoint(m, 'basse', VOL, 'couplet', 9, { pas: 1, valeur: 0 })).toBe(m);
    m = retirerPoint(m, 'basse', VOL, 'couplet', 1);
    expect(pts(m).map((p) => p.pas)).toEqual([16, 40]);
    propre(m);
    m = retirerPoint(retirerPoint(m, 'basse', VOL, 'couplet', 0), 'basse', VOL, 'couplet', 0);
    expect(pisteDe(m, 'basse')!.auto).toBeUndefined();
    propre(m);
  });

  it('cibles : hauteur refusée sur une piste fixe, insert inconnu refusé, 8 courbes au plus', () => {
    const m0 = base();
    expect(poserPoint(m0, 'basse', { type: 'hauteur' }, 'couplet', { pas: 0, valeur: 1 })).toBe(m0);
    expect(poserPoint(m0, 'basse', { type: 'insert', insert: 'x', param: 'force' }, 'couplet', { pas: 0, valeur: 1 })).toBe(m0);
    expect(poserPoint(m0, 'basse', VOL, 'nulle-part', { pas: 0, valeur: 1 })).toBe(m0);
    let m = ajouterInsert(ajouterInsert(m0, 'basse', 'eq'), 'basse', 'saturation');
    const cibles = ciblesPossibles(pisteDe(m, 'basse')!);
    expect(cibles.length).toBe(2 + 9 + 3);
    for (const c of cibles) m = poserPoint(m, 'basse', c, 'couplet', { pas: 0, valeur: 0.5 });
    expect(pisteDe(m, 'basse')!.auto).toHaveLength(8);
    propre(m);
  });

  it('efface une section ou toute la courbe', () => {
    let m = poserPoint(poserPoint(base(), 'basse', VOL, 'couplet', { pas: 0, valeur: 0 }), 'basse', VOL, 'refrain', { pas: 0, valeur: 1 });
    const une = effacerCourbe(m, 'basse', VOL, 'couplet');
    expect(pts(une)).toEqual([]);
    expect(pts(une, 'refrain')).toHaveLength(1);
    m = effacerCourbe(m, 'basse', VOL, null);
    expect(pisteDe(m, 'basse')!.auto).toBeUndefined();
    expect(effacerCourbe(m, 'basse', VOL, null)).toBe(m);
  });

  it('valeur au pas : ligne, palier, avant et après', () => {
    const p = [{ pas: 4, valeur: 0 }, { pas: 8, valeur: 1, forme: 'palier' as const }, { pas: 12, valeur: 0 }];
    expect(valeurAuPas([], 3)).toBeNull();
    expect(valeurAuPas(p, 0)).toBe(0);
    expect(valeurAuPas(p, 6)).toBe(0.5);
    expect(valeurAuPas(p, 10)).toBe(1);
    expect(valeurAuPas(p, 20)).toBe(0);
    const m = ajouterInsert(base(), 'basse', 'filtre');
    const v = valeurNeutre(pisteDe(m, 'basse')!, { type: 'insert', insert: 'filtre', param: 'frequence' });
    expect(v).toBeCloseTo(Math.log(100) / Math.log(1000), 6);
  });
});

describe('LFO', () => {
  it('règle (borné), remplace, ajoute, retire ; 2 au plus', () => {
    let m = base();
    m = reglerLfo(m, 'accords', 0, { cible: { type: 'pan' }, forme: 'triangle', periode: 0.01, profondeur: 3, phase: 0.25 });
    expect(pisteDe(m, 'accords')!.lfo).toEqual([{ cible: { type: 'pan' }, forme: 'triangle', periode: 0.25, profondeur: 1, phase: 0.25 }]);
    m = reglerLfo(m, 'accords', 1, { cible: VOL, forme: 'carre', periode: 16, profondeur: 0.5, phase: 0 });
    expect(pisteDe(m, 'accords')!.lfo).toHaveLength(2);
    m = reglerLfo(m, 'accords', 0, { cible: VOL, forme: 'scie', periode: 300, profondeur: 0.5, phase: 0 });
    expect(pisteDe(m, 'accords')!.lfo![0]).toMatchObject({ forme: 'scie', periode: 256 });
    propre(m);
    expect(reglerLfo(m, 'accords', 0, { cible: { type: 'hauteur' }, forme: 'sinus', periode: 4, profondeur: 1, phase: 0 })).toBe(m);
    m = reglerLfo(reglerLfo(m, 'accords', 0, null), 'accords', 0, null);
    expect(pisteDe(m, 'accords')!.lfo).toBeUndefined();
    expect(reglerLfo(m, 'accords', 1, null)).toBe(m);
    propre(m);
  });
});
