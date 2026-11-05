// Le traitement du worklet du master, trame par trame (pur : pas de DOM, testé dans Node).
//  Chaîne 1 (phases 0 et 1) : limiteur à anticipation sur la crête des ÉCHANTILLONS. Le calcul est EXACTEMENT
//    celui de la phase 1 (mêmes opérations, dans le même ordre) : le son ne change pas d'un bit.
//  Chaîne 2 : colle (compresseur doux, colle.ts), puis limiteur sur la crête VRAIE (entre les échantillons,
//    × 4 comme crete.ts). Le détecteur de crête vraie a besoin de DEMI trames « d'avenir » : son anticipation
//    est raccourcie d'autant, si bien que le RETARD TOTAL EST LE MÊME dans les deux chaînes (retardMaster).
// Passage d'une chaîne à l'autre sans clic : la colle s'ouvre ou se ferme en rampe (30 ms) et le gain du
// limiteur passe de l'un à l'autre en fondu (~46 ms). Les deux limiteurs sont nourris pendant le passage.

import { DEMI, NOYAUX } from '../crete';
import { ColleFlux } from './colle';
import { ATTAQUE_MASTER_S, LimiteurFlux } from './limiteur-flux';

export interface ReglagesFlux {
  /** 1 = phases 0 et 1 ; 2 = colle + crête vraie. */
  chaine: 1 | 2;
  /** Seuil de la colle (dB). */
  seuilColle: number;
  /** Part de la colle (0 = contournée pour l'A/B, 1 = normale). */
  colle: number;
}

const FONDU_LIMITEUR = 2048;
const RAMPE_COLLE_S = 0.03;
const LN10_20 = Math.LN10 / 20;
const HISTO = 16; // historique de la crête vraie (puissance de 2 ≥ 2 × DEMI)
/** Somme des |coefficients| du pire noyau : un point entre les échantillons vaut au plus SOMME × leur maximum. */
const SOMME_NOYAUX = Math.max(...NOYAUX.map((k) => k.reduce((s, c) => s + Math.abs(c), 0)));

export class MasterFlux {
  /** Retard (trames) du son : identique en chaîne 1 et en chaîne 2. */
  readonly retard: number;
  private seuil: number;
  private fs: number;
  private L: number;
  private lim1: LimiteurFlux;
  private lim2: LimiteurFlux | null = null;
  private colle: ColleFlux;
  private lg: Float32Array;
  private ld: Float32Array;
  private pos = 0;
  private hg = new Float32Array(HISTO);
  private hd = new Float32Array(HISTO);
  private hpos = 0;
  private entreAvant = 0;
  /** Trames « assez fortes » (> seuil / SOMME_NOYAUX) parmi les 2 × DEMI dernières : 0 = calcul inutile. */
  private fortes = new Uint8Array(HISTO);
  private nbFortes = 0;
  private borne: number;
  private chaine: 1 | 2;
  /** 0 = gain du limiteur 1, 1 = limiteur 2 ; entre les deux pendant un fondu. */
  private melange: number;
  private cibleMelange: number;
  private attente = 0;
  private part: number;
  private ciblePart: number;
  private pasPart: number;
  private colleDemandee: number;

  constructor(fs: number, seuil: number, r: ReglagesFlux = { chaine: 1, seuilColle: -17, colle: 1 }) {
    this.fs = fs;
    this.seuil = seuil;
    this.lim1 = new LimiteurFlux(fs, seuil, ATTAQUE_MASTER_S);
    this.borne = seuil / SOMME_NOYAUX;
    this.L = this.lim1.retard + 1;
    this.retard = this.lim1.retard;
    this.lg = new Float32Array(this.retard + 1);
    this.ld = new Float32Array(this.retard + 1);
    this.colle = new ColleFlux(fs, r.seuilColle);
    this.chaine = r.chaine;
    this.colleDemandee = r.colle;
    this.melange = this.cibleMelange = r.chaine === 2 ? 1 : 0;
    this.part = this.ciblePart = r.chaine === 2 ? r.colle : 0;
    this.pasPart = 1 / (RAMPE_COLLE_S * fs);
    if (r.chaine === 2) this.lim2 = this.nouveauLim2();
  }

  /** Limiteur à crête vraie : anticipation raccourcie de DEMI trames (même retard total que la chaîne 1). */
  private nouveauLim2(): LimiteurFlux {
    return new LimiteurFlux(this.fs, this.seuil, Math.max(1, this.L - DEMI) / this.fs);
  }

