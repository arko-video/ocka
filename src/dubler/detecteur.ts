// Détecteur de la voix en direct (le cœur du worklet, testé tel quel par Vitest) : décimation à 16 kHz, porte de
// bruit, YIN (grave ≈ 45 ms, aigu ≈ 20 ms), hystérésis, calage, mode accords ; il écrit lui-même les signaux de
// contrôle de la voix d'instrument (gain = enveloppe, hauteur de chaque voix en cents MIDI, courbure des échantillons).
// Fichier pur, importé par le worklet (pas de fonction nommée en majuscule : voir vite.config.ts, Prefresh).

import type { ModeDetection, TypeAccordChante } from './api-dubler';
import { caler, intervallesChantes } from './calage';
import { PorteBruit, Stabilisateur } from './stabilite';
import { FS_DETECTION, MODES_YIN, YinDirect } from './yin-direct';

export const VOIX_MAX = 4;
const TAILLE = 1024; // tampon circulaire à 16 kHz (puissance de 2 ≥ 713 + un pas)
const RMS_N = 160; // 10 ms à 16 kHz

export interface ReglagesDetecteur {
  mode: ModeDetection;
  /** Classes de la gamme (calage « gamme ») ou null (chromatique). */
  calage: number[] | null;
  /** Gamme du morceau (accords). */
  gamme: number[];
  /** Glissé (ms) : 0 = notes calées ; > 0 = la hauteur suit la voix, lissée. */
  glisse: number;
  accords: TypeAccordChante | null;
  suivreVolume: boolean;
  /** Décroissance (s) des sons frappés (piano, pluck, cloche) ; 0 = son tenu. */
  decroissance: number;
}

/** Une note jouée (ou un silence) : heures en n° d'échantillon de l'horloge du contexte (comme currentFrame). */
export interface EvenementNote {
  midi: number | null;
  jouees: number[];
  /** Début estimé de la note chantée, et moment où elle a été détectée. */
  debut: number;
  detecte: number;
  vel: number;
}

export interface SortiesControle {
  gain: Float32Array;
  voix: Float32Array[];
  courbure: Float32Array;
}

export class DetecteurVoix {
  evenements: EvenementNote[] = [];
  /** Hauteur chantée (cents MIDI, NaN = rien), niveau (0 à 1), notes jouées. */
  cents = Number.NaN;
  niveau = 0;
  jouees: number[] = [];
  /** Tests : chaque trame analysée (heure du centre en s depuis le début, hauteur en cents MIDI ou NaN). */
  journal: { t: number; cents: number }[] | null = null;
  private yin!: YinDirect;
  private pasYin = 96;
  private porte = new PorteBruit();
  private stab: Stabilisateur;
  private tampon = new Float32Array(TAILLE);
  private n16 = 0;
  private prochainYin = 0;
  private ratio: number;
  private prochain16 = 0;
  private nEntree = 0;
  private avant = 0;
  private filtres: Float64Array[] = [];
  private coefs: number[][] = [];
  private carres = new Float32Array(RMS_N);
  private sommeCarres = 0;
  private origine: number | null = null;
  private db = -120;
  // Signaux de contrôle (valeurs en fin du bloc précédent).
  private g = 0;
  private lisse = Number.NaN;
  private hauteurs = new Float64Array(VOIX_MAX);
  private tNote = 0;
  private dernierSilence = 0;

