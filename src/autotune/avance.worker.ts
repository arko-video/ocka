// Worker de l'autotune avancé : UN Worker vivant (il garde ses caches : analyse et dernier rendu de 2 prises).
// Messages reçus : { id, type: 'analyser' | 'rendre', fichier, pcm?, frequence, reglages?, tonalite? }.
// Réponses : { id, progression } en cours, puis { id, analyse } ou { id, rendu } (PCM transféré : une COPIE, le
// Worker garde la sienne pour le prochain recalcul partiel), { id, manque: true } s'il lui faut le PCM, ou { id, erreur }.

import type { AutotunePrise, Morceau } from '../morceau/types';
import { MoteurAvance } from './moteur-avance';

interface Demande {
  id: number;
  type: 'analyser' | 'rendre';
  fichier: string;
  pcm?: Float32Array;
  frequence: number;
  reglages?: AutotunePrise;
  tonalite?: Morceau['tonalite'];
}

const portee = self as unknown as { postMessage(m: unknown, transfert?: Transferable[]): void };
const moteur = new MoteurAvance();

self.onmessage = (e: MessageEvent<Demande>) => {
  const d = e.data;
  const progression = (p: number) => portee.postMessage({ id: d.id, progression: p });
  try {
    if (!d.pcm && !moteur.connait(d.fichier)) return portee.postMessage({ id: d.id, manque: true });
    if (d.type === 'analyser') {
      const t0 = performance.now();
      const analyse = moteur.analyser(d.fichier, d.pcm, d.frequence, progression);
      return portee.postMessage({ id: d.id, analyse, ms: performance.now() - t0 });
    }
    const r = moteur.rendre(d.fichier, d.pcm, d.frequence, d.reglages!, d.tonalite, progression);
    const copie = r.applique ? r.pcm.slice() : new Float32Array(0);
    portee.postMessage({ id: d.id, rendu: { ...r, pcm: copie } }, [copie.buffer as ArrayBuffer]);
  } catch (erreur) {
    portee.postMessage({ id: d.id, erreur: String(erreur) });
  }
};
