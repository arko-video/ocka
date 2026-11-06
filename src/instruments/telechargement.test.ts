// Téléchargement à la demande (fetch et Cache Storage simulés) : progression, taille vérifiée, annulation,
// hors réseau, lecture depuis le cache, et l'écran « Gérer les instruments » (liste, place, suppression).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_INSTRUMENTS, oublierCatalogue, urlInstruments } from './catalogue';
import { listerTelecharges, placeInstruments, supprimerInstrument, estTelecharge } from './gestion';
import { assurerInstruments, depuisCache, ouvrirInstrument } from './telechargement';

const BASE = 'http://localhost';
const abs = (u: string) => new URL(u, BASE).href;

class FauxCache {
  donnees = new Map<string, Response>();
  async match(r: string | { url: string }) {
    return this.donnees.get(abs(typeof r === 'string' ? r : r.url))?.clone();
  }
  async put(r: string, rep: Response) {
    this.donnees.set(abs(r), rep);
  }
  async keys() {
    return [...this.donnees.keys()].map((url) => ({ url }));
  }
  async delete(r: { url: string }) {
    return this.donnees.delete(abs(r.url));
  }
}

const ogg = (n: number) => new Uint8Array([0x4f, 0x67, 0x67, 0x53, ...new Array(n).fill(7)]);
const SHA = 'b'.repeat(64);
const instrument = {
  id: 'test-orgue@1',
  nom: 'Orgue de test',
  famille: 'Claviers',
  licence: { nom: 'CC0-1.0', url: 'https://exemple.org', auteur: 'Personne', sha256: [SHA] },
  canaux: 1,
  gainDb: 0,
  relache: 0.2,
  budgetS: 2,
  zones: [
    { fichier: 'z060-v1.ogg', racine: 60, cents: 0, bas: 59, haut: 61, velBas: 1, velHaut: 127, gainDb: 0, debut: 0, fin: 48000 },
    { fichier: 'z063-v1.ogg', racine: 63, cents: 0, bas: 62, haut: 64, velBas: 1, velHaut: 127, gainDb: 0, debut: 0, fin: 48000 },
  ],
};
let fichiers: Map<string, Uint8Array>;
let cache: FauxCache;
let reseauCoupe: boolean;

function preparer(tailleCatalogue?: number) {
  const json = new TextEncoder().encode(JSON.stringify(instrument));
  fichiers = new Map([
    [abs(urlInstruments('test-orgue/instrument.json')), json],
    [abs(urlInstruments('test-orgue/z060-v1.ogg')), ogg(3000)],
    [abs(urlInstruments('test-orgue/z063-v1.ogg')), ogg(5000)],
  ]);
  const taille = [...fichiers.values()].reduce((s, f) => s + f.byteLength, 0);
  const catalogue = {
    format: 'ocka.instruments/1',
    instruments: [{ id: 'test-orgue@1', nom: 'Orgue de test', famille: 'Claviers', taille: tailleCatalogue ?? taille, dureeS: 2, licence: 'CC0-1.0' }],
  };
  fichiers.set(abs(urlInstruments('catalogue.json')), new TextEncoder().encode(JSON.stringify(catalogue)));
  return taille;
}

beforeEach(() => {
  oublierCatalogue();
  cache = new FauxCache();
  reseauCoupe = false;
  vi.stubGlobal('caches', { open: async (nom: string) => (expect(nom).toBe(CACHE_INSTRUMENTS), cache) });
  vi.stubGlobal('fetch', async (url: string, init?: { signal?: AbortSignal }) => {
    if (init?.signal?.aborted) throw new DOMException('Annulé', 'AbortError');
    if (reseauCoupe) throw new TypeError('Failed to fetch');
    const f = fichiers.get(abs(url));
    return f ? new Response(f.slice(), { headers: { 'Content-Length': String(f.byteLength) } }) : new Response('', { status: 404 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('téléchargement d’un instrument', () => {
  it('télécharge, montre la progression jusqu’au bout, range dans le cache, puis relit hors ligne', async () => {
    const taille = preparer();
    const etapes: number[] = [];
    const pret = await ouvrirInstrument('test-orgue@1', { progression: (p) => etapes.push(p.faits / p.total) });
    expect(pret.taille).toBe(taille);
    expect(etapes[0]).toBe(0);
    expect(etapes[etapes.length - 1]).toBe(1);
    expect([...etapes].sort((a, b) => a - b)).toEqual(etapes);
    expect(new Uint8Array(await pret.lire('z063-v1.ogg')).byteLength).toBe(5004);
    await expect(pret.lire('../secret.ogg')).rejects.toMatchObject({ code: 'instrument_invalide' });
    reseauCoupe = true;
    const garde = await depuisCache('test-orgue@1');
    expect(garde?.instrument.nom).toBe('Orgue de test');
    expect(await estTelecharge('test-orgue@1')).toBe(true);
  });

  it('refuse une taille différente du catalogue et ne garde rien', async () => {
    preparer(1234);
    await expect(ouvrirInstrument('test-orgue@1')).rejects.toMatchObject({ code: 'instrument_invalide' });
    expect(cache.donnees.size).toBe(1); // seul le catalogue est gardé
    expect(await estTelecharge('test-orgue@1')).toBe(false);
  });

  it('refuse un fichier qui n’est pas de l’Ogg', async () => {
    preparer();
    fichiers.set(abs(urlInstruments('test-orgue/z060-v1.ogg')), new Uint8Array(3004));
    await expect(ouvrirInstrument('test-orgue@1')).rejects.toMatchObject({ code: 'instrument_invalide' });
  });

  it('hors réseau : erreur claire qui nomme l’instrument', async () => {
    preparer();
    await ouvrirInstrument('test-orgue@1').catch(() => undefined); // le catalogue est vu une fois
    await supprimerInstrument('test-orgue@1');
    reseauCoupe = true;
    await expect(assurerInstruments(['test-orgue@1'])).rejects.toMatchObject({
      code: 'hors_ligne',
      message: expect.stringContaining('Orgue de test'),
    });
  });

  it('annulation : « annule », rien de gardé', async () => {
    preparer();
    const c = new AbortController();
    c.abort();
    await expect(ouvrirInstrument('test-orgue@1', { signal: c.signal })).rejects.toMatchObject({ code: 'annule' });
    expect(await estTelecharge('test-orgue@1')).toBe(false);
  });

  it('instrument inconnu du catalogue', async () => {
    preparer();
    await expect(ouvrirInstrument('autre-chose@1')).rejects.toMatchObject({ code: 'instrument_introuvable' });
  });
});

describe('gérer les instruments', () => {
  it('liste, place prise et suppression', async () => {
    const taille = preparer();
    await ouvrirInstrument('test-orgue@1');
    expect(await listerTelecharges()).toEqual([
      { id: 'test-orgue@1', nom: 'Orgue de test', famille: 'Claviers', taille, complet: true },
    ]);
    expect(await placeInstruments()).toBe(taille);
    await supprimerInstrument('test-orgue@1');
    expect(await listerTelecharges()).toEqual([]);
    expect(await placeInstruments()).toBe(0);
  });
});
