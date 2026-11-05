// Calculs (purs) du calibrage de latence : chirp, intercorrélation par FFT, médiane avec rejet.

/** Durée du chirp et ses fréquences de départ et d'arrivée. */
export const DUREE_CHIRP = 0.05;
export const F_DEBUT = 1000;
export const F_FIN = 8000;

/**
 * Chirp de 50 ms qui monte de 1 à 8 kHz (balayage linéaire), avec des bords adoucis de 2 ms
 * (pas de « clac » au début et à la fin). Un chirp a une intercorrélation très pointue : le retard est net.
 */
export function fabriquerChirp(frequence: number, amplitude = 0.5): Float32Array {
  const n = Math.round(DUREE_CHIRP * frequence);
  const bord = Math.round(0.002 * frequence);
  const pente = (F_FIN - F_DEBUT) / DUREE_CHIRP;
  const chirp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / frequence;
    const phase = 2 * Math.PI * (F_DEBUT * t + (pente * t * t) / 2);
    const enveloppe = i < bord ? 0.5 - 0.5 * Math.cos((Math.PI * i) / bord) : i >= n - bord ? 0.5 - 0.5 * Math.cos((Math.PI * (n - 1 - i)) / bord) : 1;
    chirp[i] = amplitude * enveloppe * Math.sin(phase);
  }
  return chirp;
}

/** FFT complexe en place (n = puissance de 2). `inverse` = true pour la transformée inverse (divisée par n). */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  // Réordonne les cases (inversion des bits de l'indice).
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  // Papillons.
  for (let taille = 2; taille <= n; taille <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / taille;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let debut = 0; debut < n; debut += taille) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < taille / 2; k++) {
        const a = debut + k;
        const b = a + taille / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) (re[i] = re[i]! / n), (im[i] = im[i]! / n);
}

export interface ResultatCorrelation {
  /** Position du modèle dans le signal (échantillons, avec une fraction grâce à l'interpolation). */
  retard: number;
  /** Ressemblance au meilleur endroit, de 0 (rien à voir) à 1 (identique) : corrélation normalisée. */
  ressemblance: number;
  /** Netteté : hauteur du pic divisée par le niveau moyen de la corrélation (bruit seul ≈ 4 à 5). */
  nettete: number;
}

/**
 * Cherche où le `modele` (le chirp) se trouve dans le `signal` (ce que le micro a entendu).
 * Intercorrélation c[k] = Σ signal[k+t]·modele[t], calculée par FFT (rapide même sur 0,5 s de son).
 * On prend le pic en valeur absolue : certains micros inversent la polarité.
 */
export function intercorreler(signal: Float32Array, modele: Float32Array): ResultatCorrelation {
  const lags = signal.length - modele.length + 1;
  if (lags <= 0) return { retard: 0, ressemblance: 0, nettete: 0 };
  let n = 1;
  while (n < signal.length + modele.length) n <<= 1;
  const sr = new Float64Array(n);
  const si = new Float64Array(n);
  const mr = new Float64Array(n);
  const mi = new Float64Array(n);
  sr.set(signal);
  mr.set(modele);
  fft(sr, si);
  fft(mr, mi);
  // Produit par le conjugué du modèle → corrélation (et non convolution).
  for (let i = 0; i < n; i++) {
    const r = sr[i]! * mr[i]! + si[i]! * mi[i]!;
    const im = si[i]! * mr[i]! - sr[i]! * mi[i]!;
    sr[i] = r;
    si[i] = im;
  }
  fft(sr, si, true);
  let meilleur = 0;
  let somme2 = 0;
  for (let k = 0; k < lags; k++) {
    const a = Math.abs(sr[k]!);
    somme2 += a * a;
    if (a > Math.abs(sr[meilleur]!)) meilleur = k;
  }
  const pic = Math.abs(sr[meilleur]!);
  // Interpolation parabolique autour du pic : précision sous l'échantillon.
  let retard = meilleur;
  if (meilleur > 0 && meilleur < lags - 1) {
    const g = Math.abs(sr[meilleur - 1]!);
    const d = Math.abs(sr[meilleur + 1]!);
    const den = g - 2 * pic + d;
    if (den < 0) retard += (0.5 * (g - d)) / den;
  }
  let energieModele = 0;
  for (const x of modele) energieModele += x * x;
  let energieSignal = 0;
  for (let t = 0; t < modele.length; t++) energieSignal += signal[meilleur + t]! ** 2;
  const ressemblance = pic / Math.sqrt(energieModele * energieSignal + 1e-20);
  const nettete = pic / Math.sqrt(somme2 / lags + 1e-20);
  return { retard, ressemblance, nettete };
}

/** Seuils pour dire que le micro a vraiment entendu le chirp. */
export const RESSEMBLANCE_MIN = 0.2;
export const NETTETE_MIN = 8;

export function signalSuffisant(r: ResultatCorrelation): boolean {
  return r.ressemblance >= RESSEMBLANCE_MIN && r.nettete >= NETTETE_MIN;
}

/**
 * Médiane avec rejet : on cherche le plus grand groupe de mesures dont l'écart (max − min) reste sous
 * `ecartMax` (3 ms). S'il contient au moins `minimum` mesures, on renvoie sa médiane ; sinon null (à refaire).
 */
export function medianeAvecRejet(valeurs: number[], ecartMax = 0.003, minimum = 5): number | null {
  const v = valeurs.filter(Number.isFinite).sort((a, b) => a - b);
  let debut = 0;
  let meilleur: number[] = [];
  for (let fin = 0; fin < v.length; fin++) {
    while (v[fin]! - v[debut]! > ecartMax + 1e-12) debut++;
    if (fin - debut + 1 > meilleur.length) meilleur = v.slice(debut, fin + 1);
  }
  if (meilleur.length < minimum) return null;
  const m = meilleur.length >> 1;
  return meilleur.length % 2 ? meilleur[m]! : (meilleur[m - 1]! + meilleur[m]!) / 2;
}
