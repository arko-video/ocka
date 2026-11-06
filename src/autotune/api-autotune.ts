// CONTRAT C2 — AUTOTUNE AVANCÉ (décisions v2 §4, brief §D). Ré-exporté par moteur/api.ts : l'interface (A2) importe
// depuis moteur/api.ts. Chaque type et chaque signature ci-dessous est FIGÉ. Implémentation : A1, dans
// ./avance.ts (bouchons « pas_encore » au contrat), relié ici par `relier` ; l'IA est dans src/ia/autotune.ts.
// Hauteurs en cents MIDI (6900 = la 440 Hz) ; temps en secondes DANS le fichier de la prise (comme NoteAutotune).
// Le format Prise.autotune (AutotunePrise, NoteAutotune) est celui de morceau/types-ajouts.ts, gelé au contrat C0.

import type { AutotunePrise, Mode, Morceau, NoteAutotune, PresetAutotune, Prise, Style, Tonique } from '../morceau/types';
import { relier } from '../moteur/relier';
import type { PcmVoix } from './autotune';
import * as avance from './avance';

/** Les 4 préréglages fixes (« perso » = réglages touchés à la main). */
export type PresetFixe = Exclude<PresetAutotune, 'perso'>;
export const PRESETS_FIXES: readonly PresetFixe[] = ['naturel', 'pop', 'robot', 'hyperpop'];

/** Courbe de hauteur d'une prise (YIN, une valeur toutes les `pas` secondes), dessinée sur le piano roll de l'éditeur. */
export interface CourbeHauteur {
  /** Pas entre deux valeurs (s) ; la valeur i est au temps `debut + i × pas` (secondes dans le fichier). */
  pas: number;
  debut: number;
  /** Hauteur (cents MIDI) ; NaN = non voisé (silence, souffle, consonne). */
  cents: Float32Array;
  /** Niveau de 0 à 1 (même longueur), pour l'épaisseur du trait. */
  niveau: Float32Array;
}

/** Une note détectée : découpée aux sauts de plus de 70 cents tenus plus de 60 ms, et aux attaques. */
export interface NoteDetectee {
  /** Secondes dans le fichier ; triées, sans chevauchement. */
  debut: number;
  fin: number;
  /** Note la plus proche de la hauteur médiane (MIDI entier, 24 à 96). */
  midi: number;
  /** Justesse chantée : écart de la médiane à `midi` (cents, −50 à 50). */
  justesse: number;
  /** Vibrato : amplitude (cents crête à crête) et vitesse (Hz ; 0 = aucun). */
  vibrato: number;
  vitesseVibrato: number;
  /** Hauteur moyenne chantée (cents MIDI). */
  hauteur: number;
  /** Écart (cents) de la médiane à la note la plus proche de la gamme (détectée ou du morceau). */
  ecartGamme: number;
  /** Toujours vrai pour une note détectée : seuls les passages voisés deviennent des notes. */
  voisee: boolean;
}

/** Analyse d'une prise (calculée dans un Worker, mise en cache par fichier). */
export interface AnalyseNotes {
  /** Clé du fichier de la prise (Prise.fichier). */
  fichier: string;
  /** Durée du fichier (s). */
  duree: number;
  courbe: CourbeHauteur;
  notes: NoteDetectee[];
  /** Part des trames sonores qui sont voisées (0 à 1) ; sous 0,6, l'autotune ne s'applique pas (repli). */
  voisees: number;
}

/** Gamme proposée par la détection, avec sa confiance (0 à 1). */
export interface GammeDetectee {
  tonique: Tonique;
  mode: Mode;
  confiance: number;
}

/**
 * Ce que proposent « Corriger tout seul » (règles) et l'IA : une gamme, des notes corrigées (au format de
 * Prise.autotune.notes), un préréglage. Appliqué en UNE étape d'Annuler (appliquerConseil).
 */
