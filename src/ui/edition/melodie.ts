// Édition pure de la mélodie d'une section : gamme (8 notes sur une octave), motif créé au premier geste,
// notes posées ou effacées dans la grille, longueur du motif, son, notes jouées au clavier.
// Le morceau n'est jamais modifié : chaque fonction renvoie un nouveau morceau (ou le même si rien ne change).

import { PLAFONDS, type Morceau, type MotifMelodie, type NoteMelodie, type Section, type SonMelodie } from '../../morceau/types';
import { demiTonsDegre, hauteurTonique } from '../../morceau/theorie';
import { idLibre } from './ids';

/** Octaves proposées : grave, milieu, aigu. */
export const OCTAVES = [-1, 0, 1] as const;
export type Octave = (typeof OCTAVES)[number];
/** Durées des notes de la grille, en pas : 1/16, 1/8, 1/4, 1/2. */
export const DUREES = [1, 2, 4, 8] as const;
/** Longueurs du motif, en mesures. */
export const LONGUEURS = [1, 2, 4] as const;
export const SON_DEFAUT: SonMelodie = 'piano';

const MIDI_MIN = 24;
const MIDI_MAX = 108;

/**
 * Les 8 notes MIDI de la gamme (degrés 0 à 7, le 7 = la tonique une octave plus haut). Octave 0 : la tonique
 * entre do 4 (60) et si 4 (71). Jamais de fausse note : seules les notes de la gamme sont proposées.
 */
export function notesGamme(tonalite: Morceau['tonalite'], octave: number): number[] {
  const base = 60 + hauteurTonique(tonalite.tonique) + 12 * octave;
  return Array.from({ length: 8 }, (_, d) => base + demiTonsDegre(tonalite.mode, d));
}

/** Id du motif de mélodie joué par la section (null s'il n'y en a pas). */
export function idMelodie(m: Morceau, idSection: string): string | null {
  const id = m.sections.find((s) => s.id === idSection)?.motifs.melodie;
  return id && m.motifs[id]?.type === 'melodie' ? id : null;
}

export function motifMelodie(m: Morceau, idSection: string): MotifMelodie | null {
  const id = idMelodie(m, idSection);
  return id ? (m.motifs[id] as MotifMelodie) : null;
}

/** Longueur d'un motif neuf : 2 mesures (1 si la section n'a qu'une mesure). */
export function longueurDefaut(s: Section): number {
  return s.mesures >= 2 ? 32 : 16;
}

/** Copie du dictionnaire des motifs (sans prototype, comme le normaliseur) avec un motif changé. */
function avecMotif(m: Morceau, id: string, motif: MotifMelodie): Morceau {
  const motifs = Object.assign(Object.create(null) as Morceau['motifs'], m.motifs);
  motifs[id] = motif;
  return { ...m, motifs };
}

/** La section et son motif de mélodie ; le motif est CRÉÉ (vide) s'il manque. null si la section n'existe pas. */
function assurer(m: Morceau, idSection: string): { m: Morceau; id: string; motif: MotifMelodie } | null {
  const s = m.sections.find((x) => x.id === idSection);
  if (!s) return null;
  const existant = idMelodie(m, idSection);
  if (existant) return { m, id: existant, motif: m.motifs[existant] as MotifMelodie };
  const id = idLibre(`mel-${idSection}`, [...Object.keys(m.motifs), ...m.sections.map((x) => x.id)], 'melodie');
  const motif: MotifMelodie = { type: 'melodie', pas: longueurDefaut(s), notes: [], son: SON_DEFAUT };
  const avec = avecMotif(m, id, motif);
  const sections = m.sections.map((x) => (x.id === idSection ? { ...x, motifs: { ...x.motifs, melodie: id } } : x));
  return { m: { ...avec, sections }, id, motif };
}

/** Crée le motif de mélodie de la section s'il manque (premier geste dans la vue Mélodie). */
export function creerMelodie(m: Morceau, idSection: string): Morceau {
  return assurer(m, idSection)?.m ?? m;
}

const trier = (notes: NoteMelodie[]) => [...notes].sort((a, b) => a.pas - b.pas || a.midi - b.midi);

/** La note qui sonne au pas `pas` sur la hauteur `midi` (son début ou sa suite), s'il y en a une. */
export function noteA(motif: MotifMelodie, pas: number, midi: number): NoteMelodie | undefined {
  return motif.notes.find((n) => n.midi === midi && pas >= n.pas && pas < n.pas + n.duree);
}

/** Durée possible d'une note neuve : sans dépasser la fin du motif ni la note suivante de même hauteur. */
function dureeLibre(notes: NoteMelodie[], longueur: number, pas: number, midi: number, voulue: number): number {
  let fin = Math.min(longueur, pas + Math.max(1, Math.round(voulue)));
  for (const n of notes) if (n.midi === midi && n.pas > pas && n.pas < fin) fin = n.pas;
  return fin - pas;
}

