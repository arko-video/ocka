// Changement de hauteur par TD-PSOLA (sans changer la durée), sur une région voisée d'un signal.
// Marques d'analyse espacées d'une période ; marques de synthèse espacées d'une période / rapport ; à chaque marque
// de synthèse, le grain (2 périodes, fenêtre de Hann) de la marque d'analyse la plus proche est ajouté ; la somme
// est divisée par la somme des fenêtres (volume constant). Fichier pur : Worker et tests.

export interface Courbes {
  /** Période (en échantillons) au temps `s` (échantillon). */
  periode(s: number): number;
  /** Rapport de hauteur (> 1 = plus aigu) au temps `s`. */
  rapport(s: number): number;
}

/** Région [a, b[ de `x` changée de hauteur ; renvoie les b − a échantillons. */
export function psola(x: Float32Array, a: number, b: number, c: Courbes): Float32Array {
  const n = b - a;
  const marge = Math.ceil(c.periode(a)) + Math.ceil(c.periode(b - 1)) + 2;
  const y = new Float32Array(n + 2 * marge);
  const w = new Float32Array(n + 2 * marge);
  // Marques d'analyse : une par période.
  const marques: number[] = [];
  for (let m = a; m < b; m += Math.max(2, c.periode(m))) marques.push(m);
  let k = 0;
  for (let s = a; s < b; s += Math.max(2, c.periode(s) / Math.max(0.5, Math.min(2, c.rapport(s))))) {
    while (k + 1 < marques.length && Math.abs(marques[k + 1]! - s) <= Math.abs(marques[k]! - s)) k++;
    const mk = Math.round(marques[k]!);
    const L = Math.max(2, Math.round(c.periode(marques[k]!)));
    const dest = Math.round(s) - a + marge;
    for (let j = -L + 1; j < L; j++) {
      const src = mk + j;
      const o = dest + j;
      if (src < 0 || src >= x.length || o < 0 || o >= y.length) continue;
      const h = 0.5 + 0.5 * Math.cos((Math.PI * j) / L);
      y[o] = y[o]! + x[src]! * h;
      w[o] = w[o]! + h;
    }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = w[i + marge]!;
    out[i] = p > 0.25 ? y[i + marge]! / p : y[i + marge]!;
  }
  return out;
}
