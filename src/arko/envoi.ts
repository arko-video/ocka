// « Envoyer vers Arko » : le fichier (le M4A de exporterAudio) part, dans cet ordre :
//  1. par la feuille de partage d'Android (navigator.canShare({ files }) puis navigator.share) → « partage » ;
//  2. sinon, si OCKA tourne sur l'origine d'Arko, dans la « boîte » IndexedDB partagée ocka-vers-arko
//     (magasin « boite », clé = date, valeur = { nom, type, blob }, 5 fichiers au plus) → « boite » ;
//  3. sinon, téléchargement (l'interface dit : « Dans Arko : Son guide → Importer ») → « telechargement ».
// Partage fermé par l'utilisateur : ErreurOcka « annule », que l'interface n'affiche PAS comme une erreur
// (on ne télécharge pas non plus : il a choisi d'arrêter). Propriétaire : M2.

import { del, keys, set, type UseStore } from 'idb-keyval';
import { ErreurOcka } from '../moteur/erreur';
import { BASES_IDB, MAGASINS_PARTICULIERS, enErreurOcka, magasin } from '../stockage/dossiers';

/** Origine d'Arko (OCKA y est publié aussi, sous /ocka/). */
export const ORIGINE_ARKO = 'https://arko-video.github.io';
/** Boîte partagée avec Arko (préfixe ocka- : elle appartient à OCKA ; Arko la lit et la vide). */
export const BOITE_ARKO = { base: BASES_IDB.versArko, magasin: MAGASINS_PARTICULIERS.versArko ?? 'boite', max: 5 } as const;

/** Ce que la boîte garde pour chaque fichier. */
export interface DepotArko {
  nom: string;
  type: string;
  blob: Blob;
}

let boite: UseStore | null = null;

/** Dépose `f` dans la boîte (clé = date en ms) et ne garde que les 5 plus récents. */
export async function deposerDansBoite(f: File): Promise<number> {
  boite ??= magasin('versArko');
  const existantes = (await keys(boite)).filter((k): k is number => typeof k === 'number').sort((a, b) => a - b);
  let cle = Date.now();
  if (existantes.length > 0 && cle <= existantes[existantes.length - 1]!) cle = existantes[existantes.length - 1]! + 1;
  const depot: DepotArko = { nom: f.name, type: f.type, blob: f };
  await set(cle, depot, boite);
  const enTrop = existantes.length + 1 - BOITE_ARKO.max;
  for (let i = 0; i < enTrop; i++) await del(existantes[i]!, boite);
  return cle;
}

/** Télécharge `f` sous son nom (lien temporaire, libéré une minute plus tard). */
export function telecharger(f: File): void {
  const url = URL.createObjectURL(f);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function nomErreur(e: unknown): string {
  return typeof e === 'object' && e !== null && typeof (e as { name?: unknown }).name === 'string' ? (e as { name: string }).name : '';
}

export async function envoyerVersArko(f: File): Promise<'partage' | 'telechargement' | 'boite'> {
  // 1. Feuille de partage. Un refus « technique » (pas de geste récent, type refusé…) passe à la suite.
  let peutPartager = false;
  try {
    peutPartager = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && navigator.canShare?.({ files: [f] }) === true;
  } catch {
    peutPartager = false;
  }
  if (peutPartager) {
    try {
      await navigator.share({ files: [f], title: f.name });
      return 'partage';
    } catch (e) {
      if (nomErreur(e) === 'AbortError') throw new ErreurOcka('Envoi annulé.', 'annule');
      // NotAllowedError (geste trop ancien), DataError, TypeError… : on essaie autrement.
    }
  }
  // 2. Boîte partagée, seulement sur l'origine d'Arko.
  if (typeof location !== 'undefined' && location.origin === ORIGINE_ARKO) {
    try {
      await deposerDansBoite(f);
      return 'boite';
    } catch (e) {
      const err = enErreurOcka(e);
      if (err.code === 'disque_plein') throw err;
      // Base bloquée ou illisible : on télécharge.
    }
  }
  // 3. Téléchargement.
  try {
    telecharger(f);
    return 'telechargement';
  } catch (e) {
    throw enErreurOcka(e, { message: 'Impossible d’envoyer le fichier vers Arko. Exporte-le, puis importe-le dans Arko.', code: 'partage_impossible' });
  }
}
