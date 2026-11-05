// Le worklet du master, chargé dans l'AudioContext de l'ÉCOUTE seulement. Hors ligne (export, pistes, A/B), aucun
// worklet : Chrome ne libérerait jamais le contexte ; le même calcul y est fait en JS (master-hors-ligne.ts).
// Le worklet est chargé par une URL que Vite fabrique (« ?worker&url ») : un vrai fichier du site,
// accepté par la CSP (script-src 'self'), en dev comme après le build.

import urlLimiteur from './limiteur.worklet.ts?worker&url';
import { ATTAQUE_MASTER_S, LimiteurFlux, NOM_LIMITEUR } from './limiteur-flux';

/** Seuil du limiteur du master : −1 dBFS (chaîne 1 : crête des échantillons ; chaîne 2 : crête vraie). */
export const SEUIL_MASTER = Math.pow(10, -1 / 20);

/**
 * Retard (en trames) ajouté par le master à cette fréquence. LE MÊME en chaîne 1 et en chaîne 2
 * (l'anticipation du limiteur à crête vraie est raccourcie d'autant : voir master-flux.ts).
 */
export function retardMaster(frequence: number): number {
  return new LimiteurFlux(frequence, SEUIL_MASTER, ATTAQUE_MASTER_S).retard;
}

const charges = new WeakMap<BaseAudioContext, Promise<void>>();

/** Charge les worklets dans un contexte (une seule fois par contexte). */
export function chargerLimiteur(ctx: BaseAudioContext): Promise<void> {
  let p = charges.get(ctx);
  if (!p) {
    p = ctx.audioWorklet.addModule(urlLimiteur);
    charges.set(ctx, p);
    p.catch(() => charges.delete(ctx)); // on pourra réessayer
  }
  return p;
}

/** Réglages de départ du worklet du master. */
export interface DepartMaster {
  chaine: 1 | 2;
  seuilColle: number;
  /** 1 = colle normale, 0 = contournée (A/B). */
  colle: number;
}

/** Crée le nœud du master (stéréo). Sans `depart` : chaîne 1, exactement le limiteur des phases 0 et 1. */
export function creerLimiteur(ctx: BaseAudioContext, seuil = SEUIL_MASTER, depart?: DepartMaster): AudioWorkletNode {
  return new AudioWorkletNode(ctx, NOM_LIMITEUR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    channelCount: 2,
    channelCountMode: 'explicit',
    processorOptions: { seuil, ...depart },
    ...(depart ? { parameterData: { chaine: depart.chaine, seuilColle: depart.seuilColle, colle: depart.colle } } : {}),
  });
}
