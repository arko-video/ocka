// Réglages de l'autotune avancé (décisions v2 §4) : préréglages, curseur simple traduit en réglages, gamme résolue,
// nom du fichier rendu (déterministe : cache et ménage). Fichier pur : Worker, page et tests.
//
// Le curseur simple « Naturel ↔ Robot » (Piste.effets.autotune, corrigerVoix) correspond EXACTEMENT à des réglages
// avancés (reglagesDeForce) : vitesse = 5 + 120 × (1 − f) ms, force = 0,3 + 0,7 × f, humaniser = 1 (on corrige le
// centre de la hauteur, le vibrato reste), formants 0. Les préréglages Naturel et Pop SONT deux positions du curseur
// (0,3 et 0,9) ; Robot et Hyperpop vont plus loin (vitesse 0, vibrato aplati ; Hyperpop monte aussi les formants).

import type { AutotunePrise, Mode, Morceau, NoteAutotune, Style, Tonique } from '../morceau/types';
import type { PresetFixe } from './api-autotune';
import { reglagesForce } from './correction';
import { gamme, nomTonalite } from './gamme';

/** Position du curseur simple de chaque préréglage qui en est une. */
export const FORCE_NATUREL = 0.3;
export const FORCE_POP = 0.9;

const arrondi = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

/** Réglages du curseur simple, sans le nom du préréglage. */
function depuisForce(force: number): AutotunePrise {
  const f = Math.round(Math.min(1, Math.max(0, Number.isFinite(force) ? force : 0)) * 10) / 10;
  const { dose, vitesseS } = reglagesForce(f);
  return { gamme: 'morceau', vitesse: arrondi(vitesseS * 1000), force: arrondi(dose), humaniser: 1, formants: 0, preset: 'perso' };
}

const FIXES: Record<PresetFixe, () => AutotunePrise> = {
  naturel: () => ({ ...depuisForce(FORCE_NATUREL), preset: 'naturel' }),
  pop: () => ({ ...depuisForce(FORCE_POP), preset: 'pop' }),
  robot: () => ({ gamme: 'morceau', vitesse: 0, force: 1, humaniser: 0, formants: 0, preset: 'robot' }),
  hyperpop: () => ({ gamme: 'morceau', vitesse: 0, force: 1, humaniser: 0, formants: 3, preset: 'hyperpop' }),
};

export function reglagesPreset(preset: PresetFixe): AutotunePrise {
  const f = FIXES[preset];
  if (!f) throw new Error(`Préréglage inconnu : ${String(preset)}`);
  return f();
}

/** Mêmes réglages de son (gamme, vitesse, force, humaniser, formants), sans regarder le nom ni les notes. */
export function memesReglages(a: AutotunePrise, b: AutotunePrise): boolean {
  const g = (x: AutotunePrise['gamme']) => (typeof x === 'string' ? x : `${x.tonique}-${x.mode}`);
  return g(a.gamme) === g(b.gamme) && a.vitesse === b.vitesse && a.force === b.force && a.humaniser === b.humaniser && a.formants === b.formants;
}

/** Le curseur simple (0,1 à 1) en réglages avancés : même son que corrigerVoix(force) (testé). */
export function reglagesDeForce(force: number): AutotunePrise {
  const r = depuisForce(force);
  const p = (Object.keys(FIXES) as PresetFixe[]).find((k) => memesReglages(FIXES[k](), r));
  return { ...r, preset: p ?? 'perso' };
}

/** Préréglage conseillé pour un style de morceau (« Corriger tout seul » quand le style est connu). */
export function presetDuStyle(style: Style | string | undefined): PresetFixe {
  const s = String(style ?? '');
  if (/^(hyperpop|rage|plugg|kpop)$/.test(s)) return 'hyperpop';
  if (/^(trap|drill|ukdrill|cloud|memphis|phonk|jerseyclub|afrotrap|rapmelodique)$/.test(s)) return 'robot';
  if (/^(jazz|jazzrap|bossanova|gospel|rnb|lofi|boombap|orchestral|ambient|reggae|funk|rock)$/.test(s)) return 'naturel';
  return 'pop';
}

/* ------------------------------------------------------------ gamme résolue */

export type TonaliteMorceau = Morceau['tonalite'] | undefined;
const CHROMATIQUE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Classes de hauteur (0 = do) visées par ces réglages ; sans tonalité connue, toutes les notes. */
export function classesGamme(g: AutotunePrise['gamme'], tonalite: TonaliteMorceau): number[] {
  if (g === 'chromatique') return CHROMATIQUE.slice();
  const t: { tonique: Tonique; mode: Mode } | undefined = g === 'morceau' ? tonalite : g;
  return t && typeof t === 'object' ? gamme(t) : CHROMATIQUE.slice();
}

/** Nom lisible d'une gamme pour une phrase (« la mineur »). */
export function nomGamme(t: { tonique: Tonique; mode: Mode }): string {
  return nomTonalite(t).replace('-', ' ');
}

/* ------------------------------------------------------------ nom du rendu */

/** Empreinte 53 bits (cyrb53) d'un texte, en hexadécimal (14 caractères). */
export function empreinte(texte: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

const cleNote = (n: NoteAutotune) => `${n.debut}|${n.fin}|${n.midi}|${n.cents}|${n.vibrato}`;

/** Tout ce qui change le son rendu (et rien d'autre : le nom du préréglage n'y est pas). */
export function cleRendu(frequence: number, r: AutotunePrise, tonalite: TonaliteMorceau): string {
  const notes = (r.notes ?? []).map(cleNote).join(';');
  return `v1|${frequence}|${classesGamme(r.gamme, tonalite).join(',')}|${r.vitesse}|${r.force}|${r.humaniser}|${r.formants}|${notes}`;
}

/**
 * « auto-<clé de la prise sans .f32>-av<empreinte>.f32 » : même préfixe que le rendu simple (FICHIER_PRISE,
 * choisirOrphelins), donc connu du ramasse-miettes ; deux réglages qui sonnent pareil ont le même nom.
 */
export function nomRenduAutotune(prise: { fichier: string; frequence: number }, r: AutotunePrise, tonalite: TonaliteMorceau): string {
  return `auto-${prise.fichier.replace(/\.f32$/, '')}-av${empreinte(cleRendu(prise.frequence, r, tonalite))}.f32`;
}

/** Notes présentes dans une liste et pas dans l'autre (celles à recalculer). */
export function notesChangees(avant: readonly NoteAutotune[] = [], apres: readonly NoteAutotune[] = []): NoteAutotune[] {
  const a = new Set(avant.map(cleNote));
  const b = new Set(apres.map(cleNote));
  return [...avant.filter((n) => !b.has(cleNote(n))), ...apres.filter((n) => !a.has(cleNote(n)))];
}
