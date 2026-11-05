// Sons propres à la mélodie : piano par résonateurs, lead (2 scies + filtre à enveloppe), pluck (Karplus-Strong).
// Synthèse JS pure, SANS durée de note (le graphe coupe la note par une rampe de gain) ; à appeler dans
// avecFrequence(ctx.sampleRate, …). Aucun hasard réel : même note → mêmes échantillons.

import { frequenceMidi } from '../../morceau/theorie';
import { bruit, FREQ, mulberry32, nbEchantillons, oscillateur } from '../synthese/briques';
import { filtrer } from '../synthese/effets';

/* ------------------------------------------------------------------ piano */

/** Longueur (s) d'une note de piano : les graves sonnent plus longtemps. */
export function dureePiano(midi: number): number {
  return midi < 48 ? 6 : midi < 72 ? 5 : 3.5;
}

/**
 * Ajoute à `s` deux sinusoïdes amorties amp·rⁿ·sin(wn) (les 2 cordes d'un partiel), chacune calculée par un
 * résonateur récursif à 2 pôles : x[n] = 2r·cos(w)·x[n−1] − r²·x[n−2]. Une seule boucle pour les deux (deux fois
 * moins d'accès mémoire) ; on s'arrête quand chacune passe sous −80 dB.
 */
function cordes(s: Float32Array, f1: number, tau1: number, amp1: number, f2: number, tau2: number, amp2: number) {
  const w1 = (2 * Math.PI * f1) / FREQ;
  const w2 = (2 * Math.PI * f2) / FREQ;
  const r1 = Math.exp(-1 / (tau1 * FREQ));
  const r2 = Math.exp(-1 / (tau2 * FREQ));
  const c1 = 2 * r1 * Math.cos(w1);
  const c2 = 2 * r2 * Math.cos(w2);
  const q1 = r1 * r1;
  const q2 = r2 * r2;
  const fin1 = Math.min(s.length, Math.ceil(tau1 * FREQ * 9.2));
  const fin2 = Math.min(s.length, Math.ceil(tau2 * FREQ * 9.2));
  let a2 = 0;
  let a1 = amp1 * r1 * Math.sin(w1);
  let b2 = 0;
  let b1 = amp2 * r2 * Math.sin(w2);
  if (s.length > 1) s[1] += a1 + b1;
  const commun = Math.min(fin1, fin2);
  let i = 2;
  for (; i < commun; i++) {
    const a = c1 * a1 - q1 * a2;
    const b = c2 * b1 - q2 * b2;
    s[i] += a + b;
    a2 = a1;
    a1 = a;
    b2 = b1;
    b1 = b;
  }
  for (; i < fin1; i++) {
    const a = c1 * a1 - q1 * a2;
    s[i] += a;
    a2 = a1;
    a1 = a;
  }
  for (; i < fin2; i++) {
    const b = c2 * b1 - q2 * b2;
    s[i] += b;
    b2 = b1;
    b1 = b;
  }
}

/**
 * Piano par résonateurs (synthèse modale) : chaque partiel est un résonateur, frappé par le marteau.
 * - partiels un peu inharmoniques (cordes raides : plus dans l'aigu) ;
 * - 2 cordes par partiel, la 2e un peu désaccordée et plus lente : l'attaque s'éteint vite, l'arrière-son reste ;
 * - le marteau : brillance qui monte avec la hauteur, frappe vers 1/7,5 de la corde, petit « toc » feutré ;
 * - décroissance plus rapide dans l'aigu et pour les partiels hauts.
 */
export function piano(midi: number): Float32Array {
  const f0 = frequenceMidi(midi);
  const s = new Float32Array(nbEchantillons(dureePiano(midi)));
  const octaves = (midi - 60) / 12;
  const inharmonicite = 0.00012 * Math.pow(2, 0.9 * octaves);
  const tau0 = Math.min(3.5, 1.5 * Math.pow(2, -0.8 * octaves));
  const brillance = 900 + 2.5 * f0;
  const fMax = Math.min(0.42 * FREQ, 10000);
  for (let k = 1; k <= 24; k++) {
    const fk = k * f0 * Math.sqrt(1 + inharmonicite * k * k);
    if (fk >= fMax) break;
    const position = 0.35 + 0.65 * Math.abs(Math.sin((Math.PI * k) / 7.5));
    const amp = position / (Math.pow(k, 0.7) * (1 + (fk / brillance) ** 2));
    const tau = tau0 / (1 + 0.1 * (k - 1) + (fk / 4000) ** 2);
    cordes(s, fk, tau, 0.62 * amp, fk * 1.00052, tau * 2.4, 0.38 * amp);
  }
  // Le « toc » du marteau : un bruit feutré très court.
  const toc = filtrer(bruit(0.03, 4000 + midi), 'passe-bas', Math.min(0.4 * FREQ, 2 * brillance), 0.7);
  for (let i = 0; i < toc.length && i < s.length; i++) s[i] += 0.04 * toc[i]! * Math.exp(-i / (0.004 * FREQ));
  // Le feutre reste en contact un instant : montée de 0,8 ms (pas de clic).
  const montee = Math.max(1, Math.round(0.0008 * FREQ));
  for (let i = 0; i < montee && i < s.length; i++) s[i] *= i / montee;
  return s;
}

