// Réglages des outils malins gardés pendant la séance (signals) : on retrouve ses choix en rouvrant le panneau.
// Et l'application d'un outil : un modifier() = une étape d'Annuler, un toast « Annuler », la sélection vidée.

import { signal } from '@preact/signals';
import type { Morceau } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import type { ReglagesArpege, ReglagesRiff, ReglagesStrum } from '../../edition/api-outils-notes';
import { afficherToast, annulerAction, modifier } from '../../etat';
import { toastErreur } from '../../lecture';
import { choisies } from '../pianoroll/vue';

export const ONGLETS = ['riff', 'caler', 'arpege', 'strum', 'humaniser', 'glisse', 'swing'] as const;
export type Onglet = (typeof ONGLETS)[number];

export const onglet = signal<Onglet>('riff');
export const riff = signal<Omit<ReglagesRiff, 'graine'>>({ gamme: 'morceau', style: 'rebondi', densite: 0.5 });
export const derniereIdee = signal<number | null>(null);
export const arpege = signal<Omit<ReglagesArpege, 'graine'>>({ sens: 'haut', vitesse: 1, octaves: 1, tenue: 0.9 });
export const strum = signal<ReglagesStrum>({ sens: 'haut', etalement: 30 });
export const humain = signal({ timing: 0.3, velocite: 0.3 });
export const force = signal(0.5);
export const fantomesVisibles = signal(true);

/** Graine neuve (1 à 9999) : l'outil est déterministe, c'est l'interface qui tire au sort. */
export const nouvelleGraine = () => 1 + Math.floor(Math.random() * 9999);

/** Applique un outil : true si le morceau a changé. Une erreur devient un toast (jamais de plantage). */
export function appliquer(op: (m: Morceau) => Morceau, nom: string): boolean {
  try {
    if (!modifier(op)) {
      afficherToast(T.outilsNotes.rien, 2500);
      return false;
    }
    choisies.value = new Set();
    afficherToast(T.outilsNotes.fait(nom), 5000, { label: T.annuler, agir: annulerAction });
    return true;
  } catch (e) {
    toastErreur(e);
    return false;
  }
}
