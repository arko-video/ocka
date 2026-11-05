// Encodeur FLAC fait main (RFC 9639), EN FLUX : 16 bits, 44,1 kHz, stéréo, blocs fixes de 4096 trames.
// Chaque canal devient une sous-trame CONSTANT, VERBATIM ou FIXED d'ordre 0 à 4 (la plus courte), avec un résidu
// codé en Rice par partitions (voir residu.ts). Stéréo : on garde la paire la plus courte parmi gauche/droite,
// gauche/côté, côté/droite et milieu/côté. Chaque trame : en-tête avec CRC-8, sous-trames, CRC-16.
// STREAMINFO (42 premiers octets) : écrit au début avec le nombre d'échantillons attendu, puis récrit à la fin
// (nombre réel, tailles min/max des trames) quand l'écrivain sait corriger. MD5 à zéro = « inconnu » (permis).

import { crc16, crc8, EcrivainBits } from './bits';
import { ecrireResidu, planifierResidu, type PlanResidu } from './residu';

export const BLOC_FLAC = 4096;
const FREQUENCE = 44100;
const BITS = 16;
/** Position de STREAMINFO dans le fichier (après « fLaC » et l'en-tête de bloc). */
export const POSITION_STREAMINFO = 8;

interface Choix {
  /** 0 = CONSTANT, 1 = VERBATIM, 2 = FIXED. */
  type: 0 | 1 | 2;
  ordre: number;
  plan: PlanResidu | null;
  bits: number;
}

// Tampons de travail : différences successives (résidus des prédicteurs fixes d'ordre 0 à 4).
const DIFF = Array.from({ length: 5 }, () => new Int32Array(BLOC_FLAC));

/** Résidus des prédicteurs fixes : DIFF[k][i] = k-ième différence de x en i (i ≥ k). */
function differences(x: Int32Array, n: number, ordreMax: number): void {
  DIFF[0]!.set(x.subarray(0, n));
  for (let k = 1; k <= ordreMax; k++) {
    const a = DIFF[k - 1]!;
    const b = DIFF[k]!;
    for (let i = k; i < n; i++) b[i] = a[i]! - a[i - 1]!;
  }
}

/** Ordre du prédicteur fixe dont le résidu est le plus petit (somme des valeurs absolues, comme libFLAC). */
function meilleurOrdre(n: number, ordreMax: number): number {
  let meilleur = 0;
  let min = Infinity;
  for (let k = 0; k <= ordreMax; k++) {
    const e = DIFF[k]!;
    let s = 0;
    for (let i = ordreMax; i < n; i++) {
      const v = e[i]!;
      s += v < 0 ? -v : v;
    }
    if (s < min) {
      min = s;
      meilleur = k;
    }
  }
  return meilleur;
}

/**
 * La sous-trame la plus courte pour ce canal (`bps` bits par échantillon : 16, ou 17 pour le côté) :
 * CONSTANT si tout est égal, sinon le meilleur prédicteur fixe (0 à 4) codé au plus court, ou VERBATIM.
 */
function analyser(x: Int32Array, n: number, bps: number): Choix {
  let constant = true;
  for (let i = 1; i < n && constant; i++) if (x[i] !== x[0]) constant = false;
  if (constant) return { type: 0, ordre: 0, plan: null, bits: 8 + bps };
  const verbatim: Choix = { type: 1, ordre: 0, plan: null, bits: 8 + n * bps };
  const ordreMax = Math.min(4, n - 1);
  differences(x, n, ordreMax);
  const ordre = meilleurOrdre(n, ordreMax);
  const plan = planifierResidu(DIFF[ordre]!, n, ordre);
  const bits = 8 + ordre * bps + plan.bits;
  return bits < verbatim.bits ? { type: 2, ordre, plan, bits } : verbatim;
}

function ecrireSousTrame(w: EcrivainBits, x: Int32Array, n: number, bps: number, c: Choix): void {
  w.ecrire(c.type === 0 ? 0 : c.type === 1 ? 1 : 8 | c.ordre, 8 - 1); // 0 de remplissage + type sur 6 bits
  w.ecrire(0, 1); // pas de « bits perdus »
  if (c.type === 0) w.ecrireSigne(x[0]!, bps);
  else if (c.type === 1) for (let i = 0; i < n; i++) w.ecrireSigne(x[i]!, bps);
  else {
    for (let i = 0; i < c.ordre; i++) w.ecrireSigne(x[i]!, bps);
    differences(x, n, c.ordre);
    ecrireResidu(w, DIFF[c.ordre]!, n, c.ordre, c.plan!);
  }
}

/** Numéro de trame codé « façon UTF-8 » (1 à 6 octets). */
function numeroUtf8(w: EcrivainBits, v: number): void {
  if (v < 0x80) return w.ecrire(v, 8);
  let suite = 1;
  while (suite < 5 && v >= 2 ** (6 * suite + 6 - suite)) suite++;
  const tete = (0xff00 >> (suite + 1)) & 0xff; // 110…, 1110…, 11110…
  w.ecrire(tete | Math.floor(v / 2 ** (6 * suite)), 8);
  for (let i = suite - 1; i >= 0; i--) w.ecrire(0x80 | (Math.floor(v / 2 ** (6 * i)) & 0x3f), 8);
}

export class EncodeurFlac {
  private g = new Int32Array(BLOC_FLAC);
  private d = new Int32Array(BLOC_FLAC);
  private cote = new Int32Array(BLOC_FLAC);
  private milieu = new Int32Array(BLOC_FLAC);
  private rempli = 0;
  private numero = 0;
  private w = new EcrivainBits(1 << 16);
  private minTrame = 0;
  private maxTrame = 0;
  /** Trames déjà encodées. */
  echantillons = 0;

