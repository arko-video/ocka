// Migration des données de la phase 1, UNE fois par chargement de page, sous le verrou « ocka-menage » :
// - OPFS : les fichiers de prises du dossier « prises » passent dans « ocka-prises » (déplacés, sinon copiés) ;
//   le dossier « prises » n'est retiré que s'il est vide (on ne touche à rien d'autre) ;
// - IndexedDB : dans la base par défaut d'idb-keyval (« keyval-store »), SEULEMENT les clés « ocka.index » et
//   « ocka.morceau.<id> » sont recopiées dans « ocka-morceaux », puis SEULEMENT ces clés sont effacées. Arko vit
//   sur la même origine et peut utiliser « keyval-store » : on ne vide JAMAIS cette base, on ne la crée jamais.
// Sans danger si elle est relancée : ce qui est déjà migré n'est plus dans l'ancien endroit. Propriétaire : A2.

import { createStore, delMany, get, keys, set, update } from 'idb-keyval';
import { normaliserMorceau } from '../morceau/normaliser';
import { REGLE_ID } from '../morceau/types';
import { ANCIEN_DOSSIER_PRISES, ANCIENNE_BASE, dossierOpfs, magasin } from './dossiers';
import { indexValide, majIndex, resumer } from './index-morceaux';

export const VERROU = 'ocka-menage';
/** Clé de l'index de « Mes morceaux » dans ocka-morceaux (« # » n'est jamais dans un id de morceau). */
export const CLE_INDEX = '#index';
const PRISE_PHASE1 = /^prise-[A-Za-z0-9_-]{1,40}\.(f32|json)$/;
const PREFIXE_MORCEAU = `${ANCIENNE_BASE.prefixe}morceau.`;
const CLE_INDEX_PHASE1 = `${ANCIENNE_BASE.prefixe}index`;

/** Exécute `f` sous le verrou « ocka-menage » (un seul onglet à la fois), ou directement sans Web Locks. */
export async function sousVerrou<T>(f: () => Promise<T>): Promise<T> {
  const verrous = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!verrous?.request) return f();
  return verrous.request(VERROU, f) as Promise<T>;
}

let enCours: Promise<void> | null = null;

/** Lance la migration (une fois par page) ; toujours résolue (un échec est réessayé au prochain chargement). */
export function migrer(): Promise<void> {
  enCours ??= sousVerrou(async () => {
    await migrerPrises();
    await migrerMorceaux();
  }).catch((e: unknown) => console.warn('OCKA : migration des données de la phase 1 incomplète', e));
  return enCours;
}

/** Pour les tests : la prochaine demande relance la migration. */
export function oublierMigration(): void {
  enCours = null;
}

type Iterable_ = { values(): AsyncIterable<FileSystemHandle> };

async function migrerPrises(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return;
  const racine = await navigator.storage.getDirectory();
  let ancien: FileSystemDirectoryHandle;
  try {
    ancien = await racine.getDirectoryHandle(ANCIEN_DOSSIER_PRISES);
  } catch {
    return; // pas de dossier de la phase 1
  }
  const neuf = await dossierOpfs('prises');
  const poignees: FileSystemFileHandle[] = [];
  for await (const h of (ancien as unknown as Iterable_).values()) {
    if (h.kind === 'file' && PRISE_PHASE1.test(h.name)) poignees.push(h as FileSystemFileHandle);
  }
  for (const h of poignees) await deplacer(h, ancien, neuf);
  await racine.removeEntry(ANCIEN_DOSSIER_PRISES).catch(() => {}); // refusé s'il reste d'autres fichiers : tant mieux
}

async function deplacer(h: FileSystemFileHandle, de: FileSystemDirectoryHandle, vers: FileSystemDirectoryHandle): Promise<void> {
  const source = await h.getFile();
  try {
    // Déjà là (migration interrompue après la copie) : on garde la copie si elle est complète.
    const cible = await (await vers.getFileHandle(h.name)).getFile();
    if (cible.size === source.size) {
      await de.removeEntry(h.name);
      return;
    }
  } catch {
    // pas encore copié
  }
  const bouger = (h as unknown as { move?: (d: FileSystemDirectoryHandle, n: string) => Promise<void> }).move;
  if (bouger) {
    try {
      await bouger.call(h, vers, h.name);
      return;
    } catch {
      // on copie ci-dessous
    }
  }
  const flux = await (await vers.getFileHandle(h.name, { create: true })).createWritable();
  await source.stream().pipeTo(flux);
  await de.removeEntry(h.name);
}

async function migrerMorceaux(): Promise<void> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return;
  const listes = await indexedDB.databases().catch(() => null);
  if (!listes?.some((b) => b.name === ANCIENNE_BASE.base)) return; // jamais créer la base d'idb-keyval
  const ancien = createStore(ANCIENNE_BASE.base, ANCIENNE_BASE.magasin);
  let cles: IDBValidKey[];
  try {
    cles = await keys(ancien);
  } catch {
    return; // pas de magasin « keyval » : rien d'OCKA ici
  }
  const base = magasin('morceaux');
  const migrees: string[] = [];
  const resumes: ReturnType<typeof resumer>[] = [];
  for (const k of cles) {
    if (typeof k !== 'string') continue;
    if (k.startsWith(PREFIXE_MORCEAU)) {
      const id = k.slice(PREFIXE_MORCEAU.length);
      if (!REGLE_ID.test(id)) continue; // id illisible : laissé là, jamais effacé
      const valeur = await get(k, ancien);
      if (valeur !== undefined && (await get(id, base)) === undefined) {
        await set(id, valeur, base);
        resumes.push(resumer(id, normaliserMorceau(valeur).morceau, Date.now()));
      }
      migrees.push(k);
    } else if (k === CLE_INDEX_PHASE1) migrees.push(k);
  }
  if (migrees.length === 0) return;
  // Les morceaux recopiés entrent dans l'index, avec leur ligne de la phase 1 si elle existe (date d'origine).
  const ancienIndex = cles.includes(CLE_INDEX_PHASE1) ? indexValide(await get(CLE_INDEX_PHASE1, ancien)) : [];
  if (resumes.length > 0) {
    await update(
      CLE_INDEX,
      (brut) => resumes.reduce((index, r) => majIndex(index, ancienIndex.find((x) => x.id === r.id) ?? r), indexValide(brut)),
      base,
    );
  }
  await delMany(migrees, ancien);
}
