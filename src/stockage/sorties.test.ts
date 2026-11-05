import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nouveauMorceau } from '../morceau/styles';
import type { Morceau } from '../morceau/types';
import { sortiePrete } from '../sortie/aides-test';
import { ecrireReglages, lireReglages } from './reglages';
import { listerSorties, menagePochettes, nouvelleSortie, ouvrirSortie, retirerMorceauDesSorties, sauverSortie, sortieNeuve, supprimerSortie } from './sorties';

// IndexedDB simulée : une Map par base (createStore renvoie le nom de la base).
const { bases, morceaux } = vi.hoisted(() => ({ bases: new Map<string, Map<unknown, unknown>>(), morceaux: new Map<string, unknown>() }));
vi.mock('idb-keyval', () => {
  const b = (s: { nom: string }) => {
    if (!bases.has(s.nom)) bases.set(s.nom, new Map());
    return bases.get(s.nom)!;
  };
  const copie = (v: unknown) => (v instanceof Blob || v === undefined ? v : structuredClone(v));
  return {
    createStore: (nom: string) => ({ nom }),
    get: async (k: unknown, s: { nom: string }) => copie(b(s).get(k)),
    set: async (k: unknown, v: unknown, s: { nom: string }) => void b(s).set(k, copie(v)),
    del: async (k: unknown, s: { nom: string }) => void b(s).delete(k),
    update: async (k: unknown, f: (v: unknown) => unknown, s: { nom: string }) => void b(s).set(k, copie(f(b(s).get(k)))),
    entries: async (s: { nom: string }) => [...b(s).entries()],
    values: async (s: { nom: string }) => [...b(s).values()],
    keys: async (s: { nom: string }) => [...b(s).keys()],
  };
});
// Les morceaux (A2) : simulés.
vi.mock('./morceaux', () => ({
  listerMorceaux: async () => [...morceaux.entries()].map(([id, m]) => ({ id, titre: (m as Morceau).titre, style: 'trap', duree: 100, modifieLe: 1 })),
  ouvrirMorceau: async (id: string) => (morceaux.get(id) as Morceau | undefined) ?? null,
}));

const MAINTENANT = Date.UTC(2026, 10, 4, 12);
const base = (nom: string) => bases.get(nom) ?? new Map();

