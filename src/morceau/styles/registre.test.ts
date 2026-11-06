// Registre des styles (contrat C2) : chaque id de STYLES a sa définition complète et cohérente ; les 6 styles des
// phases 0 à 6 n'ont pas bougé en passant dans le registre (empreintes du morceau neuf et de son planning).
import { describe, expect, it } from 'vitest';
import { calculerPlanning } from '../../moteur/planning';
import { GENRES } from '../../textes/sortie';
import { TYPES_BOUCLES } from '../../aller-vite/boucles';
import { estIdFixe } from '../acces';
import { normaliserMorceau } from '../normaliser';
import { nouveauMorceau } from '../styles';
import { lireDegre } from '../theorie';
import { REGLE_ID, REGLE_INSTRUMENT, STYLES, type Style } from '../types';
import { DEFINITIONS_STYLES, definitionStyle, estStyle, FAMILLES_STYLES, fillStyle, reglages808, reglagesKit, ROLES_INSTRUMENT, stylesDeFamille, varianteStyle } from './index';

function fnv(texte: string): string {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
}

/**
 * Empreintes (morceau JSON, planning arrondi au µs) des 6 styles d'avant C2. trap, drill, lofi : celles de
 * styles-vague-b.test.ts ; phonk, pop, boom bap : relevées à l'intégration C2, après avoir vérifié que leur
 * morceau neuf est ÉGAL à celui d'OCKA v1 migré en /3 (references-v1/<style>.json).
 */
const AVANT: Record<string, [string, string]> = {
  trap: ['4fb6e255', 'e8f8999f'],
  drill: ['746872ed', '9bd6e8cc'],
  lofi: ['d4c0190d', 'd6dd9420'], // intégration C3 : piste mélodie sur le Rhodes (morceau seulement ; planning inchangé)
  phonk: ['5a405091', '64c6734'],
  pop: ['5d7760b6', '24cbdd05'],
  boombap: ['b107bc6a', '64e7fd06'],
};

describe('registre des styles', () => {
  it('chaque style de STYLES a sa définition, sous son id, et rien de plus', () => {
    expect(Object.keys(DEFINITIONS_STYLES).sort()).toEqual([...STYLES].sort());
    for (const s of STYLES) expect(DEFINITIONS_STYLES[s].id).toBe(s);
    expect(estStyle('rage')).toBe(true);
    expect(estStyle('__proto__')).toBe(false);
    expect(definitionStyle('inconnu').id).toBe('trap');
  });
  it('familles : chaque style en a une, chaque famille a au moins un style', () => {
    for (const f of FAMILLES_STYLES) expect(stylesDeFamille(f).length, f).toBeGreaterThan(0);
    expect(FAMILLES_STYLES.reduce((n, f) => n + stylesDeFamille(f).length, 0)).toBe(STYLES.length);
  });
  for (const s of STYLES) {
    it(`${s} : définition complète et cohérente`, () => {
      const d = DEFINITIONS_STYLES[s];
      const r = d.reglages;
      expect(d.textes.nom.length).toBeGreaterThan(0);
      expect(d.textes.nom.length).toBeLessThanOrEqual(20);
      expect(d.textes.phrase.length).toBeGreaterThan(10);
      expect(Object.keys(GENRES), d.genre).toContain(d.genre);
      expect(r.plage[0]).toBeLessThanOrEqual(r.tempo);
      expect(r.tempo).toBeLessThanOrEqual(r.plage[1]);
      expect(r.plage[0]).toBeGreaterThanOrEqual(60);
      expect(r.plage[1]).toBeLessThanOrEqual(200);
      expect(r.swing).toBeGreaterThanOrEqual(0);
      expect(r.swing).toBeLessThanOrEqual(0.6);
      expect(r.kit).toBe(`${s}@1`);
      expect(d.son.kits[r.kit], 'le kit <id>@1 est défini par le style').toBeDefined();
      expect(reglagesKit(r.kit)).toBe(d.son.kits[r.kit]);
      expect(d.suites).toHaveLength(3);
      for (const suite of d.suites) for (const g of suite.degres) expect(lireDegre(g), `${s} ${g}`).not.toBeNull();
      expect(d.boucles.map(([t]) => t).sort()).toEqual([...TYPES_BOUCLES].sort());
      const ids = d.instrumentsParDefaut.map((i) => i.id);
      expect(ids[0], 'la 1re piste instrument est « melodie »').toBe('melodie');
      expect(new Set(ids).size).toBe(ids.length);
      for (const i of d.instrumentsParDefaut) {
        expect(REGLE_ID.test(i.id) && !estIdFixe(i.id), i.id).toBe(true);
        expect(REGLE_INSTRUMENT.test(i.instrument), i.instrument).toBe(true);
        expect(ROLES_INSTRUMENT).toContain(i.role);
        expect(i.nom.length).toBeLessThanOrEqual(40);
      }
      const m = nouveauMorceau(s);
      expect(m.pistes.filter((p) => p.genre === 'instrument').map((p) => p.id)).toEqual(ids);
      expect(normaliserMorceau(m).problemes).toEqual([]);
    });
  }
  it('les 6 styles d’avant C2 : même morceau neuf et même planning', () => {
    for (const s of Object.keys(AVANT) as Style[]) {
      const m = nouveauMorceau(s);
      const p = calculerPlanning(m).map((e) => [e.type, Math.round(e.t * 1e6), 'vel' in e ? Math.round(e.vel * 1e6) : 0, 'midi' in e ? e.midi : 0]);
      expect([fnv(JSON.stringify(m)), fnv(JSON.stringify(p))], s).toEqual(AVANT[s]);
    }
  });
  it('son lu par le moteur : replis (kit, 808, fill) et variantes', () => {
    expect(reglagesKit('drill@9')).toBe(reglagesKit('drill@1'));
    expect(reglagesKit('inconnu@3')).toBe(reglagesKit('trap@1'));
    expect(reglages808('inconnu')).toBe(reglages808('trap'));
    expect(fillStyle('drill')).toBe(fillStyle('trap'));
    expect(fillStyle('boombap')).toHaveLength(3);
    expect([varianteStyle('lofi', 'epiano'), varianteStyle('phonk', 'cloche'), varianteStyle('trap', 'cloche')]).toEqual(['lofi', 'cowbell', '']);
    expect(varianteStyle('lofi', '__proto__')).toBe('');
  });
});