export interface ConseilAutotune {
  gamme: AutotunePrise['gamme'];
  corrections: NoteAutotune[];
  preset: PresetAutotune;
  /** Une phrase courte en français (« 3 notes trop basses dans le refrain »), affichée telle quelle. */
  explication?: string;
}

export interface OptionsAutotune {
  signal?: AbortSignal;
  /** Avancement de 0 à 1 (analyse ou rendu). */
  surProgression?: (part: number) => void;
}

/* ------------------------------------------------------------ analyse */

/**
 * Courbe de hauteur et notes découpées d'une prise (Worker, cache par fichier). Erreurs : « prise_introuvable »,
 * « prise_vide », « annule ». Une prise peu voisée n'est PAS une erreur : `voisees` < 0,6 et peu de notes.
 */
export const analyserNotes: (prise: Prise, options?: OptionsAutotune) => Promise<AnalyseNotes> = relier(() => avance.analyserNotes);

/**
 * Les gammes les plus probables d'une liste de notes (2 au plus, la meilleure d'abord ; [] sans notes). `tonalite` :
 * celle du morceau, favorisée quand la voix hésite. Pure.
 */
export const detecterGamme: (notes: readonly NoteDetectee[], tonalite?: Morceau['tonalite']) => GammeDetectee[] = relier(() => avance.detecterGamme);

/* ------------------------------------------------------------ réglages */

/** Réglages complets d'un préréglage (gamme « morceau », sans notes). Pure. */
export const reglagesPreset: (preset: PresetFixe) => AutotunePrise = relier(() => avance.reglagesPreset);

/**
 * Le curseur simple d'aujourd'hui (Piste.effets.autotune, 0,1 à 1) traduit en réglages avancés : le rendu de ces
 * réglages SONNE comme corrigerVoix(force) (testé). Pure.
 */
export const reglagesDeForce: (force: number) => AutotunePrise = relier(() => avance.reglagesDeForce);

/* ------------------------------------------------------------ rendu */

/**
 * Nom du fichier rendu (OPFS ocka-prises, préfixe « auto- ») pour ces réglages et cette tonalité : déterministe,
 * pour le cache et le ménage (fichiersAutotune le garde). Pure.
 */
export const nomRenduAutotune: (prise: Prise, reglages: AutotunePrise, tonalite: Morceau['tonalite']) => string = relier(() => avance.nomRenduAutotune);

/**
 * Rend une prise avec ses réglages et ses notes corrigées (PSOLA, hors temps réel, Worker), et le met en cache. Si
 * seule une note a changé depuis le dernier rendu, seule cette note est recalculée (100 ms de marge de chaque
 * côté). null = repli (trop peu de trames voisées) : on joue la prise brute. Erreurs : « prise_introuvable », « annule ».
 * L'écoute et l'export lisent ce rendu par lirePcmVoix (autotune.ts) dès que la prise a un `autotune`.
 */
export const rendreAutotune: (prise: Prise, reglages: AutotunePrise, tonalite: Morceau['tonalite'], options?: OptionsAutotune) => Promise<PcmVoix | null> =
  relier(() => avance.rendreAutotune);

/* ------------------------------------------------------------ corrections */

/**
 * « Corriger tout seul » (sans IA, sans réseau) : gamme détectée, notes fausses recalées, préréglage (celui du
 * `style` du morceau s'il est donné, sinon d'après le chant). Pure.
 */
export const corrigerToutSeul: (analyse: AnalyseNotes, tonalite: Morceau['tonalite'], style?: Style) => ConseilAutotune = relier(() => avance.corrigerToutSeul);

/**
 * Applique un conseil (règles ou IA) à la prise `idPrise` : Prise.autotune = réglages du préréglage + gamme + notes
 * corrigées. Pure : même objet si la prise est introuvable. L'interface l'appelle dans UN `modifier` (un Annuler).
 */
export const appliquerConseil: (m: Morceau, idPrise: string, conseil: ConseilAutotune) => Morceau = relier(() => avance.appliquerConseil);
