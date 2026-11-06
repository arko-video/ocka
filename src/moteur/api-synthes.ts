// CONTRAT C3 — SYNTHÉS ET SONS COURTS FABRIQUÉS PAR LE CODE (propriétaire : L). Ré-exporté par api.ts.
// Chaque type et chaque signature ci-dessous est FIGÉ. Un synthé = un fichier moteur/synthese/synthes/<id>.ts qui
// `export default` une DefinitionSynthe, listé dans synthes/index.ts (L). Le moteur (notes.ts, Worker de synthèse,
// planning, graphe) ne lit que le registre (synthese/registre-synthes.ts, intégrateur) : L n'édite aucun autre fichier.
// Instrument d'une piste : « ocka-<id>@1 » ; ses réglages : PisteInstrument.synthe (params 0 à 1, onde dessinée).

import type { Morceau, RecetteKick, RecetteSfxr, RecetteSon, ReglagesSynthe, SonImporte } from '../morceau/types';
import type { FamilleInstrument, InfoInstrument } from './api-instruments';
import { relier } from './relier';
import * as registre from './synthese/registre-synthes';
import * as reglages from './synthese/synthes/reglages';
import * as mutation from './synthese/synthes/sfxr-mutation';
import * as sonsCourts from './synthese/synthes/sons-courts';
import type { PcmSon } from './types-moteur';

/** Un tampon de note SANS durée (même forme que les sons v1 : mono, ou stéréo pour la nappe). */
export interface NoteSynthe {
  canaux: Float32Array[];
  /** Boucle [début, fin] (s) des sons tenus : le graphe met `loop` sur la source tant que la note dure. */
  boucle?: [number, number];
}

/** Un réglage d'un synthé : TOUJOURS normalisé de 0 à 1 dans le format (le synthé le convertit). */
export interface ParamSynthe {
  /** Valeur par défaut (0 à 1). */
  defaut: number;
  /** Choix discret : nombre de crans (ex. 3 pour la largeur d'impulsion 12,5 / 25 / 50 %) ; absent = continu. */
  crans?: number;
}

/** Réglages d'une piste complétés par les défauts (ce que reçoit le rendu). Dictionnaire sans prototype. */
export interface ReglagesLus {
  params: Record<string, number>;
  /** Onde dessinée (`points` valeurs de −1 à 1) ; absente si le synthé n'en a pas. */
  onde?: number[];
}

/** Une note d'un passage de motif (mode « motif », 303) : temps en secondes depuis le début du passage. */
export interface NoteMotifSynthe {
  t: number;
  duree: number;
  midi: number;
  /** Vélocité 0,1 à 1 (accent de la 303 : vel ≥ 0,8). */
  vel: number;
  /** Slide : la note glisse vers cette note MIDI (Note.glisse du motif). */
  glisse?: number;
}

export interface DefinitionSynthe {
  /** Id court (minuscules, chiffres, tirets ; 40 au plus) : l'instrument est « ocka-<id>@1 ». Les 6 sons v1 gardent le leur. */
  id: string;
  nom: string;
  famille: FamilleInstrument;
  /** Mots de la recherche (« + Piste »), en minuscules sans accents. */
  motsCles: string[];
  /** false = pas encore jouable : absent du catalogue, inconnu du normaliseur (piste muette, avec un conseil). */
  pret: boolean;
  /** Réglages (clés de PisteInstrument.synthe.params, camelCase, 32 au plus). */
  params: Record<string, ParamSynthe>;
  /** Onde dessinée (BitInvader) : nombre de points (16 à 256, 64 conseillé) ; absent = pas d'onde. */
  points?: number;
  /** Relâchement (s) à la fin d'une note (mode « note »). */
  relache: number;
  /** Son tenu (avec `boucle`) : il ne s'éteint pas seul. */
  tenu: boolean;
  /**
   * « note » : UN tampon par (note MIDI, réglages), sans durée, comme les sons v1 (le graphe coupe à la fin de la note).
   * « motif » (303) : UN tampon par passage du motif dans une section (accents et slides calculés ensemble), joué
   * comme une boucle de son importé (gain GAIN_NOTE : la vélocité est DANS le tampon).
   */
  mode: 'note' | 'motif';
  /** Mode « note » : rendu à la fréquence courante (avecFrequence). `variante` : celle du style (sons v1 seulement). Pur, déterministe. */
  rendreNote?(midi: number, reglages: ReglagesLus, variante: string): NoteSynthe;
  /** Mode « motif » : canaux (1 ou 2) d'au moins `duree` s (la queue de la dernière note peut dépasser). Pur, déterministe. */
  rendreMotif?(notes: readonly NoteMotifSynthe[], duree: number, reglages: ReglagesLus): Float32Array[];
}

