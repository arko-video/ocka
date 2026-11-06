// Tables d'onde à plusieurs résolutions (anti-repliement) des synthés de C3 (L) : UNE table par octave, qui ne garde
// que les harmoniques sous la moitié de la fréquence d'échantillonnage pour la note la plus aiguë de son octave.
// Aucune harmonique ne dépasse donc Nyquist : pas de repliement (testé à −60 dB jusqu'à C7). Pur, déterministe ;
// suit FREQ (avecFrequence) : des tables à 44,1 kHz et d'autres à 48 kHz.

import { fft } from '../../../enregistrement/calcul-calibrage';
import { FREQ } from '../briques';

/** Échantillons d'une période (puissance de 2) ; chaque table a un échantillon de plus (= le premier) pour lire sans modulo. */
export const TAILLE_TABLE = 2048;
/** 10 tables : la table k sert les fondamentales jusqu'à 40 Hz × 2^k (de 40 Hz à 20 kHz). */
export const NB_TABLES = 10;
export const plafondTable = (k: number): number => 40 * 2 ** k;

/** Indice de la table d'une fondamentale (Hz). */
export function choisirTable(f: number): number {
  if (!(f > 40)) return 0;
  return Math.min(NB_TABLES - 1, Math.ceil(Math.log2(f / 40) - 1e-9));
}

/** Tables d'un spectre (`re`, `im` : FFT d'une période de TAILLE_TABLE échantillons). */
export function tablesDepuisSpectre(re: Float64Array, im: Float64Array): Float32Array[] {
  const N = TAILLE_TABLE;
  const tables: Float32Array[] = [];
  for (let k = 0; k < NB_TABLES; k++) {
    const hMax = Math.min(N / 2 - 1, Math.floor(FREQ / 2 / plafondTable(k)));
    const r = new Float64Array(N);
    const i = new Float64Array(N);
    for (let h = 1; h <= hMax; h++) {
      r[h] = re[h]!;
      i[h] = im[h]!;
      r[N - h] = re[N - h]!;
      i[N - h] = im[N - h]!;
    }
    fft(r, i, true);
    const t = new Float32Array(N + 1);
    for (let j = 0; j < N; j++) t[j] = r[j]!;
    t[N] = t[0]!;
    tables.push(t);
  }
  return tables;
}

/** Tables d'une période donnée (TAILLE_TABLE échantillons) : sa moyenne est retirée (pas de continu). */
export function tablesDepuisPeriode(periode: Float64Array): Float32Array[] {
  const re = Float64Array.from(periode);
  const im = new Float64Array(TAILLE_TABLE);
  fft(re, im);
  return tablesDepuisSpectre(re, im);
}

/** Tables d'une somme de sinus : `amplitude(h)` de l'harmonique h (1 à 1023). */
export function tablesHarmoniques(amplitude: (h: number) => number): Float32Array[] {
  const N = TAILLE_TABLE;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let h = 1; h < N / 2; h++) {
    const a = amplitude(h);
    im[h] = (-a * N) / 2;
    im[N - h] = (a * N) / 2;
  }
  return tablesDepuisSpectre(re, im);
}

/** Tables mises en cache par nom et par fréquence d'échantillonnage (scie, impulsions…). */
const cache = new Map<string, Float32Array[]>();
export function tablesEnCache(nom: string, fabriquer: () => Float32Array[]): Float32Array[] {
  const cle = `${nom}@${FREQ}`;
  let t = cache.get(cle);
  if (!t) cache.set(cle, (t = fabriquer()));
  return t;
}

/** Scie descendante (−1 à 1) à bande limitée. */
export const tablesScie = (): Float32Array[] =>
  tablesEnCache('scie', () => tablesHarmoniques((h) => 2 / (Math.PI * h)));

/** Impulsion de rapport cyclique `rapport` (0,125, 0,25, 0,5…), à bande limitée, de −1 à 1 autour de 0. */
export function tablesImpulsion(rapport: number): Float32Array[] {
  return tablesEnCache(`impulsion-${rapport}`, () => {
    const p = new Float64Array(TAILLE_TABLE);
    const haut = Math.round(rapport * TAILLE_TABLE);
    for (let j = 0; j < TAILLE_TABLE; j++) p[j] = j < haut ? 1 : -1;
    return tablesDepuisPeriode(p);
  });
}

/**
 * Oscillateur à tables : ajoute `gain` × l'onde à `sortie` (à partir de `debut`), fréquence fixe ou une par
 * échantillon (Hz). La table suit la fréquence ; la phase (en tours) de départ est `phase`. Renvoie la phase finale.
 */
export function lireTables(
  tables: Float32Array[],
  sortie: Float32Array,
  freq: number | Float32Array,
  gain = 1,
  phase = 0,
  debut = 0,
): number {
  const N = TAILLE_TABLE;
  let p = phase - Math.floor(phase);
  let fAvant = -1;
  let t = tables[0]!;
  let pas = 0;
  for (let i = debut; i < sortie.length; i++) {
    const f = typeof freq === 'number' ? freq : freq[i]!;
    if (f !== fAvant) {
      fAvant = f;
      t = tables[choisirTable(f)]!;
      pas = f / FREQ;
    }
    const x = p * N;
    const j = x | 0;
    const a = t[j]!;
    sortie[i] += gain * (a + (t[j + 1]! - a) * (x - j));
    p += pas;
    if (p >= 1) p -= Math.floor(p);
  }
  return p;
}

/**
 * Tables d'une onde dessinée (`onde` : valeurs de −1 à 1). Elle est jouée comme une ligne brisée entre ses points
 * (le son « 8-bit » du dessin), puis chaque table ne garde que les harmoniques que son octave joue sans repliement.
 */
export function tablesDeOnde(onde: readonly number[]): Float32Array[] {
  const n = onde.length;
  const periode = new Float64Array(TAILLE_TABLE);
  if (n >= 2) {
    for (let j = 0; j < TAILLE_TABLE; j++) {
      const x = (j * n) / TAILLE_TABLE;
      const k = Math.floor(x);
      const a = onde[k]!;
      const b = onde[(k + 1) % n]!;
      periode[j] = Math.min(1, Math.max(-1, a + (b - a) * (x - k)));
    }
  }
  return tablesDepuisPeriode(periode);
}
