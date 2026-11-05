// Écriture d'un export (WAV, FLAC, M4A) EN FLUX, morceau par morceau, sans garder tout le fichier en mémoire :
// dans un fichier privé du site (OPFS, dossier « ocka-exports »), sinon (navigateur sans OPFS) dans des petits
// Blobs que le navigateur peut ranger hors de la mémoire de la page.
// Un nouvel export n'efface JAMAIS les autres (un export précédent peut être en cours de partage) :
// le ramasse-miettes (src/stockage/menage.ts) efface les exports de plus d'une heure.

import { ErreurOcka } from './erreur';
import { dossierOpfs, enErreurOcka } from '../stockage/dossiers';

/** Les premiers octets écrits restent corrigeables (en-tête FLAC complété à la fin). */
const TETE = 64 * 1024;

export interface Ecrivain {
  ecrire(octets: Uint8Array): Promise<void>;
  /** Récrit des octets déjà écrits, dans les 64 premiers Kio (STREAMINFO d'un FLAC). */
  corriger(position: number, octets: Uint8Array): Promise<void>;
  /** Octets écrits. */
  readonly octets: number;
  /** Termine et renvoie le fichier, sous le nom voulu. */
  fermer(nom: string, type?: string): Promise<File>;
  /** Annule : efface ce qui a été écrit. */
  abandonner(): Promise<void>;
}

/** Types MIME des exports. */
export const TYPES = { wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4' } as const;

/** Ouvre un nouvel export (« export-<date>-<hasard>.<extension> »), sans toucher aux autres fichiers. */
export async function ouvrirEcriture(extension = 'wav'): Promise<Ecrivain> {
  let dossier: FileSystemDirectoryHandle;
  let poignee: FileSystemFileHandle;
  let flux: FileSystemWritableFileStream;
  const nomFichier = `export-${Date.now()}-${Math.floor(Math.random() * 36 ** 4).toString(36)}.${extension}`;
  try {
    dossier = await dossierOpfs('exports');
    poignee = await dossier.getFileHandle(nomFichier, { create: true });
    flux = await poignee.createWritable();
  } catch (e) {
    if (e instanceof ErreurOcka && e.code === 'stockage') return ecrivainBlobs();
    if ((e as { name?: string } | null)?.name === 'QuotaExceededError') throw enErreurOcka(e);
    return ecrivainBlobs();
  }
  let position = 0;
  let fini = false;
  const abandonner = async () => {
    if (fini) return;
    fini = true;
    await flux.abort().catch(() => {});
    await dossier.removeEntry(nomFichier).catch(() => {});
  };
  /** Toute erreur d'écriture : le fichier partiel est effacé, l'erreur traduite (quota → « disque_plein »). */
  const proteger = async (f: () => Promise<void>) => {
    try {
      await f();
    } catch (e) {
      await abandonner();
      throw enErreurOcka(e, { message: 'L’écriture de l’export a échoué. Réessaie.', code: 'stockage' });
    }
  };
  return {
    get octets() {
      return position;
    },
    ecrire: (o) =>
      proteger(async () => {
        await flux.write({ type: 'write', position, data: o as Uint8Array<ArrayBuffer> });
        position += o.length;
      }),
    corriger: (p, o) =>
      proteger(async () => {
        if (p < 0 || p + o.length > Math.min(position, TETE)) throw new Error('export : correction hors de l’en-tête');
        await flux.write({ type: 'write', position: p, data: o as Uint8Array<ArrayBuffer> });
      }),
    async fermer(nom, type = TYPES.wav) {
      await proteger(() => flux.close());
      fini = true;
      const f = await poignee.getFile();
      return new File([f], nom, { type, lastModified: f.lastModified }); // mêmes données (pas de copie), nom du titre
    },
    abandonner,
  };
}

/** Secours sans OPFS : chaque morceau devient tout de suite un petit Blob (le début reste modifiable). */
function ecrivainBlobs(): Ecrivain {
  let tete = new Uint8Array(0);
  let parties: Blob[] = [];
  let position = 0;
  return {
    get octets() {
      return position;
    },
    async ecrire(o) {
      if (position < TETE) {
        const garde = o.subarray(0, TETE - position);
        const t = new Uint8Array(tete.length + garde.length);
        t.set(tete);
        t.set(garde, tete.length);
        tete = t;
        if (garde.length < o.length) parties.push(new Blob([o.slice(garde.length)]));
      } else parties.push(new Blob([o.slice()]));
      position += o.length;
    },
    async corriger(p, o) {
      if (p < 0 || p + o.length > tete.length) throw new Error('export : correction hors de l’en-tête');
      tete.set(o, p);
    },
    fermer: async (nom, type = TYPES.wav) => new File([tete as Uint8Array<ArrayBuffer>, ...parties], nom, { type }),
    abandonner: async () => {
      parties = [];
      tete = new Uint8Array(0);
    },
  };
}
