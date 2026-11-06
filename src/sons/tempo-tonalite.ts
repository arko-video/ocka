// BPM et tonalité d'un son importé (S). PURS.
// BPM : enveloppe des attaques (flux spectral, ~6 ms), autocorrélation, puis le tempo dont les multiples de la
// période (1 à 4 temps) cumulent le plus d'autocorrélation, au dixième près ; préférence douce vers 80–160.
// Tonalité : chromagramme (55 Hz à 2 kHz), corrélé aux profils de Krumhansl-Kessler (24 tonalités) : les 2 meilleures.

import type { Mode, Tonique } from '../morceau/types';
import type { PcmSon } from '../moteur/types-moteur';
import type { BpmDetecte, TonaliteDetectee } from './api-sons-avances';
import { fluxSpectral, longueur, mono, puissance2, spectres } from './spectre';

export const BPM_MIN = 60;
export const BPM_MAX = 200;
/** Poids du demi-temps (charley aux croches) : départage le tempo et son double. */
const DEMI = 0.5;

/** Autocorrélation normalisée (acf[0] = 1) de `x` centré, jusqu'au décalage `max`. */
function autocorrelation(x: Float64Array, max: number): Float64Array {
  let moyenne = 0;
  for (const v of x) moyenne += v / x.length;
  const c = x.map((v) => v - moyenne);
  const out = new Float64Array(max + 1);
  for (let d = 0; d <= max; d++) {
    let s = 0;
    for (let i = 0; i + d < c.length; i++) s += c[i]! * c[i + d]!;
    out[d] = s;
  }
  const zero = out[0]! || 1;
  for (let d = 0; d <= max; d++) out[d] = out[d]! / zero;
  return out;
}

/** Valeur interpolée d'un tableau en un point réel. */
function interpole(t: Float64Array, x: number): number {
  const i = Math.floor(x);
  if (i < 0 || i + 1 >= t.length) return 0;
  return t[i]! + (t[i + 1]! - t[i]!) * (x - i);
}

const arrondi1 = (x: number) => Math.round(x * 10) / 10;

/** Voir api-sons-avances.ts. null si le son est trop court (moins de 2 s), silencieux ou sans pulsation. */
export function detecterBpm(pcm: PcmSon): BpmDetecte | null {
  const n = longueur(pcm);
  const sr = pcm.frequence;
  if (!(sr > 0) || n < sr * 2) return null;
  const x = mono(pcm);
  let energie = 0;
  for (let i = 0; i < n; i++) energie += x[i]! * x[i]!;
  if (energie / n < 1e-8) return null;
  const pas = puissance2(Math.round(sr / 200)); // ~5 ms
  const flux = fluxSpectral(x, pas * 4, pas);
  const parSeconde = sr / pas;
  const max = Math.min(flux.length - 1, Math.ceil((parSeconde * 60 * 4) / BPM_MIN));
  const acf = autocorrelation(flux, max);
  const score = (bpm: number) => {
    const periode = (parSeconde * 60) / bpm;
    let s = 0;
    for (let k = 1; k <= 4; k++) if (k * periode < max) s += interpole(acf, k * periode) / k;
    return s + DEMI * Math.max(0, interpole(acf, periode / 2));
  };
  let meilleur = 0;
  let valeur = -Infinity;
  for (let b = BPM_MIN; b <= BPM_MAX; b += 0.5) {
    const v = score(b) * Math.exp(-0.5 * (Math.log2(b / 115) / 1.2) ** 2); // préférence douce vers 115
    if (v > valeur) (valeur = v), (meilleur = b);
  }
  for (let b = meilleur - 0.5; b <= meilleur + 0.5; b += 0.05) {
    const v = score(b) * Math.exp(-0.5 * (Math.log2(b / 115) / 1.2) ** 2);
    if (v > valeur) (valeur = v), (meilleur = b);
  }
  const brut = score(meilleur);
  if (!(brut > 0.05)) return null;
  const bpm = arrondi1(meilleur);
  return { bpm, double: arrondi1(bpm * 2), moitie: arrondi1(bpm / 2), confiance: Math.min(1, Math.max(0, brut / 1.2)) };
}

const TONIQUES: Tonique[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PROFIL_MAJEUR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const PROFIL_MINEUR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearson(a: readonly number[], b: readonly number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/** Chromagramme (12 classes, Do d'abord) d'un son : énergie des bins de 55 Hz à 2 kHz. */
export function chromagramme(pcm: PcmSon): number[] {
  const x = mono(pcm);
  const sr = pcm.frequence;
  const taille = puissance2(Math.round(sr * 0.18));
  const chroma = new Array<number>(12).fill(0);
  const classes = new Int8Array(taille / 2 + 1).fill(-1);
  for (let k = 1; k <= taille / 2; k++) {
    const f = (k * sr) / taille;
    if (f >= 55 && f <= 2000) classes[k] = (((Math.round(12 * Math.log2(f / 440)) + 69) % 12) + 12) % 12;
  }
  spectres(x, taille, taille / 2, (_t, amp) => {
    let total = 0;
    for (let k = 0; k < amp.length; k++) if (classes[k]! >= 0) total += amp[k]!;
    if (total <= 1e-9) return;
    for (let k = 0; k < amp.length; k++) if (classes[k]! >= 0) chroma[classes[k]!]! += Math.sqrt(amp[k]! / total);
  });
  return chroma;
}

/** Voir api-sons-avances.ts. */
export function detecterTonaliteSon(pcm: PcmSon): TonaliteDetectee[] {
  if (longueur(pcm) < pcm.frequence * 0.5) return [];
  const chroma = chromagramme(pcm);
  const somme = chroma.reduce((s, x) => s + x, 0);
  const maxi = Math.max(...chroma);
  if (somme <= 1e-9 || maxi / (somme / 12) < 1.25) return []; // pas de hauteur nette (bruit, batterie seule)
  const scores: { tonique: Tonique; mode: Mode; r: number }[] = [];
  for (let t = 0; t < 12; t++) {
    const tournee = (p: number[]) => p.map((_, i) => p[(i - t + 12) % 12]!);
    scores.push({ tonique: TONIQUES[t]!, mode: 'majeur', r: pearson(chroma, tournee(PROFIL_MAJEUR)) });
    scores.push({ tonique: TONIQUES[t]!, mode: 'mineur', r: pearson(chroma, tournee(PROFIL_MINEUR)) });
  }
  scores.sort((a, b) => b.r - a.r);
  const [a, b] = [scores[0]!, scores[1]!];
  // Confiance : la corrélation, et l'avance de la première sur la deuxième.
  const conf = (r: number, avance: number) => Math.round(Math.min(1, Math.max(0, r) * (0.6 + 4 * avance)) * 100) / 100;
  return [
    { tonique: a.tonique, mode: a.mode, confiance: conf(a.r, a.r - b.r) },
    { tonique: b.tonique, mode: b.mode, confiance: conf(b.r, 0) },
  ];
}
