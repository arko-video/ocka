// Projets .ocka et .ocka-sortie : aller-retour (même morceau sauf ids et clés, mêmes échantillons), tout ou rien,
// archives refusées. OPFS et IndexedDB simulés en mémoire ; les fonctions d'A1 (sorties, pochettes) aussi.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Morceau, Prise } from '../morceau/types';
import type { Sortie } from '../sortie/types';
import { installerNavigateur, type RacineFactice } from './test-factices';

vi.mock('idb-keyval', async () => (await import('./test-factices')).idbFactice);
const sorties = new Map<string, Sortie>();
vi.mock('../stockage/sorties', () => ({
  ouvrirSortie: async (id: string) => structuredClone(sorties.get(id) ?? null),
  sauverSortie: async (s: Sortie) => (sorties.set(s.id, structuredClone(s)), s),
}));
vi.mock('../sortie/pochette', () => ({
  lirePochette: async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: 'image/jpeg' }),
  stockerPochette: async () => ({ cle: 'pochette-importee', cote: 3000 }),
}));

const { nouveauMorceau } = await import('../morceau/styles');
const { normaliserMorceau } = await import('../morceau/normaliser');
const { sauverMorceau, ouvrirMorceau } = await import('../stockage/morceaux');
const { exporterProjet, exporterSortieProjet } = await import('./exporter');
const { importerProjet } = await import('./importer');
const { creerZip } = await import('../zip/ecrire');
const { lireZip } = await import('../zip/lire');
const { REGLES_MORCEAU } = await import('./commun');

let racine: RacineFactice;
beforeEach(() => {
  racine = installerNavigateur(vi.stubGlobal);
  sorties.clear();
});
afterEach(() => vi.unstubAllGlobals());

const f32 = (n: number, f: (i: number) => number) => new Uint8Array(Float32Array.from({ length: n }, (_, i) => f(i)).buffer);

function prise(m: Morceau, id: string, fichier: string): Prise {
  return { id, ancre: { section: m.sections[0]!.id, occurrence: 0, mesure: 0 }, tempo: m.tempo, fichier, frequence: 48000, duree: 1, debutCoupe: 0, finCoupe: 1, decalage: 0.01, gain: 1, choisie: id === 'p1' };
}

/** Un morceau avec 2 prises (dont une sans fichier) et un son stéréo sur un pad. */
async function preparer(): Promise<{ id: string; m: Morceau; voix: Uint8Array; son: Uint8Array }> {
  const m = nouveauMorceau('trap', 'Nuit d’été');
  m.prises = [prise(m, 'p1', 'prise-aaa.f32'), prise(m, 'p2', 'prise-absente.f32')];
  m.sons = [{ id: 's1', nom: 'Mon son', fichier: 'son-bbb.f32', frequence: 44100, duree: 0.5, canaux: 2 }];
  m.pads = { perso1: 's1' };
  const voix = f32(48000, (i) => Math.sin(i / 7) * 0.5);
  const son = f32(2 * 22050, (i) => (i < 22050 ? i / 22050 : -i / 44100)); // tout G puis tout D
  racine.poser('ocka-prises', 'prise-aaa.f32', voix);
  racine.poser('ocka-sons', 'son-bbb.f32', son);
  const id = await sauverMorceau(m);
  return { id, m: normaliserMorceau(m).morceau, voix, son };
}

const contenu = (dossier: string, nom: string) => racine.fichier(dossier, nom)!.contenu.donnees;

