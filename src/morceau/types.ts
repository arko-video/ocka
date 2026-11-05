// Format d'un morceau OCKA — "ocka.morceau/2". C'est la SEULE source de vérité d'un morceau :
// l'interface (et plus tard une IA) écrit ce format, l'écoute et l'export ne lisent que lui.
// Temps musicaux en PAS de double-croche : 16 pas par mesure de 4/4.
// Version 2 (vague A) : mélodie, sons importés (pads et boucles), effets de voix, chaîne du master, infos du titre.
// Le normaliseur lit les versions 1 et 2 et écrit toujours la version 2. Tous les ajouts sont facultatifs
// DANS LE FICHIER ; après le normaliseur, les pistes `melodie` et `sons` et `master.chaine` sont toujours là.

export const FORMAT_MORCEAU = 'ocka.morceau/2';
/** Version du format écrite par cette version d'OCKA (les versions plus récentes sont refusées). */
export const VERSION_MORCEAU = 2;

/* ------------------------------------------------------------ règles d'écriture (communes à tous) */

/** Identifiant (motif, section, prise, son, morceau, sortie) : 1 à 40 caractères, lettres, chiffres, _ et -. */
export const REGLE_ID = /^[A-Za-z0-9_-]{1,40}$/;
/** Clé du fichier d'une prise dans OPFS (dossier ocka-prises) : « prise-<id>.f32 ». */
export const REGLE_CLE_PRISE = /^prise-[A-Za-z0-9_-]{1,40}\.f32$/;
/** Clé du fichier d'un son importé dans OPFS (dossier ocka-sons) : « son-<id>.f32 ». */
export const REGLE_CLE_SON = /^son-[A-Za-z0-9_-]{1,40}\.f32$/;
/** Clé d'une pochette dans IndexedDB (base ocka-pochettes) : « pochette-<id> ». */
export const REGLE_CLE_POCHETTE = /^pochette-[A-Za-z0-9_-]{1,40}$/;

/** Plafonds du format (le normaliseur coupe au-delà). */
export const PLAFONDS = {
  motifs: 64,
  sections: 64,
  ordre: 200,
  notesParMotif: 512,
  prises: 200,
  sons: 16,
  /** Durée totale des sons importés d'un morceau (s). */
  dureeSons: 120,
  titresParSortie: 32,
} as const;

/* ------------------------------------------------------------ listes fermées */

/** 3 styles finis en vague A ; phonk, pop et boom bap ont des valeurs PROVISOIRES (copie de trap) jusqu'à la vague B. */
export const STYLES = ['trap', 'drill', 'lofi', 'phonk', 'pop', 'boombap'] as const;
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
 * Sons de la mélodie. `piano` = nouveau piano par résonateurs ; `epiano` = le piano électrique FM des accords ;
 * `cloche` et `nappe` = ceux des accords. Pas de basse synthé : la 808 suffit.
 */
export const SONS_MELODIE = ['piano', 'epiano', 'lead', 'pluck', 'cloche', 'nappe'] as const;
export type SonMelodie = (typeof SONS_MELODIE)[number];

/** Pistes du mélangeur, dans l'ordre d'affichage. */
export const IDS_PISTES = ['batterie', 'basse', 'accords', 'melodie', 'sons', 'voix'] as const;
export type IdPiste = (typeof IDS_PISTES)[number];

/** Longueurs possibles d'une boucle (mesures). */
export const MESURES_BOUCLE = [1, 2, 4, 8] as const;

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
  /** Toujours les 6 pistes de IDS_PISTES, dans cet ordre, après le normaliseur. */
  pistes: Piste[];
  prises: Prise[];
  master: Master;
  /** Sons importés (« Tes sons ») : 16 au plus, 120 s au total. */
  sons?: SonImporte[];
  /** Pad perso → id d'un son de `sons`. */
  pads?: Partial<Record<PadPerso, string>>;
  /** Infos du titre pour la sortie (explicite, langue, crédits, IA…). */
  infos?: InfosTitre;
}

export type Motif = MotifBatterie | MotifBasse | MotifAccords | MotifMelodie;

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

/** Une note de mélodie, en MIDI absolu (24 à 108). */
export interface NoteMelodie {
  /** Pas de départ dans le motif (entier). */
  pas: number;
  /** Durée en pas (entier, au moins 1, sans dépasser la fin du motif). */
  duree: number;
  midi: number;
  /** Vélocité 0,1 à 1 (défaut 1). */
  vel?: number;
}

export interface MotifMelodie {
  type: 'melodie';
  /** 16 à 64 pas (1 à 4 mesures), multiple de 16. */
  pas: number;
  /** Triées par pas puis par hauteur ; pas deux notes au même pas et à la même hauteur. */
  notes: NoteMelodie[];
  son: SonMelodie;
}

export type NomSection = 'Intro' | 'Couplet' | 'Refrain' | 'Pont' | 'Outro' | string;

export interface Section {
  id: string;
  nom: NomSection;
  /** Nombre de mesures (1 à 16). */
  mesures: number;
  /** Motif joué par chaque piste instrumentale (absent = silence pour cette piste). */
  motifs: { batterie?: string; basse?: string; accords?: string; melodie?: string };
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
}

export interface Piste {
  id: IdPiste;
  /** Volume linéaire 0 à 1,5 (défaut 0,8). */
  volume: number;
  /** Panoramique −1 (gauche) à 1 (droite). */
  pan: number;
  muet: boolean;
  solo: boolean;
  /** Piste voix seulement : réglage prêt (passe-haut 90 Hz, compresseur, réverbe). Défaut « naturel ». */
  preset?: 'naturel' | 'rap' | 'chant';
  /** Piste voix seulement : effets au-dessus du préréglage (absent = aucun effet ajouté). */
  effets?: EffetsVoix;
}

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

/** Un problème trouvé (et souvent corrigé) par le normaliseur. Message en français. */
export interface Probleme {
  chemin: string;
  niveau: 'bloquant' | 'corrige' | 'ignore' | 'conseil';
  message: string;
}
