// Fil des idées (« Une autre idée » / « Revenir ») : pour chaque motif, les idées d'avant et les graines tirées.
// « Revenir » rend l'idée d'avant (en plus d'Annuler). Gardé hors du morceau, oublié quand on ferme le morceau.

import { signal } from '@preact/signals';
import type { Motif } from '../morceau/types';
import { nouvelleGraine } from '../moteur/api';
import { numeroSeance } from './etat';

interface Fil {
  /** Motifs d'avant chaque idée (le dernier = celui que « Revenir » rend). */
  avant: Motif[];
  /** Graine de départ (gardée) et nombre d'idées tirées : la graine n° k = depart + k. */
  depart: number;
  tirees: number;
}

/**
 * Change à chaque idée ou retour : l'interface se redessine. Écrit SEULEMENT par les gestes (noterIdee,
 * reprendreIdee, remettreIdee), jamais dans un effet ni un computed : sinon « Cycle detected » (@preact/signals).
 */
export const versionIdees = signal(0);

// Morceau fermé (ou autre morceau ouvert) : on oublie tout. Vérifié à chaque appel (pas d'effet).
const tous = new Map<string, Fil>();
let seanceSuivie = -1;
function fils(): Map<string, Fil> {
  const s = numeroSeance();
  if (s !== seanceSuivie) {
    tous.clear();
    seanceSuivie = s;
  }
  return tous;
}

/** Prochaine graine du fil (la première est tirée au hasard puis gardée). */
export function prochaineGraine(cle: string): number {
  const f = fils().get(cle);
  return f ? f.depart + f.tirees + 1 : nouvelleGraine();
}

/** Note qu'une idée a remplacé `actuel` (appelé quand le changement a vraiment eu lieu). */
export function noterIdee(cle: string, actuel: Motif, graine: number) {
  const f = fils().get(cle) ?? { avant: [], depart: graine - 1, tirees: 0 };
  f.avant.push(structuredClone(actuel));
  if (f.avant.length > 30) f.avant.shift();
  f.tirees = graine - f.depart;
  fils().set(cle, f);
  versionIdees.value = versionIdees.peek() + 1;
}

/** Nombre d'idées tirées sur ce motif (0 = aucune). */
export function nombreIdees(cle: string): number {
  void versionIdees.value;
  return fils().get(cle)?.avant.length ?? 0;
}

/** Retire et rend l'idée d'avant (null s'il n'y en a pas). */
export function reprendreIdee(cle: string): Motif | null {
  const f = fils().get(cle);
  const m = f?.avant.pop() ?? null;
  versionIdees.value = versionIdees.peek() + 1;
  return m;
}

/** Remet une idée retirée (si le retour n'a rien changé, on la garde pour la prochaine fois). */
export function remettreIdee(cle: string, motif: Motif) {
  fils().get(cle)?.avant.push(motif);
  versionIdees.value = versionIdees.peek() + 1;
}
