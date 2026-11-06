// Worker des sons avancés (S) : étirement WSOLA (beat découpé aux attaques) et opérations de l'éditeur, hors ligne.
// Reçoit { id, type: 'etirer' | 'editer', frequence, canaux, rapport?, op? } ; répond { id, frequence, canaux } (PCM
// transféré) ou { id, erreur, code }.

import type { OperationSon } from './api-sons-avances';
import { appliquerOperation } from './edition-pcm';
import { etirerBeat } from './wsola';

interface Demande {
  id: number;
  type: 'etirer' | 'editer';
  frequence: number;
  canaux: Float32Array[];
  rapport?: number;
  op?: OperationSon;
}

const portee = self as unknown as { postMessage(m: unknown, transfert?: Transferable[]): void };

self.onmessage = (e: MessageEvent<Demande>) => {
  const d = e.data;
  try {
    const pcm = { frequence: d.frequence, canaux: d.canaux };
    const res = d.type === 'etirer' ? etirerBeat(pcm, d.rapport ?? 1) : appliquerOperation(pcm, d.op!);
    portee.postMessage({ id: d.id, frequence: res.frequence, canaux: res.canaux }, res.canaux.map((c) => c.buffer as ArrayBuffer));
  } catch (err) {
    const x = err as { message?: string; code?: string };
    portee.postMessage({ id: d.id, erreur: x?.message ?? 'Calcul impossible', code: x?.code ?? 'calcul' });
  }
};
