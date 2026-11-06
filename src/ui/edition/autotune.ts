// Éditions PURES de l'autotune d'une prise (Prise.autotune, contrat C2, A2) : préréglage, réglages, gamme, et les
// notes de l'éditeur (déplacer d'un demi-ton aimanté à la gamme, couper, fusionner, justesse, vibrato).
// Chaque fonction renvoie le MÊME objet quand rien ne change (modifier() n'ajoute alors pas d'étape d'Annuler).
// Les notes sont en secondes DANS le fichier de la prise (comme NoteAutotune), triées et sans chevauchement.

import { GAMMES, hauteurTonique } from '../../morceau/theorie';
import type { AutotunePrise, Morceau, NoteAutotune, Prise } from '../../morceau/types';

export type GammeAutotune = AutotunePrise['gamme'];
export type ReglageAutotune = 'vitesse' | 'force' | 'humaniser' | 'formants';

export const MAX_NOTES = 1024;
export const MIDI_MIN = 24;
export const MIDI_MAX = 96;
/** Une note plus courte ne se coupe plus (s). */
export const DUREE_MIN_NOTE = 0.06;
/** Bornes et pas des réglages (types-ajouts.ts). */
export const BORNES: Record<ReglageAutotune, { min: number; max: number; pas: number }> = {
  vitesse: { min: 0, max: 400, pas: 1 },
  force: { min: 0, max: 1, pas: 0.01 },
  humaniser: { min: 0, max: 1, pas: 0.01 },
  formants: { min: -12, max: 12, pas: 0.5 },
};

const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const arrondi = (x: number, pas: number) => Math.round(Math.round(x / pas) * pas * 1e6) / 1e6;

export const priseDe = (m: Morceau, id: string): Prise | undefined => m.prises.find((p) => p.id === id);
export const autotuneDe = (m: Morceau, id: string): AutotunePrise | undefined => priseDe(m, id)?.autotune;

function remplacerPrise(m: Morceau, id: string, f: (p: Prise) => Prise): Morceau {
  const p = priseDe(m, id);
  if (!p) return m;
  const n = f(p);
  return n === p ? m : { ...m, prises: m.prises.map((x) => (x.id === id ? n : x)) };
}

/** Écrit (ou retire, `undefined`) l'autotune d'une prise. */
export function ecrireAutotunePrise(m: Morceau, id: string, a: AutotunePrise | undefined): Morceau {
  return remplacerPrise(m, id, (p) => {
    if (p.autotune === a) return p;
    if (!a) {
      if (!p.autotune) return p;
      const { autotune: _retire, ...reste } = p;
      return reste;
    }
    return { ...p, autotune: a };
  });
}

/** Préréglage choisi : ses réglages, en GARDANT la gamme choisie et les notes déjà éditées. */
export function appliquerPreset(m: Morceau, id: string, reglages: AutotunePrise): Morceau {
  const avant = autotuneDe(m, id);
  const a: AutotunePrise = { ...reglages, gamme: avant?.gamme ?? reglages.gamme };
  if (avant?.notes?.length) a.notes = avant.notes;
  else delete a.notes;
  return ecrireAutotunePrise(m, id, a);
}

/** Un réglage touché à la main (borné, arrondi) : le préréglage devient « perso ». */
export function reglerAutotune(m: Morceau, id: string, champ: ReglageAutotune, valeur: number): Morceau {
  const a = autotuneDe(m, id);
  if (!a || !Number.isFinite(valeur)) return m;
  const b = BORNES[champ];
  const v = arrondi(borne(valeur, b.min, b.max), b.pas);
  if (a[champ] === v) return m;
  return ecrireAutotunePrise(m, id, { ...a, [champ]: v, preset: 'perso' });
}

export function memeGamme(a: GammeAutotune, b: GammeAutotune): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.tonique === b.tonique && a.mode === b.mode;
}

