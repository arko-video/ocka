// État global de l'interface, en signals. Le morceau n'est JAMAIS modifié ici directement :
// on passe toujours par une fonction pure de ./edition puis par l'historique (Annuler / Rétablir).

import { computed, signal } from '@preact/signals';
import { ecrireReglages, ErreurOcka, lireReglages, type Sortie } from '../moteur/api';
import type { InstrumentBatterie, Morceau } from '../morceau/types';
import { annuler, nouvelHistorique, pousser, remplacer, retablir, type Historique } from './edition/historique';

/** Toujours 5 étapes dans le studio (la mélodie est une vue de Beat). */
export type Etape = 'beat' | 'structure' | 'voix' | 'son' | 'exporter';
/** Les 3 écrans de l'assistant de sortie (A1) : Infos → Pochette → Vérifier. */
export type EcranSortie = 'sortie-infos' | 'sortie-pochette' | 'sortie-verifier';
/** « sorties » = l'accueil sur l'onglet Sorties (Retour depuis l'assistant y ramène). */
export type Ecran = 'accueil' | 'sorties' | 'styles' | Etape | EcranSortie;
export const ETAPES: Etape[] = ['beat', 'structure', 'voix', 'son', 'exporter'];
export const ECRANS_SORTIE: EcranSortie[] = ['sortie-infos', 'sortie-pochette', 'sortie-verifier'];

/** Écran affiché. Changé uniquement par navigation.ts (pour garder le bouton Retour juste). */
export const ecran = signal<Ecran>('accueil');
/** Panneau ouvert par-dessus l'écran (roulement, actions…), fermé par le bouton Retour. */
export const panneau = signal<string | null>(null);

export const historique = signal<Historique | null>(null);
export const morceau = computed<Morceau | null>(() => historique.value?.present ?? null);
/** Id du morceau dans « Mes morceaux » (null tant qu'il n'est pas encore enregistré). */
export const idMorceau = signal<string | null>(null);

/** Section suivie par la boucle de lecture (choisie dans Beat, Structure ou Voix). */
export const sectionCourante = signal<string | null>(null);
/** Motif de batterie et instrument édités dans Beat. */
export const motifEdite = signal<string | null>(null);
export const instrumentEdite = signal<InstrumentBatterie>('kick');

export const etatSauvegarde = signal<'rien' | 'enregistre' | 'erreur'>('rien');

/** Onglet de l'accueil (A1). navigation.ts le met à « sorties » quand on affiche l'écran « sorties ». */
export const ongletAccueil = signal<'morceaux' | 'sorties'>('morceaux');
/**
 * Bascule de l'étape Beat (v2) : « Batterie | Instruments ». Instruments = la vue Pistes (U1) ; la mélodie des
 * phases 2 à 6 y est le mode « Simple » (8 pads) de la piste « melodie ». L'ancien data-testid « vue-melodie » est
 * un alias qui ouvre directement ce mode.
 */
export const vueBeat = signal<'batterie' | 'instruments'>('batterie');
/** Bascule de l'étape Structure (v2, U2) : « Sections | Frise ». */
export const vueStructure = signal<'sections' | 'frise'>('sections');

/* ------------------------------------------------------------ v2 : pistes, piano roll, réglage « Avancé » */

/** Panneaux de la v2 (ouverts par navigation.ts, fermés par Retour ; un seul à la fois). */
export const PANNEAUX = {
  /** Piano roll en plein écran de `pisteEditee` (U1). */
  pianoRoll: 'piano-roll',
  /** « + Piste » : choix d'instrument par familles (U1, catalogue de BQ). */
  choixInstrument: 'choix-instrument',
  /** « Gérer les instruments » téléchargés (U1, API de BQ). */
  gererInstruments: 'gerer-instruments',
  /** « Effets (n) » d'une piste : inserts et pompe (U2). */
  effetsPiste: 'effets-piste',
  /** Réglages avancés (interrupteur « Avancé »). */
  avance: 'reglages-avance',
  /** C2 (A2) : éditeur de notes de l'autotune de `priseEditee` (Voix, « Avancé »). */
  editeurAutotune: 'editeur-autotune',
  /** C2 (D) : « Chanter » (Ta voix → instrument) sur `pisteEditee` ; ouvert depuis le piano roll et la vue Pistes. */
  chanter: 'chanter',
  /** C2 (D) : « Beatbox » (ta bouche joue la batterie) ; ouvert depuis la vue Batterie. */
  beatbox: 'beatbox',
  /** C3 (P) : outils malins du piano roll (arpège, strum, humaniser, glide, swing, riff machine, fantômes) sur `pisteEditee`. */
  outilsNotes: 'outils-notes',
  /** C3 (P) : MIDI — fichiers .mid (import, export) et clavier MIDI (`pisteEditee` si ouvert depuis le piano roll). */
  midi: 'midi',
  /** C3 (S) : découpe et éditeur de `sonEdite` (WSOLA, BPM, tonalité) ; SoundFonts. */
  editeurSon: 'editeur-son',
  /** C3 (L) : réglages du synthé de `pisteEditee` (paramètres, onde dessinée, LFO). */
  synthe: 'synthe',
  /** C3 (L) : sons courts fabriqués (kick, bruitages sfxr) → « Tes sons ». */
  sonsCourts: 'sons-courts',
  /** C3 (R) : looper (« Jouer en direct », Structure). */
  looper: 'looper',
  /** C3 (R) : effets de performance de la section `sectionCourante`. */
  performance: 'performance',
  /** C3 (R) : confort (tap tempo, métronome, historique, modèles de pistes, marqueurs, raccourcis). */
  confort: 'confort',
  /** C3 (V) : voix avancée (punch-in, comping, nettoyeur, doublage, chaînes de voix, gel) ; `priseEditee` facultative. */
  voixAvancee: 'voix-avancee',
  /** C3 (V) : écoute de référence (A/B au même volume perçu). */
  reference: 'reference',
} as const;

