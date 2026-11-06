// Attaques du beatbox par FLUX SPECTRAL (en flux continu : le worklet et detecterAttaques utilisent ce même code).
// Trames de ≈ 10,7 ms (512 à 48 kHz, fenêtre de Hann) toutes les ≈ 2,7 ms ; flux = hausse du log-spectre ;
// attaque si le flux dépasse 2 × sa moyenne récente (et un plancher), au-dessus de −50 dBFS, 60 ms après la
// précédente, et si le niveau monte d’au moins 3 dB. Le début est ensuite affiné dans le temps (premier bloc de 32 échantillons qui monte vraiment).
// Fichier pur, importé par le worklet (pas de fonction nommée en majuscule : voir vite.config.ts, Prefresh).

import { Fft } from './fft';

const FLUX_MIN = 0.06;
const FACTEUR = 2;
const HISTOIRE = 16;
const REFRACTAIRE_S = 0.06;
const PLANCHER_DB = -50;
const SOUS_BLOC = 32;
/** Montée du niveau exigée (dB) par rapport au plus bas des 8 trames d’avant (≈ 21 ms). */
const MONTEE_DB = 3;
const MONTEE_TRAMES = 8;

export class DetecteurAttaques {
  /** Attaques trouvées (n° d'échantillon de l'horloge : frame0 du 1er bloc + position), à vider par l'appelant. */
  attaques: number[] = [];
  /** Tests : flux de chaque trame. */
  journal: number[] | null = null;
  private n: number;
  private h: number;
  private fft: Fft;
  private fenetre: Float64Array;
  private trame: Float64Array;
  private p: Float64Array;
  private logAvant: Float64Array;
  private kMax: number;
  private anneau: Float32Array;
  private masque: number;
  private total = 0;
  private prochaine: number;
  private flux: number[] = [];
  private niveaux: number[] = [];
  private derniere = -Infinity;
  private origine: number | null = null;
  private premiere = true;

  constructor(readonly fs: number) {
    this.n = Math.pow(2, Math.round(Math.log2(fs * 0.0107)));
    this.h = this.n / 4;
    this.fft = new Fft(this.n);
    this.fenetre = Float64Array.from(
      { length: this.n },
      (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / this.n),
    );
    this.trame = new Float64Array(this.n);
    this.p = new Float64Array(this.n / 2 + 1);
    this.logAvant = new Float64Array(this.n / 2 + 1);
    this.kMax = Math.min(this.n / 2, Math.floor((16000 / fs) * this.n));
    this.anneau = new Float32Array(this.n * 4);
    this.masque = this.anneau.length - 1;
    this.prochaine = this.n;
  }

  pousser(x: Float32Array, frame0: number): void {
    if (this.origine === null) this.origine = frame0 - this.total;
    for (let i = 0; i < x.length; i++) {
      this.anneau[this.total & this.masque] = x[i]!;
      this.total++;
      if (this.total >= this.prochaine) {
        this.prochaine += this.h;
        this.analyser();
      }
    }
  }

  private analyser(): void {
    const { n, fenetre, trame, p, logAvant } = this;
    const fin = this.total;
    let e = 0;
    for (let i = 0; i < n; i++) {
      const v = this.anneau[(fin - n + i) & this.masque]!;
      e += v * v;
      trame[i] = v * fenetre[i]!;
    }
    const db = 10 * Math.log10(Math.max(1e-12, e / n));
    this.fft.puissance(trame, p);
    let f = 0;
    for (let k = 1; k <= this.kMax; k++) {
      const l = Math.log(1 + (2000 * Math.sqrt(p[k]!)) / n);
      const d = l - logAvant[k]!;
      if (d > 0) f += d;
      logAvant[k] = l;
    }
    f /= this.kMax;
    if (this.premiere) {
      this.premiere = false;
      return;
    }
    this.journal?.push(f);
    const moyenne = this.flux.length ? this.flux.reduce((a, b) => a + b, 0) / this.flux.length : 0;
    this.flux.push(f);
    if (this.flux.length > HISTOIRE) this.flux.shift();
    // Une attaque fait aussi MONTER le niveau (la queue d'un « ts » qui s'éteint a du flux, mais pas de montée).
    const bas = this.niveaux.length ? Math.min(...this.niveaux) : -120;
    this.niveaux.push(db);
    if (this.niveaux.length > MONTEE_TRAMES) this.niveaux.shift();
    if (db < PLANCHER_DB || db - bas < MONTEE_DB || f < Math.max(FLUX_MIN, FACTEUR * moyenne)) return;
    const debut = this.affiner(fin);
    if (debut - this.derniere < REFRACTAIRE_S * this.fs) return;
    this.derniere = debut;
    this.attaques.push(this.origine! + debut);
  }

  /** Début de l'attaque dans la trame qui se termine à `fin` : le 1er sous-bloc à plus du quart du plus fort. */
  private affiner(fin: number): number {
    const nb = this.n / SOUS_BLOC;
    const energies = new Float64Array(nb);
    let max = 0;
    let iMax = 0;
    for (let b = 0; b < nb; b++) {
      let e = 0;
      for (let i = 0; i < SOUS_BLOC; i++) {
        const v = this.anneau[(fin - this.n + b * SOUS_BLOC + i) & this.masque]!;
        e += v * v;
      }
      energies[b] = e;
      if (e > max) {
        max = e;
        iMax = b;
      }
    }
    let iMin = 0;
    for (let b = 1; b <= iMax; b++) if (energies[b]! < energies[iMin]!) iMin = b;
    let b = iMin;
    while (b < iMax && energies[b]! < 0.25 * max) b++;
    return fin - this.n + b * SOUS_BLOC;
  }
}

/** Débuts des attaques d'un signal (échantillons), par flux spectral. Pure. */
export function detecterAttaques(pcm: Float32Array, fs: number): number[] {
  const d = new DetecteurAttaques(fs);
  for (let i = 0; i < pcm.length; i += 128) d.pousser(pcm.subarray(i, Math.min(pcm.length, i + 128)), i);
  return d.attaques;
}
