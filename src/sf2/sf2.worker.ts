// Worker d'analyse d'un .sf2 (S) : reçoit { fichier: Blob }, lit la structure par morceaux (jamais tout le fichier),
// répond { analyse } (données pures) ou { erreur, code } (fichier refusé proprement).

import { analyserSf2, lecteurBlob } from './analyse';

const portee = self as unknown as { postMessage(m: unknown): void };

self.onmessage = async (e: MessageEvent<{ fichier: Blob }>) => {
  try {
    const f = e.data.fichier;
    portee.postMessage({ analyse: await analyserSf2(lecteurBlob(f), f.size) });
  } catch (err) {
    const x = err as { message?: string; code?: string };
    portee.postMessage({ erreur: x?.message ?? 'Cette SoundFont est illisible.', code: x?.code ?? 'sf2_illisible' });
  }
};