/* ------------------------------------------------------------ registre (intégrateur : lecture seule) */

/** Les synthés de C3 PRÊTS (catalogue de « + Piste », source « code ») ; sans les 6 sons v1 (déjà au catalogue). Pur. */
export const instrumentsSynthes: () => InfoInstrument[] = relier(() => registre.instrumentsSynthes);
/** La définition du synthé joué par un instrument (« ocka-303@1 »), ou null (banque, SoundFont, pas prêt). Pur. */
export const definitionSynthe: (instrument: string) => DefinitionSynthe | null = relier(() => registre.definitionDe);
/** Réglages d'une piste complétés par les défauts du synthé (ce que le rendu reçoit). Pur. */
export const reglagesLus: (def: DefinitionSynthe, synthe: ReglagesSynthe | undefined) => ReglagesLus = relier(() => registre.reglagesLus);

/* ------------------------------------------------------------ L : réglages d'une piste (édition pure) */

/** Règle un paramètre (0 à 1, arrondi au cran) du synthé d'une piste instrument. Pur : même objet si rien ne change. */
export const reglerParamSynthe: (m: Morceau, idPiste: string, cle: string, valeur: number) => Morceau = relier(() => reglages.reglerParamSynthe);
/** Pose l'onde dessinée (−1 à 1, `points` valeurs) d'une piste « ocka-onde@1 ». Pur. */
export const dessinerOnde: (m: Morceau, idPiste: string, onde: readonly number[]) => Morceau = relier(() => reglages.dessinerOnde);
/** Tables d'onde à plusieurs résolutions (anti-repliement) d'une onde dessinée : une table par octave. Pur. */
export const tablesOnde: (onde: readonly number[]) => Float32Array[] = relier(() => reglages.tablesOnde);

/* ------------------------------------------------------------ L : sons courts (kick, sfxr) → « Tes sons » */

/** Catégories du bouton « Au hasard » des bruitages façon sfxr. */
export const CATEGORIES_SFXR = ['piece', 'laser', 'explosion', 'bonus', 'coup', 'saut', 'bip'] as const;
export type CategorieSfxr = (typeof CATEGORIES_SFXR)[number];

/** Recette du kick par défaut (façon Kicker). Pur. */
export const kickParDefaut: () => RecetteKick = relier(() => sonsCourts.kickParDefaut);
/** Une recette sfxr tirée au hasard dans une catégorie (même graine → même recette). Pur. */
export const sfxrAuHasard: (categorie: CategorieSfxr, graine: number) => RecetteSfxr = relier(() => sonsCourts.sfxrAuHasard);
/** « Muter » : la recette change un peu (moitié des réglages, ± force), pas son type d'onde (même graine → même recette). Pur. */
export const muterSfxr: (r: RecetteSfxr, graine: number, force?: number) => RecetteSfxr = relier(() => mutation.muterSfxr);
/** Calcule le son d'une recette (mono, 48 kHz) : à l'identique pour une même recette. Pur. */
export const fabriquerSon: (recette: RecetteSon) => PcmSon = relier(() => sonsCourts.fabriquerSon);
/**
 * Enregistre le son d'une recette comme un son importé (« Tes sons », OPFS ocka-sons, par importerSon d'un WAV) et
 * renvoie le SonImporte avec sa `recette` (à poser par ajouterSon / affecterPad). Erreurs de importerSon.
 */
export const enregistrerSonFabrique: (recette: RecetteSon, nom: string, m: Morceau) => Promise<SonImporte> = relier(() => sonsCourts.enregistrerSonFabrique);
