// YIN pour le jeu en direct (copie adaptée de autotune/yin.ts, qui appartient à A1) : une trame à la fois, sur le
// signal ramené à 16 kHz, avec arrêt dès que le creux est trouvé (les voix aiguës coûtent bien moins cher), et
// le repli du papier (le minimum absolu s'il reste assez net) quand rien ne passe sous le seuil.
// Fichier pur, importé par le worklet (pas de fonction nommée en majuscule : voir vite.config.ts, Prefresh).

export const FS_DETECTION = 16000;
const SEUIL = 0.15;
const REPLI = 0.3;
const F_MAX = 1050;

/** Réglages des deux modes (décisions v2 §5) : fenêtre W et τmax à 16 kHz, pas entre deux trames. */
export const MODES_YIN = {
  /** 500 + 213 échantillons ≈ 45 ms ; de 75 à 1 000 Hz. */
  grave: { fenetre: 500, tauMax: 213, pas: 96 },
  /** 200 + 120 échantillons = 20 ms ; de 133 à 1 000 Hz. */
  aigu: { fenetre: 200, tauMax: 120, pas: 48 },
} as const;

export class YinDirect {
  private d: Float64Array;
  constructor(
    readonly fenetre: number,
    readonly tauMax: number,
  ) {
    this.d = new Float64Array(tauMax + 2);
  }

  /** Échantillons nécessaires pour une trame. */
  get longueur(): number {
    return this.fenetre + this.tauMax + 1;
  }

  /**
   * Hauteur (Hz) de la trame `x[t0 … t0 + longueur[`, lue dans un tampon circulaire de taille `n` (puissance de 2,
   * masque n − 1), ou 0 si elle n'est pas voisée.
   */
  trame(x: Float32Array, t0: number, masque: number): number {
    const w = this.fenetre;
    const tauMax = this.tauMax;
    const tauMin = Math.max(2, Math.floor(FS_DETECTION / F_MAX));
    const d = this.d;
    let cumul = 0;
    let trouve = 0;
    let min = Infinity;
    let tauMinAbs = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let j = 0; j < w; j++) {
        const e = x[(t0 + j) & masque]! - x[(t0 + j + tau) & masque]!;
        s += e * e;
      }
      cumul += s;
      const v = cumul > 0 ? (s * tau) / cumul : 1;
      d[tau] = v;
      if (tau < tauMin) continue;
      if (v < min) {
        min = v;
        tauMinAbs = tau;
      }
      if (trouve === 0 && v < SEUIL) trouve = tau;
      // Creux trouvé et on remonte : inutile de calculer plus loin (il faut d[tau + 1] pour l'interpolation).
      if (trouve > 0 && tau > trouve && v > d[tau - 1]!) {
        return this.affiner(tau - 1, tau);
      }
    }
    if (trouve > 0) {
      let tau = trouve;
      while (tau + 1 <= tauMax && d[tau + 1]! < d[tau]!) tau++;
      return this.affiner(tau, tauMax);
    }
    return min < REPLI && tauMinAbs > 0 ? this.affiner(tauMinAbs, tauMax) : 0;
  }

  /** Interpolation parabolique autour du creux `tau` ; `haut` = dernier τ calculé. */
  private affiner(tau: number, haut: number): number {
    const d = this.d;
    let fin = tau;
    if (tau > 1 && tau < haut) {
      const a = d[tau - 1]!;
      const b = d[tau]!;
      const c = d[tau + 1]!;
      const den = a - 2 * b + c;
      if (den > 0) fin = tau + (0.5 * (a - c)) / den;
    }
    const f = FS_DETECTION / fin;
    return f <= F_MAX ? f : 0;
  }
}
