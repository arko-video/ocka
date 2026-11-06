// CONTRAT C2 — TA VOIX → INSTRUMENT (façon Dubler 2) et BEATBOX (décisions v2 §5, brief §E). Ré-exporté par
// moteur/api.ts : l'interface importe depuis moteur/api.ts. Types et signatures FIGÉS. Implémentation : D, dans
// ./dubler.ts (bouchons « pas_encore » au contrat), relié ici par `relier`. Tout src/dubler/ appartient à D.
// Détection : YIN (autotune/yin.ts) dans un AudioWorklet, décimé à 16 kHz ; micro sans écho/bruit/gain auto
// (enregistrement/micro.ts) ; casque conseillé ; pas de SharedArrayBuffer. Hauteurs en MIDI / cents MIDI.

import type { IdPiste, InstrumentBatterie, Morceau, Note } from '../morceau/types';
import { relier } from '../moteur/relier';
import * as dubler from './dubler';

/* ------------------------------------------------------------ jeu en direct */

/** « grave » : 500 échantillons à 16 kHz, τmax 213 (≈ 45 ms) ; « aigu » : ≈ 20 ms. */
export type ModeDetection = 'grave' | 'aigu';
export type TypeAccordChante = 'triade' | 'septieme';

export interface ReglagesDirect {
  /** Piste instrument jouée par la voix. */
  piste: IdPiste;
  /** Calage de la note chantée : sur la gamme du morceau, ou chromatique. */
  calage: 'gamme' | 'chromatique';
  mode: ModeDetection;
  /** Glissé entre deux notes (ms, 0 à 300 ; 0 = notes nettes). */
  glisse: number;
  /** Mode accords : l'accord de la gamme sur la note chantée, joué par `piste` (défaut : la piste jouée). null = une note. */
  accords: null | { type: TypeAccordChante; piste?: IdPiste };
  /** Le volume de l'instrument suit celui de la voix. */
  suivreVolume: boolean;
}

/** Ce que la roue des 12 notes affiche, lu à chaque image (requestAnimationFrame). */
export interface NoteCourante {
  /** Note jouée (MIDI, après calage) ; null = silence (porte de bruit fermée). */
  midi: number | null;
  /** Hauteur chantée (cents MIDI) ; NaN = rien de chanté. */
  cents: number;
  /** Écart de la voix à la note jouée (cents, −50 à 50) : l'aiguille de la roue. */
  ecart: number;
  /** Niveau de la voix (0 à 1). */
  niveau: number;
  /** Notes jouées : [midi], l'accord en mode accords, ou []. */
  jouees: number[];
}

/**
 * Ouvre le micro et joue la piste en direct (le worklet pilote gain et `detune`). Erreurs : « micro_refuse »,
 * « micro_absent », « deja_en_cours », « instrument_absent » (instrument pas téléchargé). Geste requis.
 */
export const demarrerDirect: (m: Morceau, reglages: ReglagesDirect) => Promise<void> = relier(
  () => dubler.demarrerDirect,
);

/** Change les réglages pendant le jeu (calage, mode, glissé, mode accords…). Sans effet hors du direct. */
export const reglerDirect: (reglages: Partial<ReglagesDirect>) => void = relier(() => dubler.reglerDirect);

/** Arrête le direct et coupe le micro (le voyant s'éteint). Sans effet s'il n'est pas lancé. */
export const arreterDirect: () => Promise<void> = relier(() => dubler.arreterDirect);

/** La note courante (roue des 12 notes) ; hors du direct : { midi: null, cents: NaN, ecart: 0, niveau: 0, jouees: [] }. */
export const noteCourante: () => NoteCourante = relier(() => dubler.noteCourante);

/** Notes MIDI de l'accord de la gamme du morceau bâti sur `midi` (triade ou septième, notes de la gamme). Pure. */
export const accordChante: (midi: number, tonalite: Morceau['tonalite'], type: TypeAccordChante) => number[] =
  relier(() => dubler.accordChante);

/* ------------------------------------------------------------ beatbox */

/** Les 4 sons entraînés : kick « boum », caisse claire « ka », charley « ts », et un 4e au choix. */
export const SONS_BEATBOX = ['boum', 'ka', 'ts', 'perso'] as const;
export type SonBeatbox = (typeof SONS_BEATBOX)[number];
/** Exemples à enregistrer pour chaque son. */
export const EXEMPLES_PAR_SON = 5;

/** Entraînement gardé sur l'appareil (base IndexedDB « ocka-dubler », BASES_IDB.dubler). */
export interface EntrainementBeatbox {
  version: 1;
  /** Pour chaque son : ses exemples (EXEMPLES_PAR_SON au plus), chacun = le vecteur de mesuresAttaque. */
  exemples: Record<SonBeatbox, number[][]>;
  /** Pad de batterie joué par chaque son (boum → kick, ka → snare, ts → charley, perso → au choix). */
  instruments: Record<SonBeatbox, InstrumentBatterie>;
}