export function choisirGamme(m: Morceau, id: string, gamme: GammeAutotune): Morceau {
  const a = autotuneDe(m, id);
  if (!a || memeGamme(a.gamme, gamme)) return m;
  return ecrireAutotunePrise(m, id, { ...a, gamme: typeof gamme === 'string' ? gamme : { tonique: gamme.tonique, mode: gamme.mode } });
}

/** La gamme visée en clair (null = chromatique : toutes les notes). */
export function gammeResolue(g: GammeAutotune, tonalite: Morceau['tonalite']): Morceau['tonalite'] | null {
  if (g === 'chromatique') return null;
  return g === 'morceau' ? tonalite : g;
}

/** Classes de hauteur (0 à 11) de la gamme visée ; null = chromatique. */
export function classesGamme(g: GammeAutotune, tonalite: Morceau['tonalite']): ReadonlySet<number> | null {
  const t = gammeResolue(g, tonalite);
  if (!t) return null;
  const base = hauteurTonique(t.tonique);
  return new Set(GAMMES[t.mode].map((d) => (base + d) % 12));
}

/* ------------------------------------------------------------ notes de l'éditeur */

/** La note de la gamme la plus proche d'une hauteur chantée (cents MIDI) ; chromatique (`null`) : la plus proche. */
export function noteProche(cents: number, classes: ReadonlySet<number> | null): number {
  const proche = Math.round(cents / 100);
  let meilleure = proche;
  let ecart = Infinity;
  for (let x = proche - 6; x <= proche + 6; x++) {
    if (classes && !classes.has(((x % 12) + 12) % 12)) continue;
    const e = Math.abs(x * 100 - cents);
    if (e < ecart) [meilleure, ecart] = [x, e];
  }
  return borne(meilleure, MIDI_MIN, MIDI_MAX);
}

/**
 * Notes de départ de l'éditeur, d'après les notes détectées : chacune visée sur la note la plus proche de la gamme
 * (ce que fait l'autotune sans édition), justesse 0, vibrato gardé.
 */
export function notesDepuisDetection(
  detectees: readonly { debut: number; fin: number; midi: number; justesse?: number }[],
  classes: ReadonlySet<number> | null = null,
): NoteAutotune[] {
  return normaliserNotes(
    detectees.map((n) => ({ debut: n.debut, fin: n.fin, midi: noteProche(n.midi * 100 + (n.justesse ?? 0), classes), cents: 0, vibrato: 1 })),
  );
}

/** Triées par début, bornées (MIDI 24–96, cents ±100, vibrato 0–2), sans chevauchement ni note vide, 1024 au plus. */
export function normaliserNotes(notes: readonly NoteAutotune[]): NoteAutotune[] {
  const triees = notes
    .filter((n) => Number.isFinite(n.debut) && Number.isFinite(n.fin) && n.fin > n.debut && n.debut >= 0)
    .map((n) => ({
      debut: n.debut,
      fin: n.fin,
      midi: borne(Math.round(n.midi), MIDI_MIN, MIDI_MAX),
      cents: borne(Math.round(n.cents) || 0, -100, 100),
      vibrato: borne(arrondi(Number.isFinite(n.vibrato) ? n.vibrato : 1, 0.05), 0, 2),
    }))
    .sort((a, b) => a.debut - b.debut);
  const out: NoteAutotune[] = [];
  for (const n of triees) {
    const prec = out.at(-1);
    const debut = prec ? Math.max(n.debut, prec.fin) : n.debut;
    if (n.fin - debut <= 1e-6) continue;
    out.push(debut === n.debut ? n : { ...n, debut });
    if (out.length >= MAX_NOTES) break;
  }
  return out;
}

/**
 * Hauteur visée après un glissé de `dDemiTons` lignes : aimantée à la gamme (la note de la gamme suivante dans le
 * sens du geste), ou libre (`classes` null). Bornée à 24–96.
 */
