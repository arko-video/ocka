// Le calcul de l'autotune avancé, avec ses caches : tourne dans le Worker (avance.worker.ts) ou, sans Worker
// (tests), sur le fil principal. Par prise (clé du fichier) : le PCM source, l'analyse YIN, les notes, et le
// DERNIER rendu (pour ne recalculer que la note changée). Deux prises au plus en mémoire (la plus ancienne part).

import type { AutotunePrise, Morceau } from '../morceau/types';
import type { AnalyseNotes } from './api-autotune';
import { partVoisee } from './courbe-correction';
import { detecterGamme } from './detection-gamme';
import { gamme } from './gamme';
import { analyserCourbe, decouperNotes, type NoteAnalysee } from './notes';
import { rendreComplet, rendrePartiel, type Rendu } from './rendu-avance';
import type { Hauteurs } from './yin';

const MAX_PRISES = 2;

interface Entree {
  pcm: Float32Array;
  fs: number;
  h: Hauteurs;
  analyse: AnalyseNotes;
  dernier?: Rendu;
}

export interface ResultatRendu {
  pcm: Float32Array;
  voisees: number;
  applique: boolean;
  /** Zones recalculées (s) si le rendu est partiel. */
  zones?: [number, number][];
  /** Temps de calcul (ms). */
  ms: number;
}

/** Analyse complète d'un PCM (pure) : courbe, notes (écart à la gamme détectée), part voisée. */
export function analyserPcm(fichier: string, pcm: Float32Array, fs: number, progression?: (p: number) => void): { h: Hauteurs; analyse: AnalyseNotes } {
  progression?.(0.05);
  const { h, courbe } = analyserCourbe(pcm, fs);
  progression?.(0.85);
  const duree = pcm.length / fs;
  let notes: NoteAnalysee[] = decouperNotes(courbe, duree);
  const g = detecterGamme(notes)[0];
  if (g) notes = decouperNotes(courbe, duree, gamme(g));
  progression?.(1);
  return { h, analyse: { fichier, duree, courbe, notes, voisees: partVoisee(h) } };
}

export class MoteurAvance {
  private entrees = new Map<string, Entree>();

  /** true si la prise est déjà en mémoire (sinon il faut envoyer son PCM). */
  connait(fichier: string): boolean {
    return this.entrees.has(fichier);
  }

  private garder(fichier: string, e: Entree): void {
    this.entrees.delete(fichier);
    this.entrees.set(fichier, e);
    while (this.entrees.size > MAX_PRISES) this.entrees.delete(this.entrees.keys().next().value!);
  }

  /** Analyse (ou relit du cache) ; `pcm` est nécessaire si la prise n'est pas en mémoire. */
  analyser(fichier: string, pcm: Float32Array | undefined, fs: number, progression?: (p: number) => void): AnalyseNotes {
    const e = this.entrees.get(fichier);
    if (e && (!pcm || (pcm.length === e.pcm.length && fs === e.fs))) {
      this.garder(fichier, e);
      return e.analyse;
    }
    if (!pcm) throw new Error('manque_pcm');
    const { h, analyse } = analyserPcm(fichier, pcm, fs, progression);
    this.garder(fichier, { pcm, fs, h, analyse });
    return analyse;
  }

  /** Rend la prise avec ces réglages ; partiel si seules des notes ont changé depuis le dernier rendu. */
  rendre(fichier: string, pcm: Float32Array | undefined, fs: number, reglages: AutotunePrise, tonalite: Morceau['tonalite'] | undefined, progression?: (p: number) => void): ResultatRendu {
    const t0 = performance.now();
    this.analyser(fichier, pcm, fs, (p) => progression?.(p * 0.4));
    const e = this.entrees.get(fichier)!;
    let r = e.dernier ? rendrePartiel(e.pcm, e.fs, e.h, e.dernier, reglages, tonalite) : null;
    r ??= rendreComplet(e.pcm, e.fs, e.h, reglages, tonalite);
    e.dernier = r;
    progression?.(1);
    return { pcm: r.pcm, voisees: r.voisees, applique: r.applique, zones: r.zones, ms: performance.now() - t0 };
  }

  oublier(fichier?: string): void {
    if (fichier) this.entrees.delete(fichier);
    else this.entrees.clear();
  }
}
