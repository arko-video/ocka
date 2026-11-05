// Capture : branche une entrée audio (le micro) sur le worklet « capteur » et reçoit ses messages.
// Le worklet est chargé par une URL que Vite fabrique (« ?worker&url ») : elle marche en dev et après le build.
import urlCapteur from './capteur.worklet.ts?worker&url';

/** Un morceau de son reçu : `debut` = n° d'échantillon (horloge du contexte) du 1er échantillon. */
export interface MorceauCapture {
  debut: number;
  pcm: Float32Array;
}

const charges = new WeakMap<BaseAudioContext, Promise<void>>();

/** Charge le worklet une seule fois par contexte. */
export function chargerCapteur(ctx: BaseAudioContext): Promise<void> {
  let charge = charges.get(ctx);
  if (!charge) {
    charge = ctx.audioWorklet.addModule(urlCapteur);
    charges.set(ctx, charge);
    charge.catch(() => charges.delete(ctx));
  }
  return charge;
}

export class Capture {
  /** Niveau du micro de 0 à 1 (crête des 20 dernières millisecondes). */
  niveau = 0;
  /** Appelé pour chaque morceau de son pendant l'enregistrement. */
  surMorceau: ((m: MorceauCapture) => void) | null = null;
  private noeud: AudioWorkletNode;
  private quandDebut: ((frame: number) => void) | null = null;
  private quandFin: ((total: number) => void) | null = null;

  private constructor(
    readonly ctx: AudioContext,
    private entree: AudioNode,
  ) {
    // Aucune sortie : Chrome fait quand même tourner le worklet (il « tire » les nœuds sans sortie).
    this.noeud = new AudioWorkletNode(ctx, 'ocka-capteur', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' });
    this.noeud.port.onmessage = (e: MessageEvent) => this.recevoir(e.data);
    entree.connect(this.noeud);
  }

  static async creer(ctx: AudioContext, entree: AudioNode): Promise<Capture> {
    await chargerCapteur(ctx);
    return new Capture(ctx, entree);
  }

  /** Commence à enregistrer ; renvoie le n° d'échantillon du 1er échantillon enregistré. */
  demarrer(): Promise<number> {
    return new Promise((ok) => {
      this.quandDebut = ok;
      this.noeud.port.postMessage('demarrer');
    });
  }

  /** Arrête ; renvoie le nombre total d'échantillons envoyés (tous les morceaux sont déjà arrivés). */
  arreter(): Promise<number> {
    return new Promise((ok) => {
      this.quandFin = ok;
      this.noeud.port.postMessage('arreter');
    });
  }

  fermer(): void {
    this.noeud.port.postMessage('fermer');
    try {
      this.entree.disconnect(this.noeud);
    } catch {
      // déjà débranché
    }
    this.noeud.port.onmessage = null;
  }

  private recevoir(m: { type: string; valeur?: number; frame?: number; debut?: number; pcm?: Float32Array; total?: number }): void {
    if (m.type === 'niveau') this.niveau = m.valeur ?? 0;
    else if (m.type === 'debut') this.quandDebut?.(m.frame ?? 0);
    else if (m.type === 'morceau' && m.pcm) this.surMorceau?.({ debut: m.debut ?? 0, pcm: m.pcm });
    else if (m.type === 'fin') {
      // Les messages arrivent dans l'ordre : tous les morceaux sont passés avant « fin ».
      const fin = this.quandFin;
      this.quandFin = null;
      fin?.(m.total ?? 0);
    }
  }
}
