// Sons importés (« Tes sons ») : préparation des pads perso et des boucles de section. Pur (sans Web Audio) :
// tourne dans le Worker de synthèse. Rééchantillonnage UNE fois, en sinc (reechantillonner), jamais playbackRate.

import { dureePas, PAS_PAR_MESURE } from '../../morceau/temps';
import { reechantillonner } from '../reechantillonner';

/** Seuil du « silence » au début d'un pad : −40 dB sous la crête (et au moins −60 dBFS). */
const SEUIL_SILENCE_DB = -40;
/** On garde 1 ms avant le début du son, en fondu d'entrée (l'attaque reste entière, sans clic). */
const AVANT_S = 0.001;
/** Fondu de fin d'un pad (2 ms). */
const FONDU_FIN_S = 0.002;

/** Durée exacte (en échantillons, à `frequence`) de `mesures` mesures au tempo (le swing ne change pas une mesure). */
export function longueurCalee(mesures: number, tempo: number, frequence: number): number {
  return Math.round(mesures * PAS_PAR_MESURE * dureePas(tempo) * frequence);
}

/**
 * Écart de hauteur (demi-tons) quand on cale un son de `duree` s sur `mesures` mesures au tempo :
 * positif = le son est accéléré (plus aigu). L'interface prévient au-delà d'un demi-ton.
 */
export function ecartCalage(duree: number, mesures: number, tempo: number): number {
  const cible = mesures * PAS_PAR_MESURE * dureePas(tempo);
  if (!(duree > 0) || !(cible > 0)) return 0;
  return 12 * Math.log2(duree / cible);
}

/** Ramène un canal à exactement `n` échantillons (coupé, ou complété par du silence). */
function aLongueur(c: Float32Array, n: number): Float32Array {
  if (c.length === n) return c;
  const s = new Float32Array(n);
  s.set(c.subarray(0, n));
  return s;
}

/** Cale un son (chaque canal) pour qu'il dure exactement `longueur` échantillons : un seul rééchantillonnage sinc. */
export function caler(canaux: Float32Array[], longueur: number): Float32Array[] {
  const n = Math.max(1, Math.round(longueur));
  return canaux.map((c) => (c.length === n ? c.slice() : aLongueur(reechantillonner(c, c.length, n), n)));
}

/** Rééchantillonne chaque canal de `de` Hz vers `vers` Hz (copie si c'est déjà la bonne fréquence). */
export function versFrequence(canaux: Float32Array[], de: number, vers: number): Float32Array[] {
  return canaux.map((c) => (de === vers ? c.slice() : reechantillonner(c, de, vers)));
}

/** Indice du premier échantillon « entendu » (au-dessus du seuil), ou 0. */
export function debutDuSon(canaux: Float32Array[]): number {
  let crete = 0;
  for (const c of canaux) for (let i = 0; i < c.length; i++) crete = Math.max(crete, Math.abs(c[i]!));
  const seuil = Math.max(0.001, crete * Math.pow(10, SEUIL_SILENCE_DB / 20));
  const n = canaux[0]?.length ?? 0;
  for (let i = 0; i < n; i++) for (const c of canaux) if (Math.abs(c[i]!) >= seuil) return i;
  return 0;
}

/**
 * Prépare le son d'un pad perso : silence de début coupé (1 ms gardée, en fondu d'entrée), rééchantillonné à
 * `vers` Hz, crête ramenée à `crete` (comme les sons du kit), fondu de 2 ms à la fin.
 */
export function preparerPad(canaux: Float32Array[], de: number, vers: number, crete: number): Float32Array[] {
  const avant = Math.round(AVANT_S * de);
  const debut = Math.max(0, debutDuSon(canaux) - avant);
  const coupes = canaux.map((c) => c.slice(debut));
  const montee = Math.min(avant, coupes[0]?.length ?? 0);
  for (const c of coupes) for (let i = 0; i < montee; i++) c[i] *= (i + 1) / (montee + 1);
  const sortie = versFrequence(coupes, de, vers);
  let max = 0;
  for (const c of sortie) for (let i = 0; i < c.length; i++) max = Math.max(max, Math.abs(c[i]!));
  const k = max > 0 ? crete / max : 0;
  const fondu = Math.round(FONDU_FIN_S * vers);
  for (const c of sortie) {
    for (let i = 0; i < c.length; i++) c[i] *= k;
    const nf = Math.min(fondu, c.length);
    for (let j = 0; j < nf; j++) c[c.length - nf + j] *= 1 - (j + 1) / nf;
  }
  return sortie.map((c) => (c.length > 0 ? c : new Float32Array(1)));
}
