// CONTRAT C3 — VOIX AVANCÉE, ÉCOUTE DE RÉFÉRENCE, GEL D'UNE PISTE (propriétaire : V). Ré-exporté par moteur/api.ts.
// Chaque type et chaque signature ci-dessous est FIGÉ. Implémentations : ./voix-avancee.ts (punch-in, comping,
// nettoyeur, doublage, chaînes de voix, crochet de lecture), moteur/reference.ts, moteur/gel.ts.
// Règle C3 (le format n'a pas de champ pour eux) : punch-in, comping, nettoyeur et doublage produisent une NOUVELLE
// prise (fichier OPFS, même ancre, même alignement), choisie à la place de la prise source (gardée, non choisie).

import type { IdPiste, Insert, Morceau } from '../morceau/types';
import type { Lecteur } from '../moteur/api';
import * as gel from '../moteur/gel';
import * as reference from '../moteur/reference';
import { relier } from '../moteur/relier';
import * as voix from './voix-avancee';

/* ------------------------------------------------------------ punch-in */

/** Le passage à réenregistrer, en pas DANS la section (au 1/24), et le pré-roll joué avant (mesures). */
export interface ZonePunch {
  section: string;
  occurrence: number;
  de: number;
  a: number;
  preRoll: 1 | 2;
}
export interface Punch {
  /** Lecture `preRoll` mesures avant `de`, capture (même calibrage que l'enregistreur), puis arrêt seul après `a`. */
  demarrer(lecteur: Lecteur, m: Morceau, zone: ZonePunch): Promise<void>;
  /** Arrête ; renvoie le morceau où la prise de la section est remplacée par l'assemblage (fondus de 10 ms). */
  arreter(): Promise<Morceau>;
  readonly niveau: number;
  readonly enCours: boolean;
  detruire(): void;
}
/** Demande le micro (geste requis). Erreurs de l'enregistreur : « micro_refuse », « micro_absent ». */
export const creerPunch: () => Promise<Punch> = relier(() => voix.creerPunch);

/* ------------------------------------------------------------ comping */

/** Un passage gardé d'une prise, en secondes DU MORCEAU (de < a). */
export interface PassageComp {
  prise: string;
  de: number;
  a: number;
}
/** Assemble les passages (fondus enchaînés de 10 ms) en une nouvelle prise choisie pour cette apparition de section. */
export const assemblerComp: (m: Morceau, section: string, occurrence: number, passages: readonly PassageComp[]) => Promise<Morceau> = relier(() => voix.assemblerComp);

/* ------------------------------------------------------------ nettoyeur et doublage (hors ligne, mis en cache) */

/** 0 à 1 chacun (0 = éteint) : porte de bruit, réduction de bruit spectrale simple, désesseur. */
export interface ReglagesNettoyeur {
  porte: number;
  reduction: number;
  desesseur: number;
}
/** 0 à 1 chacun : écart de temps (10 à 40 ms), désaccord (0 à 15 cents), niveau de la doublure. */
export interface ReglagesDoublage {
  ecart: number;
  desaccord: number;
  niveau: number;
}
export const nettoyerPrise: (m: Morceau, idPrise: string, r: ReglagesNettoyeur) => Promise<Morceau> = relier(() => voix.nettoyerPrise);
export const doublerPrise: (m: Morceau, idPrise: string, r: ReglagesDoublage) => Promise<Morceau> = relier(() => voix.doublerPrise);
/** Fait entendre un réglage AVANT de l'appliquer (crochet de lirePcmVoix ; le lecteur se recharge) ; null = fin. */
export const ecouterReglage: (idPrise: string, r: { nettoyeur?: ReglagesNettoyeur; doublage?: ReglagesDoublage } | null) => void = relier(() => voix.ecouterReglage);

/* ------------------------------------------------------------ chaînes de voix prêtes (inserts de C1) */

export const CHAINES_VOIX = ['rap-clair', 'hyperpop', 'lofi-telephone', 'chant-pop', 'drill-sombre', 'grosse-reverbe'] as const;
export type IdChaineVoix = (typeof CHAINES_VOIX)[number];
/** Les chaînes prêtes : des inserts (PARAMS_EFFETS) pour la piste voix. Pur. */
export const chainesVoix: () => { id: IdChaineVoix; nom: string; inserts: Insert[] }[] = relier(() => voix.chainesVoix);
/** Remplace les inserts de la piste voix par ceux de la chaîne (un Annuler). Pur. */
export const appliquerChaineVoix: (m: Morceau, id: IdChaineVoix) => Morceau = relier(() => voix.appliquerChaineVoix);

/* ------------------------------------------------------------ écoute de référence */

export interface InfoReference {
  id: string;
  nom: string;
  duree: number;
  /** Sonie intégrée (LUFS, BS.1770), mesurée à l'import. */
  lufs: number;
}
export interface EcouteReference {
  /** true = on entend la référence (le mix est en pause au même endroit), au même volume perçu que le mix. */
  basculer(versReference: boolean): void;
  readonly surReference: boolean;
  /** Gain appliqué à la référence (dB) pour l'amener à la sonie du mix. */
  readonly compensationDb: number;
  detruire(): void;
}
/** Importe un morceau (MP3, M4A, WAV, FLAC…), décodé en flux par Mediabunny. Erreurs : « reference_illisible », « trop_gros », « disque_plein ». */
export const importerReference: (f: File, options?: { surProgression?: (p: number) => void; signal?: AbortSignal }) => Promise<InfoReference> = relier(() => reference.importerReference);
export const listerReferences: () => Promise<InfoReference[]> = relier(() => reference.listerReferences);
export const supprimerReference: (id: string) => Promise<void> = relier(() => reference.supprimerReference);
/** Le mix comparé (défaut : le dernier morceau chargé pour l'écoute) et le passage de la référence (s, défaut 0). */
export interface OptionsEcouteReference {
  morceau?: Morceau;
  passage?: number;
}
/** A/B avec la référence (« <id> » ; l'ancienne forme « <id>#t=<s> » reste lue). */
export const creerEcouteReference: (lecteur: Lecteur, idReference: string, options?: OptionsEcouteReference) => Promise<EcouteReference> = relier(() => reference.creerEcouteReference);

/* ------------------------------------------------------------ gel d'une piste (« freeze ») */

/** Rend la piste une fois et la joue telle quelle (moteur/gels.ts) ; l'état « gelée » vit dans la séance. */
export const gelerPiste: (m: Morceau, idPiste: IdPiste, options?: { surProgression?: (p: number) => void; signal?: AbortSignal }) => Promise<void> = relier(() => gel.gelerPiste);
export const degelerPiste: (idPiste: IdPiste) => void = relier(() => gel.degelerPiste);
/** Les pistes gelées dont le rendu est à jour pour ce morceau. */
export const pistesGelees: (m: Morceau) => IdPiste[] = relier(() => gel.pistesGelees);
