// Voix avancée (V) : outils communs des cartes du panneau — apparitions de section qui ont des prises, action
// longue (une seule à la fois, résultat appliqué en UNE étape d'Annuler), réglages prêts (copie des valeurs du moteur :
// l'interface n'importe que moteur/api.ts).

import { signal } from '@preact/signals';
import type { ReglagesDoublage, ReglagesNettoyeur } from '../../../moteur/api';
import { arrangement } from '../../../morceau/temps';
import type { Morceau, Prise, Section } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { afficherToast, modifier } from '../../etat';
import { toastErreur } from '../../lecture';

export interface Apparition {
  section: Section;
  occurrence: number;
  prises: Prise[];
}

/** Les apparitions de section (dans l'ordre du morceau) qui ont au moins une prise. */
export function apparitions(m: Morceau): Apparition[] {
  return arrangement(m)
    .map((o) => ({ section: o.section, occurrence: o.occurrence, prises: m.prises.filter((p) => p.ancre.section === o.section.id && p.ancre.occurrence === o.occurrence) }))
    .filter((a) => a.prises.length > 0);
}

/** Nom affiché d'une prise (son nom, sinon « Prise n » dans son apparition). */
export function nomPrise(a: Apparition, p: Prise): string {
  return p.nom?.trim() || T.voixAvancee.sansNom(a.prises.indexOf(p) + 1);
}

/** Action longue en cours (son nom), ou null : une seule à la fois. */
export const occupe = signal<string | null>(null);

/** Lance une action qui rend un nouveau morceau ; il remplace le morceau en une seule étape d'Annuler. */
export async function agir(nom: string, action: () => Promise<Morceau>, message: string = T.voixAvancee.fait): Promise<boolean> {
  if (occupe.peek()) return false;
  occupe.value = nom;
  try {
    const nouveau = await action();
    modifier(() => nouveau);
    afficherToast(message);
    return true;
  } catch (e) {
    toastErreur(e);
    return false;
  } finally {
    occupe.value = null;
  }
}

/** Léger / Moyen / Fort (les mêmes valeurs que enregistrement/nettoyeur-calcul.ts, INTENSITES_NETTOYEUR). */
export const INTENSITES: Record<'leger' | 'moyen' | 'fort', ReglagesNettoyeur> = {
  leger: { porte: 0.3, reduction: 0.3, desesseur: 0.3 },
  moyen: { porte: 0.6, reduction: 0.6, desesseur: 0.5 },
  fort: { porte: 1, reduction: 1, desesseur: 0.8 },
};

/** Doublage auto : 15 à 30 ms, ±8 cents, copies à −6 dB (enregistrement/doublage-calcul.ts, DOUBLAGE_AUTO). */
export const DOUBLAGE: ReglagesDoublage = { ecart: 0.4167, desaccord: 0.5333, niveau: 0.5 };
