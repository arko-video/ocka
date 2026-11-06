// Édition pure des notes d'une piste instrument dans une section (piano roll « Complet ») — propriétaire : U1.
// Signatures figées dans api-edition.ts. Règles : jamais de mutation (nouveau morceau, ou le même si rien ne change) ;
// le motif de la section est CRÉÉ au premier geste (MotifNotes, 2 mesures) ; notes sur la grille du 1/24 de pas,
// triées, dédoublonnées, au plus PLAFONDS.notesParMotifNotes ; un motif partagé par plusieurs sections est modifié
// partout (« Rendre unique » d'abord : rendreUniqueMotif). Indices = positions dans motif.notes.
// Outils : notes-motif.ts ; accords : accords.ts.

import { BORNES_NOTE, PLAFONDS, type Morceau, type MotifNotes, type Note } from '../../morceau/types';
import { notesAccord } from '../../morceau/theorie';
import {
  assurerMotif,
  avecMotif,
  borner,
  changerNotes,
  grille24,
  indicesValides,
  motifEdite,
  noteValide,
  UN_PAS,
} from './notes-motif';

export { partageDe, rendreUniqueMotif } from './notes-motif';

/** Notes copiées (presse-papiers du piano roll), pas relatifs à la première note. */
export interface NotesCopiees {
  notes: Note[];
  /** Pas couverts (de la 1re note au bout de la dernière). */
  longueur: number;
}

/** Pose une note (remplace celle qui serait au même pas et à la même hauteur). */
export function ajouterNote(m: Morceau, idPiste: string, idSection: string, note: Note): Morceau {
  return changerNotes(m, idPiste, idSection, (motif) => {
    const n = noteValide(note, motif.pas);
    if (!n) return null;
    const ailleurs = motif.notes.filter((x) => !(x.pas === n.pas && x.midi === n.midi));
    if (ailleurs.length >= PLAFONDS.notesParMotifNotes) return null;
    return [...ailleurs, n];
  });
}

export function supprimerNotes(
  m: Morceau,
  idPiste: string,
  idSection: string,
  indices: readonly number[],
): Morceau {
  const e = motifEdite(m, idPiste, idSection);
  if (!e) return m;
  const sel = indicesValides(indices, e.motif.notes.length);
  if (sel.size === 0) return m;
  return changerNotes(m, idPiste, idSection, (motif) => motif.notes.filter((_, i) => !sel.has(i)));
}

/** Glisser : décale les notes de `dPas` (1/24) et `dMidi` demi-tons, en bloc, bornées au motif et à BORNES_NOTE. */
export function deplacerNotes(
  m: Morceau,
  idPiste: string,
  idSection: string,
  indices: readonly number[],
  dPas: number,
  dMidi: number,
): Morceau {
  const e = motifEdite(m, idPiste, idSection);
  if (!e || !Number.isFinite(dPas) || !Number.isFinite(dMidi)) return m;
  const sel = indicesValides(indices, e.motif.notes.length);
  if (sel.size === 0) return m;
  const choisies = e.motif.notes.filter((_, i) => sel.has(i));
  const premier = Math.min(...choisies.map((n) => n.pas));
  const dernier = Math.max(...choisies.map((n) => n.pas));
  const bas = Math.min(...choisies.map((n) => n.midi));
  const haut = Math.max(...choisies.map((n) => n.midi));
  const dp = borner(grille24(dPas), -premier, e.motif.pas - UN_PAS - dernier);
  const dm = borner(Math.round(dMidi), BORNES_NOTE.midiMin - bas, BORNES_NOTE.midiMax - haut);
  if (dp === 0 && dm === 0) return m;
  return changerNotes(m, idPiste, idSection, (motif) => {
    const restent = motif.notes.filter((_, i) => !sel.has(i));
    const bougees = choisies.flatMap(
      (n) => noteValide({ ...n, pas: n.pas + dp, midi: n.midi + dm }, motif.pas) ?? [],
    );
    return [...restent, ...bougees];
  });
}

/** Poignée : nouvelle durée (pas, ≥ 1/24, sans dépasser la fin du motif). */
export function allongerNote(
  m: Morceau,
  idPiste: string,
  idSection: string,
  indice: number,
  duree: number,
): Morceau {
  const e = motifEdite(m, idPiste, idSection);
  const n = e?.motif.notes[indice];
  if (!e || !n || !Number.isInteger(indice) || !Number.isFinite(duree)) return m;
  const d = borner(grille24(duree), UN_PAS, e.motif.pas - n.pas);
  if (d === n.duree) return m;
  return changerNotes(m, idPiste, idSection, (motif) =>
    motif.notes.map((x, i) => (i === indice ? { ...x, duree: d } : x)),
  );
}

export function reglerVelocite(
  m: Morceau,
  idPiste: string,
  idSection: string,
  indices: readonly number[],
  vel: number,
): Morceau {
  const e = motifEdite(m, idPiste, idSection);
  if (!e || !Number.isFinite(vel)) return m;
  const sel = indicesValides(indices, e.motif.notes.length);
  const v = borner(vel, BORNES_NOTE.velMin, BORNES_NOTE.velMax);
  if (![...sel].some((i) => e.motif.notes[i]!.vel !== v)) return m;
  return changerNotes(m, idPiste, idSection, (motif) =>
    motif.notes.map((x, i) => (sel.has(i) ? { ...x, vel: v } : x)),
  );
}

