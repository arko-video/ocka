// CONTRAT C3 — PIANO ROLL MALIN (propriétaire : P). Chaque type et chaque signature ci-dessous est FIGÉ ;
// implémentation : ./outils-notes.ts (bouchons au contrat). Mêmes règles que api-edition.ts : PURES, même objet si
// rien ne change, résultat accepté tel quel par le normaliseur, à passer à `modifier()` (un Annuler).
// `indices` : notes choisies du motif de la section (null = toutes). Déjà faits (C1) et réutilisés : poserAccord
// (accords en un toucher) et quantifier (grille, FORCE 0 à 1) d'api-edition.ts, ré-exportés ici.

import type { Morceau, Note } from '../../morceau/types';
import { relier } from '../../moteur/relier';
import * as outils from './outils-notes';

export { poserAccord, quantifier } from './api-edition';
type Edition<A extends unknown[]> = (m: Morceau, ...args: A) => Morceau;
type Indices = readonly number[] | null;

export const SENS_ARPEGE = ['haut', 'bas', 'haut-bas', 'hasard'] as const;
export type SensArpege = (typeof SENS_ARPEGE)[number];
export interface ReglagesArpege {
  sens: SensArpege;
  /** Pas entre deux notes (1 = double-croche, 2 = croche, 4 = noire ; 4/3, 2/3 = triolets). */
  vitesse: number;
  /** Octaves parcourues (1 à 3). */
  octaves: 1 | 2 | 3;
  /** Part de la vitesse tenue par chaque note (0,1 à 1). */
  tenue: number;
  /** Graine du sens « hasard ». */
  graine: number;
}
/** Remplace les notes (accords) par leur arpège, sur la durée de chaque accord. */
export const arpeger: Edition<[idPiste: string, idSection: string, indices: Indices, r: ReglagesArpege]> = relier(() => outils.arpeger);

export interface ReglagesStrum {
  sens: 'haut' | 'bas';
  /** Écart entre deux cordes (ms, 0 à 120), converti en pas au tempo, arrondi au 1/24. */
  etalement: number;
}
/** Décale les notes de chaque accord (même pas) comme une guitare grattée. */
export const gratter: Edition<[idPiste: string, idSection: string, indices: Indices, r: ReglagesStrum]> = relier(() => outils.gratter);

export interface ReglagesHumaniser {
  /** 0 à 1 : décalage aléatoire du départ (jusqu'à ±1/4 de pas à 1). */
  timing: number;
  /** 0 à 1 : variation de la vélocité (jusqu'à ±25 % à 1). */
  velocite: number;
  graine: number;
}
export const humaniser: Edition<[idPiste: string, idSection: string, indices: Indices, r: ReglagesHumaniser]> = relier(() => outils.humaniser);

/** Glide : Note.glisse (la note glisse vers la suivante de la piste). */
export const reglerGlisse: Edition<[idPiste: string, idSection: string, indices: readonly number[], glisse: boolean]> = relier(() => outils.reglerGlisse);
/** Swing propre à la piste (0 à 0,6) ; null = celui du morceau (PisteInstrument.swing retiré). */
export const reglerSwingPiste: Edition<[idPiste: string, swing: number | null]> = relier(() => outils.reglerSwingPiste);

export const STYLES_RIFF = ['calme', 'rebondi', 'rapide', 'trap', 'melancolique'] as const;
export const GAMMES_RIFF = ['morceau', 'pentatonique', 'blues', 'harmonique'] as const;
export interface ReglagesRiff {
  graine: number;
  gamme: (typeof GAMMES_RIFF)[number];
  style: (typeof STYLES_RIFF)[number];
  /** 0 à 1 : part des pas qui portent une note. */
  densite: number;
}
/** « Riff machine » : une mélodie générée par règles (pas d'IA), dans la gamme, calée sur les accords. Remplace le motif. */
export const riffMachine: Edition<[idPiste: string, idSection: string, r: ReglagesRiff]> = relier(() => outils.riffMachine);

/** Notes fantômes : les notes des AUTRES pistes instrument dans cette section (pour les afficher en gris). Pur. */
export const notesFantomes: (m: Morceau, idPiste: string, idSection: string) => { piste: string; pas: number; notes: Note[] }[] = relier(() => outils.notesFantomes);
