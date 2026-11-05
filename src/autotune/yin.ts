// Détection de la hauteur par YIN (de Cheveigné et Kawahara, 2002), sur le signal ramené à 16 kHz.
// Seuil 0,12, de 70 à 1 000 Hz, une trame toutes les 10 ms (fenêtre de 16 ms), interpolation parabolique,
// puis médiane sur 5 trames (contre les sauts d'octave). Une trame trop faible n'est pas « sonore » : elle ne compte
// pas dans la part de trames voisées (une prise a des silences). Fichier pur : Worker et tests.

import { enCents } from './gamme';

export const FREQ_ANALYSE = 16000;
export const SEUIL_YIN = 0.12;
export const F_MIN = 70;
export const F_MAX = 1000;
/** Pas entre deux trames (s) et longueur de la fenêtre d'intégration (s). */
export const PAS_S = 0.01;
const FENETRE_S = 0.016;
/** Une trame est sonore au-dessus de −50 dBFS efficaces ET à moins de 40 dB sous la plus forte. */
const PLANCHER = Math.pow(10, -50 / 20);
const SOUS_MAX = Math.pow(10, -40 / 20);

export interface Hauteurs {
  /** Pas entre deux trames, en secondes ; la trame i est centrée sur i × pas + centre. */
  pas: number;
  centre: number;
  /** Hauteur de chaque trame en cents (NaN = non voisée). Après la médiane sur 5 trames. */
  cents: Float32Array;
  /** 1 si la trame est sonore (assez forte pour compter). */
  sonore: Uint8Array;
}

/** Hauteur (Hz) d'une trame commençant à `t0`, ou 0 si elle n'est pas voisée. `d` : tampon de travail. */
function trameYin(x: Float32Array, t0: number, w: number, tauMin: number, tauMax: number, fs: number, d: Float64Array): number {
  // 1. Différence d(τ) = Σ (x[j] − x[j+τ])², pour τ de 1 à tauMax.
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = t0; j < t0 + w; j++) {
      const e = x[j]! - x[j + tau]!;
      s += e * e;
    }
    d[tau] = s;
  }
  // 2. Différence normalisée par la moyenne cumulée : d'(τ) = d(τ) τ / Σ d(1..τ).
  let cumul = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    cumul += d[tau]!;
    d[tau] = cumul > 0 ? (d[tau]! * tau) / cumul : 1;
  }
  // 3. Premier τ (≥ tauMin) sous le seuil, puis le fond de ce creux.
  let tau = tauMin;
  while (tau <= tauMax && d[tau]! >= SEUIL_YIN) tau++;
  if (tau > tauMax) return 0;
  while (tau + 1 <= tauMax && d[tau + 1]! < d[tau]!) tau++;
  // 4. Interpolation parabolique autour du minimum.
  let fin = tau;
  if (tau > 1 && tau < tauMax) {
    const a = d[tau - 1]!;
    const b = d[tau]!;
    const c = d[tau + 1]!;
    const den = a - 2 * b + c;
    if (den > 0) fin = tau + (0.5 * (a - c)) / den;
  }
  const f = fs / fin;
  return f >= F_MIN && f <= F_MAX ? f : 0;
}

/** Médiane des valeurs non NaN de `v` dans [i − 2, i + 2] (NaN si la trame i n'est pas voisée). */
function median5(v: Float32Array): Float32Array {
  const out = new Float32Array(v.length).fill(NaN);
  const tmp: number[] = [];
  for (let i = 0; i < v.length; i++) {
    if (Number.isNaN(v[i]!)) continue;
    tmp.length = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(v.length - 1, i + 2); k++) if (!Number.isNaN(v[k]!)) tmp.push(v[k]!);
    tmp.sort((a, b) => a - b);
    out[i] = tmp.length % 2 ? tmp[tmp.length >> 1]! : (tmp[tmp.length / 2 - 1]! + tmp[tmp.length / 2]!) / 2;
  }
  return out;
}

/** Analyse un signal mono à `fs` Hz (16 kHz pour l'autotune ; plus haut pour mesurer finement dans les tests). */
export function analyserHauteur(x: Float32Array, fs = FREQ_ANALYSE): Hauteurs {
  const w = Math.round(FENETRE_S * fs);
  const pas = Math.round(PAS_S * fs);
  const tauMin = Math.floor(fs / F_MAX);
  const tauMax = Math.ceil(fs / F_MIN);
  const n = Math.max(0, Math.floor((x.length - w - tauMax - 1) / pas) + 1);
  const brut = new Float32Array(n).fill(NaN);
  const rms = new Float32Array(n);
  const d = new Float64Array(tauMax + 2);
  let max = 0;
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (let j = i * pas; j < i * pas + w; j++) e += x[j]! * x[j]!;
    rms[i] = Math.sqrt(e / w);
    if (rms[i]! > max) max = rms[i]!;
  }
  const seuil = Math.max(PLANCHER, max * SOUS_MAX);
  const sonore = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (rms[i]! < seuil) continue;
    sonore[i] = 1;
    const f = trameYin(x, i * pas, w, tauMin, tauMax, fs, d);
    if (f > 0) brut[i] = enCents(f);
  }
  // Îlots voisés trop courts (< 3 trames) : des accidents, pas des notes.
  for (let i = 0; i < n; ) {
    if (Number.isNaN(brut[i]!)) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && !Number.isNaN(brut[j]!)) j++;
    if (j - i < 3) brut.fill(NaN, i, j);
    i = j;
  }
  return { pas: pas / fs, centre: (w + tauMax / 2) / 2 / fs, cents: median5(brut), sonore };
}
