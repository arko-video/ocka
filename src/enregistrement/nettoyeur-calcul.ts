// Nettoyeur de voix (pur : Worker et tests). Trois étages, chacun réglé de 0 (éteint) à 1 :
//  1. réduction de bruit spectrale : profil du bruit = spectre moyen des 10 % de trames les plus calmes (le silence
//     le plus bas de la prise), puis gain de Wiener avec un SNR a priori « dirigé par la décision » (Ephraim-Malah :
//     il lisse le gain d'une trame à l'autre, d'où pas de « musical noise » prononcé) et un PLANCHER (−11 à −24 dB) ;
//  2. désesseur : quand l'énergie de 5 à 9 kHz domine la trame (un « s »), cette bande baisse (jusqu'à 12 dB) ;
//  3. porte de bruit avec maintien (120 ms), regard en avant de 5 ms, attaque 2 ms, relâche 80 ms.
// STFT : fenêtre de Hann, 2048 points à 48 kHz (1024 sous 32 kHz), recouvrement de 75 %. Mémoire : O(trame).

import type { ReglagesNettoyeur } from './api-voix-avancee';
import { FftVoix } from './fft-voix';

/** Les 3 intensités proposées (Léger / Moyen / Fort). */
export const INTENSITES_NETTOYEUR = {
  leger: { porte: 0.3, reduction: 0.3, desesseur: 0.3 },
  moyen: { porte: 0.6, reduction: 0.6, desesseur: 0.5 },
  fort: { porte: 1, reduction: 1, desesseur: 0.8 },
} as const satisfies Record<string, ReglagesNettoyeur>;
export type IntensiteNettoyeur = keyof typeof INTENSITES_NETTOYEUR;

const borne = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const hann = (n: number) => Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));

/** Plancher de la réduction (dB, négatif) selon le réglage. */
export const plancherReduction = (r: number) => -(6 + 18 * borne(r));
/** Baisse maximale du désesseur (dB) selon le réglage. */
export const baisseDesesseur = (r: number) => 12 * borne(r);
/** Profondeur de la porte fermée (dB) selon le réglage. */
export const profondeurPorte = (r: number) => 30 * borne(r);

export function nettoyer(pcm: Float32Array, frequence: number, r: ReglagesNettoyeur): Float32Array {
  const n = frequence > 32000 ? 2048 : 1024;
  const bruit = analyserBruit(pcm, n, n / 4);
  let x = pcm;
  if (borne(r.reduction) > 0 || borne(r.desesseur) > 0) x = spectral(pcm, frequence, n, bruit.calmes, borne(r.reduction), borne(r.desesseur));
  if (borne(r.porte) > 0) x = porte(x, frequence, borne(r.porte), bruit.rmsDb);
  return x;
}

/** Début (dans le signal complété de n zéros de chaque côté) de la trame t. */
const debutTrame = (t: number, pas: number) => t * pas;

/** Lit la trame t (fenêtrée) du signal complété de n zéros de chaque côté. */
function trame(pcm: Float32Array, t: number, n: number, pas: number, w: Float64Array, re: Float64Array, im: Float64Array): void {
  const d = debutTrame(t, pas) - n;
  for (let i = 0; i < n; i++) {
    const j = d + i;
    re[i] = j >= 0 && j < pcm.length ? pcm[j]! * w[i]! : 0;
    im[i] = 0;
  }
}

const nombreTrames = (longueur: number, n: number, pas: number) => Math.floor((longueur + n) / pas) + 1;

/** Trames les plus calmes (10 %, au moins 3, hors silence numérique) et niveau RMS du bruit (dBFS, ≥ −80). */
export function analyserBruit(pcm: Float32Array, n: number, pas: number): { calmes: number[]; rmsDb: number } {
  const w = hann(n);
  let w2 = 0;
  for (const v of w) w2 += v * v;
  const energies: { t: number; e: number }[] = [];
  for (let t = 0; t < nombreTrames(pcm.length, n, pas); t++) {
    const d = debutTrame(t, pas) - n;
    if (d < 0 || d + n > pcm.length) continue; // seulement des trames pleines
    let e = 0;
    for (let i = 0; i < n; i++) e += (pcm[d + i]! * w[i]!) ** 2;
    energies.push({ t, e: e / w2 });
  }
  const vivantes = energies.filter((x) => x.e > 1e-14);
  const liste = (vivantes.length >= 3 ? vivantes : energies).sort((a, b) => a.e - b.e);
  const calmes = liste.slice(0, Math.max(3, Math.ceil(liste.length * 0.1)));
  const moyenne = calmes.reduce((s, x) => s + x.e, 0) / Math.max(1, calmes.length);
  return { calmes: calmes.map((x) => x.t), rmsDb: Math.max(-80, 10 * Math.log10(moyenne + 1e-20)) };
}

