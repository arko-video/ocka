// Outils communs des synthés de C3 (L) : partiels amortis (synthèse modale), trémolo, vibrato, filtres simples,
// attaque sans clic. JS pur, déterministe ; suit FREQ (avecFrequence). Aucun import du registre.

import { FREQ } from '../briques';

export const DEUX_PI = 2 * Math.PI;

/** Échantillons d'une durée (s). */
export const nb = (s: number): number => Math.max(1, Math.round(s * FREQ));

/** Interpolation linéaire de `a` (x = 0) à `b` (x = 1). */
export const entre = (a: number, b: number, x: number): number => a + (b - a) * x;

/** De `a` à `b` sur une échelle logarithmique (fréquences, temps). */
export const entreLog = (a: number, b: number, x: number): number => a * Math.pow(b / a, x);

/**
 * Ajoute un partiel amorti (synthèse modale) : sinus de fréquence `f`, d'amplitude `amp`, divisé par e toutes les
 * `tau` s, à partir de l'échantillon `debut`. Rotation complexe exacte ; rien au-delà de 0,45 × FREQ (pas de repliement).
 */
export function ajouterMode(
  sortie: Float32Array,
  f: number,
  amp: number,
  tau: number,
  phase = 0,
  debut = 0,
): void {
  if (!(f > 0) || f >= 0.45 * FREQ || amp === 0) return;
  const w = (DEUX_PI * f) / FREQ;
  const r = Math.exp(-1 / (tau * FREQ));
  const c = Math.cos(w) * r;
  const s = Math.sin(w) * r;
  let x = Math.cos(phase) * amp;
  let y = Math.sin(phase) * amp;
  const seuil = 1e-7 * amp * amp;
  for (let i = debut; i < sortie.length; i++) {
    sortie[i] += y;
    const nx = x * c - y * s;
    y = x * s + y * c;
    x = nx;
    if ((i & 1023) === 0 && x * x + y * y < seuil * 1e-4) break;
  }
}

/** Attaque sans clic : fondu d'entrée en cosinus sur `duree` s. */
export function fonduEntree(canaux: Float32Array[], duree: number): void {
  const n = Math.round(duree * FREQ);
  for (const c of canaux)
    for (let i = 0; i < Math.min(n, c.length); i++) c[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
}

/** Trémolo : le volume oscille (`vitesse` Hz, `profondeur` 0 à 1) ; `decalage` (tours) décale l'oscillation. */
export function tremolo(c: Float32Array, vitesse: number, profondeur: number, decalage = 0): void {
  if (profondeur <= 0) return;
  const w = (DEUX_PI * vitesse) / FREQ;
  for (let i = 0; i < c.length; i++)
    c[i] *= 1 - profondeur * (0.5 - 0.5 * Math.cos(w * i + DEUX_PI * decalage));
}

/**
 * Fréquence par échantillon (Hz) : `f` avec un vibrato (`cents` crête, `vitesse` Hz) qui arrive après `delai` s
 * en `monte` s, et un glissé d'attaque de `glisseCents` qui se résorbe en `tauGlisse` s.
 */
export function courbeFrequence(
  n: number,
  f: number,
  o: {
    cents?: number;
    vitesse?: number;
    delai?: number;
    monte?: number;
    glisseCents?: number;
    tauGlisse?: number;
    phase?: number;
  } = {},
): Float32Array {
  const out = new Float32Array(n);
  const cents = o.cents ?? 0;
  const w = (DEUX_PI * (o.vitesse ?? 5.5)) / FREQ;
  const delai = (o.delai ?? 0) * FREQ;
  const monte = Math.max(1, (o.monte ?? 0.3) * FREQ);
  const g = o.glisseCents ?? 0;
  const kg = o.tauGlisse ? Math.exp(-1 / (o.tauGlisse * FREQ)) : 0;
  let glisse = g;
  for (let i = 0; i < n; i++) {
    const v =
      cents === 0 || i < delai
        ? 0
        : cents * Math.min(1, (i - delai) / monte) * Math.sin(w * (i - delai) + (o.phase ?? 0));
    out[i] = f * Math.pow(2, (v + glisse) / 1200);
    glisse *= kg;
  }
  return out;
}

/** Passe-bas à un pôle (6 dB/oct), en place ; `fc` fixe ou une par échantillon. */
export function passeBas1(c: Float32Array, fc: number | Float32Array): void {
  let y = 0;
  let fAvant = -1;
  let a = 0;
  for (let i = 0; i < c.length; i++) {
    const f = typeof fc === 'number' ? fc : fc[i]!;
    if (f !== fAvant) {
      fAvant = f;
      a = 1 - Math.exp((-DEUX_PI * Math.min(f, 0.45 * FREQ)) / FREQ);
    }
    y += a * (c[i]! - y);
    c[i] = y;
  }
}

/** Passe-haut à un pôle (coupe le continu et le grave sous `fc`), en place. */
export function passeHaut1(c: Float32Array, fc: number): void {
  const a = Math.exp((-DEUX_PI * fc) / FREQ);
  let x1 = 0;
  let y = 0;
  for (let i = 0; i < c.length; i++) {
    const x = c[i]!;
    y = a * (y + x - x1);
    x1 = x;
    c[i] = y;
  }
}

/** Résonateur passe-bande à 2 pôles (formant : fréquence, largeur de bande en Hz), ajouté à `sortie` × `gain`. */
export function formant(
  entree: Float32Array,
  sortie: Float32Array,
  f: number,
  largeur: number,
  gain: number,
): void {
  const r = Math.exp((-Math.PI * largeur) / FREQ);
  const a1 = 2 * r * Math.cos((DEUX_PI * f) / FREQ);
  const a2 = -r * r;
  const g = (1 - r) * gain;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < entree.length; i++) {
    const y = g * entree[i]! + a1 * y1 + a2 * y2;
    y2 = y1;
    y1 = y;
    sortie[i] += y;
  }
}

/** Saturation douce (tanh) à niveau constant : `force` 0 = rien. */
export function saturerDoux(c: Float32Array, force: number): void {
  if (force <= 0) return;
  const k = 1 + force * 6;
  const norme = Math.tanh(k);
  for (let i = 0; i < c.length; i++) c[i] = Math.tanh(c[i]! * k) / norme;
}

/** Arrondi au millième (comme le normaliseur) : un réglage enregistré puis relu donne le même son. */
export const milliemes = (x: number): number => Math.round(x * 1000) / 1000;
