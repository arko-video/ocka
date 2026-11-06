// Worklet des inserts JS d'UNE piste (écoute seulement ; jamais hors ligne : voir master-hors-ligne.ts) :
// « ocka-inserts » = compresseur et bitcrusher de la piste, dans l'ordre (dsp.ts, le MÊME calcul que l'export).
// Entrée et sortie stéréo explicites (une entrée mono est recopiée à gauche et à droite).
// Paramètres k-rate : origineHaut et origineBas = trame du contexte où tombe le temps 0 du morceau
// (origineHaut × 4096 + origineBas, exacts en Float32) : la tenue du bitcrusher est calée sur le morceau.
// Options : processorOptions { inserts: ReglageJs[] }. Le message « fin » arrête le processeur.
// Chargé comme fichier du build (« ?worker&url ») : compatible avec la CSP stricte.

import { ChaineJs, NOM_INSERTS, type ReglageJs } from './dsp.worklet';

declare const sampleRate: number;
declare const currentFrame: number;
declare function registerProcessor(nom: string, classe: unknown): void;
declare class AudioWorkletProcessor {
  readonly port?: MessagePort;
}

class Inserts extends AudioWorkletProcessor {
  private chaine: ChaineJs;
  private fini = false;

  static get parameterDescriptors() {
    return [
      { name: 'origineHaut', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'origineBas', defaultValue: 0, automationRate: 'k-rate' },
    ];
  }

  constructor(options: { processorOptions?: { inserts?: ReglageJs[] } }) {
    super();
    this.chaine = new ChaineJs(sampleRate, options.processorOptions?.inserts ?? []);
    if (this.port) this.port.onmessage = (e: MessageEvent) => void (e.data === 'fin' && (this.fini = true));
  }

  process(entrees: Float32Array[][], sorties: Float32Array[][], params: Record<string, Float32Array>): boolean {
    if (this.fini) return false;
    const e = entrees[0] ?? [];
    const s = sorties[0] ?? [];
    const g = s[0];
    const d = s[1];
    if (!g || !d) return true;
    const n = g.length;
    if (e.length > 0) {
      g.set(e[0]!);
      d.set(e[1] ?? e[0]!);
    } else {
      g.fill(0);
      d.fill(0);
    }
    const origine = (params.origineHaut?.[0] ?? 0) * 4096 + (params.origineBas?.[0] ?? 0);
    this.chaine.traiter(g, d, n, currentFrame - origine);
    return true;
  }
}

registerProcessor(NOM_INSERTS, Inserts);
