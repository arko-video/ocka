// CONTRAT C3 — PERFORMANCE, LOOPER, CONFORT, MARQUEURS (propriétaire : R). Ré-exporté par api.ts.
// Chaque type et chaque signature ci-dessous est FIGÉ. Implémentations : ./performance.ts (effets de performance,
// registre EFFETS_PERF, fournisseur de gels), ./looper.ts, ./confort.ts ; interface : src/ui/looper/*.
// Les fonctions qui touchent au morceau sont PURES (même objet si rien ne change ; résultat accepté par le normaliseur).

import type { EffetPerf, Marqueur, Morceau } from '../morceau/types';
import type { Lecteur } from './api';
import * as confort from './confort';
import * as looper from './looper';
import * as performance from './performance';
import { relier } from './relier';

/* ------------------------------------------------------------ effets de performance (Section.perf) */

/** Ajoute un effet à une section (8 au plus, PLAFONDS.perfParSection ; pas et durée au 1/24, dans la section). */
export const ajouterEffetPerf: (m: Morceau, idSection: string, effet: EffetPerf) => Morceau = relier(() => performance.ajouterEffetPerf);
export const reglerEffetPerf: (m: Morceau, idSection: string, index: number, effet: EffetPerf) => Morceau = relier(() => performance.reglerEffetPerf);
export const retirerEffetPerf: (m: Morceau, idSection: string, index: number) => Morceau = relier(() => performance.retirerEffetPerf);

/* ------------------------------------------------------------ looper */

/** Une case de la grille : une piste et un de ses motifs (motif null = silence). */
export interface CelluleLooper {
  piste: string;
  motif: string | null;
}
/** Un lancement enregistré : à la mesure `mesure` (depuis le départ du looper), la piste joue `motif` (null = s'arrête). */
export interface LancementLooper {
  mesure: number;
  piste: string;
  motif: string | null;
}
export interface Looper {
  /** Mesure en cours depuis le départ (0 avant). */
  readonly mesure: number;
  /** Motif joué par chaque piste (id de piste → id de motif ou null). */
  readonly actifs: Readonly<Record<string, string | null>>;
  /** Lancements en attente de la prochaine mesure. */
  readonly enAttente: readonly CelluleLooper[];
  readonly enregistre: boolean;
  /** Les lancements enregistrés depuis `enregistrer(true)`. */
  readonly journal: readonly LancementLooper[];
  demarrer(): Promise<void>;
  arreter(): void;
  /** Lance (ou arrête, motif null) une piste À LA PROCHAINE MESURE. */
  lancer(cellule: CelluleLooper): void;
  enregistrer(actif: boolean): void;
  surChangement(cb: () => void): () => void;
  detruire(): void;
}
/** La grille pistes × motifs du morceau (motifs déjà utilisés par chaque piste, dans l'ordre des sections). Pur. */
export const grilleLooper: (m: Morceau) => CelluleLooper[] = relier(() => looper.grilleLooper);
/** Un looper qui joue par le lecteur (Lecteur public : charger, boucler, lire). */
export const creerLooper: (lecteur: Lecteur, m: Morceau) => Looper = relier(() => looper.creerLooper);
/** « Enregistrer ce que je joue » : le journal devient des sections ajoutées à l'arrangement (un Annuler). Pur. */
export const journalVersMorceau: (m: Morceau, journal: readonly LancementLooper[]) => Morceau = relier(() => looper.journalVersMorceau);

/* ------------------------------------------------------------ confort */

export const SONS_METRONOME = ['clic', 'bois', 'cloche', 'charley'] as const;
export type SonMetronome = (typeof SONS_METRONOME)[number];

/** Tempo (60–200, arrondi à l'entier) d'après les heures des frappes (ms, croissantes) ; null s'il en manque (< 3). Pur. */
export const tapTempo: (frappes: readonly number[]) => number | null = relier(() => confort.tapTempo);
export const metronomeChoisi: () => SonMetronome = relier(() => confort.metronomeChoisi);
/** Change le son du métronome (gardé dans BASES_IDB.confort) ; le lecteur l'utilise au prochain clic. */
export const reglerMetronome: (son: SonMetronome) => Promise<void> = relier(() => confort.reglerMetronome);
/** Volume du métronome (0 à 1, défaut 1 : le clic d'avant C3). */
export const volumeMetronome: () => number = relier(() => confort.volumeMetronome);
/** Change le volume du métronome (0 à 1, gardé dans BASES_IDB.confort) ; le lecteur l'utilise au prochain clic. */
export const reglerVolumeMetronome: (v: number) => Promise<void> = relier(() => confort.reglerVolumeMetronome);

/** Une étape de l'historique d'Annuler, pour le montrer : libellé court en français (« Note ajoutée (Piano) »). */
export interface EtapeHistorique {
  libelle: string;
  /** Position relative au présent : −3 … −1 (passé), 0 (présent), 1 … (futur). */
  position: number;
}
/** Les étapes (au plus 60 + présent + futur), libellées en comparant chaque état au précédent. Pur. */
export const etapesHistorique: (passe: readonly Morceau[], present: Morceau, futur: readonly Morceau[]) => EtapeHistorique[] = relier(() => confort.etapesHistorique);

/** Un modèle de pistes (pistes instrument, tranches et inserts, sans notes), gardé dans BASES_IDB.confort. */
export interface ModelePistes {
  id: string;
  nom: string;
  pistes: Morceau['pistes'];
  creeLe: number;
}
export const listerModeles: () => Promise<ModelePistes[]> = relier(() => confort.listerModeles);
export const sauverModele: (nom: string, m: Morceau) => Promise<ModelePistes> = relier(() => confort.sauverModele);
export const supprimerModele: (id: string) => Promise<void> = relier(() => confort.supprimerModele);
/** Ajoute les pistes du modèle au morceau (16 pistes instrument au plus, ids libres). Pur. */
export const appliquerModele: (m: Morceau, modele: ModelePistes) => Morceau = relier(() => confort.appliquerModele);

/* ------------------------------------------------------------ marqueurs (Morceau.marqueurs) */

/** Ajoute un marqueur (64 au plus, nom ≤ 40 caractères, ancré à une apparition de section). Pur. */
export const ajouterMarqueur: (m: Morceau, nom: string, ancre: Marqueur['ancre']) => Morceau = relier(() => confort.ajouterMarqueur);
export const modifierMarqueur: (m: Morceau, id: string, changement: Partial<Pick<Marqueur, 'nom' | 'ancre'>>) => Morceau = relier(() => confort.modifierMarqueur);
export const retirerMarqueur: (m: Morceau, id: string) => Morceau = relier(() => confort.retirerMarqueur);
/** Les marqueurs placés sur le temps du morceau (s), triés. Pur. */
export const marqueursPlaces: (m: Morceau) => { id: string; nom: string; t: number }[] = relier(() => confort.marqueursPlaces);
