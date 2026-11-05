// Worker de l'autotune : corrige une prise hors du fil principal (correction.ts). Un Worker par prise, fermé après.
// Message reçu : { pcm, frequence, force, tonalite } ; réponse : { pcm, voisees, applique, ms } (tampon transféré)
// ou { erreur }.

import type { Mode, Tonique } from '../morceau/types';
import { corrigerVoix } from './correction';

interface Demande {
  pcm: Float32Array;
  frequence: number;
  force: number;
  tonalite: { tonique: Tonique; mode: Mode };
}

const portee = self as unknown as { postMessage(m: unknown, transfert?: Transferable[]): void };

self.onmessage = (e: MessageEvent<Demande>) => {
  const { pcm, frequence, force, tonalite } = e.data;
  try {
    const t0 = performance.now();
    const r = corrigerVoix(pcm, frequence, force, tonalite);
    portee.postMessage({ pcm: r.pcm, voisees: r.voisees, applique: r.applique, ms: performance.now() - t0 }, [r.pcm.buffer as ArrayBuffer]);
  } catch (erreur) {
    portee.postMessage({ erreur: String(erreur) });
  }
};
