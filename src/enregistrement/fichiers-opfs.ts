// Fichiers des prises dans OPFS (le stockage privé du navigateur), dossier « ocka-prises ».
// Format d'une prise : « prise-<id>.f32 » = PCM mono en Float32 brut (petit-boutiste),
// plus « prise-<id>.json » à côté : { format, frequence, canaux, echantillons, encodage }.
// Les fichiers de l'autotune (vague B) s'appellent « auto-<clé de la prise sans .f32>… ».
// Seuls ces noms sont acceptés : un nom venu d'ailleurs ne devient jamais un chemin.
// Avant le premier accès, les prises de la phase 1 (dossier « prises ») sont déplacées (src/stockage/migration.ts).

import { dossierOpfs } from '../stockage/dossiers';
import { migrer } from '../stockage/migration';

/** Nos fichiers dans ocka-prises : prises (+ description) et fichiers de l'autotune (« auto-<clé de la prise>… »). */
export const FICHIER_PRISE = /^(prise|auto)-[A-Za-z0-9_.~-]{1,100}$/;

async function dossier(): Promise<FileSystemDirectoryHandle> {
  await migrer();
  return dossierOpfs('prises');
}

function verifierNom(nom: string): void {
  if (!FICHIER_PRISE.test(nom)) throw new Error(`Nom de fichier de prise refusé : ${nom}`);
}

/** Nom du fichier .json qui décrit un fichier .f32. */
export function nomDescription(fichier: string): string {
  return fichier.replace(/\.f32$/, '') + '.json';
}

export interface EcrivainFlux {
  /** Ajoute des échantillons à la fin du fichier (écriture en file d'attente, sans tout garder en mémoire). */
  ecrire(pcm: Float32Array): void;
  /** Attend la fin des écritures et ferme le fichier. */
  fermer(): Promise<void>;
  /** Abandonne et efface le fichier. */
  annuler(): Promise<void>;
}

/** Ouvre un fichier en écriture « en flux » : chaque morceau part sur le disque dès qu'il arrive. */
export async function ouvrirEcriture(nom: string): Promise<EcrivainFlux> {
  verifierNom(nom);
  const d = await dossier();
  const poignee = await d.getFileHandle(nom, { create: true });
  const flux = await poignee.createWritable();
  let file: Promise<unknown> = Promise.resolve();
  let erreur: unknown = null;
  return {
    ecrire(pcm) {
      file = file.then(() => flux.write(pcm as Float32Array<ArrayBuffer>)).catch((e: unknown) => (erreur = e));
    },
    async fermer() {
      await file;
      await flux.close();
      if (erreur) throw erreur;
    },
    async annuler() {
      await file;
      await flux.abort().catch(() => {});
      await d.removeEntry(nom).catch(() => {});
    },
  };
}

/** Écrit un petit fichier texte (la description .json). */
export async function ecrireTexte(nom: string, texte: string): Promise<void> {
  verifierNom(nom);
  const d = await dossier();
  const flux = await (await d.getFileHandle(nom, { create: true })).createWritable();
  await flux.write(texte);
  await flux.close();
}

/** Lit un fichier entier, ou null s'il n'existe pas. */
export async function lireFichier(nom: string): Promise<ArrayBuffer | null> {
  const f = await fichierPrise(nom);
  return f ? await f.arrayBuffer().catch(() => null) : null;
}

/** Le fichier lui-même (lu plus tard, par morceaux : export d'un projet), ou null s'il n'existe pas. */
export async function fichierPrise(nom: string): Promise<File | null> {
  if (!FICHIER_PRISE.test(nom)) return null;
  try {
    const d = await dossier();
    return await (await d.getFileHandle(nom)).getFile();
  } catch {
    return null;
  }
}

/** Efface un fichier (sans erreur s'il n'existe pas). */
export async function supprimerFichier(nom: string): Promise<void> {
  if (!FICHIER_PRISE.test(nom)) return;
  try {
    const d = await dossier();
    await d.removeEntry(nom);
  } catch {
    // déjà absent
  }
}

/** Copie un fichier en flux (sans le charger en mémoire). Renvoie false si la source n'existe pas. */
export async function copierFichier(source: string, cible: string): Promise<boolean> {
  verifierNom(cible);
  if (!FICHIER_PRISE.test(source)) return false;
  const d = await dossier();
  let fichier: File;
  try {
    fichier = await (await d.getFileHandle(source)).getFile();
  } catch {
    return false;
  }
  const flux = await (await d.getFileHandle(cible, { create: true })).createWritable();
  await fichier.stream().pipeTo(flux);
  return true;
}

/** Liste les fichiers du dossier des prises (ocka-prises), avec leur date de modification (ms). */
export async function listerFichiers(): Promise<{ nom: string; modifie: number }[]> {
  const d = await dossier();
  const liste: { nom: string; modifie: number }[] = [];
  // `values()` existe dans Chrome ; le type n'est pas dans la lib DOM de TypeScript.
  const entrees = (d as unknown as { values(): AsyncIterable<FileSystemHandle> }).values();
  for await (const h of entrees) {
    if (h.kind !== 'file') continue;
    const f = await (h as FileSystemFileHandle).getFile();
    liste.push({ nom: h.name, modifie: f.lastModified });
  }
  return liste;
}