describe('projet .ocka', () => {
  it('aller-retour : même morceau (sauf ids et clés), mêmes échantillons, clés neuves', async () => {
    const { id, m, voix, son } = await preparer();
    const f = await exporterProjet(id);
    expect(f.name).toBe('Nuit d’été.ocka');
    const z = await lireZip(f, REGLES_MORCEAU);
    expect(z.entrees.map((e) => e.nom).sort()).toEqual(['morceau.json', 'ocka.json', 'prises/prise-aaa.wav', 'sons/son-bbb.wav']);

    const r = await importerProjet(f);
    expect(r.type).toBe('morceau');
    expect(r.id).not.toBe(id);
    const m2 = (await ouvrirMorceau(r.id))!;
    const p = m2.prises[0]!;
    expect(m2.prises).toHaveLength(1); // la prise sans fichier est retirée
    expect(p.fichier).toMatch(/^prise-[a-z0-9]+\.f32$/);
    expect(p.fichier).not.toBe('prise-aaa.f32');
    expect(m2.sons![0]!.fichier).not.toBe('son-bbb.f32');
    const attendu = structuredClone(m);
    attendu.prises = [{ ...m.prises[0]!, fichier: p.fichier }];
    attendu.sons = [{ ...m.sons![0]!, fichier: m2.sons![0]!.fichier }];
    expect(m2).toEqual(attendu);
    expect(contenu('ocka-prises', p.fichier)).toEqual(voix);
    expect(contenu('ocka-sons', m2.sons![0]!.fichier)).toEqual(son); // ré-entrelacé puis remis par canal
    expect(racine.noms('ocka-prises')).toContain(p.fichier.replace('.f32', '.json'));
  });

  it('tout ou rien : disque plein pendant la copie → aucun morceau, aucun fichier neuf', async () => {
    const { id } = await preparer();
    const f = await exporterProjet(id);
    const avant = { prises: racine.noms('ocka-prises'), sons: racine.noms('ocka-sons') };
    racine.quota = racine.utilise() + 1000;
    await expect(importerProjet(f)).rejects.toMatchObject({ code: 'disque_plein' });
    expect(racine.noms('ocka-prises')).toEqual(avant.prises);
    expect(racine.noms('ocka-sons')).toEqual(avant.sons);
    const { idbFactice } = await import('./test-factices');
    const cles = (await idbFactice.keys({ base: 'ocka-morceaux', magasin: 'ocka' })).filter((k) => k !== '#index');
    expect(cles).toEqual([id]);
  });

  it('version plus récente → « format_recent » ; fichier inattendu ou JSON cassé → « projet_illisible »', async () => {
    const fabriquer = async (nom: string, entrees: [string, string][]) => {
      const z = await creerZip('tmp', nom);
      for (const [n, t] of entrees) await z.ajouter(n, new TextEncoder().encode(t));
      return z.terminer();
    };
    const m = JSON.stringify(nouveauMorceau('lofi'));
    await expect(importerProjet(await fabriquer('a.ocka', [['ocka.json', '{"type":"morceau","version":2}'], ['morceau.json', m]]))).rejects.toMatchObject({ code: 'format_recent' });
    await expect(importerProjet(await fabriquer('b.ocka', [['ocka.json', '{"type":"morceau","version":1}'], ['morceau.json', '{"format":"ocka.morceau/9"}']]))).rejects.toMatchObject({ code: 'format_recent' });
    await expect(importerProjet(await fabriquer('c.ocka', [['ocka.json', '{"type":"morceau","version":1}'], ['morceau.json', '{pas du json']]))).rejects.toMatchObject({ code: 'projet_illisible' });
    await expect(importerProjet(await fabriquer('e.ocka', [['ocka.json', '{"type":"morceau","version":1}'], ['morceau.json', m], ['virus.exe', '']]))).rejects.toMatchObject({ code: 'projet_illisible' });
  });
});

describe('projet .ocka-sortie', () => {
  it('aller-retour : morceaux imbriqués, ids neufs, pochette, ordre des titres', async () => {
    const a = await preparer();
    const b = await sauverMorceau(nouveauMorceau('drill', 'Deuxième'));
    sorties.set('s1', { format: 'ocka.sortie/1', id: 's1', titre: 'Mon EP', artiste: 'Romain', dateSortie: '2026-12-16', genre: 'Hip-hop', langue: 'fr', titres: [b, a.id], pochette: 'pochette-x', distributeur: 'routenote', niveau: 'standard', modifieLe: 1 });
    const f = await exporterSortieProjet('s1');
    expect(f.name).toBe('Mon EP.ocka-sortie');
    expect(racine.noms('ocka-tmp')).toEqual([]); // projets de travail effacés
    const r = await importerProjet(f);
    expect(r.type).toBe('sortie');
    const s = sorties.get(r.id)!;
    expect(r.id).not.toBe('s1');
    expect(s.pochette).toBe('pochette-importee');
    expect(s.titres).toHaveLength(2);
    expect(s.titres).not.toContain(a.id);
    expect((await ouvrirMorceau(s.titres[0]!))!.titre).toBe('Deuxième');
    const m2 = (await ouvrirMorceau(s.titres[1]!))!;
    expect(m2.titre).toBe('Nuit d’été');
    expect(contenu('ocka-prises', m2.prises[0]!.fichier)).toEqual(a.voix);
  });
});
