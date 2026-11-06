// Nettoyeur et doublage, côté page : calcul dans un Worker (traitement-voix.worker.ts), MIS EN CACHE (mémoire, les
// 4 derniers résultats) par fichier source + réglages. L'écoute d'un réglage (crochet) et « Appliquer » partagent
// le cache : appliquer ce qu'on vient d'écouter ne recalcule rien.

import type { ReglagesDoublage, ReglagesNettoyeur } from './api-voix-avancee';
import { doubler } from './doublage-calcul';
import { nettoyer } from './nettoyeur-calcul';

export type Traitement = { type: 'nettoyer'; reglages: ReglagesNettoyeur } | { type: 'doubler'; reglages: ReglagesDoublage };

/** Temps (ms) du dernier calcul dans le Worker (rapport, QA). */
export const mesuresTraitement = { dernierMs: 0 };

const arrondi = (v: number) => Math.round(Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0)) * 1000) / 1000;

/** Clé stable d'un traitement (réglages arrondis au millième). */
export function cleTraitement(source: string, t: Traitement): string {
  const r = t.reglages as unknown as Record<string, number>;
  const valeurs = Object.keys(r)
    .sort()
    .map((k) => `${k}${arrondi(r[k]!)}`)
    .join('-');
  return `${source}|${t.type}|${valeurs}`;
}

function calculer(pcm: Float32Array, frequence: number, t: Traitement): Promise<Float32Array> {
  if (typeof Worker === 'undefined') return Promise.resolve(t.type === 'nettoyer' ? nettoyer(pcm, frequence, t.reglages) : doubler(pcm, frequence, t.reglages));
  return new Promise((ok, ko) => {
    const w = new Worker(new URL('./traitement-voix.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ pcm?: Float32Array; ms?: number; erreur?: string }>) => {
      w.terminate();
      if (e.data.erreur || !e.data.pcm) return ko(new Error(e.data.erreur ?? 'traitement'));
      mesuresTraitement.dernierMs = Math.round(e.data.ms ?? 0);
      ok(e.data.pcm);
    };
    w.onerror = (e) => (w.terminate(), ko(new Error(e.message)));
    // Une copie part dans le Worker : le PCM d'origine reste à l'appelant.
    const copie = pcm.slice();
    w.postMessage({ type: t.type, pcm: copie, frequence, reglages: t.reglages }, [copie.buffer as ArrayBuffer]);
  });
}

const cache = new Map<string, Promise<Float32Array>>();
const prets = new Set<string>();

/** Le PCM traité (calculé une fois par clé ; un échec n'est pas gardé). */
export function traiter(source: string, pcm: Float32Array, frequence: number, t: Traitement): Promise<Float32Array> {
  const cle = cleTraitement(source, t);
  const deja = cache.get(cle);
  if (deja) {
    cache.delete(cle);
    cache.set(cle, deja); // le plus récent en dernier
    return deja;
  }
  const p = calculer(pcm, frequence, t);
  cache.set(cle, p);
  p.then(
    () => prets.add(cle),
    () => (cache.delete(cle), prets.delete(cle)),
  );
  while (cache.size > 4) {
    const vieux = cache.keys().next().value!;
    cache.delete(vieux);
    prets.delete(vieux);
  }
  return p;
}

/** true si ce traitement est déjà calculé (l'écoute le prend sans attendre). */
export function traitementPret(source: string, t: Traitement): boolean {
  return prets.has(cleTraitement(source, t));
}
