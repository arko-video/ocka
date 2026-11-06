// GELS (contrat C3, intégrateur) : un passage d'une piste remplacé par un rendu calculé HORS LIGNE.
// - Effets de performance (R, Section.perf) : le passage des pistes touchées est rendu, l'effet est appliqué dans le
//   Worker de synthèse (travail « perf »), et le résultat remplace le passage ;
// - gel d'une piste (V, « freeze ») : toute la piste est rendue une fois, puis jouée telle quelle (ni notes, ni zones).
// Le graphe (construireGraphe : écoute ET export) demande les gels à chaque construction (fournisseurs ci-dessous) :
//   piste → tranche → PORTE (gain 0 pendant le passage) → sortie ; rendu gelé → sortie (bus du master ou piste séparée).
// Le rendu gelé est la piste APRÈS sa tranche (inserts, fader, pan, automation, sidechain), comme une piste séparée :
// porte fermée + rendu = le même son au bit près si le rendu n'est pas modifié (testé : tests/qa/gels.qa.ts).
// Limites : les envois partagés (réverbe, écho) de la piste ne sont pas gelés ; une piste gelée EN ENTIER ne joue
// plus ses notes (moins de calcul), sa tranche reste branchée (silencieuse).

import type { IdPiste, Morceau, Piste } from '../morceau/types';
import { dureeMorceau } from '../morceau/temps';
import { chargerMedias, rendreParFenetres } from './audio/rendu';
import { ErreurOcka } from './erreur';
import * as gel from './gel';
import { construireGrapheFenetre } from './graphe';
import { oublierBanque } from './instruments/banque';
import { detruireBus } from './instruments/bus';
import * as performance from './performance';
import type { PcmSon } from './types-moteur';

export interface Gel {
  piste: IdPiste;
  /** Temps du morceau (s) : début (≥ 0) et fin du passage remplacé. `de` = 0 et `a` ≥ la durée du morceau = toute la piste. */
  de: number;
  a: number;
  /** Rendu de la piste après sa tranche, STÉRÉO, qui commence à `de` (au moins `a − de` s). */
  pcm: PcmSon;
  /** Clé stable du rendu (même clé = même PCM) : clé de la banque du graphe (cles.gel). */
  cle: string;
}

export interface OptionsGels {
  /** Fréquence du contexte qui jouera les gels (le rendu peut être à une autre : il est rééchantillonné). */
  frequence: number;
  /** Export (true) : calculer ce qui manque et l'attendre. Écoute (false) : seulement ce qui est prêt ; le reste part en tâche de fond, puis prevenirGels(). */
  attendre: boolean;
  signal?: AbortSignal;
}

export type FournisseurGels = (m: Morceau, o: OptionsGels) => Promise<Gel[]>;

/** Les fournisseurs (R : performance.ts, V : gel.ts), remplaçables par les tests. Un « pas_encore » vaut []. */
export const outilsGels: { fournisseurs: FournisseurGels[] } = {
  fournisseurs: [(m, o) => performance.gelsPerformance(m, o), (m, o) => gel.gelsPistes(m, o)],
};

/** Tous les gels d'un morceau, vérifiés : piste existante, de < a, triés ; sur une même piste, un passage qui en chevauche un autre est ignoré. */
export async function gelsDuMorceau(m: Morceau, o: OptionsGels): Promise<Gel[]> {
  const tous: Gel[] = [];
  for (const f of outilsGels.fournisseurs) {
    try {
      tous.push(...(await f(m, o)));
    } catch (e) {
      if (!(e instanceof ErreurOcka && e.code === 'pas_encore')) throw e;
    }
  }
  const ids = new Set(m.pistes.map((p) => p.id));
  const fin = new Map<IdPiste, number>();
  return tous
    .filter((g) => ids.has(g.piste) && g.de >= 0 && g.a > g.de && g.pcm.canaux.length > 0)
    .sort((x, y) => x.de - y.de)
    .filter((g) => {
      if (g.de < (fin.get(g.piste) ?? -Infinity)) return false;
      fin.set(g.piste, g.a);
      return true;
    });
}

/** true si le gel couvre toute la piste (elle ne joue plus ses notes). */
export function gelEntier(g: Gel, duree: number): boolean {
  return g.de <= 0 && g.a >= duree;
}

