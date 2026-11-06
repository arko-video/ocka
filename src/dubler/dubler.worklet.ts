// Worklet « ocka-dubler » (fil audio, contexte commun d'OCKA) — deux usages :
// - « voix » : le détecteur (detecteur.ts) écoute le micro et PILOTE LUI-MÊME la voix d'instrument par ses sorties
//   de contrôle, branchées sur des AudioParam : sortie 0 = gain (enveloppe), sorties 1 à 4 = hauteur de chaque voix
//   (cents MIDI, sur le `detune` d'oscillateurs réglés sur le MIDI 0), sortie 5 = courbure (cents, `detune` des
//   échantillons, glissé). Messages : {type:'note', …EvenementNote}, {type:'etat', midi, cents, ecart, niveau, jouees}.
// - « beatbox » : flux spectral (attaques.ts) ; à chaque attaque, 40 ms de son (plus 64 échantillons avant) partent
//   vers le fil principal : {type:'attaque', pcm, debut, frame, crete}. Et {type:'niveau', valeur} pour le vumètre.
// Messages reçus : {type:'reglages', reglages}, {type:'fin'}.

import { DetecteurAttaques } from './attaques';
import { DetecteurVoix, VOIX_MAX, type ReglagesDetecteur } from './detecteur';

declare const currentFrame: number;
declare const sampleRate: number;
declare function registerProcessor(nom: string, classe: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

interface Options {
  mode: 'voix' | 'beatbox';
  reglages?: ReglagesDetecteur;
}

const AVANT = 64;

class ProcesseurDubler extends AudioWorkletProcessor {
  private fini = false;
  private voix: DetecteurVoix | null = null;
  private attaques: DetecteurAttaques | null = null;
  private silence = new Float32Array(128);
  private blocs = 0;
  private crete = 0;
  // Beatbox : les 250 dernières ms, et les attaques qui attendent leurs 40 ms.
  private anneau = new Float32Array(16384);
  private ecrits = 0;
  private enAttente: number[] = [];
  private longueur = Math.round(0.04 * sampleRate);

  constructor(options: { processorOptions?: Options }) {
    super();
    const o = options.processorOptions;
    if (o?.mode === 'beatbox' || !o?.reglages) this.attaques = new DetecteurAttaques(sampleRate);
    else this.voix = new DetecteurVoix(sampleRate, o.reglages);
    this.port.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; reglages?: Partial<ReglagesDetecteur> };
      if (m.type === 'fin') this.fini = true;
      else if (m.type === 'reglages' && m.reglages) this.voix?.regler(m.reglages);
    };
  }

  process(entrees: Float32Array[][], sorties: Float32Array[][]): boolean {
    if (this.fini) return false;
    const x = entrees[0]?.[0] ?? this.silence;
    this.blocs++;
    if (this.voix) this.traiterVoix(x, sorties);
    else this.traiterBeatbox(x);
    return true;
  }

  private traiterVoix(x: Float32Array, sorties: Float32Array[][]): void {
    const d = this.voix!;
    const n = x.length;
    const canal = (i: number) => sorties[i]?.[0] ?? new Float32Array(n);
    d.traiter(x, currentFrame, {
      gain: canal(0),
      voix: Array.from({ length: VOIX_MAX }, (_, i) => canal(i + 1)),
      courbure: canal(5),
    });
    for (const e of d.evenements) this.port.postMessage({ type: 'note', ...e });
    d.evenements.length = 0;
    // L'état pour la roue des 12 notes : toutes les ≈ 10 ms.
    if (this.blocs % 4 === 0) {
      this.port.postMessage({
        type: 'etat',
        midi: d.note,
        cents: d.cents,
        ecart: d.ecart,
        niveau: d.niveau,
        jouees: d.jouees,
      });
    }
  }

  private traiterBeatbox(x: Float32Array): void {
    const masque = this.anneau.length - 1;
    for (let i = 0; i < x.length; i++) {
      this.anneau[(this.ecrits + i) & masque] = x[i]!;
      this.crete = Math.max(this.crete, Math.abs(x[i]!));
    }
    const debutBloc = currentFrame;
    // L'anneau est daté par currentFrame : l'échantillon k du flux est à l'index (k − origine) & masque.
    const origine = debutBloc - this.ecrits;
    this.ecrits += x.length;
    const a = this.attaques!;
    a.pousser(x, debutBloc);
    this.enAttente.push(...a.attaques);
    a.attaques.length = 0;
    const finBloc = debutBloc + x.length;
    while (this.enAttente.length && this.enAttente[0]! + this.longueur <= finBloc) {
      const frame = this.enAttente.shift()!;
      const pcm = new Float32Array(AVANT + this.longueur);
      let crete = 0;
      for (let i = 0; i < pcm.length; i++) {
        const k = frame - AVANT + i - origine;
        pcm[i] = k >= 0 && k > this.ecrits - this.anneau.length ? this.anneau[k & masque]! : 0;
        crete = Math.max(crete, Math.abs(pcm[i]!));
      }
      this.port.postMessage({ type: 'attaque', pcm, debut: AVANT, frame, crete }, [pcm.buffer]);
    }
    if (this.blocs % 8 === 0) {
      this.port.postMessage({ type: 'niveau', valeur: Math.min(1, this.crete) });
      this.crete = 0;
    }
  }
}

registerProcessor('ocka-dubler', ProcesseurDubler);
export {};
