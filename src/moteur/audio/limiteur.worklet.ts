// Worklet du moteur (chargé une fois par contexte d'ÉCOUTE ; jamais hors ligne, voir master-hors-ligne.ts) :
//  - « ocka-limiteur » : le master (colle en chaîne 2, puis limiteur). Calcul : master-flux.ts, le MÊME que
//    l'export (appliqué en JS après le rendu hors ligne).
//    Paramètres (k-rate) : chaine (1 ou 2), seuilColle (dB), colle (0 à 1, A/B).
//    Options : processorOptions { seuil (linéaire), chaine, seuilColle, colle } = valeurs de départ, appliquées
//    dès la 1re trame (un message arriverait trop tard dans un rendu hors ligne).
//    Le message « fin » (port) arrête le processeur : process() renvoie false.
// Chargé comme fichier du build (« ?worker&url », voir worklet.ts) : compatible avec la CSP stricte.

import { MasterFlux } from './master-flux';
import { NOM_LIMITEUR } from './limiteur-flux';

// Ces noms existent dans le fil audio, mais TypeScript ne les connaît pas : on les déclare (ici seulement).
declare const sampleRate: number;
declare function registerProcessor(nom: string, classe: unknown): void;
declare class AudioWorkletProcessor {
  readonly port?: MessagePort;
}

interface OptionsMaster {
  seuil?: number;
  chaine?: 1 | 2;
  seuilColle?: number;
  colle?: number;
}

class Limiteur extends AudioWorkletProcessor {
  private flux: MasterFlux;
  private fini = false;

  static get parameterDescriptors() {
    return [
      { name: 'chaine', defaultValue: 1, minValue: 1, maxValue: 2, automationRate: 'k-rate' },
      { name: 'seuilColle', defaultValue: -17, minValue: -60, maxValue: 0, automationRate: 'k-rate' },
      { name: 'colle', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor(options: { processorOptions?: OptionsMaster }) {
    super();
    const o = options.processorOptions ?? {};
    this.flux = new MasterFlux(sampleRate, o.seuil ?? 0.891, { chaine: o.chaine ?? 1, seuilColle: o.seuilColle ?? -17, colle: o.colle ?? 1 });
    if (this.port) this.port.onmessage = (e: MessageEvent) => void (e.data === 'fin' && (this.fini = true));
  }

  process(entrees: Float32Array[][], sorties: Float32Array[][], params?: Record<string, Float32Array>): boolean {
    if (this.fini) return false;
    const entree = entrees[0] ?? [];
    const sortie = sorties[0] ?? [];
    if (params) this.flux.regler(params.chaine?.[0] ?? 1, params.seuilColle?.[0] ?? -17, params.colle?.[0] ?? 1);
    this.flux.traiter(entree[0], entree[1], sortie[0], sortie[1], sortie[0]?.length ?? 128);
    return true;
  }
}

registerProcessor(NOM_LIMITEUR, Limiteur);
