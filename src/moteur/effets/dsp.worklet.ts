// Calcul des inserts « en JS » d'une piste : compresseur et bitcrusher (propriétaire : M2, vague C1).
// Fichier PUR et SANS IMPORT (« .worklet.ts » : ni Prefresh ni dépendance dans le fil audio) : importé par le
// worklet de l'écoute (inserts.worklet.ts) ET par l'export (traiterInsertsJs, sur le rendu, sans worklet).
// Même code, mêmes Float32 en entrée et en sortie : même son. Stéréo, en place, trame par trame : la taille des
// blocs ne change rien. Les réglages arrivent COMPLETS (défauts déjà posés par reglagesJs, dsp.ts).

/** Nom du processeur du worklet des inserts. */
export const NOM_INSERTS = 'ocka-inserts';
export type TypeJs = 'compresseur' | 'bitcrusher';

/** Ce que le worklet reçoit (processorOptions) : les inserts JS actifs, dans l'ordre, réglages complets. */
export interface ReglageJs {
  type: TypeJs;
  params: Record<string, number>;
}

const r = (p: Record<string, number>, c: string, defaut: number) => (typeof p[c] === 'number' && Number.isFinite(p[c]) ? p[c]! : defaut);

const DB = 20 / Math.LN10; // dB = DB × ln(x)
const LN10_20 = Math.LN10 / 20;

/**
 * Gain de rattrapage du compresseur (dB) : la moitié de la réduction qu'aurait un signal à 0 dBFS. Un son fort
 * garde à peu près son niveau, un son faible remonte ; aucun réglage à toucher.
 */
export function rattrapageDb(seuil: number, ratio: number): number {
  return (0.5 * (1 - 1 / ratio) * -seuil);
}

/** Réduction statique (dB, ≤ 0) pour un niveau `x` (dB) : genou doux de largeur `genou` centré sur le seuil. */
export function reductionDb(x: number, seuil: number, ratio: number, genou: number): number {
  const k = 1 / ratio - 1;
  const d = x - seuil;
  if (2 * d < -genou) return 0;
  if (genou > 0 && 2 * Math.abs(d) <= genou) return (k * (d + genou / 2) ** 2) / (2 * genou);
  return k * d;
}

/**
 * Compresseur à détection de crête (stéréo liée), lissage attaque / relâchement dans le domaine des dB,
 * gain de rattrapage compensé, mélange sec / compressé (`mix`). Aucun retard.
 */
export class CompFlux {
  private env = 0;
  private readonly seuil: number;
  private readonly ratio: number;
  private readonly genou: number;
  private readonly mix: number;
  private readonly aA: number;
  private readonly aR: number;
  private readonly rattrapage: number;

  constructor(fs: number, p: Record<string, number>) {
    const v = (c: string) => r(p, c, 0);
    this.seuil = v('seuil');
    this.ratio = v('ratio');
    this.genou = v('genou');
    this.mix = v('mix');
    this.aA = Math.exp(-1 / ((v('attaque') / 1000) * fs));
    this.aR = Math.exp(-1 / ((v('relache') / 1000) * fs));
    this.rattrapage = rattrapageDb(this.seuil, this.ratio);
  }

  traiter(g: Float32Array, d: Float32Array, n: number): void {
    const { seuil, ratio, genou, mix, aA, aR, rattrapage } = this;
    let env = this.env;
    for (let i = 0; i < n; i++) {
      const a = g[i]!;
      const b = d[i]!;
      const x = Math.max(Math.abs(a), Math.abs(b));
      const niveau = x > 1e-6 ? DB * Math.log(x) : -120;
      const red = reductionDb(niveau, seuil, ratio, genou);
      env = red < env ? aA * env + (1 - aA) * red : aR * env + (1 - aR) * red;
      const gain = 1 - mix + mix * Math.exp((env + rattrapage) * LN10_20);
      g[i] = a * gain;
      d[i] = b * gain;
    }
    this.env = env;
  }
}

/**
 * Bitcrusher : quantification sur `bits` bits, puis réduction de fréquence (échantillon tenu `reduction` trames).
 * La tenue est calée sur le TEMPS DU MORCEAU (trame k du morceau : nouvel échantillon si k mod reduction = 0) :
 * après un saut, l'écoute retombe sur les mêmes trames que l'export.
 */
export class BitFlux {
  private tg = 0;
  private td = 0;
  private readonly q: number;
  private readonly r: number;
  private readonly mix: number;

  constructor(p: Record<string, number>) {
    this.q = Math.pow(2, Math.round(r(p, 'bits', 16)) - 1);
    this.r = Math.max(1, Math.round(r(p, 'reduction', 1)));
    this.mix = r(p, 'mix', 1);
  }

  /** `trame` : trame du morceau de g[0] (peut être négative avant le début). */
  traiter(g: Float32Array, d: Float32Array, n: number, trame: number): void {
    const { q, r, mix } = this;
    let phase = ((trame % r) + r) % r;
    for (let i = 0; i < n; i++) {
      const a = g[i]!;
      const b = d[i]!;
      if (phase === 0) {
        this.tg = Math.round(a * q) / q;
        this.td = Math.round(b * q) / q;
      }
      g[i] = a + mix * (this.tg - a);
      d[i] = b + mix * (this.td - b);
      if (++phase === r) phase = 0;
    }
  }
}

/** Les inserts JS d'une piste, dans l'ordre. */
export class ChaineJs {
  private readonly etapes: (CompFlux | BitFlux)[];

  constructor(fs: number, liste: ReglageJs[]) {
    this.etapes = liste.map((x) => (x.type === 'compresseur' ? new CompFlux(fs, x.params) : new BitFlux(x.params)));
  }

  /** Traite n trames EN PLACE ; `trame` = trame du morceau de la 1re. */
  traiter(g: Float32Array, d: Float32Array, n: number, trame: number): void {
    for (const e of this.etapes) {
      if (e instanceof CompFlux) e.traiter(g, d, n);
      else e.traiter(g, d, n, trame);
    }
  }
}