/**
 * Toucher une case de la grille : sur une note, l'efface ; sur une case vide, pose une note de `duree` pas
 * (raccourcie à la fin du motif ou avant la note suivante de même hauteur). Crée le motif s'il manque.
 */
export function basculerNote(m: Morceau, idSection: string, pas: number, midi: number, duree: number): Morceau {
  const a = assurer(m, idSection);
  if (!a || !Number.isInteger(pas) || pas < 0 || pas >= a.motif.pas) return m;
  if (!Number.isInteger(midi) || midi < MIDI_MIN || midi > MIDI_MAX) return m;
  const touchee = noteA(a.motif, pas, midi);
  if (touchee) return avecMotif(a.m, a.id, { ...a.motif, notes: a.motif.notes.filter((n) => n !== touchee) });
  if (a.motif.notes.length >= PLAFONDS.notesParMotif) return m;
  const note: NoteMelodie = { pas, duree: dureeLibre(a.motif.notes, a.motif.pas, pas, midi, duree), midi };
  return avecMotif(a.m, a.id, { ...a.motif, notes: trier([...a.motif.notes, note]) });
}

/** « Effacer la mélodie » : le motif reste (avec son son et sa longueur), sans notes. */
export function effacerMelodie(m: Morceau, idSection: string): Morceau {
  const id = idMelodie(m, idSection);
  const motif = id ? (m.motifs[id] as MotifMelodie) : null;
  if (!id || !motif || motif.notes.length === 0) return m;
  return avecMotif(m, id, { ...motif, notes: [] });
}

/** Longueur du motif en mesures (1, 2 ou 4) : les notes après la fin sont retirées, les autres raccourcies. */
export function changerLongueur(m: Morceau, idSection: string, mesures: number): Morceau {
  if (!(LONGUEURS as readonly number[]).includes(mesures)) return m;
  const a = assurer(m, idSection);
  if (!a) return m;
  const pas = mesures * 16;
  if (a.motif.pas === pas) return a.m;
  const notes = a.motif.notes.filter((n) => n.pas < pas).map((n) => (n.pas + n.duree > pas ? { ...n, duree: pas - n.pas } : n));
  return avecMotif(a.m, a.id, { ...a.motif, pas, notes });
}

/** Nombre de notes qu'une nouvelle longueur ferait perdre (pour prévenir). */
export function notesPerdues(motif: MotifMelodie | null, mesures: number): number {
  return motif ? motif.notes.filter((n) => n.pas >= mesures * 16).length : 0;
}

/** Choisit le son de la mélodie de la section (crée le motif s'il manque). */
export function choisirSon(m: Morceau, idSection: string, son: SonMelodie): Morceau {
  const a = assurer(m, idSection);
  if (!a) return m;
  if (a.motif.son === son) return a.m;
  return avecMotif(a.m, a.id, { ...a.motif, son });
}

/**
 * Ajoute d'un coup les notes jouées au clavier (déjà calées : voir clavier.ts) : UNE seule étape d'Annuler.
 * Une note déjà présente (même pas, même hauteur, ou recouverte) est sautée. Sans note gardée, rien ne change.
 */
export function poserNotes(m: Morceau, idSection: string, nouvelles: readonly NoteMelodie[]): Morceau {
  const a = assurer(m, idSection);
  if (!a) return m;
  let notes = [...a.motif.notes];
  let ajoutees = 0;
  for (const n of trier([...nouvelles])) {
    if (notes.length >= PLAFONDS.notesParMotif) break;
    if (!Number.isInteger(n.pas) || n.pas < 0 || n.pas >= a.motif.pas) continue;
    if (!Number.isInteger(n.midi) || n.midi < MIDI_MIN || n.midi > MIDI_MAX) continue;
    if (notes.some((x) => x.midi === n.midi && n.pas >= x.pas && n.pas < x.pas + x.duree)) continue;
    const note: NoteMelodie = { pas: n.pas, duree: dureeLibre(notes, a.motif.pas, n.pas, n.midi, n.duree), midi: n.midi };
    if (n.vel !== undefined) note.vel = Math.min(1, Math.max(0.1, n.vel));
    notes.push(note);
    ajoutees++;
  }
  if (ajoutees === 0) return m;
  notes = trier(notes);
  return avecMotif(a.m, a.id, { ...a.motif, notes });
}

/** Notes du motif hors des 8 lignes affichées (autre octave) : on le signale sous la grille. */
export function notesHorsVue(motif: MotifMelodie | null, lignes: readonly number[]): number {
  return motif ? motif.notes.filter((n) => !lignes.includes(n.midi)).length : 0;
}
