// CRC32 (le contrôle du ZIP, polynôme 0xEDB88320), calculé au fil de l'eau, bloc par bloc.
// Bonus : on peut CORRIGER un CRC déjà calculé quand on récrit quelques octets plus tôt dans le flux
// (ex. l'en-tête STREAMINFO d'un FLAC, complété à la fin) sans relire tout le fichier : le CRC est linéaire,
// il suffit de « pousser » la différence à travers les octets qui suivent (méthode de zlib, crc32_combine).

const POLY = 0xedb88320;

/** 8 tables de 256 entrées : on traite 8 octets à la fois (« slicing-by-8 »), 4 à 5 fois plus vite. */
const TABLES: Uint32Array[] = (() => {
  const t = Array.from({ length: 8 }, () => new Uint32Array(256));
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? POLY ^ (c >>> 1) : c >>> 1;
    t[0]![n] = c >>> 0;
  }
  for (let n = 0; n < 256; n++) {
    let c = t[0]![n]!;
    for (let k = 1; k < 8; k++) {
      c = t[0]![c & 0xff]! ^ (c >>> 8);
      t[k]![n] = c >>> 0;
    }
  }
  return t;
})();
const [T0, T1, T2, T3, T4, T5, T6, T7] = TABLES as [Uint32Array, Uint32Array, Uint32Array, Uint32Array, Uint32Array, Uint32Array, Uint32Array, Uint32Array];

/** Registre brut (sans les inversions de début et de fin) après les octets `o`. */
function brut(o: Uint8Array, registre: number): number {
  let c = registre >>> 0;
  let i = 0;
  const n = o.length;
  for (; i + 8 <= n; i += 8) {
    const a = c ^ (o[i]! | (o[i + 1]! << 8) | (o[i + 2]! << 16) | (o[i + 3]! << 24));
    c =
      T7[a & 0xff]! ^ T6[(a >>> 8) & 0xff]! ^ T5[(a >>> 16) & 0xff]! ^ T4[a >>> 24]! ^
      T3[o[i + 4]!]! ^ T2[o[i + 5]!]! ^ T1[o[i + 6]!]! ^ T0[o[i + 7]!]!;
  }
  for (; i < n; i++) c = T0[(c ^ o[i]!) & 0xff]! ^ (c >>> 8);
  return c >>> 0;
}

/** CRC32 de `o`, en continuant le CRC `crc` des octets précédents (0 au début). */
export function crc32(o: Uint8Array, crc = 0): number {
  return ~brut(o, ~crc) >>> 0;
}

/* ------------------------------------------------------------ correction (arithmétique modulo le polynôme) */

/** a × b modulo le polynôme (représentation « réfléchie » de zlib). */
function multiplier(a: number, b: number): number {
  let m = 0x80000000;
  let p = 0;
  for (;;) {
    if (a & m) {
      p ^= b;
      if ((a & (m - 1)) === 0) break;
    }
    m >>>= 1;
    b = b & 1 ? (b >>> 1) ^ POLY : b >>> 1;
  }
  return p >>> 0;
}

/** x^(2^k) modulo le polynôme, pour k = 0 … 31. */
const PUISSANCES: number[] = (() => {
  const t: number[] = [];
  let p = 0x40000000; // x^1
  for (let k = 0; k < 32; k++) {
    t.push(p);
    p = multiplier(p, p);
  }
  return t;
})();

/** x^(8 × octets) modulo le polynôme : l'effet de `octets` octets nuls sur le registre. */
function decalage(octets: number): number {
  let p = 0x80000000; // x^0 = 1
  let k = 3; // 8 bits = 2^3
  let n = octets;
  while (n > 0) {
    if (n % 2 === 1) p = multiplier(PUISSANCES[k & 31]!, p);
    n = Math.floor(n / 2);
    k++;
  }
  return p;
}

/**
 * Nouveau CRC d'un flux de `longueur` octets dont les octets à `position` passent de `anciens` à `nouveaux`
 * (même longueur). Calcul en O(log longueur), sans relire le flux.
 */
export function corrigerCrc(crc: number, longueur: number, position: number, anciens: Uint8Array, nouveaux: Uint8Array): number {
  if (anciens.length !== nouveaux.length) throw new Error('corrigerCrc : longueurs différentes');
  const apres = longueur - position - nouveaux.length;
  if (position < 0 || apres < 0) throw new Error('corrigerCrc : hors du flux');
  const difference = new Uint8Array(nouveaux.length);
  for (let i = 0; i < difference.length; i++) difference[i] = anciens[i]! ^ nouveaux[i]!;
  // CRC(A) xor CRC(A') = registre brut de (A xor A'), qui ne dépend que de la différence et de ce qui la suit.
  const effet = multiplier(decalage(apres), brut(difference, 0));
  return (crc ^ effet) >>> 0;
}
