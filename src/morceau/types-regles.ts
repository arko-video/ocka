// Format /3 — règles d'écriture (ids, clés de fichiers, instruments) et PLAFONDS du format. Ré-exporté par types.ts.
// Toutes ces constantes sont gelées au contrat C0 ; le normaliseur les applique (il coupe au-delà, avec un message).

/* ------------------------------------------------------------ règles d'écriture (communes à tous) */

/** Identifiant (motif, section, prise, son, morceau, sortie) : 1 à 40 caractères, lettres, chiffres, _ et -. */
export const REGLE_ID = /^[A-Za-z0-9_-]{1,40}$/;
/** Clé du fichier d'une prise dans OPFS (dossier ocka-prises) : « prise-<id>.f32 ». */
export const REGLE_CLE_PRISE = /^prise-[A-Za-z0-9_-]{1,40}\.f32$/;
/** Clé du fichier d'un son importé dans OPFS (dossier ocka-sons) : « son-<id>.f32 ». */
export const REGLE_CLE_SON = /^son-[A-Za-z0-9_-]{1,40}\.f32$/;
/** Clé d'une pochette dans IndexedDB (base ocka-pochettes) : « pochette-<id> ». */
export const REGLE_CLE_POCHETTE = /^pochette-[A-Za-z0-9_-]{1,40}$/;

/** Instrument d'une piste : « <banque>@<version> » (« ocka-piano@1 », « vcsl-marimba@1 », « sf2-<idSon>-<banque>-<preset>@1 »). */
export const REGLE_INSTRUMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}@[1-9][0-9]{0,2}$/;
/** Instrument donné à une piste dont l'instrument est mal écrit. */
export const INSTRUMENT_DEFAUT = 'ocka-piano@1';
/** Grille des notes, des points d'automation et des effets de performance : 1/24 de pas. */
export const GRILLE_PAS = 24;

/** Plafonds du format (le normaliseur coupe au-delà). */
export const PLAFONDS = {
  motifs: 256,
  sections: 64,
  ordre: 200,
  /** Notes d'un motif de basse ou d'accords. */
  notesParMotif: 512,
  /** Notes d'un MotifNotes. */
  notesParMotifNotes: 1024,
  /** Longueur d'un MotifNotes (pas) : 16 à 128, multiple de 16. */
  pasMotifNotes: 128,
  /** Pistes instrument (en plus des 5 pistes fixes). */
  pistesInstrument: 16,
  inserts: 6,
  courbes: 8,
  pointsParCourbe: 64,
  lfo: 2,
  perfParSection: 8,
  marqueurs: 64,
  soundfonts: 8,
  /** Taille d'une SoundFont (octets). */
  tailleSoundfont: 64 * 1024 * 1024,
  decoupesParSon: 64,
  notesAutotune: 1024,
  paramsSynthe: 32,
  ondeSynthe: 256,
  prises: 200,
  sons: 16,
  /** Durée totale des sons importés d'un morceau (s). */
  dureeSons: 120,
  titresParSortie: 32,
} as const;

/** Bornes d'une Note (MotifNotes). */
export const BORNES_NOTE = { midiMin: 12, midiMax: 120, velMin: 0.1, velMax: 1 } as const;
