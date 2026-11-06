// Analyse d'un .sf2 : dans un Worker (sf2.worker.ts), ou sur le fil principal sans Worker (Vitest). Le résultat
// (données pures, sans PCM) est gardé en mémoire par SoundFont : les zones se lisent ensuite par morceaux.

import { ErreurOcka } from '../moteur/erreur';
import { lireSf2, refusSf2, type Lecteur } from './riff';
import { resoudrePresets, type PresetAnalyse } from './zones-sf2';

export interface AnalyseSf2 {
  nom: string;
  /** Position (octets) du bloc smpl dans le fichier, et sa taille en échantillons. */
  smpl: number;
  echantillons: number;
  presets: PresetAnalyse[];
}

/** Lecteur par morceaux d'un Blob. */
export const lecteurBlob =
  (b: Blob): Lecteur =>
  async (debut, fin) =>
    new Uint8Array(await b.slice(debut, fin).arrayBuffer());

/** Analyse complète (pure, sur un lecteur). */
export async function analyserSf2(lire: Lecteur, taille: number): Promise<AnalyseSf2> {
  try {
    const brut = await lireSf2(lire, taille);
    return { nom: brut.nom, smpl: brut.smpl.debut, echantillons: brut.smpl.echantillons, presets: resoudrePresets(brut) };
  } catch (e) {
    throw e instanceof ErreurOcka ? e : refusSf2('données incohérentes');
  }
}

/** Temps (ms) de la dernière analyse (rapport). */
export const mesuresSf2 = { analyseMs: 0 };

/** Analyse d'un fichier, dans un Worker si possible. */
export async function analyserFichier(f: Blob): Promise<AnalyseSf2> {
  const t0 = performance.now();
  try {
    if (typeof Worker === 'undefined') return await analyserSf2(lecteurBlob(f), f.size);
    const w = new Worker(new URL('./sf2.worker.ts', import.meta.url), { type: 'module' });
    try {
      return await new Promise<AnalyseSf2>((ok, ko) => {
        w.onmessage = (e: MessageEvent<{ analyse?: AnalyseSf2; erreur?: string; code?: string }>) => {
          if (e.data.analyse) ok(e.data.analyse);
          else ko(new ErreurOcka(e.data.erreur ?? 'SoundFont illisible.', e.data.code ?? 'sf2_illisible'));
        };
        w.onerror = (e) => ko(new ErreurOcka(e.message || 'Cette SoundFont est illisible.', 'sf2_illisible'));
        w.postMessage({ fichier: f });
      });
    } finally {
      w.terminate();
    }
  } finally {
    mesuresSf2.analyseMs = performance.now() - t0;
  }
}

const cache = new Map<string, Promise<AnalyseSf2>>();

/** Analyse gardée en mémoire (par id de SoundFont). */
export function analyseEnCache(id: string, charger: () => Promise<AnalyseSf2>): Promise<AnalyseSf2> {
  let p = cache.get(id);
  if (!p) {
    p = charger();
    cache.set(id, p);
    p.catch(() => cache.delete(id));
  }
  return p;
}

export function poserAnalyse(id: string, a: AnalyseSf2): void {
  cache.set(id, Promise.resolve(a));
}

export function oublierAnalyse(id: string): void {
  cache.delete(id);
}
