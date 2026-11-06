import { describe, expect, it } from 'vitest';
import * as api from './api';
import * as edition from '../ui/edition/api-edition';
import type { InstrumentJson } from '../instruments/format';
import type { SourceZones } from './types-moteur';
import { relier } from './relier';
import { exempleMorceau } from '../ui/edition/exemple';

/** Les fonctions publiques ajoutées par le contrat de la vague A (l'interface les importe depuis api.ts). */
const VAGUE_A = [
  // A1 — sorties
  'listerSorties', 'ouvrirSortie', 'sauverSortie', 'supprimerSortie', 'nouvelleSortie', 'retirerMorceauDesSorties',
  'lireReglages', 'ecrireReglages', 'typeSortie', 'verifierSortie', 'preparerPochette', 'fabriquerPochette',
  'lirePochette', 'parolesMusixmatch', 'ficheSortie', 'exporterDossierSortie', 'normaliserSortie', 'normaliserReglages',
  // A2 — fichiers
  'exporterAudio', 'tailleEstimee', 'exporterProjet', 'exporterSortieProjet', 'importerProjet', 'importerSon', 'lireSon',
  'demanderPersistance',
  // M2 — effets
  'exporterPistes', 'mesurerEcartAB', 'envoyerVersArko',
] as const;

/** Les fonctions publiques ajoutées par le contrat C0 de la v2 (bouchons « pas_encore » jusqu'à la vague C1). */
const C0_API = [
  // BQ — instruments
  'listerInstruments', 'telechargerInstrument', 'instrumentsInstalles', 'supprimerInstrument', 'tailleInstruments',
  'instrumentsManquants', 'preparerInstrumentsExport', 'chargerSource', 'lireZone',
  // M2 — inserts, automation, sidechain
  'insertParDefaut', 'presetsInserts', 'valeurCible', 'valeurReelle', 'gainsSidechain',
] as const;
const C0_EDITION = [
  'ajouterNote', 'supprimerNotes', 'deplacerNotes', 'allongerNote', 'reglerVelocite', 'quantifier', 'copierNotes', 'collerNotes',
  'changerLongueurMotif', 'poserAccord', 'ajouterPiste', 'dupliquerPiste', 'supprimerPiste', 'renommerPiste', 'changerInstrument',
  'deplacerPiste', 'reglerTranche', 'ajouterInsert', 'retirerInsert', 'deplacerInsert', 'reglerInsert', 'appliquerPresetInserts',
  'reglerSidechain', 'poserPoint', 'deplacerPoint', 'retirerPoint', 'effacerCourbe', 'reglerLfo', 'rendreUnique',
] as const;

/** Contrat C2 : autotune avancé (A1) et Ta voix → instrument / beatbox (D), bouchons « pas_encore » au contrat. */
const C2_API = [
  'analyserNotes', 'detecterGamme', 'reglagesPreset', 'reglagesDeForce', 'nomRenduAutotune', 'rendreAutotune',
  'corrigerToutSeul', 'appliquerConseil',
  'demarrerDirect', 'reglerDirect', 'arreterDirect', 'noteCourante', 'accordChante', 'mesuresAttaque', 'detecterAttaques',
  'classerAttaque', 'enregistrerExemple', 'lireEntrainement', 'sauverEntrainement', 'demarrerBeatbox', 'arreterBeatbox',
  'demarrerEnregistrementNotes', 'arreterEnregistrementNotes', 'quantifierNotesChantees', 'poserNotesChantees',
  'mesurerLatenceDetection',
] as const;

describe('contrat C2', () => {
  it('api.ts expose l’autotune avancé et Ta voix → instrument ; l’IA expose requeteAutotune et lireAutotune', async () => {
    const a = api as unknown as Record<string, unknown>;
    for (const nom of C2_API) expect(typeof a[nom], nom).toBe('function');
    expect(api.PRESETS_FIXES).toEqual(['naturel', 'pop', 'robot', 'hyperpop']);
    expect(api.SONS_BEATBOX).toHaveLength(4);
    expect(api.EXEMPLES_PAR_SON).toBe(5);
    const ia = await import('../ia');
    expect(typeof ia.requeteAutotune).toBe('function');
    expect(typeof ia.lireAutotune).toBe('function');
  });
  it('hors du direct, la note courante est le silence (la roue peut la lire à chaque image)', () => {
    const n = api.noteCourante();
    expect([n.midi, n.niveau, n.jouees]).toEqual([null, 0, []]);
  });
});

describe('contrat C0 (v2)', () => {
  it('api.ts et api-edition.ts exposent toutes les fonctions de C1', () => {
    const a = api as unknown as Record<string, unknown>;
    for (const nom of C0_API) expect(typeof a[nom], nom).toBe('function');
    const e = edition as unknown as Record<string, unknown>;
    for (const nom of C0_EDITION) expect(typeof e[nom], nom).toBe('function');
  });
  it('un instrument.json de BQ (src/instruments/format.ts) est une SourceZones de l’échantillonneur (M1)', () => {
    // Vérifié par tsc : si les deux formats divergent, cette ligne ne compile plus.
    const json: InstrumentJson = { id: 'x@1', nom: 'X', famille: 'Claviers', licence: { nom: 'CC0-1.0', url: '', auteur: '', sha256: [] }, canaux: 1, gainDb: 0, relache: 0.3, budgetS: 10, zones: [] };
    const source: SourceZones = json;
    expect(source.zones).toEqual([]);
  });
  it('vague C1 : plus aucun bouchon « pas_encore » (instruments et édition reliés)', async () => {
    // Sans réseau ni Cache Storage (Node) : la banque répond « hors_ligne », pas « pas_encore ».
    await expect(api.listerInstruments()).rejects.toMatchObject({ code: 'hors_ligne' });
    await expect(api.instrumentsInstalles()).resolves.toEqual([]);
    await expect(api.chargerSource('vcsl-marimba@1')).rejects.toMatchObject({ code: 'instrument_absent' });
    const m = exempleMorceau();
    const r = edition.ajouterPiste(m, 'ocka-pluck@1');
    expect(r).not.toBeNull();
    expect(edition.supprimerPiste(r!.m, r!.id).pistes).toEqual(m.pistes);
    expect(edition.reglerTranche(m, 'basse', { muet: true }).pistes.find((p) => p.id === 'basse')?.muet).toBe(true);
  });
});

describe('contrat de la vague A', () => {
  it('api.ts se charge et expose toutes les fonctions (aucune boucle d’imports cassée)', () => {
    const exportes = api as unknown as Record<string, unknown>;
    for (const nom of VAGUE_A) expect(typeof exportes[nom], nom).toBe('function');
    expect(typeof api.exporterWav).toBe('function');
    expect(new api.ErreurOcka('x', 'pas_encore')).toBeInstanceOf(Error);
  });
  it('relier lit l’implémentation à l’appel et passe les arguments', () => {
    let impl = (a: number, b: number) => a + b;
    const f = relier(() => impl);
    expect(f(2, 3)).toBe(5);
    impl = (a, b) => a * b;
    expect(f(2, 3)).toBe(6);
  });
});
