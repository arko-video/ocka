// Worker de synthèse : calcule les sons d'un morceau (notes, frappes, 808, réverbes, prises et sons importés
// rééchantillonnés) hors du fil principal, juste après charger(). Rien n'est calculé pendant la lecture.
// Message reçu : { id, travail, frequence } ; réponse : { id, canaux, boucle } (tampons transférés) ou { id, erreur }.

import { executer, type Travail } from './travaux';

interface Demande {
  id: number;
  travail: Travail;
  frequence: number;
}

const portee = self as unknown as { postMessage(m: unknown, transfert?: Transferable[]): void };

self.onmessage = (e: MessageEvent<Demande>) => {
  const { id, travail, frequence } = e.data;
  try {
    const r = executer(travail, frequence);
    // Un même tampon ne peut être transféré qu'une fois (nappe : 2 canaux distincts, mais on reste prudent).
    const transfert = [...new Set(r.canaux.map((c) => c.buffer as ArrayBuffer))];
    portee.postMessage({ id, canaux: r.canaux, boucle: r.boucle }, transfert);
  } catch (erreur) {
    portee.postMessage({ id, erreur: String(erreur) });
  }
};
