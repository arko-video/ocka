// CONTRAT C3 — SONS AVANCÉS (propriétaire : S). Ré-exporté par moteur/api.ts. Chaque type et chaque signature est
// FIGÉ ; implémentation : ./avances.ts (bouchons au contrat). Les fonctions sur le morceau sont PURES (un Annuler).
// Découpes = SonImporte.tranches (décalages dans le MÊME tampon, 64 au plus) ; un pad perso joue la découpe
// Morceau.tranchesPads[pad] (déjà branché dans le moteur au contrat C3 : preparation.ts, clé du pad).
// Un son modifié (éditeur, étirement) est un NOUVEAU son importé (OPFS ocka-sons, par importerSon d'un WAV).

import type { DecoupeSon, Mode, Morceau, PadPerso, SonImporte, Tonique } from '../morceau/types';
import { relier } from '../moteur/relier';
import type { PcmSon } from '../moteur/types-moteur';
import * as avances from './avances';

/** Découpe aux attaques (flux spectral) : `sensibilite` 0 à 1 (1 = toutes les attaques). Triées, dans [0, durée]. Pur. */
export const decouperAttaques: (pcm: PcmSon, sensibilite: number) => DecoupeSon[] = relier(() => avances.decouperAttaques);
/** Découpe en `parts` parts égales (2 à 64). Pur. */
export const decouperEgal: (duree: number, parts: number) => DecoupeSon[] = relier(() => avances.decouperEgal);
/** Pose les découpes d'un son (SonImporte.tranches). Pur. */
export const poserDecoupes: (m: Morceau, idSon: string, tranches: readonly DecoupeSon[]) => Morceau = relier(() => avances.poserDecoupes);
/** Envoie les découpes `premiere`, `premiere + 1`… sur les pads perso (tous, ou ceux donnés) : pads + tranchesPads. Pur. */
export const tranchesVersPads: (m: Morceau, idSon: string, premiere: number, pads?: readonly PadPerso[]) => Morceau = relier(() => avances.tranchesVersPads);

/** Éditeur (façon Edison), en secondes dans le son. */
export type OperationSon =
  | { type: 'couper'; de: number; a: number }
  | { type: 'fondu'; de: number; a: number; sens: 'entree' | 'sortie' }
  | { type: 'normaliser'; crete?: number }
  | { type: 'inverser'; de?: number; a?: number };
/** Applique une opération : renvoie le NOUVEAU son importé (à poser par ajouterSon / remplacer sur les pads). */
export const editerSon: (m: Morceau, idSon: string, op: OperationSon) => Promise<SonImporte> = relier(() => avances.editerSon);

/** WSOLA : `rapport` = nouvelle durée / ancienne (0,8 à 1,25 environ), hauteur gardée. Pur. */
export const etirerPcm: (pcm: PcmSon, rapport: number) => PcmSon = relier(() => avances.etirerPcm);
/** Étire un son importé (Worker) : nouveau son importé. */
export const etirerSon: (m: Morceau, idSon: string, rapport: number) => Promise<SonImporte> = relier(() => avances.etirerSon);

/** BPM détecté, avec le double et la moitié (on les montre aussi) et la confiance (0 à 1). */
export interface BpmDetecte {
  bpm: number;
  double: number;
  moitie: number;
  confiance: number;
}
export const detecterBpm: (pcm: PcmSon) => BpmDetecte | null = relier(() => avances.detecterBpm);
export interface TonaliteDetectee {
  tonique: Tonique;
  mode: Mode;
  confiance: number;
}
/** Les 2 tonalités les plus probables (chromagramme), la meilleure d'abord ; [] pour un son sans hauteur. Pur. */
export const detecterTonaliteSon: (pcm: PcmSon) => TonaliteDetectee[] = relier(() => avances.detecterTonaliteSon);