  constructor(
    readonly fs: number,
    public reglages: ReglagesDetecteur,
  ) {
    this.ratio = fs / FS_DETECTION;
    this.stab = new Stabilisateur((c) => caler(c, this.reglages.calage));
    this.regler(reglages);
    // Anti-repliement : passe-bas de Butterworth d'ordre 4 à 6,5 kHz (deux biquads), si on décime vraiment.
    if (this.ratio > 1.01) {
      for (const q of [0.5412, 1.3066]) {
        const w = (2 * Math.PI * 6500) / fs;
        const a = Math.sin(w) / (2 * q);
        const c = Math.cos(w);
        const a0 = 1 + a;
        this.coefs.push([(1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, (-2 * c) / a0, (1 - a) / a0]);
        this.filtres.push(new Float64Array(4));
      }
    }
  }

  regler(r: Partial<ReglagesDetecteur>): void {
    const avant = this.reglages.mode;
    this.reglages = { ...this.reglages, ...r };
    if (!this.yin || this.reglages.mode !== avant) {
      const m = MODES_YIN[this.reglages.mode];
      this.yin = new YinDirect(m.fenetre, m.tauMax);
      this.pasYin = m.pas;
    }
    // Calage, accords : la note en cours est recalculée tout de suite.
    if (this.stab.note !== null) {
      this.stab.recaler(Number.isNaN(this.cents) ? this.stab.note * 100 : this.cents);
      this.majJouees();
    }
  }

  /** Traite un bloc d'entrée (`frame0` = currentFrame de son 1er échantillon) et écrit les sorties de contrôle. */
  traiter(x: Float32Array, frame0: number, sorties?: SortiesControle): void {
    if (this.origine === null) this.origine = frame0;
    for (let i = 0; i < x.length; i++) {
      let y = x[i]!;
      for (let k = 0; k < this.filtres.length; k++) {
        const z = this.filtres[k]!;
        const c = this.coefs[k]!;
        const v = c[0]! * y + c[1]! * z[0]! + c[2]! * z[1]! - c[3]! * z[2]! - c[4]! * z[3]!;
        z[1] = z[0]!;
        z[0] = y;
        z[3] = z[2]!;
        z[2] = v;
        y = v;
      }
      const n = this.nEntree++;
      while (this.prochain16 <= n) {
        const frac = this.prochain16 - (n - 1);
        this.pousser16(this.avant + (y - this.avant) * Math.min(1, Math.max(0, frac)), frame0 + i);
        this.prochain16 += this.ratio;
      }
      this.avant = y;
    }
    if (sorties) this.ecrireSorties(sorties, x.length);
  }

  private pousser16(v: number, frame: number): void {
    const i = this.n16 & (TAILLE - 1);
    this.tampon[i] = v;
    const r = this.n16 % RMS_N;
    this.sommeCarres += v * v - this.carres[r]!;
    this.carres[r] = v * v;
    this.n16++;
    if (this.n16 % 16 === 0) {
      // Porte de bruit toutes les millisecondes.
      this.db = 10 * Math.log10(Math.max(1e-12, this.sommeCarres / RMS_N));
      this.niveau = Math.min(1, Math.max(0, (this.db + 50) / 38));
      const t = this.n16 / FS_DETECTION;
      if (this.porte.pousser(this.db, t) && !this.porte.ouverte)
        this.changer(this.stab.pousser(t, Number.NaN, false), frame);
    }
    const L = this.yin.longueur;
    if (this.n16 >= L && this.n16 >= this.prochainYin) {
      this.prochainYin = this.n16 + this.pasYin;
      const t0 = this.n16 - L;
      const tCentre = (t0 + L / 2) / FS_DETECTION;
      const f = this.porte.ouverte ? this.yin.trame(this.tampon, t0, TAILLE - 1) : 0;
      this.cents = f > 0 ? 6900 + 1200 * Math.log2(f / 440) : Number.NaN;
      this.journal?.push({ t: tCentre, cents: this.porte.ouverte ? this.cents : Number.NaN });
      if (this.porte.ouverte) this.changer(this.stab.pousser(tCentre, this.cents, true), frame);
    }
  }

  private changer(c: { note: number | null; debut: number } | null, frame: number): void {
    if (!c) return;
    let debut = c.debut;
    if (c.note === null && !this.porte.ouverte) debut = this.porte.fermeeA;
    // Après un silence : si la porte vient de s'ouvrir, la note commence avec elle.
    else if (c.note !== null && this.jouees.length === 0 && this.porte.ouverteA >= this.dernierSilence)
      debut = Math.min(debut, this.porte.ouverteA - 0.005);
    if (c.note === null) this.dernierSilence = debut;
    this.tNote = this.n16 / FS_DETECTION;
    this.majJouees();
    this.evenements.push({
      midi: c.note,
      jouees: [...this.jouees],
      debut: Math.round(this.origine! + debut * this.fs),
      detecte: frame,
      vel: Math.round((0.35 + 0.65 * this.niveau) * 100) / 100,
    });
  }

  private majJouees(): void {
    const n = this.stab.note;
    if (n === null) this.jouees = [];
    else if (!this.reglages.accords) this.jouees = [n];
    else {
      const a = intervallesChantes(n, this.reglages.gamme, this.reglages.accords);
      this.jouees = a.intervalles.map((x) => a.racine + x);
    }
  }

  /** Note jouée (MIDI après calage) ou null. */
  get note(): number | null {
    return this.stab.note;
  }

  /** Écart de la voix à la note jouée (cents, −50 à 50). */
  get ecart(): number {
    const n = this.stab.note;
    if (n === null || Number.isNaN(this.cents)) return 0;
    return Math.max(-50, Math.min(50, this.cents - n * 100));
  }

  private ecrireSorties(s: SortiesControle, n: number): void {
    const dt = n / this.fs;
    const r = this.reglages;
    const t = this.n16 / FS_DETECTION;
    const note = this.stab.note;
    let cible = this.porte.ouverte && note !== null ? (r.suivreVolume ? 0.25 + 0.75 * this.niveau : 0.8) : 0;
    if (r.decroissance > 0 && cible > 0) cible *= Math.exp(-(t - this.tNote) / r.decroissance);
    const tau = cible > this.g ? 0.004 : 0.06;
    const g0 = this.g;
    this.g = cible + (this.g - cible) * Math.exp(-dt / tau);
    // Glissé : la hauteur suit la voix (lissée), sans calage ; sinon elle saute sur la note calée.
    if (!Number.isNaN(this.cents)) {
      const k = r.glisse > 0 ? 1 - Math.exp(-dt / Math.max(0.005, r.glisse / 4000)) : 1;
      this.lisse = Number.isNaN(this.lisse) ? this.cents : this.lisse + (this.cents - this.lisse) * k;
    }
    const courbure =
      r.glisse > 0 && note !== null && !Number.isNaN(this.lisse)
        ? Math.max(-200, Math.min(200, this.lisse - note * 100))
        : 0;
    for (let i = 0; i < n; i++) {
      s.gain[i] = g0 + ((this.g - g0) * (i + 1)) / n;
      s.courbure[i] = courbure;
    }
    for (let v = 0; v < s.voix.length && v < VOIX_MAX; v++) {
      const sortie = s.voix[v]!;
      const midi = this.jouees[v] ?? this.jouees[0];
      const h0 = this.hauteurs[v]!;
      const h1 = midi === undefined ? h0 : midi * 100 + courbure;
      this.hauteurs[v] = h1;
      for (let i = 0; i < n; i++) sortie[i] = h0 === 0 ? h1 : h0 + ((h1 - h0) * (i + 1)) / n;
    }
  }
}