  /** `attendus` : nombre de trames annoncé dans l'en-tête de départ (0 = inconnu). */
  constructor(private attendus = 0) {}

  /** « fLaC » + bloc STREAMINFO (le dernier bloc de métadonnées) : 42 octets. */
  entete(): Uint8Array {
    const o = new Uint8Array(42);
    o.set([0x66, 0x4c, 0x61, 0x43, 0x80, 0, 0, 34]);
    o.set(this.streamInfo(this.attendus, 0, 0), POSITION_STREAMINFO);
    return o;
  }

  /** STREAMINFO final (34 octets, à récrire en POSITION_STREAMINFO). */
  streamInfoFinal(): Uint8Array {
    return this.streamInfo(this.echantillons, this.minTrame, this.maxTrame);
  }

  private streamInfo(total: number, minTrame: number, maxTrame: number): Uint8Array {
    const w = new EcrivainBits(64);
    w.ecrire(BLOC_FLAC, 16);
    w.ecrire(BLOC_FLAC, 16);
    w.ecrire(minTrame, 24);
    w.ecrire(maxTrame, 24);
    w.ecrire(FREQUENCE, 20);
    w.ecrire(2 - 1, 3);
    w.ecrire(BITS - 1, 5);
    w.ecrire(Math.floor(total / 2 ** 32) & 0xf, 4);
    w.ecrireLong(total >>> 0, 32);
    for (let i = 0; i < 16; i++) w.ecrire(0, 8); // MD5 inconnu
    return w.octets.slice(0, 34);
  }

  /** Ajoute `trames` trames stéréo entrelacées (entiers 16 bits) ; renvoie les trames FLAC terminées. */
  ajouter(entrelaces: Int32Array, trames: number): Uint8Array {
    const sorties: Uint8Array[] = [];
    for (let i = 0; i < trames; i++) {
      this.g[this.rempli] = entrelaces[2 * i]!;
      this.d[this.rempli] = entrelaces[2 * i + 1]!;
      if (++this.rempli === BLOC_FLAC) sorties.push(this.trame());
    }
    return concatener(sorties);
  }

  /** Termine : la dernière trame (plus courte) s'il reste des échantillons. */
  terminer(): Uint8Array {
    return this.rempli > 0 ? this.trame() : new Uint8Array(0);
  }

  private trame(): Uint8Array {
    const n = this.rempli;
    const { g, d, cote, milieu, w } = this;
    for (let i = 0; i < n; i++) {
      cote[i] = g[i]! - d[i]!;
      milieu[i] = (g[i]! + d[i]!) >> 1;
    }
    const cg = analyser(g, n, BITS);
    const cd = analyser(d, n, BITS);
    const cc = analyser(cote, n, BITS + 1);
    const cm = analyser(milieu, n, BITS);
    // Assignation : 1 = gauche/droite, 8 = gauche/côté, 9 = côté/droite, 10 = milieu/côté.
    const options: [number, number][] = [
      [1, cg.bits + cd.bits],
      [8, cg.bits + cc.bits],
      [9, cc.bits + cd.bits],
      [10, cm.bits + cc.bits],
    ];
    const [assignation] = options.reduce((a, b) => (b[1] < a[1] ? b : a));

    w.vider();
    w.ecrire(0x3ffe, 14); // synchro
    w.ecrire(0, 2); // réservé, blocs de taille fixe
    w.ecrire(n === BLOC_FLAC ? 12 : 7, 4); // 4096, ou taille − 1 sur 16 bits après l'en-tête
    w.ecrire(9, 4); // 44,1 kHz
    w.ecrire(assignation, 4);
    w.ecrire(4, 3); // 16 bits
    w.ecrire(0, 1);
    numeroUtf8(w, this.numero);
    if (n !== BLOC_FLAC) w.ecrire(n - 1, 16);
    w.ecrire(crc8(w.octets, 0, w.pos), 8);
    if (assignation === 1) {
      ecrireSousTrame(w, g, n, BITS, cg);
      ecrireSousTrame(w, d, n, BITS, cd);
    } else if (assignation === 8) {
      ecrireSousTrame(w, g, n, BITS, cg);
      ecrireSousTrame(w, cote, n, BITS + 1, cc);
    } else if (assignation === 9) {
      ecrireSousTrame(w, cote, n, BITS + 1, cc);
      ecrireSousTrame(w, d, n, BITS, cd);
    } else {
      ecrireSousTrame(w, milieu, n, BITS, cm);
      ecrireSousTrame(w, cote, n, BITS + 1, cc);
    }
    w.aligner();
    const c = crc16(w.octets, 0, w.pos);
    w.ecrire(c >> 8, 8);
    w.ecrire(c & 0xff, 8);
    const trame = w.octets.slice(0, w.pos);
    this.minTrame = this.minTrame === 0 ? trame.length : Math.min(this.minTrame, trame.length);
    this.maxTrame = Math.max(this.maxTrame, trame.length);
    this.echantillons += n;
    this.numero++;
    this.rempli = 0;
    return trame;
  }
}

function concatener(parties: Uint8Array[]): Uint8Array {
  if (parties.length === 1) return parties[0]!;
  const o = new Uint8Array(parties.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const x of parties) {
    o.set(x, p);
    p += x.length;
  }
  return o;
}
