// Calage de la note chantée (gamme du morceau ou chromatique) et accords de la gamme chantés (mode accords).
// Fichier pur, sans nom de fonction en majuscule (il est importé par le worklet : voir vite.config.ts, Prefresh).

import { GAMMES, hauteurTonique } from '../morceau/theorie';
import type { Morceau } from '../morceau/types';
import type { TypeAccordChante } from './api-dubler';

/** Les 7 classes de hauteur (0 = do … 11 = si) de la gamme du morceau, triées. */
export function classesGamme(tonalite: Morceau['tonalite']): number[] {
  const t = Math.max(0, hauteurTonique(tonalite.tonique));
  return GAMMES[tonalite.mode].map((d) => (t + d) % 12).sort((a, b) => a - b);
}

/** Note MIDI (entière) la plus proche d'une hauteur en cents MIDI : dans `classes` (gamme), ou chromatique (null). */
export function caler(cents: number, classes: readonly number[] | null): number {
  const proche = Math.round(cents / 100);
  if (!classes || classes.length === 0) return proche;
  let meilleure = proche;
  let ecart = Infinity;
  for (let n = proche - 2; n <= proche + 2; n++) {
    if (!classes.includes(((n % 12) + 12) % 12)) continue;
    const e = Math.abs(cents - n * 100);
    // À égalité, la note du dessous (on chante plus souvent un peu haut qu'un peu bas).
    if (e < ecart - 1e-9) {
      ecart = e;
      meilleure = n;
    }
  }
  return meilleure;
}

/**
 * Intervalles (demi-tons au-dessus de la fondamentale) de l'accord de la gamme bâti sur la note `midi`, empilé en
 * tierces de la gamme. Une note hors de la gamme est d'abord ramenée à la note de la gamme la plus proche.
 * Renvoie [fondamentale (MIDI), intervalles…].
 */
export function intervallesChantes(
  midi: number,
  classes: readonly number[],
  type: TypeAccordChante,
): { racine: number; intervalles: number[] } {
  const racine = caler(midi * 100, classes);
  const pc = ((racine % 12) + 12) % 12;
  const i = classes.indexOf(pc);
  if (i < 0) return { racine, intervalles: [0] };
  const n = classes.length;
  const etages = type === 'septieme' ? [0, 2, 4, 6] : [0, 2, 4];
  const intervalles = etages.map((k) => {
    const j = i + k;
    const classe = classes[j % n]!;
    const octave = Math.floor(j / n);
    return classe - pc + 12 * octave;
  });
  return { racine, intervalles };
}

/** Notes MIDI de l'accord de la gamme bâti sur `midi` (triade ou septième). Pure. */
export function accordChante(midi: number, tonalite: Morceau['tonalite'], type: TypeAccordChante): number[] {
  if (!Number.isFinite(midi)) return [];
  const { racine, intervalles } = intervallesChantes(Math.round(midi), classesGamme(tonalite), type);
  return intervalles.map((x) => racine + x);
}