/* ------------------------------------------------------------------ lead */

/** Lead : 2 scies désaccordées (±7 cents), filtre passe-bas qui se referme vite (enveloppe), puis tenue. */
export function lead(f: number, total: number): Float32Array {
  const ecart = Math.pow(2, 7 / 1200);
  const a = oscillateur('scie', total, f * ecart);
  const b = oscillateur('scie', total, f / ecart);
  const n = a.length;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = 0.5 * (a[i]! + b[i]!);
  const coupure = (t: number) => Math.min(0.45 * FREQ, 350 + f * (2.2 + 9 * Math.exp(-t / 0.12)));
  const sortie = filtrer(s, 'passe-bas', coupure, 1.3);
  for (let i = 0; i < n; i++) {
    const t = i / FREQ;
    sortie[i] *= Math.min(1, t / 0.005) * (0.72 + 0.28 * Math.exp(-t / 0.22));
  }
  return sortie;
}

/* ------------------------------------------------------------------ pluck (Karplus-Strong) */

/**
 * Coefficient C du passe-tout H(z) = (C + z⁻¹) / (1 + C·z⁻¹) dont le retard de phase vaut EXACTEMENT `retard`
 * échantillons à la pulsation `w` (rad/échantillon). La formule (1 − Δ)/(1 + Δ) n'est juste qu'en basse
 * fréquence : dans l'aigu elle fausse la note de plusieurs cents.
 */
export function coefficientPasseTout(retard: number, w: number): number {
  return Math.sin((w * (1 - retard)) / 2) / Math.sin((w * (1 + retard)) / 2);
}

/** Temps d'extinction (s, −60 dB) d'une note de pluck : plus court dans l'aigu. */
function extinctionPluck(midi: number): number {
  return Math.min(2.2, Math.max(0.35, 2.2 * Math.pow(2, -(midi - 48) / 20)));
}

/** Longueur (s) d'une note de pluck. */
export function dureePluck(midi: number): number {
  return Math.min(2.5, Math.max(0.6, 1.15 * extinctionPluck(midi)));
}

/**
 * Pluck par Karplus-Strong : une ligne à retard remplie d'un éclat de bruit, rebouclée par un filtre moyenneur
 * (retard 0,5 échantillon à toutes les fréquences) et un passe-tout à retard FRACTIONNAIRE réglé exactement sur
 * la fondamentale : retard total = FREQ / f (juste à moins de 2 cents jusqu'à C7 et au-delà).
 */
export function pluck(midi: number): Float32Array {
  const f0 = frequenceMidi(midi);
  const retardTotal = FREQ / f0;
  const N = Math.max(2, Math.floor(retardTotal - 1));
  const delta = retardTotal - 0.5 - N; // entre 0,5 et 1,5 : passe-tout bien sage
  const w0 = (2 * Math.PI * f0) / FREQ;
  const C = coefficientPasseTout(delta, w0);
  const perte = Math.min(0.9999, Math.pow(10, -3 / (f0 * extinctionPluck(midi))) / Math.cos(w0 / 2));
  // Excitation : une période de bruit adouci (un médiator plutôt qu'une griffe), sans composante continue.
  const ligne = new Float32Array(N);
  const hasard = mulberry32(7000 + midi);
  let e = 0;
  let somme = 0;
  for (let i = 0; i < N; i++) {
    e += 0.55 * (hasard() * 2 - 1 - e);
    ligne[i] = e;
    somme += e;
  }
  for (let i = 0; i < N; i++) ligne[i] -= somme / N;
  const s = new Float32Array(nbEchantillons(dureePluck(midi)));
  let pos = 0;
  let precedent = 0;
  let apEntree = 0;
  let apSortie = 0;
  for (let i = 0; i < s.length; i++) {
    const x = ligne[pos]!;
    s[i] = x;
    const moyenne = 0.5 * (x + precedent);
    precedent = x;
    const y = C * moyenne + apEntree - C * apSortie;
    apEntree = moyenne;
    apSortie = y;
    ligne[pos] = perte * y;
    pos = pos + 1 === N ? 0 : pos + 1;
  }
  return filtrer(s, 'passe-bas', Math.min(0.45 * FREQ, 9000), 0.6);
}
