// Autotune, côté page : qui corrige quoi, où sont les fichiers, et le PCM que le graphe doit jouer.
// - Réglage : Piste.effets.autotune de la piste voix (0 à 1, au dixième ; 0 ou absent = pas d'autotune), gamme =
//   Morceau.tonalite. Calcul dans un Worker (autotune.worker.ts), un par prise, fermé après.
// - Fichiers dans OPFS ocka-prises : « auto-<clé de la prise sans .f32>-<force>-<tonalité>.f32 » (PCM corrigé, même
//   format et même longueur que la prise) puis sa description « …json » { voisees, applique }, écrite EN DERNIER
//   (elle dit que le travail est fini). Repli (moins de 60 % de trames voisées) : la description seule.
//   Le ramasse-miettes (stockage/menage.ts) garde ceux qu'un morceau sauvé utilise (fichiersAutotune) et efface les autres.
// - Écoute : le PCM corrigé s'il est prêt, sinon la prise brute (et le calcul part) ; l'export, lui, attend.

import { ecrireTexte, lireFichier, nomDescription, ouvrirEcriture } from '../enregistrement/fichiers-opfs';
import { lirePrise } from '../enregistrement/prises';
import type { Morceau, Prise } from '../morceau/types';
import { corrigerVoix, type ResultatAutotune } from './correction';
import { nomTonalite } from './gamme';

/** PCM d'une prise pour le graphe ; `version` = fichier corrigé joué (absent = la prise brute). */
export interface PcmVoix {
  frequence: number;
  pcm: Float32Array;
  version?: string;
}

export type EtatAutotune = { etat: 'calcul' | 'pret' | 'repli' | 'erreur'; voisees: number };

/** Temps (ms) du dernier calcul dans le Worker (QA). */
export const mesuresAutotune = { dernierMs: 0 };

const etats = new Map<string, EtatAutotune>();
const abonnes = new Set<(nom: string) => void>();
const enCours = new Map<string, Promise<PcmVoix | null>>();

/** Force de l'autotune d'un morceau (0 à 1, au dixième ; 0 = éteint). Tolère un morceau brut (ménage). */
export function forceAutotune(m: Morceau): number {
  const v = m.pistes?.find((p) => p.id === 'voix')?.effets?.autotune;
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 10) / 10 : 0;
}

/** Nom du fichier corrigé d'une prise pour une force et une tonalité. */
export function nomAutotune(fichier: string, force: number, tonalite: Morceau['tonalite']): string {
  return `auto-${fichier.replace(/\.f32$/, '')}-${force.toFixed(1)}-${nomTonalite(tonalite)}.f32`;
}

/** Fichiers corrigés qu'un morceau utilise (prises choisies, autotune allumé). */
export function fichiersAutotune(m: Morceau): string[] {
  const force = forceAutotune(m);
  if (force <= 0 || !m.tonalite) return [];
  return (m.prises ?? []).filter((p) => p?.choisie && p.fichier).map((p) => nomAutotune(p.fichier, force, m.tonalite));
}

export const etatAutotune = (nom: string): EtatAutotune | undefined => etats.get(nom);

