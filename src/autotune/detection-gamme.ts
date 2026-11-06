// Détection de la gamme d'une voix : profils de Krumhansl-Kessler (1982) corrélés à l'histogramme des notes
// (chaque note pèse sa durée ; les notes de moins de 100 ms ne comptent pas). La tonalité du morceau, si on la
// connaît, reçoit un petit bonus (elle l'emporte quand la voix hésite). Deux choix au plus, de gammes DIFFÉRENTES
// (deux tonalités relatives, do majeur et la mineur, corrigent les mêmes notes : on ne les propose pas ensemble).
// Fichier pur.

import type { Mode, Tonique } from '../morceau/types';
import type { GammeDetectee, NoteDetectee } from './api-autotune';
import { gamme } from './gamme';

export const TONIQUES: readonly Tonique[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJEUR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINEUR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NOTE_COURTE_S = 0.1;
/** Bonus de corrélation : tonalité du morceau, et sa relative (mêmes notes). */
const BONUS_MORCEAU = 0.12;
const BONUS_RELATIVE = 0.06;

/** Histogramme des 12 classes de hauteur, pondéré par la durée. */
export function histogramme(notes: readonly NoteDetectee[]): number[] {
  const h = new Array<number>(12).fill(0);
  for (const n of notes) {
    const d = n.fin - n.debut;
    if (d >= NOTE_COURTE_S && Number.isFinite(n.midi)) h[((Math.round(n.midi) % 12) + 12) % 12]! += d;
  }
  return h;
}

function correlation(x: number[], y: number[]): number {
  const mx = x.reduce((s, v) => s + v, 0) / 12;
  const my = y.reduce((s, v) => s + v, 0) / 12;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < 12; i++) {
    num += (x[i]! - mx) * (y[i]! - my);
    dx += (x[i]! - mx) ** 2;
    dy += (y[i]! - my) ** 2;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
}

/** Score de chaque tonalité (24), le meilleur d'abord. */
export function scoresTonalites(notes: readonly NoteDetectee[], morceau?: { tonique: Tonique; mode: Mode }): { tonique: Tonique; mode: Mode; r: number; score: number }[] {
  const h = histogramme(notes);
  if (h.every((v) => v === 0)) return [];
  const cleGamme = (t: { tonique: Tonique; mode: Mode }) => gamme(t).join(',');
  const gm = morceau ? cleGamme(morceau) : null;
  const out: { tonique: Tonique; mode: Mode; r: number; score: number }[] = [];
  TONIQUES.forEach((tonique, t) => {
    for (const mode of ['majeur', 'mineur'] as const) {
      const p = mode === 'majeur' ? MAJEUR : MINEUR;
      const r = correlation(h, h.map((_, i) => p[(i - t + 12) % 12]!));
      let score = r;
      if (morceau && morceau.tonique === tonique && morceau.mode === mode) score += BONUS_MORCEAU;
      else if (gm && cleGamme({ tonique, mode }) === gm) score += BONUS_RELATIVE;
      out.push({ tonique, mode, r, score });
    }
  });
  return out.sort((a, b) => b.score - a.score);
}

/** Les 2 gammes les plus probables (de notes différentes), la meilleure d'abord ; [] sans notes assez longues. */
export function detecterGamme(notes: readonly NoteDetectee[], morceau?: { tonique: Tonique; mode: Mode }): GammeDetectee[] {
  const s = scoresTonalites(notes, morceau);
  if (!s.length) return [];
  const premier = s[0]!;
  const g1 = gamme(premier).join(',');
  const second = s.find((x) => gamme(x).join(',') !== g1);
  const conf = (r: number) => Math.round(Math.min(1, Math.max(0, r)) * 100) / 100;
  const res: GammeDetectee[] = [{ tonique: premier.tonique, mode: premier.mode, confiance: conf(premier.r) }];
  if (second) res.push({ tonique: second.tonique, mode: second.mode, confiance: conf(second.r) });
  return res;
}
