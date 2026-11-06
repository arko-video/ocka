// Outils purs du piano roll (U1) : grille du 1/24 de pas, notes valides et rangées, motif de notes d'une piste dans
// une section (créé au premier geste), « Rendre unique ». Utilisés par notes.ts et pistes.ts ; jamais de mutation.

import {
  avecMotifSection,
  estPisteInstrument,
  idMotifDe,
  motifNotesDe,
  pisteDe,
  sectionDe,
  sectionsAvecMotif,
} from '../../morceau/acces';
import {
  BORNES_NOTE,
  GRILLE_PAS,
  PLAFONDS,
  type Morceau,
  type MotifNotes,
  type Note,
} from '../../morceau/types';
import { idLibre } from './ids';

/** Le plus petit pas possible : 1/24 de double-croche. */
export const UN_PAS = 1 / GRILLE_PAS;

/** Arrondi sur la grille du 1/24 (même calcul que le normaliseur). */
export const grille24 = (x: number) => Math.round(x * GRILLE_PAS) / GRILLE_PAS;

export const borner = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Ids déjà pris par un motif ou une section (un id de motif neuf n'en reprend aucun). */
export function idsPris(m: Morceau): string[] {
  return [...Object.keys(m.motifs), ...m.sections.map((s) => s.id)];
}

/** Copie du dictionnaire des motifs (sans prototype, comme le normaliseur) avec un motif changé. */
export function avecMotif(m: Morceau, id: string, motif: MotifNotes): Morceau {
  const motifs = Object.assign(Object.create(null) as Morceau['motifs'], m.motifs);
  motifs[id] = motif;
  return { ...m, motifs };
}

/**
 * Une note rendue valide pour un motif de `longueur` pas : départ et durée sur la grille du 1/24, dans le motif,
 * hauteur entière dans BORNES_NOTE, vélocité 0,1 à 1. null si elle ne peut pas y tenir (nombre illisible).
 */
export function noteValide(n: Note, longueur: number): Note | null {
  if (![n.pas, n.duree, n.midi, n.vel].every(Number.isFinite)) return null;
  const pas = borner(grille24(n.pas), 0, longueur - UN_PAS);
  if (n.pas >= longueur || n.pas < -UN_PAS / 2) return null;
  const duree = borner(grille24(n.duree), UN_PAS, longueur - pas);
  const midi = Math.round(n.midi);
  if (midi < BORNES_NOTE.midiMin || midi > BORNES_NOTE.midiMax) return null;
  const vel = borner(n.vel, BORNES_NOTE.velMin, BORNES_NOTE.velMax);
  const note: Note = { pas, duree, midi, vel };
  if (n.glisse) note.glisse = true;
  return note;
}

/** Notes triées par pas puis hauteur ; au même pas et même hauteur, la DERNIÈRE de la liste gagne ; 1024 au plus. */
export function ranger(notes: readonly Note[]): Note[] {
  const parCle = new Map<string, Note>();
  for (const n of notes) parCle.set(`${n.pas}|${n.midi}`, n);
  return [...parCle.values()]
    .sort((a, b) => a.pas - b.pas || a.midi - b.midi)
    .slice(0, PLAFONDS.notesParMotifNotes);
}

/** Le motif de notes d'une piste instrument dans une section, avec son id ; null s'il n'y en a pas. */
export function motifEdite(
  m: Morceau,
  idPiste: string,
  idSection: string,
): { id: string; motif: MotifNotes } | null {
  const motif = motifNotesDe(m, idSection, idPiste);
  const id = idMotifDe(sectionDe(m, idSection), idPiste);
  return motif && id ? { id, motif } : null;
}

/** Longueur d'un motif neuf : 2 mesures (1 si la section n'a qu'une mesure). */
export function longueurNeuve(mesures: number): number {
  return mesures >= 2 ? 32 : 16;
}

/**
 * Le motif de la piste dans la section ; CRÉÉ (vide, 2 mesures) s'il manque. null si la piste n'est pas une piste
 * instrument ou si la section n'existe pas.
 */
export function assurerMotif(
  m: Morceau,
  idPiste: string,
  idSection: string,
): { m: Morceau; id: string; motif: MotifNotes } | null {
  const s = sectionDe(m, idSection);
  if (!s || !estPisteInstrument(pisteDe(m, idPiste))) return null;
  const existant = motifEdite(m, idPiste, idSection);
  if (existant) return { m, ...existant };
  const id = idLibre(`${idPiste}-${idSection}`, idsPris(m), 'notes');
  const motif: MotifNotes = { type: 'notes', pas: longueurNeuve(s.mesures), notes: [] };
  return { m: avecMotifSection(avecMotif(m, id, motif), idSection, idPiste, id), id, motif };
}

/**
 * Change les notes du motif (créé au besoin) : `f` reçoit le motif et renvoie les nouvelles notes, ou null / le même
 * tableau si rien ne change (le morceau d'origine est alors rendu, sans motif vide créé pour rien).
 */
export function changerNotes(
  m: Morceau,
  idPiste: string,
  idSection: string,
  f: (motif: MotifNotes) => Note[] | null,
): Morceau {
  const a = assurerMotif(m, idPiste, idSection);
  if (!a) return m;
  const notes = f(a.motif);
  if (!notes || notes === a.motif.notes) return m;
  const rangees = ranger(notes);
  if (memesNotes(rangees, a.motif.notes)) return m;
  return avecMotif(a.m, a.id, { ...a.motif, notes: rangees });
}

function memesNotes(a: readonly Note[], b: readonly Note[]): boolean {
  return (
    a.length === b.length &&
    a.every((n, i) => {
      const x = b[i]!;
      return (
        n.pas === x.pas &&
        n.duree === x.duree &&
        n.midi === x.midi &&
        n.vel === x.vel &&
        !!n.glisse === !!x.glisse
      );
    })
  );
}

/** Indices valides (entiers, dans la liste), sans doublon. */
export function indicesValides(indices: readonly number[], n: number): Set<number> {
  return new Set(indices.filter((i) => Number.isInteger(i) && i >= 0 && i < n));
}

/** Nombre de sections qui jouent le motif de cette piste dans cette section (« dans N sections »). */
export function partageDe(m: Morceau, idPiste: string, idSection: string): number {
  const id = idMotifDe(sectionDe(m, idSection), idPiste);
  return id ? sectionsAvecMotif(m, id).length : 0;
}

/**
 * « Rendre unique » : si le motif de la piste est joué par plusieurs sections, cette section reçoit sa propre copie
 * (les autres gardent l'original). Même morceau si le motif n'est pas partagé.
 */
export function rendreUniqueMotif(m: Morceau, idSection: string, idPiste: string): Morceau {
  const e = motifEdite(m, idPiste, idSection);
  if (!e || sectionsAvecMotif(m, e.id).length < 2) return m;
  const id = idLibre(`${idPiste}-${idSection}`, idsPris(m), 'notes');
  const copie: MotifNotes = { type: 'notes', pas: e.motif.pas, notes: e.motif.notes.map((n) => ({ ...n })) };
  return avecMotifSection(avecMotif(m, id, copie), idSection, idPiste, id);
}
