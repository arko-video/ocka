// Format d'un morceau OCKA — "ocka.morceau/3". C'est la SEULE source de vérité d'un morceau :
// l'interface (et une IA) écrit ce format, l'écoute et l'export ne lisent que lui.
// Temps musicaux en PAS de double-croche : 16 pas par mesure de 4/4.
// Version 3 (v2 d'OCKA, gelée ENTIÈREMENT au contrat C0 jusqu'aux champs de C3) : pistes instrument en nombre
// libre (16 au plus), un motif de notes par piste et par section, tranches de mélangeur (inserts, sidechain,
// automation, LFO), effets de performance, marqueurs, SoundFonts, recettes et découpes des sons, autotune réglable.
// Le normaliseur lit les versions 1 à 3 et écrit toujours la version 3 (la mélodie /2 devient la piste
// instrument « melodie », instrument « ocka-<son>@1 » : même son). Un OCKA v1 refuse un /3 (format plus récent).
// Ajouts des vagues C2 et C3 : types-ajouts.ts ; tranche (mixage) : types-mixage.ts. Accesseurs : acces.ts.

import type { AutotunePrise, DecoupeSon, EffetPerf, InfosTitre, Marqueur, RecetteSon, ReglagesSynthe, SoundFontMorceau } from './types-ajouts';
import type { Tranche } from './types-mixage';

export * from './types-ajouts';
export * from './types-regles';
export * from './types-mixage';

export const FORMAT_MORCEAU = 'ocka.morceau/3';
/** Version du format écrite par cette version d'OCKA (les versions plus récentes sont refusées). */
export const VERSION_MORCEAU = 3;

/* ------------------------------------------------------------ listes fermées */

/**
 * Ids des styles, FIGÉS (contrat C2) : les 6 des phases 0 à 6, puis les 9 styles rap (S1) et les 20 autres (S2).
 * Chaque style a son fichier morceau/styles/<id>.ts (registre : morceau/styles/index.ts) ; l'ordre ici ne compte pas
 * pour l'affichage (l'écran du choix groupe par familles).
 */
export const STYLES = [
  'trap', 'drill', 'lofi', 'phonk', 'pop', 'boombap',
  'rage', 'plugg', 'cloud', 'jerseyclub', 'afrotrap', 'rapmelodique', 'jazzrap', 'ukdrill', 'memphis',
  'hyperpop', 'bossanova', 'rnb', 'afrobeats', 'reggaeton', 'amapiano', 'house', 'techno', 'dnb', 'ukgarage',
  'synthwave', 'jazz', 'rock', 'poppunk', 'funk', 'reggae', 'gospel', 'orchestral', 'ambient', 'kpop',
] as const;
export type Style = (typeof STYLES)[number];
export type Mode = 'majeur' | 'mineur';
/** Note de la gamme chromatique (dièses). */
export type Tonique = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

/** Pads « Tes sons » : un son importé joué sur la grille de batterie comme le kick. */
export const PADS_PERSO = ['perso1', 'perso2', 'perso3', 'perso4'] as const;
export type PadPerso = (typeof PADS_PERSO)[number];
export const INSTRUMENTS_BATTERIE = ['kick', 'snare', 'clap', 'charley', 'charleyOuvert', 'rim', 'cowbell', 'perc', ...PADS_PERSO] as const;
export type InstrumentBatterie = (typeof INSTRUMENTS_BATTERIE)[number];

/**
 * Sons fabriqués par OCKA v1, joués par les instruments « ocka-<son>@1 » (et par les accords) :
 * `piano` = piano par résonateurs ; `epiano` = piano électrique FM ; `cloche` et `nappe` = ceux des accords.
 */
export const SONS_MELODIE = ['piano', 'epiano', 'lead', 'pluck', 'cloche', 'nappe'] as const;
export type SonMelodie = (typeof SONS_MELODIE)[number];

/** Longueurs possibles d'une boucle (mesures). */
export const MESURES_BOUCLE = [1, 2, 4, 8] as const;

/** Pistes FIXES (toujours là, dans cet ordre) ; une piste instrument n'a jamais un de ces ids. */
export const IDS_FIXES = ['batterie', 'basse', 'accords', 'sons', 'voix'] as const;
export type IdFixe = (typeof IDS_FIXES)[number];
/** Id d'une piste : un IdFixe, ou celui d'une piste instrument (REGLE_ID, jamais un IdFixe). */
export type IdPiste = string;

/* ------------------------------------------------------------ morceau */

