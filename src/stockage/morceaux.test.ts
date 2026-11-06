// Stockage d'OCKA : migration de la phase 1, ramasse-miettes, duplication. Arko vit sur la même origine :
// ses clés (« arko.* ») et ses dossiers ne doivent JAMAIS être touchés, et la base « keyval-store » jamais vidée.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installerNavigateur, type RacineFactice } from '../projets/test-factices';

vi.mock('idb-keyval', async () => (await import('../projets/test-factices')).idbFactice);
const { idbFactice, bases } = await import('../projets/test-factices');
const { oublierMigration } = await import('./migration');
const { listerMorceaux, ouvrirMorceau, sauverMorceau, dupliquerMorceau } = await import('./morceaux');
const { menage } = await import('./menage');
const { nouveauMorceau } = await import('../morceau/styles');
const { DEBUT_SEANCE } = await import('../enregistrement/prises');
const { nomAutotune } = await import('../autotune/autotune');

let racine: RacineFactice;
beforeEach(() => {
  racine = installerNavigateur(vi.stubGlobal);
  oublierMigration();
});
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 400)); // le ménage lancé en fond par listerMorceaux se termine ici
  vi.unstubAllGlobals();
});

const ANCIEN = { base: 'keyval-store', magasin: 'keyval' };
const HEURE = 3600_000;
const o = (n = 8) => new Uint8Array(n).fill(7);

describe('migration de la phase 1', () => {
  it('seules les clés ocka.* quittent keyval-store ; Arko et la base restent ; prises déplacées', async () => {
    const vieux = { ...nouveauMorceau('trap', 'Vieux'), format: 'ocka.morceau/1' };
    await idbFactice.set('ocka.morceau.abc', vieux, ANCIEN);
    await idbFactice.set('ocka.index', [{ id: 'abc', titre: 'Vieux', style: 'trap', duree: 10, modifieLe: 5 }], ANCIEN);
    await idbFactice.set('arko.projets', { a: 1 }, ANCIEN);
    await idbFactice.set('ocka.inconnue', 1, ANCIEN);
    racine.poser('prises', 'prise-old.f32', o(400));
    racine.poser('prises', 'prise-old.json', o());
    racine.poser('prises', 'note-arko.txt', o());
    racine.poser('exports', 'video-arko.mp4', o());

    const liste = await listerMorceaux();
    expect(liste.map((r) => [r.id, r.modifieLe])).toEqual([['abc', 5]]);
    expect((await ouvrirMorceau('abc'))!.titre).toBe('Vieux');
    expect((await idbFactice.keys(ANCIEN)).sort()).toEqual(['arko.projets', 'ocka.inconnue']);
    expect(racine.noms('ocka-prises')).toEqual(['prise-old.f32', 'prise-old.json']);
    expect(racine.fichier('ocka-prises', 'prise-old.f32')!.contenu.donnees).toHaveLength(400);
    expect(racine.noms('prises')).toEqual(['note-arko.txt']); // dossier gardé : il n'est pas vide
    expect(racine.noms('exports')).toEqual(['video-arko.mp4']);
  });

  it('sans base keyval-store : elle n’est jamais créée ; dossier « prises » vide retiré', async () => {
    racine.poser('prises', 'prise-x.f32', o());
    await listerMorceaux();
    expect([...bases.keys()].some((k) => k.startsWith('keyval-store'))).toBe(false);
    expect(racine.enfants.has('prises')).toBe(false);
  });
});

