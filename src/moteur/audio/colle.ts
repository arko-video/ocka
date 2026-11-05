// La « colle » du master (chaîne 2) : un compresseur de bus doux, en JS, qui tourne DANS le worklet du master.
// Pas de DynamicsCompressorNode : il ajoute un gain qu'on ne peut pas couper et ~6 ms de retard non compté.
// Réglage fixe : 2:1, attaque 30 ms, relâchement 250 ms, genou doux de 6 dB, au plus 3 dB de réduction.
// Le seuil dépend de la couleur (preset). Aucune anticipation : la colle n'ajoute AUCUN retard.
// Détecteur : passe-haut 100 Hz (4e ordre), puis moyenne quadratique sur 5 ms. Grâce au passe-haut,
// la 808 seule ne fait pas « pomper » le reste (un charley ne baisse pas à chaque note de basse).
// Fichier pur (pas de DOM) : importé par le worklet et par les tests.

import type { Master } from '../../morceau/types';

export const RATIO_COLLE = 2;
export const ATTAQUE_COLLE_S = 0.03;
export const RELACHE_COLLE_S = 0.25;
/** Réduction maximale (dB). */
export const REDUCTION_MAX_DB = 3;
const GENOU_DB = 6;
const MOYENNE_S = 0.005;
const PASSE_HAUT_HZ = 100;

/**
 * Seuil de la colle selon la couleur (dB, niveau efficace du détecteur, à l'entrée du master après le pré-gain).
 * Réglés sur des refrains des phases 0 et 1 : environ 1 à 2 dB de réduction dans les passages forts.
 */
export const SEUILS_COLLE: Record<Master['preset'], number> = {
  neutre: -17,
  chaud: -19,
  clair: -16,
  lofi: -21,
};

/** Coefficients d'un passe-haut biquad (formules de R. Bristow-Johnson). */
function passeHaut(fs: number, f0: number, q: number): Float64Array {
  const w = (2 * Math.PI * f0) / fs;
  const alpha = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const a0 = 1 + alpha;
  return Float64Array.of((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - alpha) / a0);
}

export class ColleFlux {
  /** Réduction actuelle (dB, ≥ 0). */
  reduction = 0;
  private seuil = 0;
  private bas = 0;
  private etages: Float64Array[];
  /** Mémoire des 2 étages, par canal : [x1, x2, y1, y2] × 2. */
  private memG = new Float64Array(8);
  private memD = new Float64Array(8);
  private carre = 0;
  private kMoyenne: number;
  private kAttaque: number;
  private kRelache: number;

  constructor(fs: number, seuilDb: number) {
    // Butterworth du 4e ordre = 2 biquads (Q = 0,541 et 1,307).
    this.etages = [passeHaut(fs, PASSE_HAUT_HZ, 0.5411961), passeHaut(fs, PASSE_HAUT_HZ, 1.3065630)];
    this.kMoyenne = 1 - Math.exp(-1 / (MOYENNE_S * fs));
    this.kAttaque = 1 - Math.exp(-1 / (ATTAQUE_COLLE_S * fs));
    this.kRelache = 1 - Math.exp(-1 / (RELACHE_COLLE_S * fs));
    this.reglerSeuil(seuilDb);
  }

  /** Change le seuil (dB). */
  reglerSeuil(seuilDb: number): void {
    this.seuil = seuilDb;
    // Sous ce niveau (moyenne des carrés), aucune réduction : pas besoin de logarithme.
    this.bas = Math.pow(10, (seuilDb - GENOU_DB / 2) / 10);
  }

  private filtrer(x: number, m: Float64Array): number {
    let v = x;
    for (let e = 0; e < 2; e++) {
      const c = this.etages[e]!;
      const o = 4 * e;
      const y = c[0]! * v + c[1]! * m[o]! + c[2]! * m[o + 1]! - c[3]! * m[o + 2]! - c[4]! * m[o + 3]!;
      m[o + 1] = m[o]!;
      m[o] = v;
      m[o + 3] = m[o + 2]!;
      m[o + 2] = y;
      v = y;
    }
    return v;
  }

  /** Réduction voulue (dB) pour un niveau (dB) : 2:1 au-dessus du seuil, genou doux, plafond 3 dB. */
  static reductionPour(niveauDb: number, seuilDb: number): number {
    const exces = niveauDb - seuilDb;
    const pente = 1 - 1 / RATIO_COLLE;
    let r: number;
    if (2 * exces <= -GENOU_DB) r = 0;
    else if (2 * exces < GENOU_DB) r = (pente * (exces + GENOU_DB / 2) ** 2) / (2 * GENOU_DB);
    else r = pente * exces;
    return Math.min(REDUCTION_MAX_DB, r);
  }

  /** Donne une trame (gauche, droite) ; renvoie la réduction à appliquer à CETTE trame (dB, ≥ 0). */
  pousser(g: number, d: number): number {
    const hg = this.filtrer(g, this.memG);
    const hd = this.filtrer(d, this.memD);
    this.carre += ((hg * hg + hd * hd) / 2 - this.carre) * this.kMoyenne;
    const voulue = this.carre <= this.bas ? 0 : ColleFlux.reductionPour(4.342944819 * Math.log(this.carre), this.seuil);
    const r = this.reduction;
    if (voulue > r) this.reduction = r + (voulue - r) * this.kAttaque;
    else if (r > 0) {
      this.reduction = r + (voulue - r) * this.kRelache;
      if (this.reduction < 1e-5) this.reduction = 0; // retour exact à 0 dB
    }
    return this.reduction;
  }
}
