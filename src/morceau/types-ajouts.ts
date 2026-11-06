// Format /3 — ajouts des vagues C2 et C3, gelés dès le contrat C0 (décisions v2 §1) : effets de performance,
// marqueurs, SoundFonts, recettes et découpes des sons, autotune réglable d'une prise, réglages de synthé.
// Infos du titre (sortie, phase 6) aussi. Ré-exporté par types.ts. Tous FACULTATIFS dans le fichier : un champ absent reste absent après le normaliseur.

import type { Mode, Tonique } from './types';

/* ------------------------------------------------------------ effets de performance (Section.perf) */

export const TYPES_PERF = ['stutter', 'demi-tempo', 'tape-stop', 'gate', 'reverse'] as const;
export type TypePerf = (typeof TYPES_PERF)[number];
/** Répétitions par temps du stutter et du gate. */
export const DIVISIONS_PERF = [1, 2, 3, 4, 6, 8, 12, 16] as const;

/** Effet façon Gross Beat sur un passage de la section, calculé hors ligne (freeze dans le Worker, mis en cache). */
export interface EffetPerf {
  type: TypePerf;
  /** Début dans la section (pas, arrondi au 1/24). */
  pas: number;
  /** Durée (pas, arrondie au 1/24, au moins 1, sans dépasser la section). */
  duree: number;
  /** stutter et gate seulement (défaut 4). */
  division?: (typeof DIVISIONS_PERF)[number];
  /** Pistes touchées (ids) ; absent = toutes les pistes sauf la voix. */
  pistes?: string[];
}

/* ------------------------------------------------------------ marqueurs (Morceau.marqueurs) */

export interface Marqueur {
  id: string;
  /** 40 caractères au plus. */
  nom: string;
  /** Ancré à une apparition de section, comme une prise : il suit la section. */
  ancre: { section: string; occurrence: number; mesure: number };
}

/* ------------------------------------------------------------ SoundFonts (Morceau.soundfonts) */

/** Clé d'un fichier .sf2 importé dans OPFS (dossier ocka-sf2) : « sf2-<id>.sf2 ». */
export const REGLE_CLE_SF2 = /^sf2-[A-Za-z0-9_-]{1,40}\.sf2$/;

/** Une SoundFont de l'utilisateur (sous sa responsabilité). Ses presets se jouent par « sf2-<id>-<banque>-<preset>@1 ». */
export interface SoundFontMorceau {
  id: string;
  /** 60 caractères au plus. */
  nom: string;
  /** REGLE_CLE_SF2. */
  fichier: string;
  /** Octets (64 Mo au plus). */
  taille: number;
  /** Empreinte SHA-256 du fichier (64 caractères hexadécimaux), pour le retrouver après un import de projet. */
  sha256?: string;
}

/* ------------------------------------------------------------ sons fabriqués et découpés (SonImporte) */

/** Fabricant de kick (façon Kicker) : le son est recalculé à l'identique depuis la recette. */
export interface RecetteKick {
  type: 'kick';
  /** Hauteur finale (Hz, 30 à 150) et de départ (Hz, 60 à 800). */
  hauteur: number;
  depart: number;
  /** Chute de la hauteur (s, 0,005 à 1) et durée totale (s, 0,05 à 2). */
  chute: number;
  duree: number;
  /** Claquement de l'attaque et saturation, 0 à 1. */
  claquement: number;
  saturation: number;
}

/** Bruitage façon sfxr : graine + réglages (−1 à 1, noms de sfxr en camelCase), recalculé à l'identique. */
export interface RecetteSfxr {
  type: 'sfxr';
  /** Entier de 0 à 2^31 − 1. */
  graine: number;
  /** 32 réglages au plus. Dictionnaire sans prototype. */
  params: Record<string, number>;
}

export type RecetteSon = RecetteKick | RecetteSfxr;

/** Découpe (sample chop) : un passage du MÊME tampon, en secondes. */
export interface DecoupeSon {
  debut: number;
  fin: number;
}

/* ------------------------------------------------------------ autotune d'une prise (Prise.autotune) */

export const PRESETS_AUTOTUNE = ['naturel', 'pop', 'robot', 'hyperpop', 'perso'] as const;
export type PresetAutotune = (typeof PRESETS_AUTOTUNE)[number];

/** Une note de l'éditeur (découpée aux sauts > 70 cents tenus 60 ms et aux attaques), en secondes DANS le fichier. */
export interface NoteAutotune {
  debut: number;
  fin: number;
  /** Note visée (MIDI, entier, 24 à 96). */
  midi: number;
  /** Justesse fine ajoutée (cents, −100 à 100). */
  cents: number;
  /** Vibrato gardé : 0 = aplati, 1 = tel quel, 2 = doublé. */
  vibrato: number;
}

/** Autotune réglable d'une prise ; absent = le réglage simple de la piste voix (Piste.effets.autotune). */
export interface AutotunePrise {
  /** « morceau » = la tonalité du morceau ; « chromatique » = toutes les notes. */
  gamme: 'morceau' | 'chromatique' | { tonique: Tonique; mode: Mode };
  /** Constante de temps du passe-bas de correction (ms, 0 à 400 ; 0 = robot). */
  vitesse: number;
  /** 0 à 1. */
  force: number;
  /** Garde le vibrato naturel, 0 à 1. */
  humaniser: number;
  /** Décalage des formants (demi-tons, −12 à 12 ; 0 = préservés). */
  formants: number;
  preset: PresetAutotune;
  /** Notes modifiées dans l'éditeur (1024 au plus, triées par début, sans chevauchement). */
  notes?: NoteAutotune[];
}

/* ------------------------------------------------------------ synthés (PisteInstrument.synthe) */

/** Réglages d'un instrument fabriqué par le code (303, chiptune, onde dessinée…). */
export interface ReglagesSynthe {
  /** Réglages normalisés de 0 à 1 (32 au plus, noms en camelCase) ; le synthé les convertit. Sans prototype. */
  params?: Record<string, number>;
  /** Onde dessinée (BitInvader) : 16 à 256 valeurs de −1 à 1. */
  onde?: number[];
}

/* ------------------------------------------------------------ infos du titre (sortie) */

export const ROLES_CREDIT = ['auteur', 'compositeur', 'producteur', 'interprete'] as const;
export type RoleCredit = (typeof ROLES_CREDIT)[number];
export const NIVEAUX_IA = ['aucune', 'aide', 'ia'] as const;
/** Déclaration de l'IA, élément par élément : aucune, aide (l'IA a aidé), ia (fait par l'IA). */
export type NiveauIa = (typeof NIVEAUX_IA)[number];

export interface InfosTitre {
  /** « Il y a des gros mots ? » — absent = pas encore répondu. */
  explicite?: boolean;
  /** Code de langue (« fr », « en », « pt-BR ») ou « instrumental ». */
  langue?: string;
  /** Vrais noms complets (exigés par les distributeurs) ; 20 au plus. */
  credits?: { nom: string; role: RoleCredit }[];
  /** Nom de l'invité, écrit ensuite « (feat. X) » dans le titre. */
  featuring?: string;
  /** ISRC si le titre est déjà sorti (12 caractères, sans tirets). */
  isrc?: string;
  ia?: { paroles: NiveauIa; musique: NiveauIa; voix: NiveauIa };
}
