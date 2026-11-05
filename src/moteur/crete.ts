// Crête vraie (dBTP, BS.1770 annexe 2) : la plus grande valeur du signal, y compris ENTRE les échantillons.
// On sur-échantillonne × 4 en polyphase, avec un filtre court comme celui de la norme (48 coefficients :
// 12 par phase, sinc fenêtré par Hann) : 3 points calculés entre chaque paire d'échantillons.
// Tout se fait en flux, sans copie du morceau. Pour aller vite, on ne cherche entre deux échantillons
// que s'ils sont assez forts : un pic entre deux échantillons n'est jamais 2 fois plus haut qu'eux (+6 dB).

export const DEMI = 6;

/** Coefficients des 3 points intermédiaires (1/4, 2/4, 3/4) : échantillons i − DEMI + 1 … i + DEMI. */
export const NOYAUX: Float64Array[] = [1, 2, 3].map((p) => {
  const noyau = new Float64Array(2 * DEMI);
  for (let j = -DEMI + 1; j <= DEMI; j++) {
    const x = j - p / 4;
    const sinc = Math.sin(Math.PI * x) / (Math.PI * x);
    const hann = 0.5 + 0.5 * Math.cos((Math.PI * x) / (DEMI + 1));
    noyau[j + DEMI - 1] = sinc * hann;
  }
  return noyau;
});

/** Plus grande valeur absolue des 3 points entre c[i] et c[i+1] (les échantillons hors du signal valent 0). */
export function picEntre(c: Float32Array, i: number): number {
  let max = 0;
  const debut = i - DEMI + 1;
  const dedans = debut >= 0 && i + DEMI < c.length;
  for (const noyau of NOYAUX) {
    let v = 0;
    if (dedans) {
      for (let j = 0; j < 2 * DEMI; j++) v += c[debut + j]! * noyau[j]!;
    } else {
      for (let j = 0; j < 2 * DEMI; j++) {
        const k = debut + j;
        if (k >= 0 && k < c.length) v += c[k]! * noyau[j]!;
      }
    }
    const a = Math.abs(v);
    if (a > max) max = a;
  }
  return max;
}

/** Crête vraie (linéaire) de canaux entiers. */
export function creteVraie(canaux: Float32Array[]): number {
  const m = new CreteVraieFlux(canaux.length);
  m.ajouter(canaux);
  return m.fin();
}

/** dB d'une valeur linéaire (dBFS / dBTP). */
export function enDb(x: number): number {
  return 20 * Math.log10(Math.max(x, 1e-12));
}

/** Mesure de crête vraie en flux : on donne le signal bloc par bloc. */
export class CreteVraieFlux {
  private historiques: Float32Array[];
  crete = 0;

  constructor(private canaux: number) {
    this.historiques = Array.from({ length: canaux }, () => new Float32Array(2 * DEMI));
  }

  /** Ajoute `n` trames de chaque canal (à partir du début des tableaux). */
  ajouter(donnees: Float32Array[], n = donnees[0]!.length): void {
    for (let c = 0; c < this.canaux; c++) {
      const h = this.historiques[c]!;
      const x = donnees[c] ?? donnees[0]!;
      // Tampon de travail : l'historique (2 × DEMI) suivi du nouveau bloc.
      const t = new Float32Array(2 * DEMI + n);
      t.set(h);
      t.set(x.subarray(0, n), 2 * DEMI);
      for (let k = 2 * DEMI; k < t.length; k++) this.crete = Math.max(this.crete, Math.abs(t[k]!));
      // Points entre t[i] et t[i+1] : ceux du bloc précédent sont déjà faits (i < DEMI) ;
      // il faut DEMI échantillons après i, sinon ce sera au prochain bloc (ou à la fin).
      for (let i = DEMI; i + DEMI < t.length; i++) {
        const a = Math.abs(t[i]!);
        const b = Math.abs(t[i + 1]!);
        if (a < 0.5 * this.crete && b < 0.5 * this.crete) continue; // trop faible pour faire un nouveau pic
        const p = picEntre(t, i);
        if (p > this.crete) this.crete = p;
      }
      h.set(t.subarray(t.length - 2 * DEMI));
    }
  }

  /** Termine (les derniers points, avec des zéros après la fin) et renvoie la crête vraie linéaire. */
  fin(): number {
    this.ajouter(this.historiques.map(() => new Float32Array(DEMI)), DEMI);
    return this.crete;
  }
}
