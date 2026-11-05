// État global de l'interface, en signals. Le morceau n'est JAMAIS modifié ici directement :
// on passe toujours par une fonction pure de ./edition puis par l'historique (Annuler / Rétablir).

import { computed, signal } from '@preact/signals';
import { ErreurOcka, type Sortie } from '../moteur/api';
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
/** Bascule de l'étape Beat (U) : la grille de batterie ou la mélodie. */
export const vueBeat = signal<'batterie' | 'melodie'>('batterie');
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
  derniereCle = null;
}

export function fermerSession() {
  seance++;
  historique.value = null;
  idMorceau.value = null;
  sectionCourante.value = null;
  motifEdite.value = null;
  vueBeat.value = 'batterie';
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