export interface Morceau {
  format: typeof FORMAT_MORCEAU;
  titre: string;
  artiste?: string;
  style: Style;
  /** Battements par minute, de 60 à 200. */
  tempo: number;
  /** Swing des double-croches paires, de 0 (droit) à 0,6. */
  swing: number;
  tonalite: { tonique: Tonique; mode: Mode };
  /** Kit de batterie fabriqué par OCKA, versionné (« trap@1 ») : un kit retouché ne change pas les vieux morceaux. */
  kit: string;
  /** Fondu de fin en secondes (0 à 8, défaut 0). */
  fondu?: number;
  /** Dictionnaire id → motif. Créé avec Object.create(null) par le normaliseur (ids hostiles : « __proto__ »…). */
  motifs: Record<string, Motif>;
  sections: Section[];
  /** Arrangement : ids de sections dans l'ordre (une section peut revenir). */
  ordre: string[];
  /**
   * Après le normaliseur : batterie, basse, accords, puis les pistes instrument (16 au plus, dans leur ordre),
   * puis sons et voix. Les 5 pistes fixes sont toujours là.
   */
  pistes: Piste[];
  prises: Prise[];
  master: Master;
  /** Sons importés (« Tes sons ») : 16 au plus, 120 s au total. */
  sons?: SonImporte[];
  /** Pad perso → id d'un son de `sons`. */
  pads?: Partial<Record<PadPerso, string>>;
  /** Pad perso → n° de la découpe (SonImporte.tranches) jouée par ce pad ; absent = le son entier. */
  tranchesPads?: Partial<Record<PadPerso, number>>;
  /** Infos du titre pour la sortie (explicite, langue, crédits, IA…). */
  infos?: InfosTitre;
  /** 64 au plus. */
  marqueurs?: Marqueur[];
  /** SoundFonts importées (8 au plus). */
  soundfonts?: SoundFontMorceau[];
}

export type Motif = MotifBatterie | MotifBasse | MotifAccords | MotifNotes;

export interface MotifBatterie {
  type: 'batterie';
  /** Longueur du motif en pas (16 = 1 mesure, 32 = 2 mesures), multiple de 16, au plus 256. */
  pas: number;
  /** Pour chaque instrument : une vélocité (0 = rien, 0,1 à 1) par pas. */
  pistes: Partial<Record<InstrumentBatterie, number[]>>;
  /** Roulements (trap, drill) : par instrument et par pas, 0 = frappe simple, 2/3/4/6 = frappes dans le pas. */
  roulements?: Partial<Record<InstrumentBatterie, number[]>>;
}

export interface NoteBasse {
  /** Pas de départ dans le motif. */
  pas: number;
  /** Durée en pas. */
  duree: number;
  /** Degré dans la gamme (0 = tonique), octave relative (−1, 0, +1). */
  degre: number;
  octave?: number;
  /** Glissé vers la note suivante (808 drill). */
  glisse?: boolean;
  vel?: number;
}

export interface MotifBasse {
  type: 'basse';
  pas: number;
  notes: NoteBasse[];
  /** true = la basse suit la fondamentale de l'accord en cours au lieu de la tonique. */
  suitAccords?: boolean;
}

export interface MotifAccords {
  type: 'accords';
  pas: number;
  /** Accords en degrés romains de la gamme : "i", "VI", "iv7", "V"… avec leur pas de départ et leur durée. */
  accords: { pas: number; duree: number; degre: string }[];
  /** Son : « piano » = le piano électrique FM (appelé `epiano` dans la mélodie), nappe ou cloche. */
  son?: 'piano' | 'nappe' | 'cloche';
}

/** Une note d'un motif de notes, en MIDI absolu (BORNES_NOTE). */
export interface Note {
  /** Pas de départ dans le motif, arrondi au 1/24 de pas (0 ≤ pas < longueur du motif). */
  pas: number;
  /** Durée en pas, arrondie au 1/24 (au moins 1/24, sans dépasser la fin du motif). */
  duree: number;
  midi: number;
  /** Vélocité 0,1 à 1 (l'échantillonneur choisit sa couche avec vel × 127 et applique vel^1,6). */
  vel: number;
  /** Glissé (glide) vers la note suivante de la piste. */
  glisse?: boolean;
}

/** Le motif d'une piste instrument dans une section (la généralisation de l'ancien motif « melodie »). */
export interface MotifNotes {
  type: 'notes';
  /** 16 à 128 pas (1 à 8 mesures), multiple de 16. Il boucle jusqu'à la fin de la section. */
  pas: number;
  /** 1024 au plus, triées par pas puis par hauteur ; pas deux notes au même pas et à la même hauteur. */
  notes: Note[];
}

export type NomSection = 'Intro' | 'Couplet' | 'Refrain' | 'Pont' | 'Outro' | string;

export interface Section {
  id: string;
  nom: NomSection;
  /** Nombre de mesures (1 à 16). */
  mesures: number;
  /**
   * Motif joué par chaque piste (id de piste → id de motif ; absent = silence pour cette piste). Dictionnaire SANS
   * prototype. batterie → MotifBatterie, basse → MotifBasse, accords → MotifAccords, piste instrument → MotifNotes.
   * Lire avec les accesseurs de acces.ts (motifDe, motifNotesDe…).
   */
  motifs: Record<IdPiste, string>;
  /** Roulement de batterie (fill) sur la dernière mesure, pour annoncer la section suivante. */
  fill?: boolean;
  /** « break » : dernière mesure sans batterie ; « drop » : première mesure sans batterie ni basse. */
  coupure?: 'aucune' | 'break' | 'drop';
  /** Paroles de la section, affichées en prompteur pendant l'enregistrement. */
  paroles?: string;
  /**
   * Boucle d'un son importé (piste `sons`) : repart au début de la section puis toutes les `mesures` mesures.
   * `caler` : le son est rééchantillonné pour durer exactement `mesures` mesures (ça change un peu la hauteur).
   */
  boucle?: { son: string; mesures: (typeof MESURES_BOUCLE)[number]; caler: boolean };
  /** Effets de performance (8 au plus), calculés hors ligne. */
  perf?: EffetPerf[];
}

