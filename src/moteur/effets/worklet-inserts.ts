// Chargement du worklet des inserts JS (écoute seulement : jamais dans un OfflineAudioContext, sauf tests).
// URL fabriquée par Vite (« ?worker&url ») : un vrai fichier du site, accepté par la CSP (script-src 'self').

import url from './inserts.worklet.ts?worker&url';

const charges = new WeakMap<BaseAudioContext, Promise<void>>();
const prets = new WeakSet<BaseAudioContext>();

/** Charge le worklet des inserts dans ce contexte (une fois). */
export function chargerInserts(ctx: BaseAudioContext): Promise<void> {
  let p = charges.get(ctx);
  if (!p) {
    p = ctx.audioWorklet.addModule(url).then(() => void prets.add(ctx));
    charges.set(ctx, p);
    p.catch(() => charges.delete(ctx));
  }
  return p;
}

/** Vrai si le worklet est déjà chargé (sinon la chaîne passe le son tel quel en attendant). */
export const insertsCharges = (ctx: BaseAudioContext): boolean => prets.has(ctx);
