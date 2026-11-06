// Autotune, côté page : qui corrige quoi, où sont les fichiers, et le PCM que le graphe doit jouer.
// - Réglage simple : Piste.effets.autotune de la piste voix (0 à 1, au dixième ; 0 ou absent = pas d'autotune),
//   gamme = Morceau.tonalite. Calcul dans un Worker (autotune.worker.ts), un par prise, fermé après.
// - Réglage avancé (C2) : Prise.autotune, qui l'emporte pour SA prise dès qu'il existe (avance.ts, rendreAutotune).
// - Fichiers dans OPFS ocka-prises : simple « auto-<clé de la prise sans .f32>-<force>-<tonalité>.f32 », avancé
//   « auto-<clé de la prise sans .f32>-av<empreinte des réglages>.f32 » (même format et même longueur que la prise),
//   puis leur description « …json » { voisees, applique }, écrite EN DERNIER (etats.ts). Repli : la description seule.
//   Le ramasse-miettes (stockage/menage.ts) garde ceux qu'un morceau sauvé utilise (fichiersAutotune) et efface les autres.
// - Écoute : le PCM corrigé s'il est prêt, sinon la prise brute (et le calcul part) ; l'export, lui, attend.

import { ecrireTexte, nomDescription, ouvrirEcriture } from '../enregistrement/fichiers-opfs';
import { crochetPrise } from '../enregistrement/crochets-prise';
import { lirePrise } from '../enregistrement/prises';
import type { Morceau, Prise } from '../morceau/types';
import { pcmAvance, rendrePlusTard } from './avance';
import { corrigerVoix, type ResultatAutotune } from './correction';
import { etatAutotune, lireFait, noter, type EtatAutotune, type PcmVoix } from './etats';
import { nomTonalite } from './gamme';
import { nomRenduAutotune } from './reglages';

export { etatAutotune, surAutotune, type EtatAutotune, type PcmVoix } from './etats';

/** Temps (ms) du dernier calcul dans le Worker (QA). */
export const mesuresAutotune = { dernierMs: 0 };

const enCours = new Map<string, Promise<PcmVoix | null>>();

/** Force de l'autotune d'un morceau (0 à 1, au dixième ; 0 = éteint). Tolère un morceau brut (ménage). */
export function forceAutotune(m: Morceau): number {
  const p = m.pistes?.find((x) => x.id === 'voix');
  const v = p && p.genre !== 'instrument' ? p.effets?.autotune : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 10) / 10 : 0;
}

/** Nom du fichier corrigé d'une prise pour une force et une tonalité. */
export function nomAutotune(fichier: string, force: number, tonalite: Morceau['tonalite']): string {
  return `auto-${fichier.replace(/\.f32$/, '')}-${force.toFixed(1)}-${nomTonalite(tonalite)}.f32`;
}

/** Fichiers corrigés qu'un morceau utilise (prises choisies : réglage avancé de la prise, sinon le simple). */
export function fichiersAutotune(m: Morceau): string[] {
  const force = forceAutotune(m);
  const out: string[] = [];
  for (const p of m.prises ?? []) {
    if (!p?.choisie || !p.fichier) continue;
    try {
      if (p.autotune) out.push(nomRenduAutotune(p, p.autotune, m.tonalite));
      else if (force > 0 && m.tonalite) out.push(nomAutotune(p.fichier, force, m.tonalite));
    } catch {
      // morceau brut mal formé (ménage) : rien à garder pour cette prise
    }
  }
  return out;
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
 * `deja` : ce que le lecteur a en cache (gardé s'il est encore le bon). Contrat C3 : le résultat passe ensuite par le
 * crochet des prises (enregistrement/crochets-prise.ts, V), à l'écoute comme à l'export.
 */
export async function lirePcmVoix(prise: Prise, m: Morceau, attendre: boolean, deja?: PcmVoix): Promise<PcmVoix | null> {
  const pcm = await lireCorrige(prise, m, attendre, deja);
  return pcm ? crochetPrise(prise, m, pcm, attendre) : pcm;
}

async function lireCorrige(prise: Prise, m: Morceau, attendre: boolean, deja?: PcmVoix): Promise<PcmVoix | null> {
  if (prise.autotune) return pcmAvance(prise, m, attendre, () => Promise.resolve(deja && !deja.version ? deja : lirePrise(prise)), deja);
  const force = forceAutotune(m);
  if (force <= 0) return deja && !deja.version ? deja : lirePrise(prise);
  const nom = nomAutotune(prise.fichier, force, m.tonalite);
  if (deja?.version === nom) return deja;
  if (attendre) return (await preparerAutotune(prise, force, m.tonalite)) ?? (deja && !deja.version ? deja : lirePrise(prise));
  const etat = etatAutotune(nom)?.etat;
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
  for (const p of m.prises) {
    if (!p.choisie) continue;
    if (p.autotune) rendrePlusTard(p, m.tonalite);
    else if (force > 0) plusTard(p, force, m.tonalite);
  }
}

/** État de l'autotune pour les prises choisies d'un morceau : le pire (calcul > erreur > repli > prêt), ou null. */
export function resumeAutotune(m: Morceau): EtatAutotune | null {
  const ordre = ['calcul', 'erreur', 'repli', 'pret'] as const;
  let pire: EtatAutotune | null = null;
  for (const nom of fichiersAutotune(m)) {
    const e = etatAutotune(nom) ?? { etat: 'calcul' as const, voisees: 0 };
    if (!pire || ordre.indexOf(e.etat) < ordre.indexOf(pire.etat)) pire = e;
  }
  return pire;
}