/** Piste fixe : batterie, basse (808), accords, sons (importés), voix. */
export interface PisteFixe extends Tranche {
  id: IdFixe;
  genre?: undefined;
  /** Piste voix seulement : réglage prêt (passe-haut 90 Hz, compresseur, réverbe). Défaut « naturel ». */
  preset?: 'naturel' | 'rap' | 'chant';
  /** Piste voix seulement : effets au-dessus du préréglage (absent = aucun effet ajouté). */
  effets?: EffetsVoix;
}

/** Piste instrument (16 au plus) : un MotifNotes par section, joué par `instrument`. */
export interface PisteInstrument extends Tranche {
  /** REGLE_ID, jamais un IdFixe. La mélodie d'un morceau /2 garde l'id « melodie ». */
  id: string;
  genre: 'instrument';
  /** Nom affiché et nom du fichier de piste séparée (40 caractères au plus). */
  nom: string;
  /** REGLE_INSTRUMENT. Inconnu mais bien écrit : gardé (muet tant qu'il n'est pas installé, avec un conseil). */
  instrument: string;
  /** Réglages d'un instrument fabriqué par le code (303, chiptune, onde dessinée…). */
  synthe?: ReglagesSynthe;
  /** Swing propre à la piste (0 à 0,6) ; absent = celui du morceau. */
  swing?: number;
}

export type Piste = PisteFixe | PisteInstrument;

/** Effets de voix. Niveaux de 0 à 1 ; l'autotune est arrondi au dixième (vague B). */
export interface EffetsVoix {
  reverbe?: number;
  echo?: number;
  radio?: boolean;
  doubler?: boolean;
  autotune?: number;
}

export interface Prise {
  id: string;
  /**
   * Où commence la prise : section (id), n° de son apparition dans l'ordre (0 = la 1re fois) et mesure dans la section.
   * Ancrée à la section : si on ajoute une section avant, la voix suit.
   */
  ancre: { section: string; occurrence: number; mesure: number };
  /** Tempo au moment de l'enregistrement (si le tempo change ensuite, l'interface prévient). */
  tempo: number;
  /** Clé du fichier PCM dans OPFS (REGLE_CLE_PRISE). */
  fichier: string;
  /** Fréquence d'échantillonnage du fichier (souvent 48000). */
  frequence: number;
  /** Durée totale du fichier en secondes. */
  duree: number;
  /** Partie gardée du fichier (secondes) : on coupe le début et la fin. */
  debutCoupe: number;
  finCoupe: number;
  /** Décalage de latence à retirer (secondes) : la prise est recalée sur le beat. */
  decalage: number;
  /** Gain linéaire (défaut 1). */
  gain: number;
  /** Prise gardée : une seule prise choisie par section en v1, les autres sont muettes. */
  choisie: boolean;
  nom?: string;
  /** Autotune réglable de cette prise (C2) ; absent = le réglage simple de la piste voix. */
  autotune?: AutotunePrise;
}

/** Un son importé. Le PCM est dans OPFS (dossier ocka-sons) ; seul lireSon (A2) lit ce fichier. */
export interface SonImporte {
  id: string;
  /** Nom affiché (60 caractères au plus). */
  nom: string;
  /** Clé du fichier (REGLE_CLE_SON). */
  fichier: string;
  frequence: number;
  /** Durée en secondes (0 à 120). */
  duree: number;
  canaux: 1 | 2;
  /** Son fabriqué par OCKA (kick, sfxr) : recalculé à l'identique depuis la recette. */
  recette?: RecetteSon;
  /** Découpes (sample chop) : 64 au plus, triées, dans [0, duree]. */
  tranches?: DecoupeSon[];
}

export interface Master {
  /** Couleur du son. */
  preset: 'neutre' | 'chaud' | 'clair' | 'lofi';
  /**
   * Niveau d'export : « standard » = −14 LUFS intégré, crête vraie ≤ −1 dBTP (le niveau de Spotify) ;
   * « fort » = −11 LUFS, crête vraie ≤ −2 dBTP (règle de Spotify pour les masters forts).
   */
  niveau: 'standard' | 'fort';
  /**
   * 1 = chaîne des phases 0 et 1 (morceaux lus en version 1 : le son ne change pas) ;
   * 2 = avec la colle et les panoramiques par défaut (nouveaux morceaux). Facultatif dans le fichier.
   */
  chaine: 1 | 2;
}

/** Un problème trouvé (et souvent corrigé) par le normaliseur. Message en français. */
export interface Probleme {
  chemin: string;
  niveau: 'bloquant' | 'corrige' | 'ignore' | 'conseil';
  message: string;
}
