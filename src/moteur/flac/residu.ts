// Résidu d'une sous-trame FLAC (ce qui reste après la prédiction), codé en Rice par partitions.
// Le bloc est coupé en 2^p partitions (p = 0 à 8) ; chaque partition a son paramètre de Rice k (0 à 14 avec
// des paramètres sur 4 bits, 0 à 30 sur 5 bits) ou « s'échappe » (valeurs brutes sur w bits) si c'est plus court.
// Coût estimé d'une partition de c valeurs repliées (u ≥ 0) de somme S : c·(k+1) + ⌊S / 2^k⌋. C'est un MAJORANT
// exact du coût réel (Σ⌊u/2^k⌋ ≤ ⌊S/2^k⌋) : la trame écrite n'est jamais plus longue que prévu.

import type { EcrivainBits } from './bits';

export const ORDRE_PARTITION_MAX = 8;

export interface PlanResidu {
  /** Ordre de partition p (2^p partitions). */
  ordre: number;
  /** 0 : paramètres sur 4 bits ; 1 : sur 5 bits. */
  methode: 0 | 1;
  /** Paramètre de Rice de chaque partition, ou −1 = échappement. */
  params: Int8Array;
  /** Largeur des valeurs brutes (échappement) de chaque partition. */
  largeurs: Uint8Array;
  /** Bits du résidu entier (méthode, ordre, paramètres et codes). */
  bits: number;
}

/** Paramètre trouvé par le dernier appel de coutRice (évite de créer un objet à chaque partition). */
let kTrouve = 0;
/** 2^−k : ⌊s × 2^−k⌋ est exact en virgule flottante (multiplication par une puissance de 2). */
const INVERSES = Float64Array.from({ length: 31 }, (_, k) => 2 ** -k);

/** Coût du meilleur paramètre k ≤ kMax pour c valeurs repliées de somme s (k dans kTrouve). */
function coutRice(c: number, s: number, kMax: number): number {
  kTrouve = 0;
  if (c === 0) return 0;
  const moyenne = Math.floor(s / c);
  // Optimum continu vers log2(moyenne × ln 2) : on essaie autour de ⌊log2(moyenne)⌋.
  const k0 = moyenne > 0 ? Math.min(kMax, 31 - Math.clz32(moyenne)) : 0;
  let cout = Infinity;
  const fin = Math.min(kMax, k0 + 1);
  for (let k = k0 > 0 ? k0 - 1 : 0; k <= fin; k++) {
    const x = c * (k + 1) + Math.floor(s * INVERSES[k]!);
    if (x < cout) {
      cout = x;
      kTrouve = k;
    }
  }
  return cout;
}

// Tampons réutilisés : sommes, maxima et effectifs de toutes les partitions, niveau p rangé à partir de 2^p − 1.
const NB = (2 << ORDRE_PARTITION_MAX) - 1;
const SOMMES = new Float64Array(NB);
const MAXIMA = new Uint32Array(NB);
const EFFECTIFS = new Uint32Array(NB);
/** Coûts des deux méthodes pour le dernier niveau calculé. */
let bitsMethode1 = 0;

/**
 * Coût (bits) des partitions du niveau p avec la méthode 0 (paramètres sur 4 bits) ; celui de la méthode 1
 * (5 bits) va dans bitsMethode1. Avec `params`, remplit aussi le plan pour la méthode `methode`.
 */
function coutNiveau(p: number, methode?: 0 | 1, params?: Int8Array, largeurs?: Uint8Array): number {
  const base = (1 << p) - 1;
  let bits0 = 6;
  let bits1 = 6;
  for (let j = 0; j < 1 << p; j++) {
    const c = EFFECTIFS[base + j]!;
    const s = SOMMES[base + j]!;
    const c30 = coutRice(c, s, 30);
    const k30 = kTrouve;
    let c14 = c30;
    let k14 = k30;
    if (k30 > 14) {
      c14 = coutRice(c, s, 14);
      k14 = kTrouve;
    }
    const largeur = 32 - Math.clz32(MAXIMA[base + j]!);
    const brut = 5 + c * largeur;
    bits0 += 4 + Math.min(c14, brut);
    bits1 += 5 + Math.min(c30, brut);
    if (params && largeurs) {
      const [cout, k] = methode === 0 ? [c14, k14] : [c30, k30];
      params[j] = brut < cout ? -1 : k;
      largeurs[j] = largeur;
    }
  }
  bitsMethode1 = bits1;
  return bits0;
}

