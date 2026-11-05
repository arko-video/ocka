// Le temps d'un morceau : arrangement (sections dans l'ordre), pas ↔ secondes avec le swing, durée totale.
// Un PAS = une double-croche ; 16 pas par mesure de 4/4.

import type { Morceau, Prise, Section } from './types';

export const PAS_PAR_MESURE = 16;

/** Durée d'un pas (double-croche) en secondes, sans swing. */
export function dureePas(tempo: number): number {
  return 60 / tempo / 4;
}

/** Une apparition d'une section dans l'arrangement. */
export interface Occurrence {
  /** Position dans `ordre`. */
  index: number;
  section: Section;
  /** N° de l'apparition de cette section (0 = la 1re fois). */
  occurrence: number;
  /** Premier pas (compté depuis le début du morceau). */
  debutPas: number;
  /** Nombre de pas de cette apparition. */
  pas: number;
}

/** L'arrangement à plat : chaque section de `ordre`, avec son premier pas. Les ids inconnus sont sautés. */
export function arrangement(morceau: Morceau): Occurrence[] {
  const parId = new Map(morceau.sections.map((s) => [s.id, s]));
  const compte = new Map<string, number>();
  const liste: Occurrence[] = [];
  let debutPas = 0;
  morceau.ordre.forEach((id, index) => {
    const section = parId.get(id);
    if (!section) return;
    const occurrence = compte.get(id) ?? 0;
    compte.set(id, occurrence + 1);
    const pas = section.mesures * PAS_PAR_MESURE;
    liste.push({ index, section, occurrence, debutPas, pas });
    debutPas += pas;
  });
  return liste;
}

/** Nombre total de pas du morceau. */
export function totalPas(morceau: Morceau): number {
  return arrangement(morceau).reduce((s, o) => s + o.pas, 0);
}

/** Durée du morceau en secondes (arrangement complet ; le fondu est compris dedans). */
export function dureeMorceau(morceau: Morceau): number {
  return totalPas(morceau) * dureePas(morceau.tempo);
}

/**
 * Secondes d'un pas (qui peut être fractionnaire, pour les roulements), avec le swing :
 * les pas impairs (2e et 4e double-croche de chaque temps) sont retardés de swing × durée d'un pas.
 */
export function pasVersSecondes(morceau: Pick<Morceau, 'tempo' | 'swing'>, pas: number): number {
  const d = dureePas(morceau.tempo);
  const p = Math.floor(pas);
  const fraction = pas - p;
  const impair = ((p % 2) + 2) % 2 === 1;
  const debut = p * d + (impair ? morceau.swing * d : 0);
  const longueur = impair ? d * (1 - morceau.swing) : d * (1 + morceau.swing);
  return debut + fraction * longueur;
}

/** L'inverse de pasVersSecondes : le pas (fractionnaire) joué au temps t. */
export function secondesVersPas(morceau: Pick<Morceau, 'tempo' | 'swing'>, t: number): number {
  const d = dureePas(morceau.tempo);
  const paire = Math.floor(t / (2 * d)); // une paire de pas = 2 pas, toujours 2d secondes
  const reste = t - paire * 2 * d;
  const premier = d * (1 + morceau.swing);
  if (reste < premier) return paire * 2 + reste / premier;
  return paire * 2 + 1 + (reste - premier) / (d * (1 - morceau.swing));
}

/** Temps de départ (s) d'une apparition de section, ou null si elle n'existe pas. */
export function debutOccurrence(morceau: Morceau, section: string, occurrence: number): number | null {
  const o = arrangement(morceau).find((x) => x.section.id === section && x.occurrence === occurrence);
  return o ? o.debutPas * dureePas(morceau.tempo) : null;
}

/** Temps (s) où commence une prise : début de l'apparition de sa section + ses mesures. null si l'ancre n'existe plus. */
export function positionAncre(morceau: Morceau, ancre: Prise['ancre']): number | null {
  const debut = debutOccurrence(morceau, ancre.section, ancre.occurrence);
  if (debut === null) return null;
  return debut + ancre.mesure * PAS_PAR_MESURE * dureePas(morceau.tempo);
}

/** L'apparition de section jouée au pas donné (ou null après la fin). */
export function occurrenceAuPas(morceau: Morceau, pas: number): Occurrence | null {
  for (const o of arrangement(morceau)) if (pas >= o.debutPas && pas < o.debutPas + o.pas) return o;
  return null;
}

/** Durée affichée en mm:ss. */
export function formaterDuree(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
