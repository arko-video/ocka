// CONTRAT de la vague A — FICHIERS (propriétaire : A2). Ré-exporté par api.ts ; l'interface importe depuis api.ts.
// Chaque type ci-dessous est FIGÉ : l'implémentation (fichier indiqué) doit le respecter, sinon tsc échoue ici.
// Toutes les erreurs sont des ErreurOcka (message en français) ; codes indiqués pour chaque fonction.

import type { Master, Morceau, SonImporte } from '../morceau/types';
import * as importSons from '../sons/import';
import * as projetsExport from '../projets/exporter';
import * as projetsImport from '../projets/importer';
import * as dossiers from '../stockage/dossiers';
import type { EcrivainFlux } from '../zip/types';
import * as exportAudio from './export';
import { relier } from './relier';
import type { PcmSon } from './types-moteur';

export type { PcmSon } from './types-moteur';

/** Formats audio d'un titre. wav24 = Spotify / DistroKid ; wav16 et flac16 = 16 bits avec dither TPDF ; m4a = AAC 256 kb/s. */
export type FormatAudio = 'wav24' | 'wav16' | 'flac16' | 'm4a';

export interface OptionsAudio {
  format: FormatAudio;
  /** Niveau imposé (dossier de sortie : un seul niveau pour tous les titres). Défaut : morceau.master.niveau. */
  niveau?: Master['niveau'];
  /**
   * Écrit le fichier dans ce flux (une entrée du ZIP de sortie, ouverte par l'appelant) au lieu de créer un fichier
   * dans ocka-exports. L'en-tête doit être connu d'avance (taille calculée avant d'écrire). L'appelant ferme l'entrée.
   */
  ecrivain?: EcrivainFlux;
  surProgression?: (p: number) => void;
  signal?: AbortSignal;
}

export interface ResultatAudio {
  /** Le fichier (« Titre.wav », « .flac », « .m4a ») dans ocka-exports ; null quand on a écrit dans `ecrivain`. */
  fichier: File | null;
  /** Octets écrits. */
  octets: number;
  /** Sonie intégrée (LUFS) et crête vraie (dBTP) mesurées sur le résultat (M4A : après décodage). */
  lufs: number;
  creteVraie: number;
  duree: number;
}

/** Progression (0 à 1) et annulation des opérations longues. */
export interface OptionsLongues {
  surProgression?: (p: number) => void;
  signal?: AbortSignal;
}

export interface ResultatImport {
  type: 'morceau' | 'sortie';
  /** Id NEUF du morceau ou de la sortie créé (jamais un id existant écrasé). */
  id: string;
}

/* ------------------------------------------------------------ audio (src/moteur/export.ts) */

/**
 * Exporte un titre au niveau Spotify (BS.1770 puis limiteur à crête vraie, comme exporterWav), en WAV 24 ou 16 bits,
 * FLAC 16 bits (encodeur fait main, en flux) ou M4A (AAC 256 kb/s encodé pendant la dernière passe, pas de second rendu ;
 * encodeur natif du navigateur, sinon secours WebAssembly, d'où 'wasm-unsafe-eval' dans la CSP).
 * Erreurs : « morceau_invalide », « trop_court », « annule », « disque_plein », « format_impossible » (M4A impossible
 * sur ce téléphone : conseiller le WAV).
 */
export const exporterAudio: (morceau: Morceau, options: OptionsAudio) => Promise<ResultatAudio> = relier(() => exportAudio.exporterAudio);
/** Taille estimée (octets) d'un titre de `duree` s dans ce format (pour verifierPlace avant un export). Pure. */
export const tailleEstimee: (duree: number, format: FormatAudio) => number = relier(() => exportAudio.tailleEstimee);

/* ------------------------------------------------------------ projets (src/projets/) */

/**
 * « Exporter le projet » : « Titre.ocka » (ZIP : morceau.json, prises en WAV 32 bits flottants, sons importés)
 * dans ocka-exports. Erreurs : « morceau_introuvable », « disque_plein », « annule ».
 */
export const exporterProjet: (idMorceau: string, options?: OptionsLongues) => Promise<File> = relier(() => projetsExport.exporterProjet);
/**
 * « Titre.ocka-sortie » : sortie.json, pochette.jpg et chaque morceau comme dans un .ocka.
 * Erreurs : « sortie_introuvable », « disque_plein », « annule ».
 */
export const exporterSortieProjet: (idSortie: string, options?: OptionsLongues) => Promise<File> = relier(() => projetsExport.exporterSortieProjet);
/**
 * « Importer un projet » (.ocka ≤ 1 Go, .ocka-sortie ≤ 3,9 Go) : lecture sûre (src/zip/lire.ts), JSON normalisé,
 * clés OPFS NEUVES pour chaque fichier, ids neufs, place vérifiée (× 1,1), tout ou rien (enregistré en dernier).
 * Erreurs : « projet_illisible », « projet_trop_gros », « format_recent », « disque_plein », « annule ».
 */
export const importerProjet: (f: File, options?: OptionsLongues) => Promise<ResultatImport> = relier(() => projetsImport.importerProjet);

/* ------------------------------------------------------------ sons importés (src/sons/import.ts) */

/**
 * Importe un son (WAV, MP3, M4A, OGG) pour `morceau` : ≤ 20 Mo, durée vérifiée AVANT decodeAudioData, écrit dans
 * ocka-sons à sa fréquence d'ORIGINE (SonImporte.frequence). C'est le moteur (M1, instruments/importes.ts) qui le
 * rééchantillonne une fois (sinc) à la fréquence du contexte, à la lecture. Ne modifie PAS le morceau : l'interface
 * ajoute le SonImporte rendu dans morceau.sons. Erreurs : « son_trop_gros », « son_trop_long » (120 s au total
 * par morceau), « trop_de_sons » (16), « son_illisible », « disque_plein ».
 */
export const importerSon: (f: File, morceau: Morceau) => Promise<SonImporte> = relier(() => importSons.importerSon);
/** PCM d'un son importé (pour le graphe), ou null si son fichier n'existe plus. */
export const lireSon: (son: SonImporte) => Promise<PcmSon | null> = relier(() => importSons.lireSon);

/* ------------------------------------------------------------ stockage (src/stockage/dossiers.ts, contrat) */

/**
 * Demande que les données d'OCKA ne soient pas effacées quand le téléphone manque de place. Après un geste
 * (première prise, premier export). true si accordé ; sinon conseiller « Exporter le projet ».
 */
export const demanderPersistance: () => Promise<boolean> = relier(() => dossiers.demanderPersistance);
