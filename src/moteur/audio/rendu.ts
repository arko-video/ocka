// Outils de rendu hors temps réel partagés par les pistes séparées (stems.ts) et l'A/B (ab.ts).
// Le graphe est TOUJOURS celui de construireGraphe (M1) : le même que pour l'écoute et l'export.

import type { Morceau } from '../../morceau/types';
import { lirePcmVoix } from '../../autotune/autotune';
import { lireSon } from '../../sons/import';
import { ErreurOcka } from '../erreur';
import type { Graphe, PcmPrise } from '../graphe';
import type { PcmSon } from '../types-moteur';

/** Les fichiers d'un morceau (prises choisies et sons importés), lus une fois avant le rendu. */
export interface Medias {
  prises: Map<string, PcmPrise>;
  sons: Map<string, PcmSon>;
}

/** Lit les prises choisies (corrigées par l'autotune : on ATTEND la correction) et les sons importés (un fichier disparu est simplement absent). */
export async function chargerMedias(morceau: Morceau): Promise<Medias> {
  const prises = new Map<string, PcmPrise>();
  for (const p of morceau.prises) {
    if (!p.choisie || prises.has(p.fichier)) continue;
    const lu = await lirePcmVoix(p, morceau, true);
    if (lu) prises.set(p.fichier, lu);
  }
  const sons = new Map<string, PcmSon>();
  for (const s of morceau.sons ?? []) {
    if (sons.has(s.fichier)) continue;
    const lu = await lireSon(s);
    if (lu) sons.set(s.fichier, lu);
  }
  return { prises, sons };
}

export interface OptionsFenetres {
  /** Taille d'une fenêtre de planification (trames, multiple de 128). */
  pas: number;
  /** Appelée à chaque pause du rendu (trames déjà rendues), AVANT la reprise : on peut y vider des tampons. */
  pendant?: (trames: number) => Promise<void>;
  surProgression?: (p: number) => void;
  signal?: AbortSignal;
}

/**
 * Rend `ctx` (déjà branché par construireGraphe) à partir du temps `debut` du morceau (au temps 0 du contexte),
 * en planifiant par fenêtres, toujours une fenêtre d'avance (comme l'export : peu de sources à la fois).
 * Lève ErreurOcka « annule » si `signal` est déclenché (le rendu finit alors en silence, vite).
 */
export async function rendreParFenetres(ctx: OfflineAudioContext, graphe: Graphe, debut: number, o: OptionsFenetres): Promise<AudioBuffer> {
  const fs = ctx.sampleRate;
  const fenetre = o.pas / fs;
  const origine = -debut;
  graphe.planifier(debut, debut + 2 * fenetre, origine, true);
  let annule = false;
  let erreur: unknown = null;
  for (let k = 1; k * o.pas < ctx.length; k++) {
    const t = (k * o.pas) / fs;
    ctx
      .suspend(t)
      .then(async () => {
        try {
          if (annule || erreur) return;
          if (o.signal?.aborted) {
            annule = true;
            graphe.detruire();
            return;
          }
          await o.pendant?.(Math.round(ctx.currentTime * fs));
          o.surProgression?.(Math.min(1, (k * o.pas) / ctx.length));
          graphe.planifier(debut + t + fenetre, debut + t + 2 * fenetre, origine);
        } catch (e) {
          erreur = e;
          graphe.detruire();
        } finally {
          void ctx.resume();
        }
      })
      .catch(() => {
        /* pause impossible (déjà passée) : la planification suivante rattrape */
      });
  }
  const rendu = await ctx.startRendering();
  if (erreur) throw erreur;
  if (annule || o.signal?.aborted) throw new ErreurOcka('Export annulé.', 'annule');
  return rendu;
}