/** Prévient `fn` à chaque changement d'état d'un fichier corrigé ; renvoie de quoi se désabonner. */
export function surAutotune(fn: (nom: string) => void): () => void {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

function noter(nom: string, e: EtatAutotune) {
  etats.set(nom, e);
  for (const f of abonnes) f(nom);
}

/** Le travail déjà fait (description lue), ou null s'il n'existe pas encore. */
async function lireFait(nom: string, frequence: number): Promise<PcmVoix | 'repli' | null> {
  const desc = await lireFichier(nomDescription(nom));
  if (!desc) return null;
  try {
    const d = JSON.parse(new TextDecoder().decode(desc)) as { voisees?: number; applique?: boolean };
    const voisees = Number(d.voisees) || 0;
    if (!d.applique) return (noter(nom, { etat: 'repli', voisees }), 'repli');
    const o = await lireFichier(nom);
    if (!o) return null;
    noter(nom, { etat: 'pret', voisees });
    return { frequence, pcm: new Float32Array(o, 0, Math.floor(o.byteLength / 4)), version: nom };
  } catch {
    return null;
  }
}

/** Corrige dans un Worker (sur le fil principal sans Worker : tests). */
function calculer(pcm: Float32Array, frequence: number, force: number, tonalite: Morceau['tonalite']): Promise<ResultatAutotune> {
  if (typeof Worker === 'undefined') return Promise.resolve(corrigerVoix(pcm, frequence, force, tonalite));
  return new Promise((ok, ko) => {
    const w = new Worker(new URL('./autotune.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<ResultatAutotune & { ms: number; erreur?: string }>) => {
      w.terminate();
      if (e.data.erreur) return ko(new Error(e.data.erreur));
      mesuresAutotune.dernierMs = Math.round(e.data.ms);
      ok(e.data);
    };
    w.onerror = (e) => (w.terminate(), ko(new Error(e.message)));
    w.postMessage({ pcm, frequence, force, tonalite }, [pcm.buffer as ArrayBuffer]);
  });
}

/**
 * Le PCM corrigé d'une prise (calculé et écrit s'il n'existe pas ; un seul calcul à la fois par fichier).
 * null : repli (trop peu de trames voisées), prise introuvable ou erreur — on joue alors la prise brute.
 */
export function preparerAutotune(prise: Prise, force: number, tonalite: Morceau['tonalite']): Promise<PcmVoix | null> {
  const nom = nomAutotune(prise.fichier, force, tonalite);
  let p = enCours.get(nom);
  if (p) return p;
  p = (async (): Promise<PcmVoix | null> => {
    const fait = await lireFait(nom, prise.frequence);
    if (fait) return fait === 'repli' ? null : fait;
    const brut = await lirePrise(prise);
    if (!brut || brut.pcm.length === 0) return null;
    noter(nom, { etat: 'calcul', voisees: 0 });
    try {
      const r = await calculer(brut.pcm, brut.frequence, force, tonalite);
      if (r.applique) {
        const e = await ouvrirEcriture(nom);
        e.ecrire(r.pcm);
        await e.fermer();
      }
      await ecrireTexte(nomDescription(nom), JSON.stringify({ voisees: Math.round(r.voisees * 1000) / 1000, applique: r.applique }));
      noter(nom, { etat: r.applique ? 'pret' : 'repli', voisees: r.voisees });
      return r.applique ? { frequence: brut.frequence, pcm: r.pcm, version: nom } : null;
    } catch (e) {
      console.error(e);
      noter(nom, { etat: 'erreur', voisees: 0 });
      return null;
    }
  })().finally(() => enCours.delete(nom));
  enCours.set(nom, p);
  return p;
}

const attentes = new Map<string, ReturnType<typeof setTimeout>>();
/** Correction en tâche de fond, lancée 0,7 s après la DERNIÈRE demande pour cette prise (curseur qui glisse). */
function plusTard(prise: Prise, force: number, tonalite: Morceau['tonalite']): void {
  clearTimeout(attentes.get(prise.fichier));
  attentes.set(
    prise.fichier,
    setTimeout(() => {
      attentes.delete(prise.fichier);
      void preparerAutotune(prise, force, tonalite);
    }, 700),
  );
}

/**
 * Le PCM qu'un graphe doit jouer pour une prise. `attendre` (export) : attend la correction. Sinon (écoute) : le
 * corrigé s'il est prêt, sinon la prise brute, et la correction part en tâche de fond (surAutotune prévient).
 * `deja` : ce que le lecteur a en cache (gardé s'il est encore le bon).
 */
export async function lirePcmVoix(prise: Prise, m: Morceau, attendre: boolean, deja?: PcmVoix): Promise<PcmVoix | null> {
  const force = forceAutotune(m);
  if (force <= 0) return deja && !deja.version ? deja : lirePrise(prise);
  const nom = nomAutotune(prise.fichier, force, m.tonalite);
  if (deja?.version === nom) return deja;
  if (attendre) return (await preparerAutotune(prise, force, m.tonalite)) ?? (deja && !deja.version ? deja : lirePrise(prise));
  const etat = etats.get(nom)?.etat;
  if (etat === 'pret' || etat === undefined) {
    const fait = await lireFait(nom, prise.frequence);
    if (fait && fait !== 'repli') return fait;
    if (!fait) plusTard(prise, force, m.tonalite);
  }
  return deja && !deja.version ? deja : lirePrise(prise);
}

/** Lance la correction des prises choisies d'un morceau (autotune allumé), sans attendre. */
export function preparerAutotuneMorceau(m: Morceau): void {
  const force = forceAutotune(m);
  if (force <= 0) return;
  for (const p of m.prises) if (p.choisie) plusTard(p, force, m.tonalite);
}

/** État de l'autotune pour les prises choisies d'un morceau : le pire (calcul > erreur > repli > prêt), ou null. */
export function resumeAutotune(m: Morceau): EtatAutotune | null {
  const ordre = ['calcul', 'erreur', 'repli', 'pret'] as const;
  let pire: EtatAutotune | null = null;
  for (const nom of fichiersAutotune(m)) {
    const e = etats.get(nom) ?? { etat: 'calcul' as const, voisees: 0 };
    if (!pire || ordre.indexOf(e.etat) < ordre.indexOf(pire.etat)) pire = e;
  }
  return pire;
}
