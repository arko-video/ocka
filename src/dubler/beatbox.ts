// Beatbox, partie pure : classement k-NN (k = 3) sur les exemples de l'entraînement, normalisés (moyenne et écart type de chaque mesure).

import { EXEMPLES_PAR_SON, SONS_BEATBOX, type EntrainementBeatbox, type SonBeatbox } from './api-dubler';
import { NB_MESURES } from './mesures';

export { DUREE_MESURE_S, mesuresAttaque, NB_MESURES } from './mesures';

/** Sons indispensables ; « perso » (le 4e, au choix) peut rester vide : il est alors ignoré. */
export const SONS_OBLIGATOIRES: readonly SonBeatbox[] = ['boum', 'ka', 'ts'];

/** Les sons entraînés (5 exemples ou plus), ou null si l'entraînement n'est pas complet. */
export function sonsEntraines(e: EntrainementBeatbox): SonBeatbox[] | null {
  const sons: SonBeatbox[] = [];
  for (const s of SONS_BEATBOX) {
    const n = e.exemples[s]?.filter((v) => v.length === NB_MESURES).length ?? 0;
    if (n >= EXEMPLES_PAR_SON) sons.push(s);
    else if (n > 0 || SONS_OBLIGATOIRES.includes(s)) return null;
  }
  return sons;
}

/** Le son le plus proche (k-NN, k = 3) et sa confiance (part des 3 voisins d'accord, 0 à 1) ; null si incomplet. Pure. */
export function classerAttaque(
  e: EntrainementBeatbox,
  mesures: readonly number[],
): { son: SonBeatbox; confiance: number } | null {
  const sons = sonsEntraines(e);
  if (!sons || mesures.length !== NB_MESURES) return null;
  const exemples = sons.flatMap((s) =>
    e.exemples[s].filter((v) => v.length === NB_MESURES).map((v) => ({ s, v })),
  );
  // Normalisation : chaque mesure centrée et réduite d'après les exemples (écart type plancher 0,03).
  const moy = new Float64Array(NB_MESURES);
  const et = new Float64Array(NB_MESURES);
  for (const { v } of exemples) v.forEach((x, i) => (moy[i] = moy[i]! + x / exemples.length));
  for (const { v } of exemples) v.forEach((x, i) => (et[i] = et[i]! + (x - moy[i]!) ** 2 / exemples.length));
  for (let i = 0; i < NB_MESURES; i++) et[i] = Math.max(0.03, Math.sqrt(et[i]!));
  const distances = exemples.map(({ s, v }) => {
    let d = 0;
    for (let i = 0; i < NB_MESURES; i++) d += ((v[i]! - mesures[i]!) / et[i]!) ** 2;
    return { s, d };
  });
  distances.sort((a, b) => a.d - b.d);
  const voisins = distances.slice(0, 3);
  const votes = new Map<SonBeatbox, { n: number; d: number }>();
  for (const { s, d } of voisins) {
    const v = votes.get(s) ?? { n: 0, d: 0 };
    votes.set(s, { n: v.n + 1, d: v.d + d });
  }
  // Le plus de voix ; à égalité, les voisins les plus proches.
  let meilleur: { s: SonBeatbox; n: number; d: number } | null = null;
  for (const [s, v] of votes)
    if (!meilleur || v.n > meilleur.n || (v.n === meilleur.n && v.d < meilleur.d)) meilleur = { s, ...v };
  return { son: meilleur!.s, confiance: meilleur!.n / voisins.length };
}
