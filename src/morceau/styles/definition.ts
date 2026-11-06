// CONTRAT C2 — la définition d'un style. Chaque style vit dans SON fichier `styles/<id>.ts`, qui exporte par défaut
// un objet `DefinitionStyle` ; `styles/index.ts` les réunit (registre). Tout ce qui dépend du style (morceau neuf,
// Boucles OCKA, choix du style, kit, 808, fill, genre de sortie) LIT ce registre : ajouter ou finir un style ne
// touche qu'à son fichier. Le type ci-dessous est FIGÉ pour la vague C2 (S1, S2).
// Un kit « <id>@1 » ne change plus de son une fois le style livré : on crée « <id>@2 » (les vieux morceaux gardent @1).

import type { TypeBoucle } from '../../aller-vite/boucles';
import type { QuatreMotifs } from '../styles-grilles';
import type { IdPiste, InstrumentBatterie, Master, Mode, Morceau, MotifAccords, MotifBasse, MotifNotes, SonMelodie, Style, Tonique, Tranche } from '../types';

/** Familles de l'écran du choix du style, dans l'ordre d'affichage. */
export const FAMILLES_STYLES = ['rap', 'electro', 'monde', 'poprockjazz', 'cinema'] as const;
export type FamilleStyle = (typeof FAMILLES_STYLES)[number];

/** Rôle d'une piste instrument par défaut (Ta voix → instrument joue le mode accords sur la piste « nappe »…). */
export const ROLES_INSTRUMENT = ['melodie', 'accords', 'nappe', 'arpege', 'contrechant', 'lead', 'basse', 'percussions'] as const;
export type RoleInstrument = (typeof ROLES_INSTRUMENT)[number];

export interface ReglagesStyle {
  /** Tempo du morceau neuf (60 à 200), dans `plage`. */
  tempo: number;
  /** Plage de tempo du style (« Au hasard » tire dedans). */
  plage: [number, number];
  /** Swing des double-croches paires (0 à 0,6). */
  swing: number;
  tonique: Tonique;
  mode: Mode;
  /** Son du motif d'accords (piste fixe « accords »). */
  son: NonNullable<MotifAccords['son']>;
  /** Couleur du master au départ. */
  preset: Master['preset'];
  /** Kit écrit dans le morceau neuf : TOUJOURS « <id>@1 » (testé). Ses réglages sont dans `son.kits`. */
  kit: string;
  /** Volumes de départ propres au style (les autres pistes gardent ceux de pistesParDefaut). */
  volumes?: Partial<Record<IdPiste, number>>;
  /** Pistes fixes muettes au départ (ex. « basse » quand une contrebasse joue sur une piste instrument). */
  muettes?: IdPiste[];
}

/** Une suite d'accords proposée (degrés romains, 1 accord par mesure : « i », « VImaj7 », « bII »…). */
export interface SuiteStyle {
  nom: string;
  degres: string[];
}

/** Écrit le motif de notes d'une piste instrument pour une section (fonction PURE, déterministe). */
export type EcrireNotes = (m: Morceau, idSection: string) => MotifNotes;

/** Une piste instrument du morceau neuf. La PREMIÈRE a l'id « melodie » (pads « Simple », Boucles OCKA, hasard). */
export interface InstrumentDefaut {
  /** REGLE_ID, jamais un IdFixe ; unique dans le style. */
  id: string;
  /** Nom affiché (40 caractères au plus). */
  nom: string;
  /** Id de la banque (« vcsl-marimba@1 », « ocka-pluck@1 »…) : voir le catalogue de BQ. */
  instrument: string;
  role: RoleInstrument;
  /** Défaut 0,8 et 0. */
  volume?: number;
  pan?: number;
  /**
   * Notes posées au départ : un même motif `idMotif`, écrit avec les accords de la section `depuis` (défaut
   * « refrain »), joué dans `sections` (ids : intro, couplet, refrain, outro). `ecrire` : un type de Boucle OCKA
   * ou une fonction propre au style. Absent : la piste est vide (l'utilisateur la remplit).
   */
  notes?: { ecrire: TypeBoucle | EcrireNotes; sections: string[]; idMotif: string; depuis?: string };
  /**
   * Effets de la piste au départ (facultatif) : inserts (6 au plus : compresseur, égaliseur…) et envois vers
   * la réverbe ou l'écho partagés (`envoi-reverbe`, `envoi-echo`). Absent : aucun effet (son des styles d'avant).
   */
  tranche?: Pick<Tranche, 'inserts'>;
}

/* ------------------------------------------------------------ son (lu par le moteur) */

