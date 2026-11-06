import { describe, expect, it } from 'vitest';
import { pisteDe } from '../../morceau/acces';
import type { Insert, Morceau } from '../../morceau/types';
import { poserPoint, reglerLfo } from './automation';
import { base, propre } from './exemple-u2';
import {
  ajouterInsert,
  appliquerPresetInserts,
  deplacerInsert,
  nombreEffets,
  reglerInsert,
  reglerSidechain,
  reglerTranche,
  retirerInsert,
} from './mixage';

const inserts = (m: Morceau, id = 'basse') => pisteDe(m, id)?.inserts ?? [];

describe('tranche', () => {
  it('borne volume et pan, même objet si rien ne change', () => {
    const m0 = base();
    const m = reglerTranche(m0, 'basse', { volume: 3, pan: -2, muet: true });
    expect(pisteDe(m, 'basse')).toMatchObject({ volume: 1.5, pan: -1, muet: true });
    expect(reglerTranche(m, 'basse', { volume: 1.5 })).toBe(m);
    expect(reglerTranche(m0, 'inconnue', { volume: 0.2 })).toBe(m0);
    expect(m0.pistes.find((p) => p.id === 'basse')!.muet).toBe(false);
    propre(m);
  });
});

describe('inserts', () => {
  it('ajoute avec des ids uniques, au plus 6', () => {
    let m = base();
    for (let i = 0; i < 8; i++) m = ajouterInsert(m, 'basse', 'saturation');
    expect(inserts(m).map((x) => x.id)).toEqual(['saturation', 'saturation-2', 'saturation-3', 'saturation-4', 'saturation-5', 'saturation-6']);
    expect(inserts(m)[0]).toMatchObject({ type: 'saturation', actif: true });
    expect(nombreEffets(pisteDe(m, 'basse')!)).toBe(6);
    expect(Object.getPrototypeOf(inserts(m)[0]!.params)).toBeNull();
    propre(m);
  });

  it('retire un effet avec ses courbes et LFO', () => {
    let m = ajouterInsert(ajouterInsert(base(), 'basse', 'filtre'), 'basse', 'eq');
    const cible = { type: 'insert', insert: 'filtre', param: 'frequence' } as const;
    m = poserPoint(m, 'basse', cible, 'couplet', { pas: 0, valeur: 0.2 });
    m = poserPoint(m, 'basse', { type: 'volume' }, 'couplet', { pas: 0, valeur: 0.5 });
    m = reglerLfo(m, 'basse', 0, { cible, forme: 'sinus', periode: 16, profondeur: 0.5, phase: 0 });
    const r = retirerInsert(m, 'basse', 'filtre');
    expect(inserts(r).map((x) => x.id)).toEqual(['eq']);
    expect(pisteDe(r, 'basse')!.auto!.map((c) => c.cible.type)).toEqual(['volume']);
    expect(pisteDe(r, 'basse')!.lfo).toBeUndefined();
    expect(retirerInsert(r, 'basse', 'filtre')).toBe(r);
    propre(r);
    const vide = retirerInsert(r, 'basse', 'eq');
    expect(pisteDe(vide, 'basse')!.inserts).toBeUndefined();
    propre(vide);
  });

  it('réordonne avec les flèches', () => {
    let m = base();
    for (const t of ['eq', 'saturation', 'compresseur'] as const) m = ajouterInsert(m, 'accords', t);
    m = deplacerInsert(m, 'accords', 'compresseur', -1);
    expect(inserts(m, 'accords').map((x) => x.id)).toEqual(['eq', 'compresseur', 'saturation']);
    expect(deplacerInsert(m, 'accords', 'eq', -1)).toBe(m);
    expect(deplacerInsert(m, 'accords', 'saturation', 1)).toBe(m);
    propre(m);
  });

  it('règle actif et paramètres, bornés, clés inconnues ignorées', () => {
    let m = ajouterInsert(base(), 'basse', 'bitcrusher');
    m = reglerInsert(m, 'basse', 'bitcrusher', { actif: false, params: { bits: 3.6, reduction: 99, inconnu: 4 } });
    const x = inserts(m)[0]!;
    expect(x.actif).toBe(false);
    expect({ ...x.params }).toMatchObject({ bits: 4, reduction: 32 });
    expect(Object.hasOwn(x.params, 'inconnu')).toBe(false);
    expect(reglerInsert(m, 'basse', 'bitcrusher', { params: { bits: 4 } })).toBe(m);
    expect(reglerInsert(m, 'basse', 'absent', { actif: true })).toBe(m);
    propre(m);
  });

  it('applique un préréglage (ids uniques, 6 au plus, réglages bornés)', () => {
    const p = (id: string, type: Insert['type'], params: Record<string, number> = {}): Insert => ({ id, type, actif: true, params });
    const preset = [p('a', 'eq'), p('a', 'saturation', { force: 7 }), p('', 'filtre'), p('b', 'chorus'), p('c', 'phaser'), p('d', 'flanger'), p('e', 'eq')];
    const m = appliquerPresetInserts(base(), 'voix', preset);
    const l = inserts(m, 'voix');
    expect(l).toHaveLength(6);
    expect(new Set(l.map((x) => x.id)).size).toBe(6);
    expect(l[1]!.params.force).toBe(1);
    expect(appliquerPresetInserts(m, 'voix', l)).toBe(m);
    propre(m);
  });
});

describe('sidechain', () => {
  it('pompe : pose bornée, retire, même objet', () => {
    const m0 = base();
    const m = reglerSidechain(m0, 'accords', { source: 'kick', force: 2, relache: 0 });
    expect(pisteDe(m, 'accords')!.sidechain).toEqual({ source: 'kick', force: 1, relache: 0.02 });
    expect(reglerSidechain(m, 'accords', { source: 'kick', force: 1, relache: 0.02 })).toBe(m);
    propre(m);
    const r = reglerSidechain(m, 'accords', null);
    expect(pisteDe(r, 'accords')!.sidechain).toBeUndefined();
    expect(reglerSidechain(r, 'accords', null)).toBe(r);
    propre(r);
  });
});
