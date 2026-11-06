// Analyse d'une prise en NOTES (décisions v2 §4) : courbe de hauteur (YIN existant, yin.ts) découpée en notes
//  - aux silences et sons non voisés ;
//  - aux sauts de plus de 70 cents par rapport à la note en cours, tenus plus de 60 ms ;
//  - aux attaques : le niveau creuse d'au moins 6 dB puis remonte d'au moins 6 dB en 40 ms au plus.
// Chaque note : début, fin, hauteur (médiane et moyenne), note la plus proche et justesse, écart à la gamme,
// vibrato (amplitude crête à crête, vitesse) mesuré après avoir retiré la tendance (parabole) de la note.
// Fichier pur : Worker et tests.

import { reechantillonner } from '../moteur/reechantillonner';
import type { CourbeHauteur, NoteDetectee } from './api-autotune';
import { noteProche } from './gamme';
import { analyserHauteur, FREQ_ANALYSE, type Hauteurs } from './yin';

export const SAUT_CENTS = 70;
export const TENU_S = 0.06;
const ATTAQUE_DB = 6;
/** Une note plus courte que ça n'est pas gardée (un accident de la détection). */
const NOTE_MIN_S = 0.03;

/** Note détectée (hauteur, écart à la gamme et « voisée » sont maintenant dans le contrat, NoteDetectee). */
export type NoteAnalysee = NoteDetectee;

/** YIN sur le signal ramené à 16 kHz (exactement comme corrigerVoix) et niveau de chaque trame. */
export function analyserCourbe(pcm: Float32Array, fs: number): { h: Hauteurs; courbe: CourbeHauteur } {
  const x = reechantillonner(pcm, fs, FREQ_ANALYSE);
  const h = analyserHauteur(x);
  const pas = Math.round(h.pas * FREQ_ANALYSE);
  const w = Math.round(0.016 * FREQ_ANALYSE);
  const niveau = new Float32Array(h.cents.length);
  let max = 0;
  for (let i = 0; i < niveau.length; i++) {
    let e = 0;
    for (let j = i * pas; j < Math.min(x.length, i * pas + w); j++) e += x[j]! * x[j]!;
    niveau[i] = Math.sqrt(e / w);
    max = Math.max(max, niveau[i]!);
  }
  if (max > 0) for (let i = 0; i < niveau.length; i++) niveau[i] = niveau[i]! / max;
  return { h, courbe: { pas: h.pas, debut: h.centre, cents: h.cents, niveau } };
}

