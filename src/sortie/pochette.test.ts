import { describe, expect, it } from 'vitest';
import { hasard } from './modeles-pochette';
import { cadrage, heureDeCle, nouvelleCle } from './pochette';
import { REGLE_CLE_POCHETTE } from '../morceau/types';

describe('pochette (parties pures)', () => {
  it('cadrage : carré du plus petit côté, centré sur `centre`, sans sortir de l’image', () => {
    expect(cadrage(4000, 3000, { x: 0.5, y: 0.5 })).toEqual({ sx: 500, sy: 0, cote: 3000 });
    expect(cadrage(4000, 3000, { x: 0, y: 0.5 })).toEqual({ sx: 0, sy: 0, cote: 3000 });
    expect(cadrage(4000, 3000, { x: 1, y: 0.5 })).toEqual({ sx: 1000, sy: 0, cote: 3000 });
    expect(cadrage(1500, 2000, { x: 0.5, y: 0.25 })).toEqual({ sx: 0, sy: 0, cote: 1500 });
    expect(cadrage(1500, 2000, { x: Number.NaN, y: 0.7 })).toEqual({ sx: 0, sy: 500, cote: 1500 }); // 0,7 × 2000 − 750 = 650 → borné à 500
  });
  it('clé : au format d’OCKA, avec l’heure de création lisible (ramasse-miettes)', () => {
    const c = nouvelleCle(1_793_800_000_000);
    expect(c).toMatch(REGLE_CLE_POCHETTE);
    expect(heureDeCle(c)).toBe(1_793_800_000_000);
    expect(heureDeCle('pochette-importee')).toBeNull();
  });
  it('couleurs tirées d’une graine : même graine = même suite', () => {
    const a = hasard(42);
    const b = hasard(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hasard(43)()).not.toBe(hasard(42)());
  });
});
