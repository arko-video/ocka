// Étirer au tempo sans changer la hauteur : WSOLA (Waveform Similarity Overlap-Add), hors ligne, PUR.
// Trames de Hann de 40 ms posées tous les 20 ms en sortie ; en entrée, on avance de 20 ms / rapport et on cherche
// (±12 ms) le passage qui ressemble le plus à la suite naturelle de la trame d'avant (intercorrélation, d'abord
// grossière puis fine). La longueur de sortie est EXACTE (au échantillon près). Jusqu'à ±20 % environ.
// Pour un beat : on découpe aux attaques, on étire chaque passage et on le repose à sa place (attaques nettes).

import { ErreurOcka } from '../moteur/erreur';
import type { PcmSon } from '../moteur/types-moteur';
import { attaques } from './decoupe';
import { hann, longueur } from './spectre';

/** Rapports permis (nouvelle durée / ancienne). */
export const RAPPORT_MIN = 0.75;
export const RAPPORT_MAX = 1.34;

/** Rapport borné, ou erreur claire. */
export function verifierRapport(rapport: number): number {
  if (!Number.isFinite(rapport) || rapport < RAPPORT_MIN || rapport > RAPPORT_MAX) {
    throw new ErreurOcka('On peut étirer ou resserrer un son de 20 % environ, pas plus.', 'etirement_impossible');
  }
  return rapport;
}

/** Ressemblance de deux passages de `x` (pas `saut` : calcul grossier). */
function correlation(x: Float32Array, a: number, b: number, n: number, saut: number): number {
  let s = 0;
  for (let i = 0; i < n; i += saut) s += x[a + i]! * x[b + i]!;
  return s;
}

/** WSOLA vers une longueur exacte (trames). `pcm` est lu, jamais modifié. */
export function etirerVers(pcm: PcmSon, cible: number): PcmSon {
  const n = longueur(pcm);
  const sr = pcm.frequence;
  const L = Math.max(0, Math.round(cible));
  const canaux = pcm.canaux.map(() => new Float32Array(L));
  if (L === 0 || n === 0) return { frequence: sr, canaux };
  if (L === n) return { frequence: sr, canaux: pcm.canaux.map((c) => c.slice(0, n)) };
  const N = Math.max(64, 2 * Math.round(sr * 0.02));
  const Hs = N / 2;
  const tol = Math.max(8, Math.round(sr * 0.012));
  // Signal de recherche : mono, bordé de zéros (marge = tol + N).
  const marge = tol + N;
  const x = new Float32Array(n + 2 * marge);
  for (const c of pcm.canaux) for (let i = 0; i < n; i++) x[marge + i]! += c[i]! / pcm.canaux.length;
  const lire = (c: Float32Array, i: number) => (i >= 0 && i < n ? c[i]! : 0);
  const w = hann(N);
  const poids = new Float64Array(L);
  let precedent = -Hs; // position d'entrée choisie pour la trame d'avant (début de trame)
  for (let k = 0; k * Hs - Hs < L; k++) {
    const sortie = k * Hs - Hs; // début de la trame en sortie (la 1re commence avant 0)
    const nominal = Math.round(((sortie + Hs) * n) / L - Hs);
    let choisi = nominal;
    if (k > 0) {
      const suite = precedent + Hs; // ce qui suivrait naturellement la trame d'avant
      const bas = Math.max(-N, nominal - tol);
      const haut = Math.min(n, nominal + tol);
      let meilleur = -Infinity;
      for (let d = bas; d <= haut; d += 4) {
        const c = correlation(x, marge + suite, marge + d, N, 4);
        if (c > meilleur) (meilleur = c), (choisi = d);
      }
      const centre = choisi;
      meilleur = -Infinity;
      for (let d = Math.max(bas, centre - 4); d <= Math.min(haut, centre + 4); d++) {
        const c = correlation(x, marge + suite, marge + d, N, 1);
        if (c > meilleur) (meilleur = c), (choisi = d);
      }
    }
    precedent = choisi;
    for (let i = 0; i < N; i++) {
      const o = sortie + i;
      if (o < 0 || o >= L) continue;
      poids[o]! += w[i]!;
      for (let c = 0; c < canaux.length; c++) canaux[c]![o]! += w[i]! * lire(pcm.canaux[c]!, choisi + i);
    }
  }
  for (let o = 0; o < L; o++) {
    const p = poids[o]!;
    if (p > 1e-3) for (const c of canaux) c[o] = c[o]! / p;
  }
  return { frequence: sr, canaux };
}

/** Voir api-sons-avances.ts : longueur = round(n × rapport). */
export function etirerPcm(pcm: PcmSon, rapport: number): PcmSon {
  verifierRapport(rapport);
  return etirerVers(pcm, Math.round(longueur(pcm) * rapport));
}

/**
 * Beat : découpé aux attaques, chaque passage étiré puis reposé à sa nouvelle place (attaque × rapport). Les
 * attaques restent nettes. Sans attaques nettes (3 au moins), un WSOLA d'un seul tenant.
 */
export function etirerBeat(pcm: PcmSon, rapport: number): PcmSon {
  verifierRapport(rapport);
  const n = longueur(pcm);
  const sr = pcm.frequence;
  const L = Math.round(n * rapport);
  const t = attaques(pcm, 0.5).filter((x) => x > 0.03 && x < n / sr - 0.03);
  if (t.length < 3) return etirerVers(pcm, L);
  const bornes = [0, ...t.map((x) => Math.round(x * sr)), n];
  const canaux = pcm.canaux.map(() => new Float32Array(L));
  for (let i = 0; i + 1 < bornes.length; i++) {
    const [a, b] = [bornes[i]!, bornes[i + 1]!];
    if (b <= a) continue;
    const debut = Math.round(a * rapport);
    const fin = i + 2 === bornes.length ? L : Math.round(b * rapport);
    const part = etirerVers({ frequence: sr, canaux: pcm.canaux.map((c) => c.subarray(a, b)) }, fin - debut);
    const f = Math.min(Math.round(sr * 0.002), fin - debut); // anti-clic en fin de passage
    part.canaux.forEach((c, k) => {
      for (let j = 0; j < f; j++) c[c.length - 1 - j] = c[c.length - 1 - j]! * ((j + 0.5) / f);
      canaux[k]!.set(c, debut);
    });
  }
  return { frequence: sr, canaux };
}
