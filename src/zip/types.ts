// Interfaces internes du ZIP d'OCKA (contrat entre A2, qui les implémente, et A1 / M2, qui les utilisent).
// Écriture : méthode « stocké » (0) seulement, EN FLUX dans OPFS, jamais tout le fichier en mémoire, pas de ZIP64
// (refus au-delà de 3,9 Go). L'en-tête local de chaque entrée est écrit d'avance puis CORRIGÉ (taille + CRC32)
// à la fermeture de l'entrée, par un `seek` dans le fichier OPFS : aucun fichier temporaire, pas de descripteur.
// Lecture : par le RÉPERTOIRE CENTRAL avec File.slice (rien n'est chargé d'un coup), règles strictes (§5).

/** Taille maximale d'un ZIP écrit ou lu (pas de ZIP64). */
export const TAILLE_MAX_ZIP = 3.9e9;

/** Une entrée en cours d'écriture : on y verse des octets, puis on la ferme. */
export interface EcrivainFlux {
  /** Ajoute des octets à la fin (le CRC32 est calculé au fil de l'eau). Lève ErreurOcka « disque_plein » / « trop_gros ». */
  ecrire(o: Uint8Array): Promise<void>;
  /** Octets déjà écrits dans CETTE entrée (pour la progression et les tests). */
  readonly position: number;
  /** Termine l'entrée : corrige son en-tête local (taille + CRC). Plus aucune écriture ensuite. */
  fermer(): Promise<void>;
}

/** Un ZIP en cours d'écriture dans un dossier OPFS d'OCKA. Une seule entrée ouverte à la fois. */
export interface EcrivainZip {
  /**
   * Ouvre une nouvelle entrée `nom` (chemin ZIP en « / », UTF-8, ex. « paroles/01 - Titre.txt »).
   * L'entrée précédente doit être fermée. Noms en double refusés (ErreurOcka « projet_illisible »).
   */
  entree(nom: string): Promise<EcrivainFlux>;
  /** Raccourci : ouvre une entrée, y écrit `donnees` (un Blob est lu en flux), et la ferme. */
  ajouter(nom: string, donnees: Blob | Uint8Array): Promise<void>;
  /** Écrit le répertoire central, ferme le fichier et le renvoie (File OPFS, pas de copie en mémoire). */
  terminer(): Promise<File>;
  /** Abandonne : efface le fichier partiel. Sans erreur si déjà terminé ou annulé. */
  annuler(): Promise<void>;
}

/** Une entrée lue dans le répertoire central. */
export interface EntreeZip {
  nom: string;
  /** Taille décompressée annoncée (octets). */
  taille: number;
  /** Taille dans le ZIP (octets). */
  tailleCompressee: number;
  /** 0 = stocké, 8 = deflate (accepté seulement pour les noms de `ReglesLectureZip.deflate`). */
  methode: 0 | 8;
  crc32: number;
}

/**
 * Règles d'un import (§5) : tout ce qui n'est pas permis est refusé avec ErreurOcka « projet_illisible ».
 * Toujours refusés : ZIP chiffré, ZIP64, méthode autre que 0 ou 8, noms en double, nom local ≠ nom central,
 * plages qui se chevauchent ou sortent du fichier, chemins absolus ou avec « .. ».
 */
export interface ReglesLectureZip {
  /** Taille maximale du fichier ZIP (1 Go pour un projet, 3,9 Go pour une sortie) ; au-delà : « projet_trop_gros ». */
  tailleMax: number;
  /** Liste blanche des noms : chaînes exactes, ou RegExp ENTIÈRES (avec ^ et $), ex. /^prises\/prise-[A-Za-z0-9_-]{1,40}\.wav$/. */
  noms: readonly (string | RegExp)[];
  /** Noms dont la méthode 8 (deflate) est permise : le JSON seulement. */
  deflate: readonly string[];
  /** Taille décompressée maximale d'une entrée deflate (2 Mo pour le JSON). */
  maxDeflate: number;
  /** Nombre maximal d'entrées (ex. 1 + 200 prises + 16 sons). */
  maxEntrees: number;
}

/** Un ZIP ouvert en lecture (rien n'est lu tant qu'on ne demande pas une entrée). */
export interface LecteurZip {
  readonly entrees: readonly EntreeZip[];
  /** Les données d'une entrée stockée (méthode 0), sans copie (File.slice). Lève si absente ou deflate. */
  blob(nom: string): Blob;
  /** Le texte UTF-8 d'une entrée (0 ou 8), CRC vérifié, coupé à `maxDeflate`. Lève si absente ou trop grande. */
  texte(nom: string): Promise<string>;
}
