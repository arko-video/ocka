// Côté page : envoie les calculs lourds des sons avancés au Worker (sons.worker.ts). Sans Worker (Vitest), le même
// calcul tourne sur le fil principal. Un Worker par calcul (rare, long) : il est arrêté à la fin.

import { ErreurOcka } from '../moteur/erreur';
import type { PcmSon } from '../moteur/types-moteur';
import type { OperationSon } from './api-sons-avances';
import { appliquerOperation } from './edition-pcm';
import { etirerBeat } from './wsola';

/** Temps (ms) du dernier calcul (rapport, QA). */
export const mesuresSons = { ms: 0 };

type Demande = { type: 'etirer'; rapport: number } | { type: 'editer'; op: OperationSon };

export async function calculer(pcm: PcmSon, d: Demande): Promise<PcmSon> {
  const t0 = performance.now();
  try {
    if (typeof Worker === 'undefined') return d.type === 'etirer' ? etirerBeat(pcm, d.rapport) : appliquerOperation(pcm, d.op);
    const canaux = pcm.canaux.map((c) => c.slice());
    const w = new Worker(new URL('./sons.worker.ts', import.meta.url), { type: 'module' });
    try {
      return await new Promise<PcmSon>((ok, ko) => {
        w.onmessage = (e: MessageEvent<{ frequence: number; canaux: Float32Array[]; erreur?: string; code?: string }>) => {
          if (e.data.erreur) ko(new ErreurOcka(e.data.erreur, e.data.code ?? 'calcul'));
          else ok({ frequence: e.data.frequence, canaux: e.data.canaux });
        };
        w.onerror = (e) => ko(new ErreurOcka(e.message || 'Le calcul du son a échoué.', 'calcul'));
        w.postMessage({ id: 1, frequence: pcm.frequence, canaux, ...d }, canaux.map((c) => c.buffer as ArrayBuffer));
      });
    } finally {
      w.terminate();
    }
  } finally {
    mesuresSons.ms = performance.now() - t0;
  }
}