function spectral(pcm: Float32Array, fs: number, n: number, calmes: number[], reduction: number, desesseur: number): Float32Array {
  const pas = n / 4;
  const w = hann(n);
  const fft = new FftVoix(n);
  const { re, im } = fft;
  const k2 = n / 2 + 1;
  // 1. Profil du bruit (spectre de puissance moyen des trames calmes), lissé sur 3 cases.
  const brut = new Float64Array(k2);
  for (const t of calmes) {
    trame(pcm, t, n, pas, w, re, im);
    fft.transformer(false);
    for (let k = 0; k < k2; k++) brut[k]! += (re[k]! ** 2 + im[k]! ** 2) / calmes.length;
  }
  const bruit = new Float64Array(k2);
  for (let k = 0; k < k2; k++) bruit[k] = Math.max(1e-20, (brut[Math.max(0, k - 1)]! + brut[k]! + brut[Math.min(k2 - 1, k + 1)]!) / 3);

  // 2. Bandes du désesseur (5–9 kHz, pentes de 4–5 kHz et 9–10,5 kHz) et du total (au-dessus de 100 Hz).
  const hz = (k: number) => (k * fs) / n;
  const poidsS = new Float64Array(k2);
  for (let k = 0; k < k2; k++) {
    const f = hz(k);
    poidsS[k] = f < 4000 || f > 10500 ? 0 : f < 5000 ? (f - 4000) / 1000 : f <= 9000 ? 1 : (10500 - f) / 1500;
  }
  let bruitS = 0;
  for (let k = 0; k < k2; k++) if (poidsS[k] === 1) bruitS += bruit[k]!;

  const plancher = reduction > 0 ? 10 ** (plancherReduction(reduction) / 20) : 1;
  const alpha = 0.92;
  const precedent = new Float64Array(k2); // |Ŝ|² de la trame précédente
  const gains = new Float64Array(k2);
  let baisse = 0; // dB, désesseur lissé
  const sortie = new Float64Array(pcm.length + 2 * n);
  const total = nombreTrames(pcm.length, n, pas);
  for (let t = 0; t < total; t++) {
    trame(pcm, t, n, pas, w, re, im);
    fft.transformer(false);
    let es = 0;
    let et = 0;
    for (let k = 0; k < k2; k++) {
      const p = re[k]! ** 2 + im[k]! ** 2;
      let g = 1;
      if (reduction > 0) {
        const gamma = p / bruit[k]!;
        const xi = Math.max(1e-3, (alpha * precedent[k]!) / bruit[k]! + (1 - alpha) * Math.max(gamma - 1, 0));
        g = Math.max(plancher, xi / (1 + xi));
      }
      gains[k] = g;
      precedent[k] = g * g * p;
      if (poidsS[k] === 1) es += g * g * p;
      if (hz(k) >= 100) et += g * g * p;
    }
    // Désesseur : un « s » = la bande 5–9 kHz domine la trame et sort nettement du bruit.
    const part = et > 0 ? es / et : 0;
    const s = es > 10 * bruitS ? Math.min(1, Math.max(0, (part - 0.3) / 0.4)) : 0;
    baisse = Math.max(desesseur > 0 ? baisseDesesseur(desesseur) * s : 0, baisse * 0.6);
    for (let k = 0; k < k2; k++) {
      const g = gains[k]! * (baisse > 0 && poidsS[k]! > 0 ? 10 ** ((-baisse * poidsS[k]!) / 20) : 1);
      re[k]! *= g;
      im[k]! *= g;
      if (k > 0 && k < n / 2) {
        re[n - k]! *= g;
        im[n - k]! *= g;
      }
    }
    fft.transformer(true);
    const d = debutTrame(t, pas);
    for (let i = 0; i < n && d + i < sortie.length; i++) sortie[d + i]! += re[i]! * w[i]!;
  }
  // Somme des fenêtres² (Hann, recouvrement de 75 %) = 1,5.
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = sortie[i + n]! / 1.5;
  return out;
}

/** Porte de bruit avec maintien : ouverte au-dessus du bruit + 9 dB, fermée sous le bruit + 5 dB après 120 ms. */
export function porte(pcm: Float32Array, fs: number, force: number, bruitDb: number): Float32Array {
  const bloc = Math.max(1, Math.round(fs / 1000));
  const nb = Math.ceil(pcm.length / bloc);
  const energie = new Float64Array(nb);
  for (let b = 0; b < nb; b++) {
    let e = 0;
    const fin = Math.min(pcm.length, (b + 1) * bloc);
    for (let i = b * bloc; i < fin; i++) e += pcm[i]! * pcm[i]!;
    energie[b] = e / bloc;
  }
  const ouvrir = bruitDb + 9;
  const fermer = bruitDb + 5;
  const maintien = 120;
  const ferme = 10 ** (-profondeurPorte(force) / 20);
  const cible = new Float64Array(nb);
  let ouverte = false;
  let reste = 0;
  let somme = 0;
  for (let b = 0; b < nb; b++) {
    somme += energie[b]! - (b >= 10 ? energie[b - 10]! : 0); // fenêtre de 10 ms
    const db = 10 * Math.log10(Math.max(1e-20, somme / Math.min(10, b + 1)));
    if (db > ouvrir) (ouverte = true), (reste = maintien);
    else if (ouverte && db < fermer && --reste <= 0) ouverte = false;
    else if (ouverte && db >= fermer) reste = maintien;
    cible[b] = ouverte ? 1 : ferme;
  }
  // Regard en avant de 5 ms (l'attaque d'une consonne n'est pas mangée), puis lissage.
  const out = new Float32Array(pcm.length);
  const att = Math.exp(-1 / (0.002 * fs));
  const rel = Math.exp(-1 / (0.08 * fs));
  let g = cible[0]!;
  for (let b = 0; b < nb; b++) {
    let c = cible[b]!;
    for (let k = 1; k <= 5 && b + k < nb; k++) c = Math.max(c, cible[b + k]!);
    const fin = Math.min(pcm.length, (b + 1) * bloc);
    for (let i = b * bloc; i < fin; i++) {
      g = c > g ? c + (g - c) * att : c + (g - c) * rel;
      out[i] = pcm[i]! * g;
    }
  }
  return out;
}