beforeEach(() => {
  bases.clear();
  morceaux.clear();
  vi.useFakeTimers();
  vi.setSystemTime(MAINTENANT);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('nouvelleSortie', () => {
  it('sans morceau : date = aujourd’hui + 6 semaines, artiste, lien et distributeur des réglages, label = artiste', async () => {
    await ecrireReglages({ artiste: 'Kalo', distributeur: 'distrokid', lienProfil: 'https://open.spotify.com/artist/x', vraiNom: 'Romain Dupont' });
    const s = await nouvelleSortie();
    expect(s).toMatchObject({ dateSortie: '2026-12-16', artiste: 'Kalo', label: 'Kalo', distributeur: 'distrokid', lienProfil: 'https://open.spotify.com/artist/x', titres: [], niveau: 'standard', modifieLe: MAINTENANT });
    expect(s.id).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
    expect(await ouvrirSortie(s.id)).toEqual(s);
  });
  it('depuis un morceau : un titre, son nom, son genre ; morceau absent → morceau_introuvable', async () => {
    const pop = nouveauMorceau('pop', 'Soleil');
    pop.master.niveau = 'fort';
    morceaux.set('m1', pop);
    const s = await nouvelleSortie('m1');
    expect(s).toMatchObject({ titre: 'Soleil', titres: ['m1'], genre: 'Pop', niveau: 'fort', distributeur: 'routenote', artiste: '' });
    expect(s.label).toBeUndefined();
    await expect(nouvelleSortie('inconnu')).rejects.toMatchObject({ code: 'morceau_introuvable' });
    await expect(nouvelleSortie('../x')).rejects.toMatchObject({ code: 'morceau_introuvable' });
  });
  it('sortieNeuve (pure) : l’artiste du morceau sert si les réglages n’en ont pas', () => {
    const m = nouveauMorceau('trap', 'Nuit');
    m.artiste = 'Lou';
    expect(sortieNeuve({}, m, 'm1', 'id1', MAINTENANT)).toMatchObject({ artiste: 'Lou', label: 'Lou', genre: 'Hip-Hop/Rap', dateSortie: '2026-12-16' });
  });
});

describe('retirerMorceauDesSorties', () => {
  it('retire le morceau de TOUTES ses sorties, sans toucher aux autres', async () => {
    await sauverSortie(sortiePrete(['m1', 'm2'], { id: 'a' }));
    await sauverSortie(sortiePrete(['m2', 'm1'], { id: 'b' }));
    await sauverSortie(sortiePrete(['m3'], { id: 'c' }));
    vi.setSystemTime(MAINTENANT + 5000);
    await retirerMorceauDesSorties('m1');
    const lire = (id: string) => base('ocka-sorties').get(id) as { titres: string[]; modifieLe: number };
    expect(lire('a').titres).toEqual(['m2']);
    expect(lire('b').titres).toEqual(['m2']);
    expect(lire('a').modifieLe).toBe(MAINTENANT + 5000);
    expect(lire('c')).toMatchObject({ titres: ['m3'], modifieLe: MAINTENANT });
  });
});

describe('lister, ouvrir, sauver, supprimer', () => {
  it('listerSorties : résumé (titres encore présents, durée, type), le plus récent d’abord', async () => {
    morceaux.set('m1', nouveauMorceau('trap', 'A'));
    morceaux.set('m2', nouveauMorceau('trap', 'B'));
    await sauverSortie(sortiePrete(['m1', 'mort', 'm2'], { id: 'vieille' }));
    vi.setSystemTime(MAINTENANT + 1000);
    await sauverSortie(sortiePrete(['m1'], { id: 'neuve', titre: 'Neuve' }));
    const l = await listerSorties();
    expect(l.map((r) => r.id)).toEqual(['neuve', 'vieille']);
    expect(l[1]).toMatchObject({ nbTitres: 2, duree: 200, type: 'single', pochette: 'pochette-abc123-xyz' });
  });
  it('ouvrirSortie retire les titres morts ; format plus récent → sortie_illisible ; id hostile → null', async () => {
    morceaux.set('m1', nouveauMorceau('trap', 'A'));
    await sauverSortie(sortiePrete(['m1', 'mort'], { id: 's1' }));
    expect((await ouvrirSortie('s1'))!.titres).toEqual(['m1']);
    base('ocka-sorties').set('s2', { ...sortiePrete([]), id: 's2', format: 'ocka.sortie/9' });
    await expect(ouvrirSortie('s2')).rejects.toMatchObject({ code: 'sortie_illisible' });
    expect(await ouvrirSortie('__proto__')).toBeNull();
    expect(await ouvrirSortie('absente')).toBeNull();
  });
  it('sauverSortie normalise (label « N/A » retiré) et date la modification', async () => {
    const s = await sauverSortie(sortiePrete([], { label: 'N/A', modifieLe: 3 }));
    expect(s.label).toBeUndefined();
    expect(s.modifieLe).toBe(MAINTENANT);
    await supprimerSortie(s.id);
    expect(base('ocka-sorties').has(s.id)).toBe(false);
  });
});

describe('réglages', () => {
  it('fusion, valeur vide = effacée, lien illisible retiré', async () => {
    expect(await lireReglages()).toEqual({});
    await ecrireReglages({ vraiNom: ' Romain Dupont ', artiste: 'Kalo' });
    expect(await ecrireReglages({ artiste: '', lienProfil: 'javascript:alert(1)' })).toEqual({ vraiNom: 'Romain Dupont' });
    expect(await lireReglages()).toEqual({ vraiNom: 'Romain Dupont' });
  });
});

describe('ramasse-miettes des pochettes', () => {
  it('sous le verrou « ocka-menage » : efface les pochettes inutilisées de plus d’une heure', async () => {
    const verrous: string[] = [];
    vi.stubGlobal('navigator', {
      locks: { request: async (nom: string, _o: unknown, f: (v: unknown) => unknown) => (verrous.push(nom), f({ name: nom })) },
    });
    const vieille = `pochette-${(MAINTENANT - 7200_000).toString(36)}-aaaaaa`;
    const recente = `pochette-${(MAINTENANT - 60_000).toString(36)}-bbbbbb`;
    const utilisee = `pochette-${(MAINTENANT - 7200_000).toString(36)}-cccccc`;
    const p = base('ocka-pochettes');
    bases.set('ocka-pochettes', p);
    for (const k of [vieille, recente, utilisee]) p.set(k, new Blob(['x']));
    await sauverSortie(sortiePrete([], { pochette: utilisee }));
    expect(await menagePochettes(true)).toBe(1);
    expect(verrous).toEqual(['ocka-menage']);
    expect([...p.keys()]).toEqual([recente, utilisee]);
  });
});