/** Réglages d'un kit de batterie synthétisé (moteur/instruments/batterie.ts). */
export interface ReglagesKit {
  kick: { de: number; a: number; glisse: number; tau: number; duree: number; clic: number; force: number };
  snare: { corps: [number, number]; tauCorps: number; tauBruit: number; passeHaut: number; passeBas: number; force: number };
  charley: { passeHaut: number; tauFerme: number; tauOuvert: number; passeBas: number };
  /** Passe-bas final de tout le kit (lo-fi : un peu étouffé). */
  sourdine: number;
  /** Hauteur (Hz) du « tok » du pad perc ; défaut 880. */
  perc?: number;
  /** Saturation « de bande » après la sourdine (boom bap : son poussiéreux). */
  bande?: number;
  /** Passe-haut final (boom bap : moins de sub, comme un vieux sample). */
  coupeBas?: number;
  /** Cloche 808 plus dure : fréquences des deux carrés, durée (tau) et saturation (phonk). */
  cowbell?: { f1: number; f2: number; tau: number; force: number };
  /** Le pad « perc » joue un bruit de vinyle (craquements et souffle) au lieu d'un « tok » (boom bap). */
  vinyle?: boolean;
  /** Crêtes propres au kit (sinon CRETES de batterie.ts). */
  cretes?: Partial<Record<InstrumentBatterie, number>>;
}

/** Réglages de la basse 808 du style (moteur/instruments/melodiques.ts). */
export interface Reglages808 {
  /** Temps (s) pour que le niveau soit divisé par e : grand = 808 longue. */
  tau: number;
  /** Saturation : ajoute des harmoniques pour que la 808 s'entende sur un téléphone. */
  force: number;
  passeBas: number;
  /** Durée du glissé vers la note suivante (drill). */
  glisse: number;
}

/** Une frappe du fill (dernière mesure) : pas 8 à 15, vélocité, roulement (0 = simple, 2/3/4/6). */
export interface FrappeFill {
  pas: number;
  vel: number;
  roul: number;
}

/** Variante d'un son OCKA selon le style (clé du cache des notes) : piano électrique lo-fi, cloche 808 accordée. */
export type VarianteSon = 'lofi' | 'cowbell';

export interface SonStyle {
  /** Kits définis par ce style (« <id>@1 », plus tard « <id>@2 »…). Un kit inconnu joue « <id>@1 », sinon trap@1. */
  kits: Record<string, ReglagesKit>;
  /** Absent : la 808 de la trap. */
  basse808?: Reglages808;
  /** Fill de caisse claire de la dernière mesure ; absent : celui de la trap (roulements 2, 2, 3, 4). */
  fill?: FrappeFill[];
  variantes?: Partial<Record<SonMelodie, VarianteSon>>;
}

/* ------------------------------------------------------------ la définition */

export interface DefinitionStyle {
  id: Style;
  famille: FamilleStyle;
  /** Textes français : nom court (« Boom bap ») et une phrase (« Kick et caisse poussiéreux… »). */
  textes: { nom: string; phrase: string };
  /** Genre proposé pour la sortie (valeur des listes des distributeurs : « Hip-Hop/Rap », « Pop », « Dance »…). */
  genre: string;
  reglages: ReglagesStyle;
  /** 4 motifs de batterie : intro, couplet, refrain, pont (joué aussi à l'outro). */
  batterie: () => QuatreMotifs;
  /** Ligne de 808 du couplet et du refrain. */
  basse: () => { couplet: MotifBasse; refrain: MotifBasse };
  /** Exactement 3 suites ; la 1re est celle du morceau neuf. */
  suites: SuiteStyle[];
  instrumentsParDefaut: InstrumentDefaut[];
  /** Les 6 Boucles OCKA (chaque type une fois), la plus typique d'abord, avec leur son OCKA conseillé. */
  boucles: [TypeBoucle, SonMelodie][];
  son: SonStyle;
  /** Forme d'onde décorative de la carte (hauteurs 0 à 100, répétées) ; absent : une onde douce. */
  onde?: number[];
  /** Copie provisoire d'un style proche (vague C2) : à retirer quand le style est fini. */
  provisoire?: true;
}

/** La piste « melodie » au piano d'OCKA (les 6 styles des phases 0 à 6). */
export const MELODIE_PIANO: InstrumentDefaut = { id: 'melodie', nom: 'Mélodie', instrument: 'ocka-piano@1', role: 'melodie' };

/**
 * Style PROVISOIRE (C2) : copie de `base` (motifs, son, instruments, boucles), sous son id, ses textes et sa famille.
 * Son kit « <id>@1 » reprend le kit de `base` ; sa 808, son fill et ses variantes aussi.
 */
export function copieProvisoire(base: DefinitionStyle, id: Style, famille: FamilleStyle, textes: DefinitionStyle['textes'], genre = base.genre): DefinitionStyle {
  const kit = base.son.kits[base.reglages.kit]!;
  return {
    ...base,
    id,
    famille,
    textes,
    genre,
    reglages: { ...base.reglages, kit: `${id}@1` },
    son: { ...base.son, kits: { [`${id}@1`]: kit } },
    provisoire: true,
  };
}