function mediane(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

const enDb = (v: number) => 20 * Math.log10(Math.max(v, 1e-6));

/** Attaque à la trame i : un creux de 6 dB sous ce qui précède, puis une remontée de 6 dB en 4 trames au plus. */
function attaque(niv: Float32Array, i: number, debut: number): boolean {
  if (i - debut < 6) return false;
  let creux = Infinity;
  for (let j = Math.max(debut, i - 4); j < i; j++) creux = Math.min(creux, enDb(niv[j]!));
  let avant = -Infinity;
  for (let j = Math.max(debut, i - 20); j < i - 2; j++) avant = Math.max(avant, enDb(niv[j]!));
  return enDb(niv[i]!) - creux >= ATTAQUE_DB && avant - creux >= ATTAQUE_DB;
}

/** Découpe une suite de trames voisées [r0, r1[ en notes (trames de début de chaque note). */
function coupures(c: CourbeHauteur, r0: number, r1: number): number[] {
  const tenu = Math.max(1, Math.round(TENU_S / c.pas));
  const fen = Math.max(3, Math.round(0.15 / c.pas));
  const debuts = [r0];
  let debut = r0;
  for (let i = r0 + 1; i < r1; i++) {
    const ref = mediane(Array.from(c.cents.subarray(Math.max(debut, i - fen), i)));
    const e = c.cents[i]! - ref;
    let saut = Math.abs(e) > SAUT_CENTS && i + tenu <= r1;
    for (let j = i; saut && j < i + tenu; j++) saut = Math.abs(c.cents[j]! - ref) > SAUT_CENTS && Math.sign(c.cents[j]! - ref) === Math.sign(e);
    if (saut || (attaque(c.niveau, i, debut) && r1 - i >= 4)) {
      debuts.push(i);
      debut = i;
    }
  }
  return debuts;
}

/** Vibrato d'une note : amplitude crête à crête (cents) et vitesse (Hz), après retrait d'une parabole. */
export function mesurerVibrato(v: number[], pas: number): { vibrato: number; vitesseVibrato: number } {
  const n = v.length;
  if (n * pas < 0.2) return { vibrato: 0, vitesseVibrato: 0 };
  // Moindres carrés : v ≈ a + b t + c t² (t centré réduit).
  const t = v.map((_, i) => (2 * i) / (n - 1) - 1);
  const S = [0, 0, 0, 0, 0];
  const Y = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 5; k++) S[k]! += t[i]! ** k;
    for (let k = 0; k < 3; k++) Y[k]! += v[i]! * t[i]! ** k;
  }
  const M = [
    [S[0]!, S[1]!, S[2]!],
    [S[1]!, S[2]!, S[3]!],
    [S[2]!, S[3]!, S[4]!],
  ];
  const det = (m: number[][]) => m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) - m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) + m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
  const D = det(M);
  const coef = [0, 1, 2].map((k) => (D === 0 ? 0 : det(M.map((ligne, i) => ligne.map((x, j) => (j === k ? Y[i]! : x)))) / D));
  const r = v.map((x, i) => x - coef[0]! - coef[1]! * t[i]! - coef[2]! * t[i]! ** 2);
  const rms = Math.sqrt(r.reduce((s, x) => s + x * x, 0) / n);
  const amplitude = 2 * Math.SQRT2 * rms;
  // Vitesse : pic d'autocorrélation entre 3 et 9 Hz.
  let meilleur = 0;
  let tau = 0;
  const ac = (L: number) => {
    let s = 0;
    for (let i = 0; i + L < n; i++) s += r[i]! * r[i + L]!;
    return s / Math.max(1e-9, rms * rms * (n - L));
  };
  for (let L = Math.round(1 / 9 / pas); L <= Math.min(n - 4, Math.round(1 / 3 / pas)); L++) {
    const a = ac(L);
    if (a > meilleur) {
      meilleur = a;
      tau = L;
    }
  }
  if (amplitude < 8 || meilleur < 0.3 || tau === 0) return { vibrato: Math.round(amplitude), vitesseVibrato: 0 };
  const g = ac(tau - 1);
  const d = ac(tau + 1);
  const den = g - 2 * meilleur + d;
  const fin = den < 0 ? tau + (0.5 * (g - d)) / den : tau;
  return { vibrato: Math.round(amplitude), vitesseVibrato: Math.round((1 / (fin * pas)) * 10) / 10 };
}

/** Notes de la courbe (triées, sans chevauchement). `classes` : la gamme de l'écart (toutes les notes sinon). */
export function decouperNotes(c: CourbeHauteur, duree: number, classes: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]): NoteAnalysee[] {
  const notes: NoteAnalysee[] = [];
  const n = c.cents.length;
  for (let i = 0; i < n; ) {
    if (Number.isNaN(c.cents[i]!)) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && !Number.isNaN(c.cents[j]!)) j++;
    const debuts = coupures(c, i, j);
    debuts.forEach((s0, k) => {
      const s1 = debuts[k + 1] ?? j;
      const v = Array.from(c.cents.subarray(s0, s1));
      const debut = Math.max(0, c.debut + s0 * c.pas - c.pas / 2);
      const fin = Math.min(duree, c.debut + (s1 - 1) * c.pas + c.pas / 2);
      if (fin - debut < NOTE_MIN_S || v.length === 0) return;
      const med = mediane(v);
      const midi = Math.min(96, Math.max(24, Math.round(med / 100)));
      const r3 = (x: number) => Math.round(x * 1000) / 1000;
      notes.push({
        debut: r3(debut),
        fin: r3(fin),
        midi,
        justesse: Math.round(Math.min(50, Math.max(-50, med - midi * 100)) * 10) / 10,
        ...mesurerVibrato(v, c.pas),
        hauteur: Math.round(v.reduce((s, x) => s + x, 0) / v.length),
        ecartGamme: Math.round(med - noteProche(med, classes)),
        voisee: true,
      });
    });
    i = j;
  }
  return notes;
}
