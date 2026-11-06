// FFT complexe radix 2 (sur place), aller et retour, pour le nettoyeur de voix (STFT). Fichier pur (Worker et tests).

export class FftVoix {
  readonly re: Float64Array;
  readonly im: Float64Array;
  private cos: Float64Array;
  private sin: Float64Array;
  private inv: Uint32Array;

  constructor(readonly n: number) {
    if (n < 2 || (n & (n - 1)) !== 0) throw new Error('taille de FFT : une puissance de 2');
    this.re = new Float64Array(n);
    this.im = new Float64Array(n);
    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
    this.inv = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.inv[i] = r;
    }
  }

  /** Transformée sur place de (re, im) ; `retour` = inverse (divisée par n). */
  transformer(retour: boolean): void {
    const { n, re, im, inv } = this;
    for (let i = 0; i < n; i++) {
      const j = inv[i]!;
      if (j > i) {
        let t = re[i]!;
        re[i] = re[j]!;
        re[j] = t;
        t = im[i]!;
        im[i] = im[j]!;
        im[j] = t;
      }
    }
    const signe = retour ? 1 : -1;
    for (let taille = 2; taille <= n; taille <<= 1) {
      const moitie = taille >> 1;
      const pas = n / taille;
      for (let debut = 0; debut < n; debut += taille) {
        for (let k = 0; k < moitie; k++) {
          const c = this.cos[k * pas]!;
          const s = signe * this.sin[k * pas]!;
          const a = debut + k;
          const b = a + moitie;
          const tr = re[b]! * c - im[b]! * s;
          const ti = re[b]! * s + im[b]! * c;
          re[b] = re[a]! - tr;
          im[b] = im[a]! - ti;
          re[a]! += tr;
          im[a]! += ti;
        }
      }
    }
    if (retour) for (let i = 0; i < n; i++) (re[i]! /= n), (im[i]! /= n);
  }
}
