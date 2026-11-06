// Où OCKA range ses données, et la place qu'il reste.
// OCKA partage son origine avec Arko (arko-video.github.io) : TOUT ce qui appartient à OCKA est préfixé « ocka- »
// (dossiers OPFS et bases IndexedDB), et on ne touche JAMAIS à rien d'autre.
// Ce fichier appartient au contrat : seuls l'intégrateur et la tâche « contrat » le modifient.

import { createStore, type UseStore } from 'idb-keyval';
import { ErreurOcka } from '../moteur/erreur';

/** Dossiers OPFS d'OCKA (à la racine de navigator.storage.getDirectory()). */
export const DOSSIERS_OPFS = {
  /** Prises de voix (« prise-<id>.f32 » + description .json) et fichiers de l'autotune (« auto-… », vague B). */
  prises: 'ocka-prises',
  /** Exports d'un titre (WAV, FLAC, M4A, pistes séparées, projets). */
  exports: 'ocka-exports',
  /** Sons importés (« son-<id>.f32 »). */
  sons: 'ocka-sons',
  /** Dossiers de sortie (ZIP « Artiste - Titre (sortie).zip »). */
  sorties: 'ocka-sorties',
  /** Fichiers de travail (import d'un projet…), effacés au démarrage. */
  tmp: 'ocka-tmp',
  /** SoundFonts importées par l'utilisateur (« sf2-<id>.sf2 », REGLE_CLE_SF2 ; v2, vague C3). */
  sf2: 'ocka-sf2',
  /** C3 (V) : morceaux de référence importés (PCM décodé par Mediabunny, « ref-<id>.f32 » + description .json). */
  references: 'ocka-references',
  /** C3 (V, R) : rendus gelés mis en cache (gel d'une piste, effets de performance), « gel-<clé>.f32 ». Jetables. */
  gels: 'ocka-gels',
} as const;
export type NomDossier = keyof typeof DOSSIERS_OPFS;

/**
 * Caches (Cache Storage) d'OCKA (v2). Le service worker de la PWA a les siens (« workbox-… ») : jamais touchés ici.
 * - instruments : instruments téléchargés par BQ (instrument.json et fichiers Ogg Opus, clé = URL de même origine).
 */
export const CACHES = {
  instruments: 'ocka-instruments',
} as const;
export type NomCache = keyof typeof CACHES;
/** Nom du cache des instruments (BQ l'importe pour ouvrir le même cache). */
export const CACHE_INSTRUMENTS = CACHES.instruments;

/** Un cache d'OCKA (créé s'il n'existe pas). Lève ErreurOcka « stockage » sans Cache Storage. */
export async function cacheOcka(nom: NomCache): Promise<Cache> {
  if (typeof caches === 'undefined') throw new ErreurOcka('Ce navigateur ne peut pas garder les instruments.', 'stockage');
  try {
    return await caches.open(CACHES[nom]);
  } catch (e) {
    throw enErreurOcka(e, { message: 'Ce navigateur ne peut pas garder les instruments.', code: 'stockage' });
  }
}

/**
 * Phase 1 : les prises étaient dans le dossier « prises » (sans préfixe). A2 les déplace dans ocka-prises
 * (une fois, sous le verrou « ocka-menage »), puis n'y touche plus.
 */
export const ANCIEN_DOSSIER_PRISES = 'prises';

/** Bases IndexedDB d'OCKA. Chacune a un seul magasin d'objets : MAGASIN_IDB, sauf versArko (« boite ») ; voir magasin(). */
export const BASES_IDB = {
  /** Morceaux (« <id> » → Morceau) et index de « Mes morceaux ». */
  morceaux: 'ocka-morceaux',
  /** Sorties (« <id> » → Sortie). */
  sorties: 'ocka-sorties',
  /** Pochettes JPEG (« pochette-<id> » → Blob). */
  pochettes: 'ocka-pochettes',
  /** Réglages de l'utilisateur (vrai nom, artiste, lien du profil, distributeur). */
  reglages: 'ocka-reglages',
  /** Clé de l'IA (vague B). */
  cles: 'ocka-cles',
  /** Ta voix → instrument (C2, D) : entraînement du beatbox (« beatbox » → EntrainementBeatbox), réglages du direct. */
  dubler: 'ocka-dubler',
  /** C3 (R) : confort — modèles de pistes (« modele-<id> »), son du métronome, raccourcis. */
  confort: 'ocka-confort',
  /** Boîte partagée avec Arko (magasin « boite », clé = date → { nom, type, blob }) : Arko la lit et la vide. */
  versArko: 'ocka-vers-arko',
} as const;
export type NomBase = keyof typeof BASES_IDB;
export const MAGASIN_IDB = 'ocka';
/** Bases dont le magasin ne s'appelle pas MAGASIN_IDB (nom convenu avec Arko). */
export const MAGASINS_PARTICULIERS: Partial<Record<NomBase, string>> = { versArko: 'boite' };

/**
 * Phase 1 : morceaux et index dans la base PAR DÉFAUT d'idb-keyval (« keyval-store », magasin « keyval »),
 * sous les clés « ocka.index » et « ocka.morceau.<id> ». A2 les recopie dans ocka-morceaux puis efface
 * SEULEMENT ces clés-là (la base peut contenir des données d'Arko).
 */
