import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Morceau } from '../morceau/types';
import { morceauPret, sortiePrete } from './aides-test';
import { exporterDossierSortie } from './dossier';

// Tout ce qui appartient aux autres (A2 : ZIP, export audio, morceaux) est simulé.
const s = vi.hoisted(() => ({
  morceaux: new Map<string, unknown>(),
  entrees: [] as string[],
  zip: { nom: '', dossier: '', annule: false, termine: false },
  exporter: vi.fn(),
  place: vi.fn(),
}));
vi.mock('../stockage/morceaux', () => ({ ouvrirMorceau: async (id: string) => s.morceaux.get(id) ?? null }));
vi.mock('../stockage/reglages', () => ({ lireReglages: async () => ({ vraiNom: 'Romain Dupont' }) }));
vi.mock('./pochette', () => {
  // En-tête JPEG 3000 × 3000 (SOF0).
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0x0b, 0xb8, 0x0b, 0xb8, 3, 0, 0, 0, 0xff, 0xd9]);
  return { lirePochette: async (cle: string) => (cle.startsWith('pochette-') ? new Blob([jpeg], { type: 'image/jpeg' }) : null) };
});
vi.mock('../moteur/export', () => ({ exporterAudio: s.exporter, tailleEstimee: (d: number) => Math.round(d * 1000) }));
vi.mock('../stockage/dossiers', async (orig) => ({ ...(await orig<object>()), verifierPlace: s.place }));
vi.mock('../zip/ecrire', () => ({
  creerZip: async (dossier: string, nom: string) => {
    Object.assign(s.zip, { dossier, nom });
    return {
      entree: async (n: string) => (s.entrees.push(n), { position: 0, ecrire: async () => {}, fermer: async () => {} }),
      ajouter: async (n: string) => void s.entrees.push(n),
      terminer: async () => ((s.zip.termine = true), new File(['zip'], s.zip.nom)),
      annuler: async () => void (s.zip.annule = true),
    };
  },
}));

function deuxTitres(plus: Partial<Morceau['infos']> = {}) {
  s.morceaux.set('m1', morceauPret('Nuit blanche'));
  s.morceaux.set('m2', morceauPret('Deux', { featuring: 'Léa', ...plus }));
}

beforeEach(() => {
  s.morceaux.clear();
  s.entrees.length = 0;
  Object.assign(s.zip, { nom: '', dossier: '', annule: false, termine: false });
  s.exporter.mockReset().mockResolvedValue({ fichier: null, octets: 10, lufs: -14, creteVraie: -1, duree: 60 });
  s.place.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 4, 12));
});
afterEach(() => vi.useRealTimers());

describe('exporterDossierSortie', () => {
  it('rend chaque titre DANS le ZIP, dans l’ordre, au niveau de la sortie, puis pochette, paroles et fiche', async () => {
    deuxTitres();
    const progression: [number, number][] = [];
    const sortie = sortiePrete(['m1', 'm2'], { titre: 'Mon EP', niveau: 'fort' });
    const f = await exporterDossierSortie(sortie, { format: 'flac16', surProgression: (t, p) => progression.push([t, p]) });
    expect(f.name).toBe('Kalo - Mon EP (sortie).zip');
    expect(s.zip).toMatchObject({ dossier: 'sorties', termine: true, annule: false });
    expect(s.entrees).toEqual([
      '01 - Nuit blanche.flac',
      '02 - Deux (feat. Léa).flac',
      'pochette.jpg',
      'paroles/01 - Nuit blanche.txt',
      'paroles/02 - Deux (feat. Léa).txt',
      'fiche-de-sortie.html',
      'fiche-de-sortie.txt',
    ]);
    expect(s.exporter).toHaveBeenCalledTimes(2);
    expect(s.exporter.mock.calls[1]![0]).toBe(s.morceaux.get('m2'));
    expect(s.exporter.mock.calls[1]![1]).toMatchObject({ format: 'flac16', niveau: 'fort' });
    expect(s.exporter.mock.calls[1]![1].ecrivain).toBeDefined();
    expect(progression).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
    // Place : 2,2 × (audio estimé + pochette + marge).
    expect(s.place.mock.calls[0]![1]).toBe(2.2);
    expect(s.place.mock.calls[0]![0]).toBeGreaterThan(130_000);
  });

  it('WAV 24 bits : fichiers « .wav » ; instrumental : pas de fichier de paroles', async () => {
    deuxTitres({ langue: 'instrumental' });
    await exporterDossierSortie(sortiePrete(['m1', 'm2'], { titre: 'Mon EP' }), { format: 'wav24' });
    expect(s.entrees.filter((e) => e.endsWith('.wav'))).toEqual(['01 - Nuit blanche.wav', '02 - Deux (feat. Léa).wav']);
    expect(s.entrees.filter((e) => e.startsWith('paroles/'))).toEqual(['paroles/01 - Nuit blanche.txt']);
  });

  it('un problème bloquant → « sortie_invalide », rien n’est écrit', async () => {
    deuxTitres({ explicite: undefined });
    const e = exporterDossierSortie(sortiePrete(['m1', 'm2'], { titre: 'Mon EP' }), { format: 'flac16' });
    await expect(e).rejects.toMatchObject({ code: 'sortie_invalide' });
    expect(s.zip.nom).toBe('');
    await expect(exporterDossierSortie(sortiePrete(['m1', 'absent']), { format: 'flac16' })).rejects.toMatchObject({ code: 'titre_introuvable' });
    await expect(exporterDossierSortie(sortiePrete(['m1'], { pochette: undefined }), { format: 'flac16' })).rejects.toMatchObject({ code: 'sortie_invalide' });
  });

  it('Annuler pendant un titre : le ZIP partiel est effacé, erreur « annule »', async () => {
    deuxTitres();
    const ctrl = new AbortController();
    s.exporter.mockImplementationOnce(async () => {
      ctrl.abort();
      throw new DOMException('stop', 'AbortError');
    });
    const e = exporterDossierSortie(sortiePrete(['m1', 'm2'], { titre: 'Mon EP' }), { format: 'flac16', signal: ctrl.signal });
    await expect(e).rejects.toMatchObject({ code: 'annule' });
    expect(s.zip).toMatchObject({ annule: true, termine: false });
    expect(s.exporter).toHaveBeenCalledTimes(1);
  });

  it('téléphone plein pendant l’écriture → « disque_plein », fichier partiel effacé ; place insuffisante → rien n’est créé', async () => {
    deuxTitres();
    s.exporter.mockRejectedValueOnce(new DOMException('plein', 'QuotaExceededError'));
    await expect(exporterDossierSortie(sortiePrete(['m1', 'm2'], { titre: 'Mon EP' }), { format: 'flac16' })).rejects.toMatchObject({ code: 'disque_plein' });
    expect(s.zip.annule).toBe(true);
    Object.assign(s.zip, { nom: '', annule: false });
    s.place.mockRejectedValueOnce(Object.assign(new Error('Pas assez de place'), { code: 'disque_plein' }));
    await expect(exporterDossierSortie(sortiePrete(['m1', 'm2'], { titre: 'Mon EP' }), { format: 'flac16' })).rejects.toMatchObject({ code: 'disque_plein' });
    expect(s.zip.nom).toBe('');
  });
});
