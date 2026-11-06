// Lecteur factice pour le banc : il joue un clic net (1 ms) sur chaque noire, dans le contexte commun,
// et donne `ctx` et `heureDe(t)` comme le vrai lecteur devrait le faire (voir api.ts).
import { contexteAudio, type Lecteur } from '../../src/moteur/api';
import type { Morceau } from '../../src/morceau/types';

export class LecteurFactice implements Lecteur {
  readonly ctx: AudioContext = contexteAudio();
  /** Bus de sortie du lecteur (le banc peut s'y brancher pour une boucle interne). */
  readonly sortie: GainNode;
  private morceau: Morceau | null = null;
  private position = 0;
  private depart = 0;
  private sources: AudioBufferSourceNode[] = [];
  private clic: AudioBuffer;
  enLecture = false;
  metronomeActif = false;
  /** Journal des appels (pour vérifier le décompte). */
  journal: string[] = [];

  constructor() {
    this.sortie = this.ctx.createGain();
    this.sortie.connect(this.ctx.destination);
    const n = Math.round(this.ctx.sampleRate * 0.001);
    this.clic = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    this.clic.getChannelData(0).fill(0.8);
  }

  async charger(morceau: Morceau): Promise<void> {
    this.morceau = morceau;
  }
  lire(): void {
    if (!this.morceau) return;
    this.journal.push(`lire@${this.position.toFixed(3)}`);
    this.depart = this.ctx.currentTime + 0.05;
    this.enLecture = true;
    const noire = 60 / this.morceau.tempo;
    for (let k = Math.ceil(this.position / noire - 1e-9); k * noire - this.position < 30; k++) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.clic;
      s.connect(this.sortie);
      s.start(this.heureDe(k * noire));
      this.sources.push(s);
    }
  }
  heureDe(t: number): number {
    return this.depart + (t - this.position);
  }
  pause(): void {
    this.position = this.temps;
    this.enLecture = false;
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // déjà fini
      }
    });
    this.sources = [];
    this.journal.push('pause');
  }
  aller(t: number): void {
    this.journal.push(`aller@${t.toFixed(3)}`);
    this.position = t;
  }
  boucler(section: string | null): void {
    this.journal.push(`boucler@${section}`);
  }
  entendre(): void {}
  entendreNote(): void {}
  readonly latenceSortie = 0;
  readonly notesMuettes = 0;
  comparer(): void {}
  metronome(actif: boolean): void {
    this.metronomeActif = actif;
    this.journal.push(`metronome@${actif}`);
  }
  get temps(): number {
    return this.enLecture ? this.position + (this.ctx.currentTime - this.depart) : this.position;
  }
  get duree(): number {
    return 60;
  }
  get pasCourant(): number {
    return 0;
  }
  surChangement(): () => void {
    return () => {};
  }
  detruire(): void {
    this.pause();
  }
}