export const ANCIENNE_BASE = { base: 'keyval-store', magasin: 'keyval', prefixe: 'ocka.' } as const;

const magasins = new Map<NomBase, UseStore>();

/** Le magasin idb-keyval d'une base d'OCKA (à passer en dernier argument de get/set/del/keys). La base s'ouvre au 1er usage. */
export function magasin(nom: NomBase): UseStore {
  let m = magasins.get(nom);
  if (!m) {
    m = createStore(BASES_IDB[nom], MAGASINS_PARTICULIERS[nom] ?? MAGASIN_IDB);
    magasins.set(nom, m);
  }
  return m;
}

/** Un dossier OPFS d'OCKA (créé s'il n'existe pas). Lève ErreurOcka « stockage » sans OPFS. */
export async function dossierOpfs(nom: NomDossier): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) {
    throw new ErreurOcka('Ce navigateur ne permet pas de ranger des fichiers. Utilise Chrome à jour.', 'stockage');
  }
  const racine = await navigator.storage.getDirectory();
  return racine.getDirectoryHandle(DOSSIERS_OPFS[nom], { create: true });
}

/* ------------------------------------------------------------ place libre */

export interface Place {
  quota: number;
  utilise: number;
  libre: number;
}

/** Place disponible pour le site (octets), ou null si le navigateur ne le dit pas. */
export async function estimerPlace(): Promise<Place | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e || typeof e.quota !== 'number' || !Number.isFinite(e.quota)) return null;
    const utilise = typeof e.usage === 'number' ? e.usage : 0;
    return { quota: e.quota, utilise, libre: Math.max(0, e.quota - utilise) };
  } catch {
    return null;
  }
}

/** « 12 Mo », « 1,3 Go ». */
export function formaterOctets(o: number): string {
  if (o >= 1e9) return `${(Math.ceil(o / 1e8) / 10).toString().replace('.', ',')} Go`;
  return `${Math.max(1, Math.ceil(o / 1e6))} Mo`;
}

/**
 * Vérifie AVANT d'écrire qu'il reste au moins `octets × facteur` octets (ex. dossier de sortie : facteur 2,2,
 * car le téléchargement recopie le fichier ; import : 1,1). Lève ErreurOcka « disque_plein » sinon.
 * Si le navigateur ne dit rien, on laisse faire (une erreur de quota sera traduite par enErreurOcka).
 */
export async function verifierPlace(octets: number, facteur = 1): Promise<void> {
  const besoin = Math.ceil(Math.max(0, octets) * facteur);
  const p = await estimerPlace();
  if (!p || p.libre >= besoin) return;
  throw new ErreurOcka(
    `Pas assez de place sur le téléphone : il faut environ ${formaterOctets(besoin)} de libre, il reste ${formaterOctets(p.libre)}. Libère de la place (photos, vidéos), puis réessaie.`,
    'disque_plein',
  );
}

export const MESSAGE_DISQUE_PLEIN = 'Le téléphone n’a plus de place : rien n’a été gardé. Libère de la place (photos, vidéos), puis réessaie.';

/** true si l'erreur vient d'un stockage plein (IndexedDB, OPFS, Cache). */
export function estDisquePlein(e: unknown): boolean {
  if (e instanceof ErreurOcka) return e.code === 'disque_plein';
  const x = e as { name?: unknown; code?: unknown; message?: unknown } | null;
  if (!x || typeof x !== 'object') return false;
  return x.name === 'QuotaExceededError' || x.code === 22 || (typeof x.message === 'string' && /quota/i.test(x.message));
}

/**
 * Traduit n'importe quelle erreur en ErreurOcka (message en français) :
 * ErreurOcka → telle quelle ; QuotaExceededError → « disque_plein » ; AbortError → « annule » ; sinon `secours`.
 * L'erreur d'origine est gardée dans `cause` (pour la console).
 */
export function enErreurOcka(e: unknown, secours: { message: string; code: string } = { message: 'Quelque chose n’a pas marché. Réessaie.', code: 'inconnu' }): ErreurOcka {
  if (e instanceof ErreurOcka) return e;
  let r: ErreurOcka;
  if (estDisquePlein(e)) r = new ErreurOcka(MESSAGE_DISQUE_PLEIN, 'disque_plein');
  else if ((e as { name?: unknown } | null)?.name === 'AbortError') r = new ErreurOcka('Annulé.', 'annule');
  else r = new ErreurOcka(secours.message, secours.code);
  r.cause = e;
  return r;
}

/* ------------------------------------------------------------ stockage durable */

let accorde = false;

/**
 * Demande au navigateur de ne pas effacer les données d'OCKA quand le téléphone manque de place.
 * À appeler APRÈS un geste (première prise, premier export) : Chrome décide selon l'usage du site.
 * Renvoie true si c'est accordé. Si c'est refusé, l'interface conseille « Exporter le projet ».
 */
export async function demanderPersistance(): Promise<boolean> {
  if (accorde) return true;
  try {
    const s = navigator.storage;
    if (!s?.persist) return false;
    accorde = (await s.persisted?.()) === true || (await s.persist()) === true;
  } catch {
    accorde = false;
  }
  return accorde;
}