/** C3 (S) : son importé (id) ouvert dans l'éditeur de son ; null = aucun. */
export const sonEdite = signal<string | null>(null);

/** Piste instrument ouverte dans le piano roll (ou dont on règle les effets) ; null = aucune. */
export const pisteEditee = signal<string | null>(null);
/** Prise (id) ouverte dans l'éditeur de notes de l'autotune (C2, A2) ; null = aucune. */
export const priseEditee = signal<string | null>(null);
/** Mode du piano roll : « Simple » (les 8 pads de la gamme) ou « Complet » (chromatique). */
export const modePianoRoll = signal<'simple' | 'complet'>('simple');
/**
 * Réglage « Avancé » (désactivé par défaut) : couloirs d'automation et de LFO, marqueurs, réglages des inserts,
 * arpège, strum, humaniser, swing par piste, notes fantômes, éditeur d'autotune, punch-in, comping, référence A/B,
 * freeze, clavier MIDI. Gardé dans les réglages (IndexedDB ocka-reglages, `Reglages.avance`) ; chargé au démarrage
 * par chargerAvance(), qui y migre l'ancienne clé localStorage « ocka-avance » (puis l'efface).
 */
export const modeAvance = signal<boolean>(false);
const ANCIENNE_CLE_AVANCE = 'ocka-avance';

function ancienAvance(): boolean | null {
  try {
    const v = globalThis.localStorage?.getItem(ANCIENNE_CLE_AVANCE);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

/** Au démarrage : lit le réglage (et migre l'ancienne clé localStorage). Sans stockage : désactivé, sans planter. */
export async function chargerAvance(): Promise<void> {
  const ancien = ancienAvance();
  if (ancien !== null) modeAvance.value = ancien; // tout de suite, avant la base
  try {
    const r = ancien === null ? await lireReglages() : await ecrireReglages({ avance: ancien });
    if (ancien !== null) globalThis.localStorage?.removeItem(ANCIENNE_CLE_AVANCE);
    modeAvance.value = r.avance === true;
  } catch {
    /* base illisible : on garde la valeur actuelle pour cette séance */
  }
}

export function reglerAvance(actif: boolean) {
  modeAvance.value = actif;
  void ecrireReglages({ avance: actif }).catch(() => undefined); // refusé : le réglage vaut pour cette séance
}
/**
 * Sortie ouverte dans l'assistant (A1) : chargée avant d'aller sur un écran de sortie, sauvée par A1.
 * Sans elle, les écrans de sortie ramènent à l'onglet Sorties.
 */
export const sortieEditee = signal<Sortie | null>(null);

/* ------------------------------------------------------------ modifier */

let derniereCle: string | null = null;
let derniereFois = 0;

/**
 * Applique une fonction d'édition. Avec une `cle` (curseur, champ texte), les changements rapprochés
 * de la même cle sont fusionnés en une seule étape d'historique.
 */
export function modifier(op: (m: Morceau) => Morceau, cle?: string): boolean {
  const h = historique.peek();
  if (!h) return false;
  const nouveau = op(h.present);
  if (nouveau === h.present) return false;
  const maintenant = Date.now();
  const fusion = cle !== undefined && cle === derniereCle && maintenant - derniereFois < 1500;
  historique.value = fusion ? remplacer(h, nouveau) : pousser(h, nouveau);
  derniereCle = cle ?? null;
  derniereFois = maintenant;
  return true;
}

export function annulerAction() {
  const h = historique.peek();
  if (h?.peutAnnuler) historique.value = annuler(h);
  derniereCle = null;
}

export function retablirAction() {
  const h = historique.peek();
  if (h?.peutRetablir) historique.value = retablir(h);
  derniereCle = null;
}

/** Numéro de la séance (change à chaque ouverture ou fermeture d'un morceau). Simple variable, pas un signal. */
let seance = 0;
export function numeroSeance(): number {
  return seance;
}

/** Ouvre un morceau dans le studio (nouvel historique). */
export function ouvrirSession(m: Morceau, id: string | null) {
  seance++;
  historique.value = nouvelHistorique(m);
  idMorceau.value = id;
  sectionCourante.value = m.ordre[0] ?? null;
  motifEdite.value = null;
  pisteEditee.value = null;
  priseEditee.value = null;
  sonEdite.value = null;
  derniereCle = null;
}

export function fermerSession() {
  seance++;
  historique.value = null;
  idMorceau.value = null;
  sectionCourante.value = null;
  motifEdite.value = null;
  vueBeat.value = 'batterie';
  vueStructure.value = 'sections';
  pisteEditee.value = null;
  priseEditee.value = null;
  sonEdite.value = null;
  modePianoRoll.value = 'simple';
}

/* ------------------------------------------------------------ toast */

export const toast = signal<string | null>(null);
export const toastAction = signal<{ label: string; agir: () => void } | null>(null);
let minuteurToast: ReturnType<typeof setTimeout> | undefined;

export function afficherToast(message: string, dureeMs = 3500, action: { label: string; agir: () => void } | null = null) {
  toast.value = message;
  toastAction.value = action;
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => {
    toast.value = null;
    toastAction.value = null;
  }, dureeMs);
}

/** Message d'erreur lisible : celui d'une ErreurOcka (déjà en français), sinon le texte de secours. */
export function messageErreur(e: unknown, secours: string): string {
  return e instanceof ErreurOcka && e.message ? e.message : secours;
}
