// Sonie selon l'UIT-R BS.1770-4 / EBU R128 (LUFS intégré), calculée EN FLUX (bloc par bloc).
//  1. Filtre K = « plateau » vers les aigus (+4 dB) puis passe-haut vers 38 Hz. Ses coefficients sont
//     recalculés pour la fréquence réelle à partir du prototype analogique (transformée bilinéaire),
//     comme libebur128 : à 48 kHz on retrouve exactement les coefficients de la norme.
//  2. Énergie moyenne par blocs de 400 ms qui se chevauchent à 75 % (un nouveau bloc toutes les 100 ms).
//  3. Seuil absolu −70 LUFS, puis seuil relatif −10 LU sous la moyenne des blocs restants.

export interface Biquad {
  b0: number; b1: number; b2: number; a1: number; a2: number;
}

/** Les 2 étages du filtre K pour une fréquence d'échantillonnage donnée. */
export function filtreK(frequence: number): [Biquad, Biquad] {
  // Étage 1 : plateau dans les aigus (prototype analogique : f0, gain G en dB, facteur Q).
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / frequence);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const plateau: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Étage 2 : passe-haut (RLB).
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / frequence);
  a0 = 1 + K / Q + K * K;
  const passeHaut: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [plateau, passeHaut];
}

/** Poids des canaux (G) : 1 pour gauche, droite et centre (pas de surround dans OCKA). */
const POIDS = 1;

/** Mesure de sonie en flux : on donne les échantillons bloc par bloc, puis on lit le résultat. */
export class MesureSonie {
  private etages: [Biquad, Biquad];
  /** Mémoire des filtres : [x1, x2, y1, y2] par étage et par canal. */
  private memoires: Float64Array[];
  private parSousBloc: number;
  private compte = 0;
  private energie: Float64Array;
  /** Énergie moyenne (somme des canaux) de chaque sous-bloc de 100 ms. */
  readonly sousBlocs: number[] = [];

  constructor(frequence: number, private canaux: number) {
    this.etages = filtreK(frequence);
    this.memoires = Array.from({ length: canaux }, () => new Float64Array(8));
    this.parSousBloc = Math.round(frequence / 10);
    this.energie = new Float64Array(canaux);
  }

  /** Ajoute `n` trames (à partir de `debut`) de chaque canal. */
  ajouter(donnees: Float32Array[], debut = 0, n = donnees[0]!.length - debut): void {
    const [e1, e2] = this.etages;
    let i = debut;
    const fin = debut + n;
    while (i < fin) {
      const bout = Math.min(fin, i + (this.parSousBloc - this.compte));
      for (let c = 0; c < this.canaux; c++) {
        const x = donnees[c] ?? donnees[0]!;
        const m = this.memoires[c]!;
        let [ax1, ax2, ay1, ay2, bx1, bx2, by1, by2] = m as unknown as number[];
        let e = 0;
        for (let k = i; k < bout; k++) {
          const v = x[k]!;
          const y1 = e1.b0 * v + e1.b1 * ax1! + e1.b2 * ax2! - e1.a1 * ay1! - e1.a2 * ay2!;
          ax2 = ax1; ax1 = v; ay2 = ay1; ay1 = y1;
          const y2 = e2.b0 * y1 + e2.b1 * bx1! + e2.b2 * bx2! - e2.a1 * by1! - e2.a2 * by2!;
          bx2 = bx1; bx1 = y1; by2 = by1; by1 = y2;
          e += y2 * y2;
        }
        m.set([ax1!, ax2!, ay1!, ay2!, bx1!, bx2!, by1!, by2!]);
        this.energie[c]! += e;
      }
      this.compte += bout - i;
      i = bout;
      if (this.compte === this.parSousBloc) {
        let s = 0;
        for (let c = 0; c < this.canaux; c++) s += (POIDS * this.energie[c]!) / this.parSousBloc;
        this.sousBlocs.push(s);
        this.energie.fill(0);
        this.compte = 0;
      }
    }
  }

  /** Énergies des blocs de 400 ms (4 sous-blocs de 100 ms, un nouveau bloc toutes les 100 ms). */
  blocs(): number[] {
    const b: number[] = [];
    for (let j = 0; j + 4 <= this.sousBlocs.length; j++) {
      b.push((this.sousBlocs[j]! + this.sousBlocs[j + 1]! + this.sousBlocs[j + 2]! + this.sousBlocs[j + 3]!) / 4);
    }
    return b;
  }

  /** Sonie intégrée en LUFS (−Infinity si tout est sous le seuil absolu). */
  integree(): number {
    return sonieIntegree(this.blocs());
  }
}

/** Sonie (LUFS) d'une énergie de bloc. */
export function lufsDe(energie: number): number {
  return -0.691 + 10 * Math.log10(energie);
}

/** Double seuil de la norme : −70 LUFS, puis −10 LU sous la moyenne des blocs gardés. */
export function sonieIntegree(blocs: number[]): number {
  const absolus = blocs.filter((e) => e > 0 && lufsDe(e) > -70);
  if (absolus.length === 0) return -Infinity;
  const moyenne = absolus.reduce((a, e) => a + e, 0) / absolus.length;
  const seuilRelatif = lufsDe(moyenne) - 10;
  const gardes = absolus.filter((e) => lufsDe(e) > seuilRelatif);
  if (gardes.length === 0) return -Infinity;
  return lufsDe(gardes.reduce((a, e) => a + e, 0) / gardes.length);
}

/** Raccourci : sonie intégrée de canaux entiers. */
export function mesurerSonie(canaux: Float32Array[], frequence: number): number {
  const m = new MesureSonie(frequence, canaux.length);
  m.ajouter(canaux);
  return m.integree();
}