export function midiCible(midi: number, dDemiTons: number, classes: ReadonlySet<number> | null): number {
  const brut = borne(midi + Math.round(dDemiTons), MIDI_MIN, MIDI_MAX);
  if (!classes || dDemiTons === 0 || classes.has(brut % 12)) return brut;
  const sens = dDemiTons > 0 ? 1 : -1;
  for (let k = 1; k <= 11; k++) {
    const x = brut + sens * k;
    if (x < MIDI_MIN || x > MIDI_MAX) break;
    if (classes.has(x % 12)) return x;
  }
  return brut;
}

const remplacerNote = (notes: readonly NoteAutotune[], i: number, n: NoteAutotune) => notes.map((x, k) => (k === i ? n : x));

export function deplacerNote(notes: readonly NoteAutotune[], i: number, midi: number): readonly NoteAutotune[] {
  const n = notes[i];
  const v = borne(Math.round(midi), MIDI_MIN, MIDI_MAX);
  return !n || n.midi === v ? notes : remplacerNote(notes, i, { ...n, midi: v });
}

export function reglerJustesse(notes: readonly NoteAutotune[], i: number, cents: number): readonly NoteAutotune[] {
  const n = notes[i];
  const v = borne(Math.round(cents), -100, 100);
  return !n || !Number.isFinite(cents) || n.cents === v ? notes : remplacerNote(notes, i, { ...n, cents: v });
}

export function reglerVibrato(notes: readonly NoteAutotune[], i: number, vibrato: number): readonly NoteAutotune[] {
  const n = notes[i];
  const v = borne(arrondi(vibrato, 0.05), 0, 2);
  return !n || !Number.isFinite(vibrato) || n.vibrato === v ? notes : remplacerNote(notes, i, { ...n, vibrato: v });
}

/** Coupe la note `i` en deux au temps `t` (au milieu par défaut) ; chaque moitié dure au moins 60 ms. */
export function couperNote(notes: readonly NoteAutotune[], i: number, t?: number): readonly NoteAutotune[] {
  const n = notes[i];
  if (!n) return notes;
  const c = t ?? (n.debut + n.fin) / 2;
  if (c - n.debut < DUREE_MIN_NOTE || n.fin - c < DUREE_MIN_NOTE) return notes;
  return [...notes.slice(0, i), { ...n, fin: c }, { ...n, debut: c }, ...notes.slice(i + 1)];
}

/** Fusionne la note `i` avec la suivante : une seule note, de la hauteur (et des réglages) de la plus longue. */
export function fusionnerNotes(notes: readonly NoteAutotune[], i: number): readonly NoteAutotune[] {
  const a = notes[i];
  const b = notes[i + 1];
  if (!a || !b) return notes;
  const longue = b.fin - b.debut > a.fin - a.debut ? b : a;
  return [...notes.slice(0, i), { ...longue, debut: a.debut, fin: b.fin }, ...notes.slice(i + 2)];
}

/**
 * Écrit les notes de l'éditeur dans Prise.autotune (normalisées). Sans autotune sur la prise, `base` (réglages de
 * départ) est posé dans la même étape d'Annuler ; sans base, rien ne change.
 */
export function ecrireNotes(m: Morceau, id: string, notes: readonly NoteAutotune[], base?: AutotunePrise): Morceau {
  const a = autotuneDe(m, id) ?? base;
  if (!a) return m;
  const n = normaliserNotes(notes);
  if (a === autotuneDe(m, id) && JSON.stringify(a.notes ?? []) === JSON.stringify(n)) return m;
  return ecrireAutotunePrise(m, id, { ...a, notes: n });
}

const cleNoteAutotune = (n: NoteAutotune) => `${n.debut}|${n.fin}|${n.midi}|${n.cents}|${n.vibrato}`;

/** Indices des notes de `apres` qui n'existaient pas telles quelles dans `avant` (celles à recalculer). */
export function notesChangees(avant: readonly NoteAutotune[] | undefined, apres: readonly NoteAutotune[]): number[] {
  const vues = new Set((avant ?? []).map(cleNoteAutotune));
  return apres.flatMap((n, i) => (vues.has(cleNoteAutotune(n)) ? [] : [i]));
}