/** Quantification des départs : `grille` en pas (4 = noire… 0,5 = triple-croche ; 4/3, 2/3 = triolets), `force` 0 à 1. */
export function quantifier(
  m: Morceau,
  idPiste: string,
  idSection: string,
  indices: readonly number[] | null,
  grille: number,
  force: number,
): Morceau {
  const e = motifEdite(m, idPiste, idSection);
  if (!e || !(grille > 0) || !Number.isFinite(grille) || !Number.isFinite(force)) return m;
  const f = borner(force, 0, 1);
  const sel = indices === null ? null : indicesValides(indices, e.motif.notes.length);
  const notes = e.motif.notes.map((n, i) => {
    if (sel && !sel.has(i)) return n;
    const cible = Math.round(n.pas / grille) * grille;
    const pas = borner(grille24(n.pas + (cible - n.pas) * f), 0, e.motif.pas - UN_PAS);
    return pas === n.pas ? n : { ...n, pas, duree: Math.min(n.duree, e.motif.pas - pas) };
  });
  if (notes.every((n, i) => n === e.motif.notes[i])) return m;
  return changerNotes(m, idPiste, idSection, () => notes);
}

/** Copier (pur, sans morceau) : les notes choisies, rangées, au pas relatif à la première. */
export function copierNotes(motif: MotifNotes, indices: readonly number[]): NotesCopiees {
  const sel = indicesValides(indices, motif.notes.length);
  const choisies = motif.notes.filter((_, i) => sel.has(i));
  if (choisies.length === 0) return { notes: [], longueur: 0 };
  const debut = Math.min(...choisies.map((n) => n.pas));
  const fin = Math.max(...choisies.map((n) => n.pas + n.duree));
  return {
    notes: choisies.map((n) => ({ ...n, pas: grille24(n.pas - debut) })),
    longueur: grille24(fin - debut),
  };
}

/** Coller au pas `pas` : les notes qui dépassent la fin du motif sont raccourcies ou laissées de côté. */
export function collerNotes(
  m: Morceau,
  idPiste: string,
  idSection: string,
  copie: NotesCopiees,
  pas: number,
): Morceau {
  if (!copie || !Array.isArray(copie.notes) || copie.notes.length === 0 || !Number.isFinite(pas)) return m;
  const depart = grille24(Math.max(0, pas));
  return changerNotes(m, idPiste, idSection, (motif) => {
    if (depart >= motif.pas) return null;
    const collees = copie.notes.flatMap((n) =>
      depart + n.pas < motif.pas ? (noteValide({ ...n, pas: depart + n.pas }, motif.pas) ?? []) : [],
    );
    return collees.length ? [...motif.notes, ...collees] : null;
  });
}

/** Longueur du motif (16 à 128 pas, multiple de 16) : les notes au-delà partent, les autres sont raccourcies. */
export function changerLongueurMotif(m: Morceau, idPiste: string, idSection: string, pas: number): Morceau {
  if (!Number.isInteger(pas) || pas < 16 || pas > PLAFONDS.pasMotifNotes || pas % 16 !== 0) return m;
  const a = assurerMotif(m, idPiste, idSection);
  if (!a || a.motif.pas === pas) return m;
  const notes = a.motif.notes
    .filter((n) => n.pas < pas)
    .map((n) => (n.pas + n.duree > pas ? { ...n, duree: pas - n.pas } : n));
  return avecMotif(a.m, a.id, { ...a.motif, pas, notes });
}

/** Pose d'un coup des notes de même départ et même durée (un accord). Une seule étape d'Annuler. */
export function poserNotesAccord(
  m: Morceau,
  idPiste: string,
  idSection: string,
  pas: number,
  duree: number,
  midis: readonly number[],
  vel = 1,
): Morceau {
  if (midis.length === 0) return m;
  return changerNotes(m, idPiste, idSection, (motif) => {
    const neuves = midis.flatMap((midi) => noteValide({ pas, duree, midi, vel }, motif.pas) ?? []);
    if (neuves.length === 0) return null;
    const cles = new Set(neuves.map((n) => `${n.pas}|${n.midi}`));
    const restent = motif.notes.filter((x) => !cles.has(`${x.pas}|${x.midi}`));
    if (restent.length + neuves.length > PLAFONDS.notesParMotifNotes) return null;
    return [...restent, ...neuves];
  });
}

/** « Accords en un toucher » : l'accord du degré (« i », « VI7 »…) dans la tonalité du morceau (racine entre do 4 et si 4). */
export function poserAccord(
  m: Morceau,
  idPiste: string,
  idSection: string,
  pas: number,
  duree: number,
  degre: string,
): Morceau {
  const notes = notesAccord(m.tonalite.tonique, m.tonalite.mode, degre, 60);
  return poserNotesAccord(m, idPiste, idSection, pas, duree, notes);
}