describe('ramasse-miettes', () => {
  /** Fichier de l'autotune de la prise gardée (force 0,5, tonalité du morceau) : nouveau format auto-<prise>-<force>-<tonalité>.f32. */
  let autoGarde = '';
  let autoAncienneForce = '';
  async function scene() {
    const m = nouveauMorceau('trap', 'Gardé');
    // Autotune allumé sur la voix : le fichier corrigé de la prise choisie est utilisé, donc gardé.
    m.pistes = m.pistes.map((p) => (p.id === 'voix' && p.genre !== 'instrument' ? { ...p, effets: { ...p.effets, autotune: 0.5 } } : p));
    autoGarde = nomAutotune('prise-garde.f32', 0.5, m.tonalite);
    autoAncienneForce = nomAutotune('prise-garde.f32', 0.8, m.tonalite);
    m.prises = [{ id: 'p', ancre: { section: m.sections[0]!.id, occurrence: 0, mesure: 0 }, tempo: 120, fichier: 'prise-garde.f32', frequence: 48000, duree: 1, debutCoupe: 0, finCoupe: 1, decalage: 0, gain: 1, choisie: true }];
    m.sons = [{ id: 's', nom: 'S', fichier: 'son-garde.f32', frequence: 44100, duree: 1, canaux: 1 }];
    m.soundfonts = [{ id: 'garde', nom: 'SF', fichier: 'sf2-garde.sf2', taille: 4, sha256: 'a'.repeat(64) }];
    await sauverMorceau(m);
    const vieux = Date.now() - 2 * HEURE;
    for (const n of ['prise-garde.f32', 'prise-garde.json', 'prise-orphelin.f32', 'prise-orphelin.json', autoGarde, autoAncienneForce, 'auto-prise-mort-1.f32', 'lisez-moi.txt']) racine.poser('ocka-prises', n, o(), vieux);
    racine.poser('ocka-prises', 'prise-recente.f32', o(), Date.now());
    racine.poser('ocka-prises', 'prise-seance-passee.f32', o(), DEBUT_SEANCE - 1000);
    racine.poser('ocka-sons', 'son-garde.f32', o(), vieux);
    racine.poser('ocka-sons', 'son-orphelin.f32', o(), vieux);
    racine.poser('ocka-sf2', 'sf2-garde.sf2', o(), vieux);
    racine.poser('ocka-sf2', 'sf2-orpheline.sf2', o(), vieux);
    racine.poser('ocka-sf2', 'sf2-recente.sf2', o(), Date.now());
    racine.poser('ocka-exports', 'export-vieux.wav', o(), vieux);
    racine.poser('ocka-exports', 'export-recent.wav', o(), Date.now());
    racine.poser('exports', 'video-arko.mp4', o(), vieux);
    racine.poser('arko-projets', 'p.json', o(), vieux);
  }

  it('efface les orphelins anciens ; garde l’utilisé, le récent, et tout ce qui n’est pas à OCKA', async () => {
    await scene();
    const bilan = await menage();
    // Effacés : prise orpheline (+ .json), prise d'avant la séance, autotune d'une prise morte, autotune à une ancienne force.
    expect(bilan).toEqual({ prises: 5, sons: 1, sf2: 1, exports: 1, tmp: 0 });
    expect(autoGarde).toMatch(/^auto-prise-garde-0\.5-[A-Za-z]+-(majeur|mineur)\.f32$/);
    expect(racine.noms('ocka-prises')).toEqual([autoGarde, 'lisez-moi.txt', 'prise-garde.f32', 'prise-garde.json', 'prise-recente.f32']);
    expect(racine.noms('ocka-sons')).toEqual(['son-garde.f32']);
    expect(racine.noms('ocka-sf2')).toEqual(['sf2-garde.sf2', 'sf2-recente.sf2']);
    expect(racine.noms('ocka-exports')).toEqual(['export-recent.wav']);
    expect(racine.noms('exports')).toEqual(['video-arko.mp4']);
    expect(racine.noms('arko-projets')).toEqual(['p.json']);
  });

  it('autre onglet ouvert : la règle « avant la séance » ne s’applique pas', async () => {
    await scene();
    const autre = new BroadcastChannel('ocka-onglets');
    (autre as unknown as { unref?: () => void }).unref?.();
    autre.onmessage = (e: MessageEvent) => {
      if (e.data?.qui) autre.postMessage({ moi: 'autre-onglet', pour: e.data.qui });
    };
    try {
      await menage();
    } finally {
      autre.close();
    }
    expect(racine.noms('ocka-prises')).toContain('prise-seance-passee.f32');
    expect(racine.noms('ocka-prises')).not.toContain('prise-orphelin.f32'); // plus d'une heure : effacé quand même
  });
});

describe('morceaux', () => {
  it('dupliquer copie les prises ET les sons (même id de son, fichier neuf)', async () => {
    const m = nouveauMorceau('lofi', 'Avec son');
    m.sons = [{ id: 's1', nom: 'S', fichier: 'son-a.f32', frequence: 44100, duree: 1, canaux: 1 }];
    m.pads = { perso2: 's1' };
    racine.poser('ocka-sons', 'son-a.f32', o(64));
    const id = await sauverMorceau(m);
    const copie = (await ouvrirMorceau(await dupliquerMorceau(id)))!;
    expect(copie.titre).toBe('Avec son (copie)');
    expect(copie.sons![0]!.id).toBe('s1');
    expect(copie.sons![0]!.fichier).not.toBe('son-a.f32');
    expect(copie.pads).toEqual({ perso2: 's1' });
    expect(racine.fichier('ocka-sons', copie.sons![0]!.fichier)!.contenu.donnees).toEqual(o(64));
  });

  it('dupliquer sans le fichier d’un son : rien n’est créé', async () => {
    const m = nouveauMorceau('lofi');
    m.sons = [{ id: 's1', nom: 'S', fichier: 'son-absent.f32', frequence: 44100, duree: 1, canaux: 1 }];
    const id = await sauverMorceau(m);
    await expect(dupliquerMorceau(id)).rejects.toMatchObject({ code: 'duplication_impossible' });
    expect((await listerMorceaux()).map((r) => r.id)).toEqual([id]);
  });

  it('sauverMorceau ne demande plus le stockage durable', async () => {
    const persist = vi.spyOn(navigator.storage, 'persist');
    await sauverMorceau(nouveauMorceau('trap'));
    expect(persist).not.toHaveBeenCalled();
  });
});
