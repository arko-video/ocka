// La banque de sons d'un contexte audio : un cache LRU (~48 Mo) de tampons calculés AVANT la lecture par le
// Worker de synthèse (synthese/atelier.ts), directement à ctx.sampleRate (aucun rééchantillonnage par Chromium).
// Pendant la lecture, le graphe ne fait que LIRE ce cache : un son pas prêt est sauté et compté (`sautees`).
// Les tampons d'un graphe vivant sont épinglés : le LRU ne les jette jamais.

import type { InstrumentBatterie, SonMelodie } from '../../morceau/types';
import { commander } from '../synthese/atelier';
import { executer, type Travail } from '../synthese/travaux';

/** Taille visée du cache par contexte (octets). Au-delà, on jette les tampons les plus anciens non épinglés. */
export const PLAFOND_OCTETS = 48 * 1024 * 1024;

/** Un tampon prêt à jouer. */
export interface Pret {
  buffer: AudioBuffer;
  /** Boucle [début, fin] (s) : sons tenus (nappe, lead). */
  boucle?: [number, number];
}

/** Un tampon demandé : sa clé, le travail qui le fabrique (créé seulement s'il manque) et sa priorité. */
export interface Demande {
  cle: string;
  travail: () => Travail;
  priorite: number;
}

interface Entree extends Pret {
  octets: number;
}

/** Durée d'une note de 808 dans le cache (arrondie à la milliseconde, comme en phase 1). */
export function dureeBasse(duree: number): number {
  return Math.max(0.02, Math.round(duree * 1000) / 1000);
}

/** Clés du cache. La fréquence n'y est pas : une banque = un contexte = une fréquence. Jamais le tempo pour les notes. */
export const cles = {
  frappe: (kit: string, instrument: InstrumentBatterie) => `f|${kit}|${instrument}`,
  basse: (style: string, midi: number, duree: number, cible?: number) => `b|${style}|${midi}|${dureeBasse(duree)}|${cible ?? ''}`,
  note: (son: SonMelodie, variante: string, midi: number) => `n|${son}|${variante}|${midi}`,
  prise: (fichier: string) => `v|${fichier}`,
  pad: (fichier: string, crete: number) => `p|${fichier}|${crete}`,
  boucle: (fichier: string, longueur: number | null) => `l|${fichier}|${longueur ?? ''}`,
};

export class Banque {
  /** Ordre d'insertion = ordre LRU (le plus ancien d'abord) ; une lecture remet le tampon à la fin. */
  private tampons = new Map<string, Entree>();
  private enCours = new Map<string, { promesse: Promise<void>; prioriser(p: number): void }>();
  private epingles = new Map<string, number>();
  /** Réverbes et clics : petits, hors LRU. */
  private fixes = new Map<string, AudioBuffer>();
  /** Octets des tampons du cache. */
  octets = 0;
  /** Sons pas prêts au moment de les jouer (sautés). Doit rester à 0 après la préparation. */
  sautees = 0;
  /** Sons démarrés en retard (heure de départ déjà passée au moment de la planification). */
  retards = 0;

  constructor(
    private ctx: BaseAudioContext,
    readonly plafond = PLAFOND_OCTETS,
  ) {}

  get frequence(): number {
    return this.ctx.sampleRate;
  }

  /** Nombre de tampons dans le cache. */
  get taille(): number {
    return this.tampons.size;
  }

  /** Le tampon s'il est prêt (rien n'est calculé ici, jamais). */
  lire(cle: string): Pret | undefined {
    const e = this.tampons.get(cle);
    if (e) {
      this.tampons.delete(cle);
      this.tampons.set(cle, e);
    }
    return e;
  }

  /** Lance le calcul des tampons manquants (Worker). Résolue quand tous ceux demandés sont prêts (ou en échec). */
  preparer(demandes: Iterable<Demande>): Promise<void> {
    const attentes: Promise<void>[] = [];
    for (const d of demandes) {
      if (this.tampons.has(d.cle)) continue;
      let c = this.enCours.get(d.cle);
      if (c) c.prioriser(d.priorite);
      else {
        const cmd = commander(d.travail(), this.ctx.sampleRate, d.priorite);
        const promesse = cmd.promesse
          .then(
            (r) => this.ranger(d.cle, r.canaux, r.boucle),
            (e: unknown) => console.warn('OCKA : son impossible à préparer', d.cle, e),
          )
          .finally(() => this.enCours.delete(d.cle));
        c = { promesse, prioriser: cmd.prioriser };
        this.enCours.set(d.cle, c);
      }
      attentes.push(c.promesse);
    }
    return Promise.all(attentes).then(() => undefined);
  }

