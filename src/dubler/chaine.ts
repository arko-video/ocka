// La chaîne d'écoute du micro : micro sans traitement (enregistrement/micro.ts : pas d'annulation d'écho, de réduction
// de bruit ni de gain automatique), contexte audio COMMUN (même horloge que le lecteur), worklet « ocka-dubler ».
// Le worklet est chargé par une URL que Vite fabrique (« ?worker&url ») : un vrai fichier du site (CSP stricte).

import { contexteAudio } from '../enregistrement/contexte';
import { fermerMicro, ouvrirMicro, type Micro } from '../enregistrement/micro';
import type { ReglagesDetecteur } from './detecteur';
import urlWorklet from './dubler.worklet.ts?worker&url';

const charges = new WeakMap<BaseAudioContext, Promise<void>>();

function chargerWorklet(ctx: BaseAudioContext): Promise<void> {
  let p = charges.get(ctx);
  if (!p) {
    p = ctx.audioWorklet.addModule(urlWorklet);
    charges.set(ctx, p);
    p.catch(() => charges.delete(ctx));
  }
  return p;
}

export interface Chaine {
  ctx: AudioContext;
  micro: Micro;
  noeud: AudioWorkletNode;
  /** Débranche tout, arrête le worklet et coupe le micro (le voyant s'éteint). */
  fermer(): void;
}

/** Sorties du worklet en mode « voix » : gain, 4 hauteurs de voix, courbure. */
export const SORTIES_VOIX = 6;

/** Ouvre le micro et le branche sur le worklet (« voix » avec ses réglages, ou « beatbox »). Geste requis. */
export async function ouvrirChaine(mode: 'voix' | 'beatbox', reglages?: ReglagesDetecteur): Promise<Chaine> {
  const ctx = contexteAudio();
  const micro = await ouvrirMicro();
  try {
    await ctx.resume();
    await chargerWorklet(ctx);
    const source = ctx.createMediaStreamSource(micro.flux);
    const noeud =
      mode === 'voix'
        ? new AudioWorkletNode(ctx, 'ocka-dubler', {
            numberOfInputs: 1,
            numberOfOutputs: SORTIES_VOIX,
            outputChannelCount: new Array<number>(SORTIES_VOIX).fill(1),
            channelCount: 1,
            channelCountMode: 'explicit',
            processorOptions: { mode, reglages },
          })
        : new AudioWorkletNode(ctx, 'ocka-dubler', {
            numberOfInputs: 1,
            numberOfOutputs: 0,
            channelCount: 1,
            channelCountMode: 'explicit',
            processorOptions: { mode },
          });
    source.connect(noeud);
    let ferme = false;
    return {
      ctx,
      micro,
      noeud,
      fermer() {
        if (ferme) return;
        ferme = true;
        noeud.port.postMessage({ type: 'fin' });
        noeud.port.onmessage = null;
        try {
          source.disconnect();
          noeud.disconnect();
        } catch {
          // déjà débranché
        }
        fermerMicro(micro);
      },
    };
  } catch (e) {
    fermerMicro(micro);
    throw e;
  }
}

/** Lecteur de l'interface (ui/lecture.ts, consommé en lecture seule) : chargé au besoin, sans boucle d'imports. */
export async function lecteurOcka() {
  const l = await import('../ui/lecture');
  return { lecteur: l.obtenirLecteur(), pret: l.lecteurPret, reappliquer: l.reappliquerReglages };
}
