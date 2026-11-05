// Format d'une sortie OCKA — "ocka.sortie/1" (single, EP ou album envoyé chez un distributeur).
// Stockée dans IndexedDB (base ocka-sorties), normalisée par normaliserSortie (src/morceau/normaliser-sortie.ts).
// `titres` est la SEULE source de vérité : un morceau peut être dans plusieurs sorties.

export const FORMAT_SORTIE = 'ocka.sortie/1';
export const VERSION_SORTIE = 1;

export const DISTRIBUTEURS = ['routenote', 'distrokid', 'autre'] as const;
export type Distributeur = (typeof DISTRIBUTEURS)[number];

/** Type de sortie selon la règle de Spotify (voir typeSortie). */
export type TypeSortie = 'single' | 'ep' | 'album';

export interface Sortie {
  format: typeof FORMAT_SORTIE;
  /** REGLE_ID. */
  id: string;
  titre: string;
  artiste: string;
  /** Lien du profil Spotify de l'artiste (https://…). */
  lienProfil?: string;
  /** Date de sortie « AAAA-MM-JJ » (défaut : aujourd'hui + 6 semaines). */
  dateSortie: string;
  genre: string;
  /** Label : absent = le nom de l'artiste (jamais « N/A »). */
  label?: string;
  /** Code de langue des métadonnées (« fr »). */
  langue: string;
  /** Code-barres UPC/EAN (12 ou 13 chiffres) s'il existe déjà ; sinon le distributeur le donne. */
  upc?: string;
  /** Ids des morceaux, dans l'ordre (32 au plus, sans doublon). */
  titres: string[];
  /** Clé de la pochette JPEG dans IndexedDB ocka-pochettes (REGLE_CLE_POCHETTE). */
  pochette?: string;
  distributeur: Distributeur;
  /** Un seul niveau pour toute la sortie (il remplace master.niveau de chaque titre à l'export). */
  niveau: 'standard' | 'fort';
  /** Date de modification (ms depuis 1970). */
  modifieLe: number;
}

/** Ligne de l'onglet « Sorties » de l'accueil. */
export interface ResumeSortie {
  id: string;
  titre: string;
  artiste: string;
  nbTitres: number;
  /** Durée totale (s) des titres encore présents. */
  duree: number;
  type: TypeSortie;
  pochette?: string;
  modifieLe: number;
}

/** Réglages de l'utilisateur (IndexedDB ocka-reglages), pour pré-remplir les sorties. */
export interface Reglages {
  /** Vrai nom complet (demandé une seule fois, pour pré-remplir les crédits). */
  vraiNom?: string;
  artiste?: string;
  lienProfil?: string;
  distributeur?: Distributeur;
}

/**
 * Un problème de la liste « Prêt pour Spotify ? ». « bloquant » empêche « Préparer le dossier » ;
 * « conseil » s'affiche seulement. `corriger` dit où ramener l'utilisateur (écran de l'assistant,
 * id du titre concerné, nom du champ à mettre en avant).
 */
export interface ProblemeSortie {
  /** Code stable (ex. « pochette_absente », « titre_trop_court ») : pour les tests et le bouton Corriger. */
  code: string;
  niveau: 'bloquant' | 'conseil';
  message: string;
  corriger: { ecran: 'infos' | 'pochette' | 'verifier'; titre?: string; champ?: string };
}