/** Choisit le meilleur découpage pour le résidu r[ordrePred … n). */
export function planifierResidu(r: Int32Array, n: number, ordrePred: number): PlanResidu {
  let pMax = 0;
  while (pMax < ORDRE_PARTITION_MAX && n % (1 << (pMax + 1)) === 0 && n >> (pMax + 1) > ordrePred) pMax++;
  const taille = n >> pMax;
  const base = (1 << pMax) - 1;
  for (let j = 0; j < 1 << pMax; j++) {
    const debut = j === 0 ? ordrePred : j * taille;
    const fin = (j + 1) * taille;
    let s = 0;
    let m = 0;
    for (let i = debut; i < fin; i++) {
      const v = r[i]!;
      const u = (v << 1) ^ (v >> 31); // repli : 0, −1, 1, −2… → 0, 1, 2, 3…
      s += u;
      if (u > m) m = u;
    }
    SOMMES[base + j] = s;
    MAXIMA[base + j] = m;
    EFFECTIFS[base + j] = fin - debut;
  }
  // Niveaux plus grossiers : on fusionne les partitions deux à deux.
  for (let p = pMax - 1; p >= 0; p--) {
    const b = (1 << p) - 1;
    const f = (2 << p) - 1;
    for (let j = 0; j < 1 << p; j++) {
      SOMMES[b + j] = SOMMES[f + 2 * j]! + SOMMES[f + 2 * j + 1]!;
      MAXIMA[b + j] = Math.max(MAXIMA[f + 2 * j]!, MAXIMA[f + 2 * j + 1]!);
      EFFECTIFS[b + j] = EFFECTIFS[f + 2 * j]! + EFFECTIFS[f + 2 * j + 1]!;
    }
  }
  let ordre = 0;
  let methode: 0 | 1 = 0;
  let bits = Infinity;
  for (let p = 0; p <= pMax; p++) {
    const b0 = coutNiveau(p);
    if (b0 < bits) {
      bits = b0;
      ordre = p;
      methode = 0;
    }
    if (bitsMethode1 < bits) {
      bits = bitsMethode1;
      ordre = p;
      methode = 1;
    }
  }
  const params = new Int8Array(1 << ordre);
  const largeurs = new Uint8Array(1 << ordre);
  coutNiveau(ordre, methode, params, largeurs);
  return { ordre, methode, params, largeurs, bits };
}

/** Écrit le résidu r[ordrePred … n) selon `plan`. */
export function ecrireResidu(w: EcrivainBits, r: Int32Array, n: number, ordrePred: number, plan: PlanResidu): void {
  w.ecrire(plan.methode, 2);
  w.ecrire(plan.ordre, 4);
  const bitsParam = plan.methode === 0 ? 4 : 5;
  const echappement = plan.methode === 0 ? 15 : 31;
  const taille = n >> plan.ordre;
  for (let j = 0; j < 1 << plan.ordre; j++) {
    const debut = j === 0 ? ordrePred : j * taille;
    const fin = (j + 1) * taille;
    const k = plan.params[j]!;
    if (k < 0) {
      const largeur = plan.largeurs[j]!;
      w.ecrire(echappement, bitsParam);
      w.ecrire(largeur, 5);
      for (let i = debut; i < fin; i++) w.ecrireSigne(r[i]!, largeur);
    } else {
      w.ecrire(k, bitsParam);
      for (let i = debut; i < fin; i++) w.rice(r[i]!, k);
    }
  }
}
