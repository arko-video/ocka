import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Boîte IndexedDB simulée (idb-keyval) : une Map en mémoire.
const memoire = new Map<IDBValidKey, unknown>();
vi.mock('idb-keyval', () => ({
  createStore: () => ({}),
  keys: async () => [...memoire.keys()],
  set: async (k: IDBValidKey, v: unknown) => void memoire.set(k, v),
  del: async (k: IDBValidKey) => void memoire.delete(k),
}));

const { BOITE_ARKO, envoyerVersArko, ORIGINE_ARKO } = await import('./envoi');

const fichier = () => new File([new Uint8Array([1, 2, 3])], 'Titre.m4a', { type: 'audio/mp4' });
let clics = 0;

function environnement(o: { share?: (d: ShareData) => Promise<void>; canShare?: boolean; origine?: string }) {
  vi.stubGlobal('navigator', o.share ? { share: o.share, canShare: () => o.canShare ?? true } : {});
  vi.stubGlobal('location', { origin: o.origine ?? 'http://localhost:5173' });
  vi.stubGlobal('document', {
    createElement: () => ({ click: () => void clics++, remove() {} }),
    body: { append() {} },
  });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL() {} });
}

beforeEach(() => {
  memoire.clear();
  clics = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe('Envoyer vers Arko', () => {
  it('feuille de partage disponible → « partage »', async () => {
    const share = vi.fn(async () => {});
    environnement({ share });
    expect(await envoyerVersArko(fichier())).toBe('partage');
    expect(share).toHaveBeenCalledOnce();
    expect(clics).toBe(0);
  });
  it('partage fermé par l’utilisateur → « annule » (pas de téléchargement)', async () => {
    environnement({ share: async () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })) });
    await expect(envoyerVersArko(fichier())).rejects.toMatchObject({ code: 'annule' });
    expect(clics).toBe(0);
  });
  it('partage refusé (geste trop ancien) → téléchargement', async () => {
    environnement({ share: async () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })) });
    expect(await envoyerVersArko(fichier())).toBe('telechargement');
    expect(clics).toBe(1);
  });
  it('pas de partage de fichiers, autre origine → « telechargement »', async () => {
    environnement({ share: async () => {}, canShare: false });
    expect(await envoyerVersArko(fichier())).toBe('telechargement');
    expect(memoire.size).toBe(0);
  });
  it('sur l’origine d’Arko → « boite » : { nom, type, blob }, 5 fichiers au plus', async () => {
    environnement({ origine: ORIGINE_ARKO });
    for (let i = 0; i < 7; i++) expect(await envoyerVersArko(fichier())).toBe('boite');
    expect(memoire.size).toBe(BOITE_ARKO.max);
    const cles = [...memoire.keys()] as number[];
    expect(new Set(cles).size).toBe(5);
    expect(memoire.get(cles[0]!)).toMatchObject({ nom: 'Titre.m4a', type: 'audio/mp4' });
    expect(clics).toBe(0);
  });
});
