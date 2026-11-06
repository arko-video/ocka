// Crochet de lecture des prises (contrat C3, intégrateur) : appelé par lirePcmVoix (autotune/autotune.ts) sur le PCM
// qu'un graphe va jouer (après l'autotune), à l'écoute ET à l'export. Implémenté par V (voix-avancee.ts : écoute d'un
// réglage du nettoyeur ou du doublage avant de l'appliquer). Un « pas_encore » rend la prise telle quelle.

import type { PcmVoix } from '../autotune/autotune';
import type { Morceau, Prise } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import { traiterPrise } from './voix-avancee';

export async function crochetPrise(prise: Prise, m: Morceau, pcm: PcmVoix, attendre: boolean): Promise<PcmVoix> {
  try {
    return await traiterPrise(prise, m, pcm, attendre);
  } catch (e) {
    if (e instanceof ErreurOcka && e.code === 'pas_encore') return pcm;
    throw e;
  }
}