  /** Applique les réglages (à chaque bloc : valeurs des AudioParam). */
  regler(chaine: number, seuilColle: number, colle: number): void {
    const c: 1 | 2 = chaine >= 1.5 ? 2 : 1;
    this.colle.reglerSeuil(seuilColle);
    this.colleDemandee = colle;
    if (c !== this.chaine) {
      this.chaine = c;
      if (c === 2) {
        if (!this.lim2) this.lim2 = this.nouveauLim2();
        this.attente = this.L + DEMI; // le limiteur 2 doit d'abord voir passer une anticipation complète
      } else this.attente = 0;
      this.cibleMelange = c === 2 ? 1 : 0;
    }
    this.ciblePart = this.chaine === 2 ? Math.min(1, Math.max(0, this.colleDemandee)) : 0;
  }

  /** Réduction actuelle de la colle (dB), pour les tests et l'affichage. */
  get reductionColle(): number {
    return this.colle.reduction * this.part;
  }

  /** Crête entre les trames k − DEMI et k − DEMI + 1 d'un canal (historique `h`, trame k à `hpos`). */
  private entre(h: Float32Array): number {
    let max = 0;
    const debut = this.hpos - 2 * DEMI + 1; // trame k − 11
    for (let p = 0; p < NOYAUX.length; p++) {
      const noyau = NOYAUX[p]!;
      let v = 0;
      for (let j = 0; j < 2 * DEMI; j++) v += h[(debut + j) & (HISTO - 1)]! * noyau[j]!;
      const a = v < 0 ? -v : v;
      if (a > max) max = a;
    }
    return max;
  }

  /** Traite `n` trames. Entrées absentes = silence ; droite absente = gauche (comme en phase 1). */
  traiter(eG: Float32Array | undefined, eD: Float32Array | undefined, sG: Float32Array | undefined, sD: Float32Array | undefined, n: number): void {
    const lg = this.lg;
    const ld = this.ld;
    const taille = lg.length;
    for (let i = 0; i < n; i++) {
      let gauche = eG?.[i] ?? 0;
      let droite = eD?.[i] ?? gauche;
      // 1. Colle (chaîne 2, ou pendant qu'elle se ferme).
      if (this.part !== this.ciblePart) {
        this.part = this.part < this.ciblePart ? Math.min(this.ciblePart, this.part + this.pasPart) : Math.max(this.ciblePart, this.part - this.pasPart);
      }
      if (this.chaine === 2 || this.part > 0) {
        const r = this.colle.pousser(gauche, droite) * this.part;
        if (r > 0) {
          const gc = Math.exp(-r * LN10_20);
          gauche *= gc;
          droite *= gc;
        }
      }
      // 2. Limiteur 1 (crête des échantillons), toujours nourri : c'est le calcul de la phase 1.
      const gain1 = this.lim1.pousser(Math.max(Math.abs(gauche), Math.abs(droite)));
      const lecture = (this.pos + 1) % taille; // la trame la plus ancienne de la ligne
      lg[this.pos] = gauche;
      ld[this.pos] = droite;
      // 3. Limiteur 2 (crête vraie de la trame k − DEMI), en chaîne 2 ou pendant un fondu.
      this.hpos = (this.hpos + 1) & (HISTO - 1);
      this.hg[this.hpos] = lg[this.pos]!;
      this.hd[this.hpos] = ld[this.pos]!;
      const forte = Math.abs(lg[this.pos]!) > this.borne || Math.abs(ld[this.pos]!) > this.borne ? 1 : 0;
      this.nbFortes += forte - this.fortes[(this.hpos - 2 * DEMI) & (HISTO - 1)]!;
      this.fortes[this.hpos] = forte;
      let gain = gain1;
      if (this.lim2 && (this.chaine === 2 || this.melange > 0)) {
        // Si les 12 trames sont toutes sous seuil / SOMME_NOYAUX, aucun point entre elles n'atteint le seuil :
        // le limiteur ne réagirait pas, on saute le calcul (même résultat, bien moins cher).
        const entre = this.nbFortes > 0 ? Math.max(this.entre(this.hg), this.entre(this.hd)) : 0;
        const p = (this.hpos - DEMI) & (HISTO - 1);
        const crete = Math.max(Math.abs(this.hg[p]!), Math.abs(this.hd[p]!), entre, this.entreAvant);
        this.entreAvant = entre;
        const gain2 = this.lim2.pousser(crete);
        if (this.attente > 0) this.attente--;
        else if (this.melange !== this.cibleMelange) {
          this.melange = this.cibleMelange > this.melange ? Math.min(1, this.melange + 1 / FONDU_LIMITEUR) : Math.max(0, this.melange - 1 / FONDU_LIMITEUR);
        }
        if (this.melange === 1) gain = gain2;
        else if (this.melange > 0) gain = gain1 + (gain2 - gain1) * this.melange;
        if (this.melange === 0 && this.chaine === 1) this.lim2 = null; // fondu fini : plus de calcul
      }
      if (sG) sG[i] = lg[lecture]! * gain;
      if (sD) sD[i] = ld[lecture]! * gain;
      this.pos = lecture;
    }
  }
}
