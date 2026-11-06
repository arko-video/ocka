// CONTRAT C1 (v2) — ÉDITION PURE du morceau /3 par l'interface : notes et pistes (U1), mixage, automation et
// sections (U2). Chaque type ci-dessous est FIGÉ : l'implémentation (fichier indiqué) doit le respecter, sinon tsc
// échoue ici. Toutes pures : nouveau morceau (ou LE MÊME objet si rien ne change, pour l'historique), jamais de
// mutation, résultat accepté tel quel par le normaliseur (aucun problème). À passer à `modifier()` (ui/etat.ts).
// Lecture : morceau/acces.ts (motifNotesDe, pistesInstrument, sectionsAvecMotif…).

import type { Cible, Insert, Lfo, Morceau, MotifNotes, Note, PointCourbe, Sidechain, Tranche, TypeEffet } from '../../morceau/types';
import { relier } from '../../moteur/relier';
import * as automation from './automation';
import * as mixage from './mixage';
import * as notes from './notes';
import * as pistes from './pistes';
import * as sections from './sections';

export type { NotesCopiees } from './notes';
type Edition<A extends unknown[]> = (m: Morceau, ...args: A) => Morceau;

/* ------------------------------------------------------------ notes (U1, src/ui/edition/notes.ts) */

/** Pose une note (créée sur la grille du 1/24 ; le motif de la section est créé s'il manque). */
export const ajouterNote: Edition<[idPiste: string, idSection: string, note: Note]> = relier(() => notes.ajouterNote);
export const supprimerNotes: Edition<[idPiste: string, idSection: string, indices: readonly number[]]> = relier(() => notes.supprimerNotes);
/** Glisser : décale les notes de `dPas` (1/24) et `dMidi` demi-tons, bornées au motif et à BORNES_NOTE. */
export const deplacerNotes: Edition<[idPiste: string, idSection: string, indices: readonly number[], dPas: number, dMidi: number]> = relier(() => notes.deplacerNotes);
/** Poignée : nouvelle durée (pas, ≥ 1/24, sans dépasser la fin du motif). */
export const allongerNote: Edition<[idPiste: string, idSection: string, indice: number, duree: number]> = relier(() => notes.allongerNote);
export const reglerVelocite: Edition<[idPiste: string, idSection: string, indices: readonly number[], vel: number]> = relier(() => notes.reglerVelocite);
/** Quantification : `grille` en pas (4 = noire… 0,5 = triple-croche ; 4/3, 2/3 = triolets), `force` 0 à 1. `indices` null = tout. */
export const quantifier: Edition<[idPiste: string, idSection: string, indices: readonly number[] | null, grille: number, force: number]> = relier(() => notes.quantifier);
/** Copier (pur, sans morceau) puis coller au pas `pas`. */
export const copierNotes: (motif: MotifNotes, indices: readonly number[]) => notes.NotesCopiees = relier(() => notes.copierNotes);
export const collerNotes: Edition<[idPiste: string, idSection: string, copie: notes.NotesCopiees, pas: number]> = relier(() => notes.collerNotes);
/** Longueur du motif (16 à 128 pas, multiple de 16) : les notes au-delà partent, les autres sont raccourcies. */
export const changerLongueurMotif: Edition<[idPiste: string, idSection: string, pas: number]> = relier(() => notes.changerLongueurMotif);
/** « Accords en un toucher » : l'accord du degré (« i », « VI7 »…) dans la tonalité du morceau, posé d'un coup. */
export const poserAccord: Edition<[idPiste: string, idSection: string, pas: number, duree: number, degre: string]> = relier(() => notes.poserAccord);

/* ------------------------------------------------------------ pistes (U1, src/ui/edition/pistes.ts) */

/** « + Piste » : une piste instrument neuve (id libre, nom par défaut = nom de l'instrument) ; null au-delà de 16. */
export const ajouterPiste: (m: Morceau, instrument: string, nom?: string) => { m: Morceau; id: string } | null = relier(() => pistes.ajouterPiste);
export const dupliquerPiste: (m: Morceau, id: string) => { m: Morceau; id: string } | null = relier(() => pistes.dupliquerPiste);
export const supprimerPiste: Edition<[id: string]> = relier(() => pistes.supprimerPiste);
export const renommerPiste: Edition<[id: string, nom: string]> = relier(() => pistes.renommerPiste);
export const changerInstrument: Edition<[id: string, instrument: string]> = relier(() => pistes.changerInstrument);
export const deplacerPiste: Edition<[id: string, sens: -1 | 1]> = relier(() => pistes.deplacerPiste);

/* ------------------------------------------------------------ mixage (U2, src/ui/edition/mixage.ts) */

export const reglerTranche: Edition<[idPiste: string, c: Partial<Pick<Tranche, 'volume' | 'pan' | 'muet' | 'solo'>>]> = relier(() => mixage.reglerTranche);
export const ajouterInsert: Edition<[idPiste: string, type: TypeEffet]> = relier(() => mixage.ajouterInsert);
export const retirerInsert: Edition<[idPiste: string, idInsert: string]> = relier(() => mixage.retirerInsert);
export const deplacerInsert: Edition<[idPiste: string, idInsert: string, sens: -1 | 1]> = relier(() => mixage.deplacerInsert);
export const reglerInsert: Edition<[idPiste: string, idInsert: string, c: { actif?: boolean; params?: Record<string, number> }]> = relier(() => mixage.reglerInsert);
export const appliquerPresetInserts: Edition<[idPiste: string, inserts: readonly Insert[]]> = relier(() => mixage.appliquerPresetInserts);
/** « Pompe » : sidechain sur le kick (null = retiré). */
export const reglerSidechain: Edition<[idPiste: string, sidechain: Sidechain | null]> = relier(() => mixage.reglerSidechain);

/* ------------------------------------------------------------ automation (U2, src/ui/edition/automation.ts) */

export const poserPoint: Edition<[idPiste: string, cible: Cible, idSection: string, point: PointCourbe]> = relier(() => automation.poserPoint);
export const deplacerPoint: Edition<[idPiste: string, cible: Cible, idSection: string, indice: number, point: PointCourbe]> = relier(() => automation.deplacerPoint);
export const retirerPoint: Edition<[idPiste: string, cible: Cible, idSection: string, indice: number]> = relier(() => automation.retirerPoint);
export const effacerCourbe: Edition<[idPiste: string, cible: Cible, idSection: string | null]> = relier(() => automation.effacerCourbe);
export const reglerLfo: Edition<[idPiste: string, indice: 0 | 1, lfo: Lfo | null]> = relier(() => automation.reglerLfo);

/* ------------------------------------------------------------ frise (U2, src/ui/edition/sections.ts) */

/** « Rendre unique » : copie du motif de la piste pour cette section seulement. */
export const rendreUnique: Edition<[idSection: string, idPiste: string]> = relier(() => sections.rendreUnique);
