// Ramasse-miettes d'OCKA, sous le verrou « ocka-menage » (un seul onglet à la fois). Propriétaire : A2.
// - ocka-prises : prises (+ description) et fichiers de l'autotune « auto-… » qu'AUCUN morceau sauvé n'utilise (un
//   fichier corrigé n'est utilisé que pour la force et la tonalité actuelles du morceau : fichiersAutotune) ;
// - ocka-sons : sons importés qu'aucun morceau sauvé n'utilise ;
//   → effacés s'ils sont d'avant cette séance (seulement si aucun autre onglet d'OCKA n'est ouvert : un autre
//     onglet peut avoir une prise pas encore sauvée), ou vieux d'au moins une heure (« Annuler » peut les ramener) ;
// - ocka-exports : exports de plus d'une heure (un export récent peut être en cours de partage) ;
// - ocka-tmp : fichiers de travail d'avant la séance (seul onglet) ou de plus d'une heure.
// Les pochettes (ocka-pochettes) sont nettoyées par A1 (src/stockage/sorties.ts). Rien d'autre n'est touché.

import { entries } from 'idb-keyval';
import type { Morceau } from '../morceau/types';
import { fichiersAutotune } from '../autotune/autotune';
import { AGE_MIN_NETTOYAGE, DEBUT_SEANCE, choisirOrphelins } from '../enregistrement/prises';
import { dossierOpfs, magasin, type NomDossier } from './dossiers';
import { fichiersUtilises, sonsUtilises } from './index-morceaux';
import { CLE_INDEX, migrer, sousVerrou } from './migration';

export interface BilanMenage {
  prises: number;
  sons: number;
  exports: number;
  tmp: number;
}

/* ------------------------------------------------------------ les autres onglets */

const CANAL = 'ocka-onglets';
const ONGLET = 'ocka-onglet';
const monId = Math.random().toString(36).slice(2);
let canal: BroadcastChannel | null = null;
let reponses = 0;

/** Ce onglet se fait connaître : il répond aux appels des autres et tient un verrou partagé tant qu'il vit. */
function seFaireConnaitre(): void {
  if (canal || typeof BroadcastChannel === 'undefined') return;
  canal = new BroadcastChannel(CANAL);
  (canal as unknown as { unref?: () => void }).unref?.(); // Node (tests) : ne retient pas le processus
  canal.onmessage = (e: MessageEvent) => {
    const m = e.data as { qui?: string; moi?: string; pour?: string } | null;
    if (m?.qui && m.qui !== monId) canal!.postMessage({ moi: monId, pour: m.qui });
    else if (m?.moi && m.pour === monId) reponses++;
  };
  try {
    void navigator.locks?.request(ONGLET, { mode: 'shared' }, () => new Promise<void>(() => {})).catch(() => {});
  } catch {
    // pas de Web Locks : le canal suffit
  }
}

/** true si un autre onglet d'OCKA est ouvert (réponse sur le BroadcastChannel, ou verrou partagé d'un autre onglet). */
export async function autreOnglet(attente = 250): Promise<boolean> {
  seFaireConnaitre();
  try {
    const etat = await navigator.locks?.query?.();
    if (etat && (etat.held ?? []).filter((v) => v.name === ONGLET).length > 1) return true;
  } catch {
    // on se fie au canal
  }
  if (!canal) return false;
  const avant = reponses;
  canal.postMessage({ qui: monId });
  await new Promise((r) => setTimeout(r, attente));
  return reponses > avant;
}

/* ------------------------------------------------------------ ménage */

/** Tous les morceaux sauvés (bruts : on ne lit que leurs clés de fichiers). */
export async function tousLesMorceaux(): Promise<Morceau[]> {
  const lignes = await entries(magasin('morceaux'));
  return lignes.filter(([k, v]) => k !== CLE_INDEX && !!v && typeof v === 'object').map(([, v]) => v as Morceau);
}

async function lister(nom: NomDossier): Promise<{ d: FileSystemDirectoryHandle; fichiers: { nom: string; modifie: number }[] }> {
  const d = await dossierOpfs(nom);
  const fichiers: { nom: string; modifie: number }[] = [];
  for await (const h of (d as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
    if (h.kind !== 'file' || h.name.endsWith('.crswap')) continue;
    try {
      fichiers.push({ nom: h.name, modifie: (await (h as FileSystemFileHandle).getFile()).lastModified });
    } catch {
      // fichier en cours d'écriture ou disparu
    }
  }
  return { d, fichiers };
}

async function effacer(d: FileSystemDirectoryHandle, noms: string[]): Promise<number> {
  let n = 0;
  for (const nom of noms) {
    try {
      await d.removeEntry(nom);
      n++;
    } catch {
      // déjà effacé, ou ouvert ailleurs
    }
  }
  return n;
}

/**
 * Lance le ménage (après la migration). `ageMin` : âge minimal (ms) des prises et sons orphelins à effacer
 * pendant la séance (1 h ; 0 dans les tests). Renvoie le nombre de fichiers effacés par dossier.
 */
export async function menage(ageMin = AGE_MIN_NETTOYAGE): Promise<BilanMenage> {
  await migrer();
  const autre = await autreOnglet();
  const debut = autre ? -Infinity : DEBUT_SEANCE;
  return sousVerrou(async () => {
    const morceaux = await tousLesMorceaux();
    const maintenant = Date.now();
    const prises = await lister('prises');
    const sons = await lister('sons');
    const exports = await lister('exports');
    const tmp = await lister('tmp');
    const vieux = (f: { modifie: number }) => maintenant - f.modifie >= AGE_MIN_NETTOYAGE;
    const utilises = fichiersUtilises(morceaux);
    for (const m of morceaux) for (const f of fichiersAutotune(m)) utilises.add(f);
    return {
      prises: await effacer(prises.d, choisirOrphelins(prises.fichiers, utilises, maintenant, ageMin, debut)),
      sons: await effacer(sons.d, choisirOrphelins(sons.fichiers, sonsUtilises(morceaux), maintenant, ageMin, debut, /^son-[A-Za-z0-9_-]{1,40}\.f32$/)),
      exports: await effacer(exports.d, exports.fichiers.filter(vieux).map((f) => f.nom)),
      tmp: await effacer(tmp.d, tmp.fichiers.filter((f) => vieux(f) || f.modifie < debut).map((f) => f.nom)),
    };
  });
}
