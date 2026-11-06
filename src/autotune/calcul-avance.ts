// Côté page : envoie l'analyse et le rendu de l'autotune avancé au Worker (avance.worker.ts), un seul Worker vivant.
// Sans Worker (tests Vitest), le même moteur tourne sur le fil principal. Annuler (AbortSignal) arrête le Worker
// (ses caches sont perdus, il renaît au prochain appel) et rejette toutes les demandes en cours par « annule ».

import { lirePrise } from '../enregistrement/prises';
import type { AutotunePrise, Morceau, Prise } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import type { AnalyseNotes } from './api-autotune';
import { MoteurAvance, type ResultatRendu } from './moteur-avance';

/** Temps (ms) des derniers calculs (QA et rapport). */
export const mesuresAvance = { analyseMs: 0, renduMs: 0, partiel: false };

interface Attente {
  ok: (v: unknown) => void;
  ko: (e: unknown) => void;
  progression?: (p: number) => void;
}

let worker: Worker | null = null;
let local: MoteurAvance | null = null;
let suivant = 1;
const attentes = new Map<number, Attente>();

const annule = () => new ErreurOcka('Calcul annulé.', 'annule');

function leWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./avance.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<{ id: number; progression?: number; erreur?: string }>) => {
    const a = attentes.get(e.data.id);
    if (!a) return;
    if (typeof e.data.progression === 'number') return a.progression?.(e.data.progression);
    attentes.delete(e.data.id);
    if (e.data.erreur) a.ko(new Error(e.data.erreur));
    else a.ok(e.data);
  };
  w.onerror = (e) => arreter(new Error(e.message || 'Worker de l’autotune en erreur'));
  worker = w;
  return w;
}

/** Arrête le Worker (annulation ou erreur) et rejette tout ce qui attend. */
function arreter(raison: unknown): void {
  worker?.terminate();
  worker = null;
  for (const a of attentes.values()) a.ko(raison);
  attentes.clear();
}

async function pcmDe(prise: Prise): Promise<Float32Array> {
  const brut = await lirePrise(prise);
  if (!brut) throw new ErreurOcka('Le fichier de cette prise est introuvable sur le téléphone.', 'prise_introuvable');
  if (brut.pcm.length === 0) throw new ErreurOcka('Cette prise est vide.', 'prise_vide');
  return brut.pcm;
}

/** Une demande au Worker ; s'il n'a pas la prise en mémoire, on lui envoie son PCM et on recommence. */
async function demander<T>(msg: Record<string, unknown>, prise: Prise, signal?: AbortSignal, progression?: (p: number) => void): Promise<T> {
  if (signal?.aborted) throw annule();
  const envoyer = (pcm?: Float32Array) =>
    new Promise<Record<string, unknown>>((ok, ko) => {
      const id = suivant++;
      attentes.set(id, { ok: ok as (v: unknown) => void, ko, progression });
      const w = leWorker();
      w.postMessage({ ...msg, id, fichier: prise.fichier, frequence: prise.frequence, pcm }, pcm ? [pcm.buffer as ArrayBuffer] : []);
    });
  let surAnnule = () => {};
  const coupure = new Promise<never>((_, ko) => {
    surAnnule = () => (arreter(annule()), ko(annule()));
  });
  coupure.catch(() => {});
  signal?.addEventListener('abort', surAnnule, { once: true });
  try {
    let r = await Promise.race([envoyer(), coupure]);
    if (r.manque) {
      const pcm = await Promise.race([pcmDe(prise), coupure]);
      r = await Promise.race([envoyer(pcm), coupure]);
    }
    return r as T;
  } finally {
    signal?.removeEventListener('abort', surAnnule);
  }
}

export async function calculerAnalyse(prise: Prise, signal?: AbortSignal, progression?: (p: number) => void): Promise<AnalyseNotes> {
  const t0 = performance.now();
  let a: AnalyseNotes;
  if (typeof Worker === 'undefined') {
    local ??= new MoteurAvance();
    a = local.analyser(prise.fichier, local.connait(prise.fichier) ? undefined : await pcmDe(prise), prise.frequence, progression);
    if (signal?.aborted) throw annule();
  } else {
    a = (await demander<{ analyse: AnalyseNotes }>({ type: 'analyser' }, prise, signal, progression)).analyse;
  }
  mesuresAvance.analyseMs = Math.round(performance.now() - t0);
  return a;
}

export async function calculerRendu(prise: Prise, reglages: AutotunePrise, tonalite: Morceau['tonalite'], signal?: AbortSignal, progression?: (p: number) => void): Promise<ResultatRendu> {
  let r: ResultatRendu;
  if (typeof Worker === 'undefined') {
    local ??= new MoteurAvance();
    r = local.rendre(prise.fichier, local.connait(prise.fichier) ? undefined : await pcmDe(prise), prise.frequence, reglages, tonalite, progression);
    if (signal?.aborted) throw annule();
  } else {
    r = (await demander<{ rendu: ResultatRendu }>({ type: 'rendre', reglages, tonalite }, prise, signal, progression)).rendu;
  }
  mesuresAvance.renduMs = Math.round(r.ms);
  mesuresAvance.partiel = !!r.zones;
  return r;
}
