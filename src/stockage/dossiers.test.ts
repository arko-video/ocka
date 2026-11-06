import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurOcka } from '../moteur/erreur';
import { BASES_IDB, CACHES, DOSSIERS_OPFS, demanderPersistance, enErreurOcka, estimerPlace, formaterOctets, verifierPlace } from './dossiers';

/** Remplace navigator.storage le temps d'un test. */
function stockage(s: Partial<StorageManager>) {
  vi.stubGlobal('navigator', { storage: s });
}

afterEach(() => vi.unstubAllGlobals());

describe('dossiers et bases', () => {
  it('tout est préfixé « ocka- » (même origine qu’Arko)', () => {
    for (const nom of [...Object.values(DOSSIERS_OPFS), ...Object.values(BASES_IDB), ...Object.values(CACHES)]) expect(nom).toMatch(/^ocka-[a-z0-9]+(-[a-z]+)*$/);
    expect(DOSSIERS_OPFS.sf2).toBe('ocka-sf2');
    expect(CACHES.instruments).toBe('ocka-instruments');
  });
});

describe('place libre', () => {
  it('estimerPlace : quota − usage, ou null', async () => {
    stockage({ estimate: async () => ({ quota: 1000, usage: 300 }) });
    expect(await estimerPlace()).toEqual({ quota: 1000, utilise: 300, libre: 700 });
    stockage({});
    expect(await estimerPlace()).toBeNull();
  });
  it('verifierPlace : disque_plein si libre < octets × facteur', async () => {
    stockage({ estimate: async () => ({ quota: 500e6, usage: 300e6 }) });
    await expect(verifierPlace(100e6, 2.2)).rejects.toMatchObject({ code: 'disque_plein' });
    await expect(verifierPlace(100e6, 2.2)).rejects.toBeInstanceOf(ErreurOcka);
    await expect(verifierPlace(90e6, 2.2)).resolves.toBeUndefined();
  });
  it('verifierPlace laisse faire quand le navigateur ne dit rien', async () => {
    stockage({});
    await expect(verifierPlace(1e12, 3)).resolves.toBeUndefined();
  });
  it('message en Mo / Go', () => {
    expect(formaterOctets(1)).toBe('1 Mo');
    expect(formaterOctets(12.2e6)).toBe('13 Mo');
    expect(formaterOctets(1.25e9)).toBe('1,3 Go');
  });
});

describe('enErreurOcka', () => {
  it('QuotaExceededError → disque_plein, AbortError → annule, ErreurOcka telle quelle', () => {
    const quota = new DOMException('plus de place', 'QuotaExceededError');
    expect(enErreurOcka(quota)).toMatchObject({ code: 'disque_plein', cause: quota });
    expect(enErreurOcka({ name: 'UnknownError', message: 'Quota exceeded' }).code).toBe('disque_plein');
    expect(enErreurOcka(new DOMException('stop', 'AbortError')).code).toBe('annule');
    const e = new ErreurOcka('Déjà en français.', 'stockage');
    expect(enErreurOcka(e)).toBe(e);
  });
  it('autre erreur → message de secours en français', () => {
    const r = enErreurOcka(new TypeError('x is undefined'), { message: 'Le son n’a pas pu être lu.', code: 'son_illisible' });
    expect(r).toMatchObject({ message: 'Le son n’a pas pu être lu.', code: 'son_illisible' });
    expect(enErreurOcka('bizarre').code).toBe('inconnu');
  });
});

describe('demanderPersistance', () => {
  it('sans API → false ; refusé → false ; accordé → true, puis mémorisé', async () => {
    stockage({});
    expect(await demanderPersistance()).toBe(false);
    stockage({ persisted: async () => false, persist: async () => false });
    expect(await demanderPersistance()).toBe(false);
    const persist = vi.fn(async () => true);
    stockage({ persisted: async () => false, persist });
    expect(await demanderPersistance()).toBe(true);
    stockage({});
    expect(await demanderPersistance()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