/**
 * Mesures d'une attaque (40 ms à partir de `debut`, en échantillons) : 12 bandes log, centroïde, ZCR et
 * décroissance, normalisés (15 valeurs). Pure.
 */
export const mesuresAttaque: (pcm: Float32Array, fs: number, debut: number) => number[] = relier(
  () => dubler.mesuresAttaque,
);

/** Débuts des attaques d'un signal (échantillons), par flux spectral. Pure. */
export const detecterAttaques: (pcm: Float32Array, fs: number) => number[] = relier(
  () => dubler.detecterAttaques,
);

/** Le son le plus proche (k-NN, k = 3) et sa confiance (0 à 1) ; null si un son a moins de EXEMPLES_PAR_SON exemples. Pure. */
export const classerAttaque: (
  e: EntrainementBeatbox,
  mesures: readonly number[],
) => { son: SonBeatbox; confiance: number } | null = relier(() => dubler.classerAttaque);

/** Écoute le micro jusqu'à la prochaine attaque et renvoie ses mesures (un exemple). Erreurs : micro, « annule ». */
export const enregistrerExemple: (son: SonBeatbox, options?: { signal?: AbortSignal }) => Promise<number[]> =
  relier(() => dubler.enregistrerExemple);

/** L'entraînement gardé sur l'appareil, ou null. */
export const lireEntrainement: () => Promise<EntrainementBeatbox | null> = relier(
  () => dubler.lireEntrainement,
);
export const sauverEntrainement: (e: EntrainementBeatbox) => Promise<void> = relier(
  () => dubler.sauverEntrainement,
);

/** Beatbox en direct : chaque attaque classée joue le pad du kit du morceau. Erreur : « entrainement_incomplet », micro. */
export const demarrerBeatbox: (m: Morceau, e: EntrainementBeatbox) => Promise<void> = relier(
  () => dubler.demarrerBeatbox,
);
export const arreterBeatbox: () => Promise<void> = relier(() => dubler.arreterBeatbox);

/* ------------------------------------------------------------ enregistrement en notes */

export interface OptionsEnregistrementNotes {
  piste: IdPiste;
  /** Section (id) et n° de son apparition dans l'ordre : le beat boucle sur elle pendant l'enregistrement. */
  section: string;
  occurrence: number;
  /** Quantification en pas (1 = double-croche, 2 = croche, 4 = noire ; 2/3 et 4/3 = triolets) ; null = rien caler. */
  quantif: number | null;
  /** Force de la quantification, 0 à 1 (défaut 1). */
  force?: number;
}

/** Notes chantées d'une section, prêtes pour le piano roll (en pas dans la section, latence retirée). */
export interface NotesChantees {
  piste: IdPiste;
  section: string;
  /** Longueur du motif (pas, multiple de 16, 16 à 128). */
  pas: number;
  notes: Note[];
}

/** Lance le beat en boucle sur la section et enregistre les notes chantées (direct en cours requis : « pas_en_cours »). */
export const demarrerEnregistrementNotes: (m: Morceau, options: OptionsEnregistrementNotes) => Promise<void> =
  relier(() => dubler.demarrerEnregistrementNotes);

/** Arrête l'enregistrement : notes recalées (calibrage de la latence) et quantifiées. « pas_en_cours » sinon. */
export const arreterEnregistrementNotes: () => Promise<NotesChantees> = relier(
  () => dubler.arreterEnregistrementNotes,
);

/** Quantifie des notes (pas arrondis vers la grille `quantif`, dosés par `force`) ; null = inchangées. Pure. */
export const quantifierNotesChantees: (
  notes: readonly Note[],
  quantif: number | null,
  force?: number,
) => Note[] = relier(() => dubler.quantifierNotesChantees);

/** Pose les notes dans le motif de la piste pour la section (motif créé ou remplacé). Pure, un seul Annuler. */
export const poserNotesChantees: (m: Morceau, n: NotesChantees) => Morceau = relier(
  () => dubler.poserNotesChantees,
);

/* ------------------------------------------------------------ latence */

/** Latence de détection, de la note chantée à la note jouée, SANS la sortie audio (signal de test, même détecteur). */
export interface LatenceDetection {
  moyenneMs: number;
  maxMs: number;
  /** Nombre de changements de note mesurés. */
  mesures: number;
}

export const mesurerLatenceDetection: (mode: ModeDetection) => Promise<LatenceDetection> = relier(
  () => dubler.mesurerLatenceDetection,
);
