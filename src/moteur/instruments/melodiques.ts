// Instruments à notes : la basse 808 (avec glissé et saturation, une note par durée) et les sons des accords
// (piano électrique doux en FM, nappe de scies désaccordées, cloche FM), SANS durée : voir notes.ts.
// Synthèse JS pure, une note à la fois, à appeler dans avecFrequence(ctx.sampleRate, …) (fil principal ou Worker).

import { frequenceMidi } from '../../morceau/theorie';
import { FREQ, nbEchantillons, oscillateur } from '../synthese/briques';
import { filtrer, saturer } from '../synthese/effets';

/** Durée du relâchement à la fin d'une note de 808 (évite le clic, garde la note « tenue »). */
const RELACHE_808 = 0.03;

interface Reglages808 {
  /** Temps (s) pour que le niveau soit divisé par e : grand = 808 longue. */
  tau: number;
  /** Saturation : ajoute des harmoniques pour que la 808 s'entende sur un téléphone. */
  force: number;
  passeBas: number;
  /** Durée du glissé vers la note suivante (drill). */
  glisse: number;
}
const R808: Record<string, Reglages808> = {
  trap: { tau: 1.6, force: 2.0, passeBas: 2200, glisse: 0.09 },
  drill: { tau: 1.4, force: 2.6, passeBas: 2600, glisse: 0.11 },
  lofi: { tau: 0.7, force: 1.3, passeBas: 900, glisse: 0.08 },
  // Vague B. Phonk : très saturée et longue ; pop : ronde, propre ; boom bap : courte et sourde (comme une contrebasse).
  phonk: { tau: 2.6, force: 4.5, passeBas: 3200, glisse: 0.1 },
  pop: { tau: 1.0, force: 1.5, passeBas: 1500, glisse: 0.08 },
  boombap: { tau: 0.55, force: 1.5, passeBas: 750, glisse: 0.08 },
};

/**
 * Une note de 808 : un sinus grave qui commence un peu plus haut (le « punch »), tenu longtemps, saturé.
 * `cible` : note MIDI vers laquelle la fin de la note glisse (808 drill). Crête ≈ 0,9.
 */
export function synthetiser808(style: string, midi: number, duree: number, cible?: number): Float32Array {
  const r = R808[style] ?? R808.trap!;
  const total = duree + RELACHE_808;
  const n = nbEchantillons(total);
  const f = frequenceMidi(midi);
  const f2 = cible !== undefined ? frequenceMidi(cible) : f;
  const tGlisse = Math.max(0, duree - Math.min(r.glisse, duree * 0.5));
  const freqs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / FREQ;
    let x = f * (1 + 0.9 * Math.exp(-t / 0.012)); // punch : la note tombe en ~30 ms sur sa hauteur
    if (t > tGlisse && f2 !== f) x *= Math.pow(f2 / f, Math.min(1, (t - tGlisse) / Math.max(0.001, duree - tGlisse)));
    freqs[i] = x;
  }
  const onde = oscillateur('sinus', total, freqs);
  for (let i = 0; i < n; i++) {
    const t = i / FREQ;
    let g = Math.min(1, t / 0.0015) * Math.exp(-t / r.tau);
    if (t > duree) g *= Math.max(0, 1 - (t - duree) / RELACHE_808);
    onde[i] *= g;
  }
  const sortie = filtrer(saturer(onde, r.force), 'passe-bas', r.passeBas, 0.6);
  for (let i = 0; i < n; i++) sortie[i] *= 0.9;
  return sortie;
}

/**
 * Relâchement des notes d'accords (s) : à la fin de la note, le graphe baisse le gain en ligne droite pendant
 * ce temps (comme une pédale douce), puis arrête la source. Les sons eux-mêmes n'ont pas de durée.
 */
export const RELACHE_ACCORD = 0.35;

/**
 * Piano électrique doux (FM : une sinusoïde qui en module une autre, la brillance s'éteint vite).
 * Sans durée : `total` secondes de son, qui s'éteint seul (tau 1,5 s).
 */
export function epiano(f: number, total: number, lofi: boolean): Float32Array {
  const n = nbEchantillons(total);
  const s = new Float32Array(n);
  const w = (2 * Math.PI * f) / FREQ;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / FREQ;
    const indice = 1.6 * Math.exp(-t / 0.25) + 0.25;
    const cloche = 0.12 * Math.exp(-t / 0.03) * Math.sin(phase * 14);
    const g = Math.min(1, t / 0.003) * Math.exp(-t / 1.5);
    s[i] = g * (Math.sin(phase + indice * Math.sin(phase)) + cloche);
    // lo-fi : la hauteur ondule un peu (« wow » de cassette).
    phase += lofi ? w * (1 + 0.0025 * Math.sin(2 * Math.PI * 0.6 * t)) : w;
  }
  return filtrer(s, 'passe-bas', lofi ? 2800 : 6000, 0.6);
}

/** Nappe : 3 scies légèrement désaccordées, adoucies, qui montent lentement puis tiennent (sans fin). */
export function nappe(f: number, total: number, desaccord: number[]): Float32Array {
  const n = nbEchantillons(total);
  const s = new Float32Array(n);
  for (const cents of desaccord) {
    const o = oscillateur('scie', total, f * Math.pow(2, cents / 1200));
    for (let i = 0; i < n; i++) s[i] += o[i]! / desaccord.length;
  }
  const sous = oscillateur('sinus', total, f / 2);
  for (let i = 0; i < n; i++) {
    const t = i / FREQ;
    const g = Math.min(1, t / 0.25) * (0.85 + 0.15 * Math.exp(-t / 0.5));
    s[i] = (s[i]! + 0.3 * sous[i]!) * g;
  }
  // Deux passe-bas doux : une nappe sombre, qui laisse la place à la voix (2-4 kHz) et à la 808.
  return filtrer(filtrer(s, 'passe-bas', 1000, 0.6), 'passe-bas', 2200, 0.6);
}

/** Cloche FM (rapport 3,5 : un son de cloche ou de clochette), qui s'éteint seule (tau 0,9 s). */
export function cloche(f: number, total: number): Float32Array {
  const n = nbEchantillons(total);
  const s = new Float32Array(n);
  const w = (2 * Math.PI * f) / FREQ;
  for (let i = 0; i < n; i++) {
    const t = i / FREQ;
    const g = Math.min(1, t / 0.002) * Math.exp(-t / 0.9);
    s[i] = g * Math.sin(w * i + 2.5 * Math.exp(-t / 0.4) * Math.sin(3.5 * w * i));
  }
  return s;
}