  /** Lâche tous les tampons (contexte hors ligne fini : voir oublierBanque). */
  vider(): void {
    this.tampons.clear();
    this.fixes.clear();
    this.epingles.clear();
    this.octets = 0;
  }

  /** Les tampons épinglés ne sont jamais jetés par le LRU (ceux d'un graphe vivant). */
  epingler(liste: Iterable<string>): void {
    for (const cle of liste) this.epingles.set(cle, (this.epingles.get(cle) ?? 0) + 1);
  }

  liberer(liste: Iterable<string>): void {
    for (const cle of liste) {
      const n = (this.epingles.get(cle) ?? 0) - 1;
      if (n > 0) this.epingles.set(cle, n);
      else this.epingles.delete(cle);
    }
    this.evincer();
  }

  /** Range un tampon calculé (copié dans un AudioBuffer du contexte), puis respecte le plafond. */
  private ranger(cle: string, canaux: Float32Array[], boucle?: [number, number]) {
    if (this.tampons.has(cle)) return;
    const buffer = this.versTampon(canaux);
    const octets = buffer.length * buffer.numberOfChannels * 4;
    this.tampons.set(cle, { buffer, boucle, octets });
    this.octets += octets;
    this.evincer();
  }

  private evincer() {
    if (this.octets <= this.plafond) return;
    for (const [cle, e] of this.tampons) {
      if (this.octets <= this.plafond) break;
      if (this.epingles.has(cle)) continue;
      this.tampons.delete(cle);
      this.octets -= e.octets;
    }
  }

  private versTampon(canaux: Float32Array[]): AudioBuffer {
    const n = Math.max(1, canaux[0]?.length ?? 1);
    const b = this.ctx.createBuffer(Math.max(1, canaux.length), n, this.ctx.sampleRate);
    canaux.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
    return b;
  }

  /**
   * Réponse impulsionnelle stéréo d'une réverbe (ConvolverNode), toujours la même. Synchrone (chaînes de M2) :
   * le bus master la précalcule dans le Worker (prechargerReverbe), donc ici elle est déjà prête.
   */
  reverbe(taille: number, duree: number): AudioBuffer {
    const cle = `r|${taille}|${duree}`;
    let b = this.fixes.get(cle);
    if (!b) {
      b = this.versTampon(executer({ type: 'reverbe', taille, duree }, this.ctx.sampleRate).canaux);
      this.fixes.set(cle, b);
    }
    return b;
  }

  /** Calcule une réverbe dans le Worker (avant d'en avoir besoin). */
  async prechargerReverbe(taille: number, duree: number): Promise<void> {
    const cle = `r|${taille}|${duree}`;
    if (this.fixes.has(cle)) return;
    const r = await commander({ type: 'reverbe', taille, duree }, this.ctx.sampleRate, -10).promesse;
    if (!this.fixes.has(cle)) this.fixes.set(cle, this.versTampon(r.canaux));
  }

  /** Clic de métronome (aigu sur le 1er temps) : 30 ms, calculé une fois. */
  clic(fort: boolean): AudioBuffer {
    const cle = `m|${fort}`;
    let b = this.fixes.get(cle);
    if (!b) {
      const sr = this.ctx.sampleRate;
      const s = new Float32Array(Math.round(0.03 * sr));
      const f = fort ? 1800 : 1200;
      for (let i = 0; i < s.length; i++) s[i] = 0.5 * Math.sin((2 * Math.PI * f * i) / sr) * Math.exp(-i / (0.006 * sr));
      b = this.versTampon([s]);
      this.fixes.set(cle, b);
    }
    return b;
  }
}

const banques = new WeakMap<BaseAudioContext, Banque>();

/**
 * Oublie la banque d'un contexte HORS LIGNE dont le rendu est fini (export, pistes, A/B). Chrome garde en vie tout
 * OfflineAudioContext où un AudioWorklet a été chargé (le fil du worklet le retient jusqu'à la fermeture de la page) :
 * on lâche au moins nos tampons, pour que chaque export ne garde pas aussi tous ses sons.
 */
export function oublierBanque(ctx: BaseAudioContext): void {
  banques.get(ctx)?.vider();
  banques.delete(ctx);
}

/** La banque de sons d'un contexte (créée au premier appel). */
export function banqueDe(ctx: BaseAudioContext): Banque {
  let b = banques.get(ctx);
  if (!b) {
    b = new Banque(ctx);
    banques.set(ctx, b);
  }
  return b;
}
