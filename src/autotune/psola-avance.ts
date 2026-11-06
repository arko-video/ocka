// TD-PSOLA de l'autotune avancé, avec des marques EXPLICITES (pour ne recalculer qu'une note) et le décalage des
// formants. Avec formants = 0, le calcul est celui de psola.ts, opération par opération (même son, testé).
//  - marques d'analyse : une par période de la voix, depuis le début de la région ;
//  - marques de synthèse : espacées d'une période / rapport (la nouvelle hauteur) ;
//  - à chaque marque de synthèse, le grain (2 périodes, fenêtre de Hann) de la marque d'analyse la plus proche est
//    ajouté ; la somme est divisée par la somme des fenêtres.
//  - Formants : le grain est lu `α = 2^(formants/12)` fois plus vite (interpolation linéaire) : son enveloppe
//    spectrale est étirée de α, sans changer la hauteur (donnée par l'espacement des marques).
// Fichier pur : Worker et tests.

/** Période (échantillons) et rapport de hauteur (> 1 = plus aigu) au temps `s` (échantillon). */
export interface Courbes {
  periode(s: number): number;
  rapport(s: number): number;
}

const pasSynthese = (c: Courbes, s: number) => Math.max(2, c.periode(s) / Math.max(0.5, Math.min(2, c.rapport(s))));

export function marquesAnalyse(a: number, b: number, c: Courbes): Float64Array {
  const m: number[] = [];
  for (let s = a; s < b; s += Math.max(2, c.periode(s))) m.push(s);
  return Float64Array.from(m);
}

export function marquesSynthese(a: number, b: number, c: Courbes): Float64Array {
  const m: number[] = [];
  for (let s = a; s < b; s += pasSynthese(c, s)) m.push(s);
  return Float64Array.from(m);
}

/**
 * Marques de synthèse de `depart` à `arrivee` (deux marques de l'ancien rendu) avec les nouvelles courbes : la
 * dernière tombe EXACTEMENT sur `arrivee` (l'écart est réparti sur les pas où `souple` vaut le plus, les marges de
 * la zone) ; sans `arrivee` (fin de région), on avance jusqu'à `fin`. Renvoie les marques strictement entre les deux.
 */
export function marquesRaccord(depart: number, arrivee: number | null, fin: number, c: Courbes, souple: (s: number) => number): number[] {
  const pos: number[] = [depart];
  const pas: number[] = [];
  const limite = arrivee ?? fin;
  for (let s = depart; ; ) {
    const d = pasSynthese(c, s);
    if (arrivee === null ? s + d >= fin : s + d > limite) {
      if (arrivee !== null && limite - s > d / 2) {
        pas.push(d);
        pos.push(s + d);
      }
      break;
    }
    pas.push(d);
    s += d;
    pos.push(s);
  }
  if (arrivee === null) return pos.slice(1);
  if (pas.length === 0) return [];
  const ecart = arrivee - pos[pos.length - 1]!;
  const poids = pos.slice(0, -1).map((s) => Math.max(0, souple(s)));
  let total = poids.reduce((x, y) => x + y, 0);
  if (total <= 1e-9) {
    poids.fill(1);
    total = poids.length;
  }
  const out: number[] = [];
  let s = depart;
  for (let k = 0; k < pas.length - 1; k++) {
    s += pas[k]! + (ecart * poids[k]!) / total;
    out.push(s);
  }
  return out;
}

/** Indice de la marque d'analyse la plus proche de `s` (à égalité, la plus tardive, comme psola.ts). */
function plusProche(m: Float64Array, s: number): number {
  let lo = 0;
  let hi = m.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (m[mid]! <= s) lo = mid;
    else hi = mid - 1;
  }
  if (lo + 1 < m.length && Math.abs(m[lo + 1]! - s) <= Math.abs(m[lo]! - s)) return lo + 1;
  return lo;
}

/**
 * Somme des grains sur [t0, t1[ (échantillons absolus), pour les marques de synthèse `syn` (croissantes).
 * Seuls les grains qui touchent [t0, t1[ sont calculés, dans l'ordre des marques : un même échantillon reçoit les
 * mêmes grains dans le même ordre qu'un rendu complet (résultat identique au bit près).
 */
export function superposer(x: Float32Array, ana: Float64Array, syn: ArrayLike<number>, periode: (s: number) => number, alpha: number, t0: number, t1: number): Float32Array {
  const n = t1 - t0;
  const y = new Float32Array(n);
  const w = new Float32Array(n);
  const lMax = Math.ceil(periode(t0)) + Math.ceil(periode(t1 - 1)) + 4096;
  // Première marque utile (les grains font au plus ~2 × 14 ms) : recherche par dichotomie.
  let k0 = 0;
  let hi = syn.length;
  while (k0 < hi) {
    const mid = (k0 + hi) >> 1;
    if (syn[mid]! < t0 - lMax) k0 = mid + 1;
    else hi = mid;
  }
  for (let k = k0; k < syn.length; k++) {
    const s = syn[k]!;
    if (s - lMax > t1) break;
    const ia = plusProche(ana, s);
    const mk = Math.round(ana[ia]!);
    const L = Math.max(2, Math.round(periode(ana[ia]!)));
    const dest = Math.round(s) - t0;
    if (dest + L <= 0 || dest - L >= n) continue;
    for (let j = -L + 1; j < L; j++) {
      const o = dest + j;
      if (o < 0 || o >= n) continue;
      let v: number;
      if (alpha === 1) {
        const src = mk + j;
        if (src < 0 || src >= x.length) continue;
        v = x[src]!;
      } else {
        const p = mk + j * alpha;
        const i = Math.floor(p);
        if (i < 0 || i + 1 >= x.length) continue;
        v = x[i]! + (p - i) * (x[i + 1]! - x[i]!);
      }
      const h = 0.5 + 0.5 * Math.cos((Math.PI * j) / L);
      y[o] = y[o]! + v * h;
      w[o] = w[o]! + h;
    }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = w[i]!;
    out[i] = p > 0.25 ? y[i]! / p : y[i]!;
  }
  return out;
}