const abonnes = new Set<() => void>();
/** L'interface recharge le lecteur quand un gel calculé en tâche de fond est prêt (ui/lecture.ts). */
export function surGels(cb: () => void): () => void {
  abonnes.add(cb);
  return () => abonnes.delete(cb);
}
/** Un fournisseur prévient qu'un gel calculé en tâche de fond est prêt. */
export function prevenirGels(): void {
  for (const cb of abonnes) cb();
}

/** Marge rendue AVANT `de` (s) : filtres, compresseurs et réverbes propres à la piste ont déjà leur état. */
export const AVANT_GEL = 0.5;

/**
 * Le morceau à rendre pour les pistes `ids` seulement : les AUTRES pistes ne s'entendent pas dans ce rendu (elles vont
 * vers un nœud muet), on les allège donc — muettes (le solo reste : il décide si une piste s'entend), sans inserts,
 * automation ni LFO (pas de « passe A » des inserts JS d'une autre piste), et sans les prises si la voix n'en est pas.
 * La batterie garde ses notes et son muet (le sidechain suit le kick). Les pistes rendues, elles, restent telles quelles.
 */
export function morceauPourRendu(m: Morceau, ids: readonly IdPiste[]): Morceau {
  const garder = new Set(ids);
  const pistes = m.pistes.map((p) => {
    if (garder.has(p.id)) return p;
    const q = { ...p, muet: p.id === 'batterie' ? p.muet : true };
    delete q.inserts;
    delete q.auto;
    delete q.lfo;
    return q as Piste;
  });
  return { ...m, pistes, prises: garder.has('voix') ? m.prises : [] };
}

/**
 * Rend des pistes séparées (après leur tranche, avant le master), de `de` à `a` (s, temps du morceau), à `frequence` :
 * un PcmSon stéréo par piste qui commence à `de`. Seules ces pistes sont calculées (morceauPourRendu). Sans gels (pas
 * de boucle). Pour les fournisseurs (R, V). Erreurs : « annule » ; un instrument absent → « instrument_absent ».
 */
// prettier-ignore
export async function rendrePistesSeparees(entier: Morceau, ids: IdPiste[], de: number, a: number, frequence: number, signal?: AbortSignal): Promise<Map<IdPiste, PcmSon>> {
  const m = morceauPourRendu(entier, ids);
  const debut = Math.max(0, de - AVANT_GEL);
  const fin = Math.min(a, dureeMorceau(m) + 10);
  const pas = 128 * 172;
  const n = Math.max(pas, Math.ceil(((fin - debut) * frequence) / pas) * pas);
  const ctx = new OfflineAudioContext(Math.max(1, 2 * ids.length), n, frequence);
  const fusion = ctx.createChannelMerger(Math.max(1, 2 * ids.length));
  fusion.connect(ctx.destination);
  const nulle = ctx.createGain();
  const pistesSeparees = Object.create(null) as Record<IdPiste, AudioNode>;
  for (const p of m.pistes) pistesSeparees[p.id] = nulle;
  ids.forEach((id, i) => {
    const g = new GainNode(ctx, { channelCount: 2, channelCountMode: 'explicit' });
    const separe = ctx.createChannelSplitter(2);
    g.connect(separe);
    separe.connect(fusion, 0, 2 * i);
    separe.connect(fusion, 1, 2 * i + 1);
    pistesSeparees[id] = g;
  });
  const medias = await chargerMedias(m);
  const graphe = await construireGrapheFenetre(ctx, m, medias.prises, debut, fin, nulle, { pistesSeparees, sons: medias.sons, gels: false });
  let rendu: AudioBuffer;
  try {
    rendu = await rendreParFenetres(ctx, graphe, debut, { pas, signal });
  } finally {
    graphe.detruire();
    detruireBus(ctx);
    oublierBanque(ctx);
  }
  const saut = Math.round((de - debut) * frequence);
  const out = new Map<IdPiste, PcmSon>();
  ids.forEach((id, i) => out.set(id, { frequence, canaux: [0, 1].map((c) => rendu.getChannelData(2 * i + c).slice(saut)) }));
  return out;
}
