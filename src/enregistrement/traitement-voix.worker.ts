// Worker du nettoyeur et du doublage (calcul hors du fil principal). Un Worker par calcul, fermé après.
// Message reçu : { type: 'nettoyer' | 'doubler', pcm, frequence, reglages } ; réponse : { pcm, ms } (tampon
// transféré) ou { erreur }.

import type { ReglagesDoublage, ReglagesNettoyeur } from './api-voix-avancee';
import { doubler } from './doublage-calcul';
import { nettoyer } from './nettoyeur-calcul';

type Demande = { type: 'nettoyer'; pcm: Float32Array; frequence: number; reglages: ReglagesNettoyeur } | { type: 'doubler'; pcm: Float32Array; frequence: number; reglages: ReglagesDoublage };

const portee = self as unknown as { postMessage(m: unknown, transfert?: Transferable[]): void };

self.onmessage = (e: MessageEvent<Demande>) => {
  const d = e.data;
  try {
    const t0 = performance.now();
    const r = d.type === 'nettoyer' ? nettoyer(d.pcm, d.frequence, d.reglages) : doubler(d.pcm, d.frequence, d.reglages);
    const pcm = r === d.pcm ? r.slice() : r;
    portee.postMessage({ pcm, ms: performance.now() - t0 }, [pcm.buffer as ArrayBuffer]);
  } catch (erreur) {
    portee.postMessage({ erreur: String(erreur) });
  }
};
