// Écriture bit à bit (poids fort d'abord, comme le veut le FLAC) et contrôles CRC-8 / CRC-16 des trames.

export class EcrivainBits {
  octets: Uint8Array;
  pos = 0;
  /** Bits en attente (moins de 8) et leur nombre. */
  private acc = 0;
  private n = 0;

  constructor(capacite = 1 << 16) {
    this.octets = new Uint8Array(capacite);
  }

  /** Repart de zéro (le tampon est réutilisé). */
  vider(): void {
    this.pos = 0;
    this.acc = 0;
    this.n = 0;
  }

  private agrandir(): void {
    const plus = new Uint8Array(this.octets.length * 2);
    plus.set(this.octets);
    this.octets = plus;
  }

  /** Écrit les `bits` bits de poids faible de `v` (0 à 24 bits). */
  ecrire(v: number, bits: number): void {
    if (this.pos + 8 > this.octets.length) this.agrandir();
    this.acc = (this.acc << bits) | (v & ((1 << bits) - 1));
    this.n += bits;
    while (this.n >= 8) {
      this.n -= 8;
      this.octets[this.pos++] = (this.acc >>> this.n) & 0xff;
    }
    this.acc &= (1 << this.n) - 1;
  }

  /** Entier non signé de 0 à 32 bits. */
  ecrireLong(v: number, bits: number): void {
    if (bits > 24) {
      this.ecrire(Math.floor(v / 65536), bits - 16);
      this.ecrire(v & 0xffff, 16);
    } else this.ecrire(v, bits);
  }

  /** Entier signé en complément à deux sur `bits` bits (0 à 32). */
  ecrireSigne(v: number, bits: number): void {
    if (bits > 24) {
      this.ecrire(v >> 16, bits - 16);
      this.ecrire(v & 0xffff, 16);
    } else if (bits > 0) this.ecrire(v, bits);
  }

  /** `q` zéros puis un 1 (partie « unaire » du code de Rice). */
  unaire(q: number): void {
    while (q >= 24) {
      this.ecrire(0, 24);
      q -= 24;
    }
    this.ecrire(1, q + 1);
  }

  /** Code de Rice de `r` avec le paramètre `k` (0 à 30). */
  rice(r: number, k: number): void {
    const u = (r << 1) ^ (r >> 31); // repli : 0, −1, 1, −2… → 0, 1, 2, 3…
    const q = u >>> k;
    if (q + 1 + k <= 24) this.ecrire((1 << k) | (u & ((1 << k) - 1)), q + 1 + k);
    else {
      this.unaire(q);
      this.ecrireLong(u & ((1 << k) - 1), k);
    }
  }

  /** Complète l'octet en cours avec des zéros. */
  aligner(): void {
    if (this.n > 0) this.ecrire(0, 8 - this.n);
  }
}

const CRC8 = new Uint8Array(256);
const CRC16 = new Uint16Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  CRC8[i] = c;
  let d = i << 8;
  for (let k = 0; k < 8; k++) d = d & 0x8000 ? ((d << 1) ^ 0x8005) & 0xffff : (d << 1) & 0xffff;
  CRC16[i] = d;
}

/** CRC-8 (polynôme x⁸ + x² + x + 1) de l'en-tête d'une trame. */
export function crc8(o: Uint8Array, debut: number, fin: number): number {
  let c = 0;
  for (let i = debut; i < fin; i++) c = CRC8[c ^ o[i]!]!;
  return c;
}

/** CRC-16 (polynôme 0x8005) d'une trame entière. */
export function crc16(o: Uint8Array, debut: number, fin: number): number {
  let c = 0;
  for (let i = debut; i < fin; i++) c = ((c << 8) & 0xffff) ^ CRC16[(c >> 8) ^ o[i]!]!;
  return c;
}
