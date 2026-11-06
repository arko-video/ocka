// CONTRAT C1 (v2) — BANQUE D'INSTRUMENTS. Ré-exporté par api.ts ; l'interface importe depuis api.ts.
// Chaque type ci-dessous est FIGÉ. Implémentations (reliées à l'intégration C1) : src/instruments/api-banque.ts (BQ :
// catalogue, téléchargement, gestion, export) et moteur/instruments/fournisseur.ts (M1 : zones lues et décodées).
// Fichiers : public/instruments/<id>/instrument.json + fichiers Opus (même origine), Cache Storage « ocka-instruments ».

import * as banque from '../instruments/api-banque';
import * as fournisseur from './instruments/fournisseur';
import { relier } from './relier';
import type { PcmSon, SourceZones } from './types-moteur';
import type { Morceau } from '../morceau/types';

/**
 * Familles du choix d'instrument (« + Piste »), dans l'ordre d'affichage. Les FAMILLES de instrument.json
 * (src/instruments/format.ts, BQ) en sont un sous-ensemble ; « Chœurs » et « Synthés » sont fabriqués par le code.
 */
export const FAMILLES_INSTRUMENTS = ['Claviers', 'Guitares', 'Basses', 'Cordes', 'Vents', 'Percussions mélodiques', 'Chœurs', 'Synthés', 'Batteries', 'Percussions'] as const;
export type FamilleInstrument = (typeof FAMILLES_INSTRUMENTS)[number];

/** Une entrée du catalogue (instruments de la banque ET sons fabriqués par le code, « ocka-<son>@1 » compris). */
export interface InfoInstrument {
  /** Id versionné écrit dans PisteInstrument.instrument (« vcsl-marimba@1 »). */
  id: string;
  /** Nom affiché, en français (« Marimba »). */
  nom: string;
  famille: FamilleInstrument;
  /** « banque » = échantillons à télécharger ; « code » = fabriqué par OCKA (rien à télécharger). */
  source: 'banque' | 'code';
  /** Octets à télécharger (0 pour « code »). */
  taille: number;
  /** true si jouable hors ligne (déjà dans le Cache Storage, ou « code »). */
  installe: boolean;
  /** Mots pour la recherche (« piano à queue steinway »), en minuscules sans accents. */
  motsCles: string[];
  /** Provenance (affichée dans « Gérer les instruments » et CREDITS) ; absent pour « code ». */
  licence?: { nom: string; auteur: string; url: string };
}

/** Progression d'un téléchargement. */
export interface ProgressionTelechargement {
  octets: number;
  total: number;
}

export interface OptionsTelechargement {
  surProgression?: (p: ProgressionTelechargement) => void;
  signal?: AbortSignal;
}

/* ------------------------------------------------------------ interface (« + Piste », « Gérer les instruments ») */

/** Le catalogue complet, trié par famille puis par nom. Sans réseau : lu dans le bundle. */
export const listerInstruments: () => Promise<InfoInstrument[]> = relier(() => banque.listerInstruments);

/**
 * Télécharge un instrument (instrument.json puis ses fichiers, même origine) dans le Cache Storage « ocka-instruments »,
 * SHA-256 vérifiés, avec la progression. Rien à faire pour « code » ou un instrument déjà installé.
 * Erreurs : « hors_ligne », « instrument_inconnu », « instrument_corrompu » (empreinte fausse), « disque_plein », « annule ».
 */
export const telechargerInstrument: (id: string, options?: OptionsTelechargement) => Promise<void> = relier(() => banque.telechargerInstrument);

/** « Gérer les instruments » : les instruments téléchargés et la place que chacun prend (octets). */
export const instrumentsInstalles: () => Promise<{ id: string; octets: number }[]> = relier(() => banque.instrumentsInstalles);

/** Supprime un instrument téléchargé (ses pistes deviennent muettes jusqu'au prochain téléchargement). */
export const supprimerInstrument: (id: string) => Promise<void> = relier(() => banque.supprimerInstrument);

/** Place totale prise par les instruments téléchargés (octets). */
export const tailleInstruments: () => Promise<number> = relier(() => banque.tailleInstruments);

/** Les instruments du morceau qui ne sont pas jouables ici (pas téléchargés, ou inconnus de cette version). */
export const instrumentsManquants: (m: Morceau) => Promise<string[]> = relier(() => fournisseur.instrumentsManquants);

/**
 * Avant un export : télécharge ce qui manque. Hors ligne : ErreurOcka « hors_ligne » au message clair (JAMAIS de
 * piste muette dans un export) ; instrument inconnu de cette version : « instrument_inconnu ».
 */
export const preparerInstrumentsExport: (m: Morceau, options?: OptionsTelechargement) => Promise<void> = relier(() => banque.preparerInstrumentsExport);

/* ------------------------------------------------------------ moteur (M1, échantillonneur) */

/** Les zones d'un instrument installé (instrument.json lu dans le cache). Erreur : « instrument_absent ». */
export const chargerSource: (id: string, signal?: AbortSignal) => Promise<SourceZones> = relier(() => fournisseur.banque.chargerSource);

/** PCM décodé d'un fichier de zone (Opus → 48 kHz, amorce retirée), lu dans le cache. Erreur : « instrument_absent ». */
export const lireZone: (id: string, fichier: string, signal?: AbortSignal) => Promise<PcmSon> = relier(() => fournisseur.zonePcm);
