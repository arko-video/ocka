// Cache des zones DÉCODÉES des instruments échantillonnés, commun à tous les contextes (écoute, export, A/B) :
// un AudioBuffer à 48 kHz ne dépend d'aucun contexte, l'export réutilise donc ce que l'écoute a déjà décodé.
// Budget : 128 Mio (décisions v2 §2, en plus des 48 Mo de la banque de synthèse). LRU : on jette d'abord les zones
// les plus anciennes, JAMAIS une zone épinglée (celles d'un échantillonneur vivant : un son en cours d'usage).
// Le décodage (decodeAudioData) se fait à la préparation (charger(), construireGraphe), jamais pendant la lecture.

import type { PcmSon } from '../types-moteur';

/** Budget des zones décodées (octets). */
export const BUDGET_ZONES = 128 * 1024 * 1024;

/** Ce qui fournit les zones : la banque de BQ (fournisseur.ts), ou un faux dans les tests. */
export interface LectureZone {
  (id: string, fichier: string, signal?: AbortSignal): Promise<PcmSon | AudioBuffer>;
}

interface Entree {
  buffer: AudioBuffer;
  octets: number;
}

/** Copie d'un PCM (ou tampon décodé) dans un AudioBuffer autonome, coupé à `fin` échantillons (zone). */
function versTampon(pcm: PcmSon | AudioBuffer, fin: number): AudioBuffer {
  const estTampon = typeof AudioBuffer !== 'undefined' && pcm instanceof AudioBuffer;
  const longueur = estTampon ? pcm.length : (pcm as PcmSon).canaux[0]!.length;
  const n = Math.max(1, Math.min(longueur, fin > 0 ? fin : longueur));
  if (estTampon && n === longueur) return pcm;
  const canaux = estTampon ? Array.from({ length: pcm.numberOfChannels }, (_, i) => pcm.getChannelData(i)) : (pcm as PcmSon).canaux;
  const frequence = estTampon ? pcm.sampleRate : (pcm as PcmSon).frequence;
  const b = new AudioBuffer({ numberOfChannels: Math.max(1, canaux.length), length: n, sampleRate: frequence });
  canaux.forEach((c, i) => b.copyToChannel(c.subarray(0, n) as Float32Array<ArrayBuffer>, i));
  return b;
}

export class CacheZones {
  /** Ordre d'insertion = ordre LRU (le plus ancien d'abord). */
  private entrees = new Map<string, Entree>();
  private enCours = new Map<string, Promise<AudioBuffer>>();
  private epingles = new Map<string, number>();
  octets = 0;
  /** Plus grand total atteint (octets) ; > plafond si les zones épinglées dépassent le budget. */
  pic = 0;
  /** Zones décodées depuis le début (mesure). */
  decodages = 0;

  constructor(readonly plafond = BUDGET_ZONES) {}

  static cle(id: string, fichier: string): string {
    return `${id}|${fichier}`;
  }

  get taille(): number {
    return this.entrees.size;
  }

  /** La zone si elle est décodée (rien n'est décodé ici). */
  lire(cle: string): AudioBuffer | undefined {
    const e = this.entrees.get(cle);
    if (!e) return undefined;
    this.entrees.delete(cle);
    this.entrees.set(cle, e);
    return e.buffer;
  }

  epingler(cles: Iterable<string>): void {
    for (const c of cles) this.epingles.set(c, (this.epingles.get(c) ?? 0) + 1);
  }

  liberer(cles: Iterable<string>): void {
    for (const c of cles) {
      const n = (this.epingles.get(c) ?? 0) - 1;
      if (n > 0) this.epingles.set(c, n);
      else this.epingles.delete(c);
    }
    this.evincer();
  }

  /** Décode la zone si elle manque (un seul décodage à la fois par zone). `fin` : longueur utile (échantillons). */
  obtenir(lecture: LectureZone, id: string, fichier: string, fin: number, signal?: AbortSignal): Promise<AudioBuffer> {
    const cle = CacheZones.cle(id, fichier);
    const deja = this.lire(cle);
    if (deja) return Promise.resolve(deja);
    let p = this.enCours.get(cle);
    if (!p) {
      p = lecture(id, fichier, signal)
        .then((pcm) => {
          const buffer = versTampon(pcm, fin);
          this.ranger(cle, buffer);
          return buffer;
        })
        .finally(() => this.enCours.delete(cle));
      this.enCours.set(cle, p);
    }
    return p;
  }

  /** Lâche tout ce qui n'est pas épinglé (alerte mémoire). */
  purger(): void {
    for (const [cle, e] of this.entrees) {
      if (this.epingles.has(cle)) continue;
      this.entrees.delete(cle);
      this.octets -= e.octets;
    }
  }

  private ranger(cle: string, buffer: AudioBuffer) {
    if (this.entrees.has(cle)) return;
    const octets = buffer.length * buffer.numberOfChannels * 4;
    this.entrees.set(cle, { buffer, octets });
    this.octets += octets;
    this.decodages++;
    this.pic = Math.max(this.pic, this.octets);
    this.evincer();
  }

  private evincer() {
    if (this.octets <= this.plafond) return;
    for (const [cle, e] of this.entrees) {
      if (this.octets <= this.plafond) break;
      if (this.epingles.has(cle)) continue;
      this.entrees.delete(cle);
      this.octets -= e.octets;
    }
  }
}

/** Le cache commun à toute la page. */
export const cacheZones = new CacheZones();
