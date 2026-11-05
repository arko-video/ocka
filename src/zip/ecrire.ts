// Écriture d'un ZIP « stocké » en flux dans OPFS (interfaces : ./types.ts). Propriétaire : A2.
// Chaque entrée : en-tête local écrit d'avance (CRC et tailles à 0), données versées en flux (CRC32 au fil de l'eau),
// puis en-tête CORRIGÉ par une écriture à sa position (FileSystemWritableFileStream accepte une position).
// Rien n'est gardé en mémoire à part un tampon de 1 Mio (moins d'appels au disque) et les 64 premiers Kio de
// l'entrée ouverte (pour `corriger`). Le fichier n'apparaît sous son nom qu'à la fermeture du flux (Chrome écrit
// dans un fichier d'échange) ; annuler ou une erreur efface tout.

import { ErreurOcka } from '../moteur/erreur';
import { dossierOpfs, enErreurOcka, formaterOctets, type NomDossier } from '../stockage/dossiers';
import { corrigerCrc, crc32 } from './crc32';
import { champsTaille, dateDos, enTeteLocal, nomSur, repertoireCentral, type InfosEntree } from './format';
import { TAILLE_MAX_ZIP, type EcrivainFlux, type EcrivainZip } from './types';

/** Tampon d'écriture (octets). Les gros blocs passent directement. */
const TAMPON = 1 << 20;
/** Début de chaque entrée gardé en mémoire : on peut le corriger (en-tête FLAC complété à la fin). */
export const TETE_CORRIGEABLE = 64 * 1024;

/** Une entrée qui sait aussi récrire ses premiers octets (le CRC est corrigé sans relire). */
export interface EcrivainCorrigeable extends EcrivainFlux {
  /** Récrit `octets` à `position` (depuis le début de l'entrée), dans ses TETE_CORRIGEABLE premiers octets. */
  corriger(position: number, octets: Uint8Array): Promise<void>;
}

export function estCorrigeable(e: EcrivainFlux): e is EcrivainCorrigeable {
  return typeof (e as Partial<EcrivainCorrigeable>).corriger === 'function';
}

/**
 * Crée le ZIP `nom` (ex. « Artiste - Titre (sortie).zip ») dans le dossier OPFS d'OCKA `dossier`.
 * Un ZIP du même nom en cours ou ancien est remplacé ; les AUTRES fichiers du dossier ne sont jamais effacés.
 * Erreurs : ErreurOcka « disque_plein » (quota), « trop_gros » (> 3,9 Go), « stockage » (pas d'OPFS).
 * Les appels (ecrire, fermer…) s'attendent les uns les autres : jamais deux écritures en même temps.
 */
export async function creerZip(dossier: NomDossier, nom: string): Promise<EcrivainZip> {
  return creerZipLimite(dossier, nom, TAILLE_MAX_ZIP);
}

/**
 * Nom du fichier DANS OPFS : seulement des caractères sûrs (Chrome refuse parfois « É » selon le système),
 * toujours le même pour un même nom. Le File rendu porte, lui, le vrai nom (« Été.zip »).
 */
export function nomDisque(nom: string): string {
  const sur = nom.replace(/[^A-Za-z0-9 ._()-]/gu, (c) => `_${c.codePointAt(0)!.toString(16)}`);
  if (sur.length <= 150) return sur;
  let h = 0;
  for (const c of nom) h = (Math.imul(h, 31) + c.codePointAt(0)!) >>> 0;
  return `${sur.slice(0, 140)}_${h.toString(36)}${sur.slice(sur.lastIndexOf('.'))}`.slice(0, 200);
}

/** Comme creerZip, avec une autre taille maximale (pour les tests). */
export async function creerZipLimite(dossier: NomDossier, nom: string, limite: number): Promise<EcrivainZip> {
  if (nom.includes('/') || !nomSur(nom)) throw new ErreurOcka(`Nom de fichier refusé : « ${nom} ».`, 'stockage');
  const surDisque = nomDisque(nom);
  let d: FileSystemDirectoryHandle;
  let poignee: FileSystemFileHandle;
  let disque: FileSystemWritableFileStream;
  try {
    d = await dossierOpfs(dossier);
    poignee = await d.getFileHandle(surDisque, { create: true });
    disque = await poignee.createWritable();
  } catch (e) {
    throw enErreurOcka(e, { message: 'Impossible de créer le fichier sur le téléphone.', code: 'stockage' });
  }
  const { heure, date } = dateDos(new Date());
  const tampon = new Uint8Array(TAMPON);
  let rempli = 0;
  /** Le tampon contient les octets [debutTampon, debutTampon + rempli) ; position = taille du fichier. */
  let debutTampon = 0;
  let position = 0;
  const entrees: InfosEntree[] = [];
  const noms = new Set<string>();
  let ouverte: EcrivainCorrigeable | null = null;
  let etat: 'ouvert' | 'termine' | 'annule' = 'ouvert';

  const ecrireA = (o: Uint8Array, a: number) => disque.write({ type: 'write', position: a, data: o as Uint8Array<ArrayBuffer> });
  async function vider() {
    if (rempli === 0) return;
    await ecrireA(tampon.subarray(0, rempli), debutTampon);
    debutTampon += rempli;
    rempli = 0;
  }
  async function pousser(o: Uint8Array) {
    if (position + o.length > limite) {
      throw new ErreurOcka(
        `Le fichier dépasserait ${formaterOctets(limite)}, la taille maximale d'un ZIP. Enlève des titres, ou choisis le FLAC (plus léger).`,
        'trop_gros',
      );
    }
    if (o.length >= TAMPON / 4) {
      await vider();
      await ecrireA(o, position);
      position += o.length;
      debutTampon = position;
      return;
    }
    if (rempli + o.length > TAMPON) await vider();
    tampon.set(o, rempli);
    rempli += o.length;
    position += o.length;
  }
  /** Récrit des octets déjà poussés (en-têtes) : dans le tampon si besoin, sinon sur le disque. */
  async function recrire(o: Uint8Array, a: number) {
    if (a + o.length > debutTampon) await vider();
    await ecrireA(o, a);
  }
  async function annulerInterne() {
    if (etat !== 'ouvert') return;
    etat = 'annule';
    await disque.abort().catch(() => {});
    await d.removeEntry(surDisque).catch(() => {});
  }
  /** Toute erreur : le fichier partiel est effacé, puis l'erreur est traduite (quota → « disque_plein »). */
  async function proteger<T>(f: () => Promise<T>): Promise<T> {
    if (etat !== 'ouvert') throw new ErreurOcka('Ce ZIP est déjà terminé ou annulé.', etat === 'annule' ? 'annule' : 'stockage');
    try {
      return await f();
    } catch (e) {
      await annulerInterne();
      throw enErreurOcka(e, { message: 'L’écriture du fichier a échoué. Réessaie.', code: 'stockage' });
    }
  }

  async function entree(nomEntree: string): Promise<EcrivainFlux> {
    const octetsNom = nomSur(nomEntree);
    await proteger(async () => {
      if (ouverte) throw new Error('ZIP : l’entrée précédente n’est pas fermée');
      if (!octetsNom) throw new ErreurOcka(`Nom refusé dans le ZIP : « ${nomEntree} ».`, 'projet_illisible');
      if (noms.has(nomEntree)) throw new ErreurOcka(`Deux fichiers s’appellent « ${nomEntree} » dans le ZIP.`, 'projet_illisible');
      if (entrees.length >= 0xffff) throw new ErreurOcka('Trop de fichiers dans le ZIP.', 'trop_gros');
    });
    noms.add(nomEntree);
    const info: InfosEntree = { nom: octetsNom!, crc: 0, taille: 0, heure, date, position };
    await proteger(() => pousser(enTeteLocal(info)));
    const debutDonnees = position;
    const tete = new Uint8Array(TETE_CORRIGEABLE);
    let crc = 0;
    let taille = 0;
    let fermee = false;
    const flux: EcrivainCorrigeable = {
      get position() {
        return taille;
      },
      async ecrire(o: Uint8Array) {
        if (fermee) throw new Error('ZIP : écriture dans une entrée fermée');
        await proteger(async () => {
          if (taille < TETE_CORRIGEABLE) tete.set(o.subarray(0, TETE_CORRIGEABLE - taille), taille);
          crc = crc32(o, crc);
          taille += o.length;
          await pousser(o);
        });
      },
      async corriger(p: number, o: Uint8Array) {
        if (fermee || p < 0 || p + o.length > Math.min(taille, TETE_CORRIGEABLE)) throw new Error('ZIP : correction hors du début de l’entrée');
        await proteger(async () => {
          crc = corrigerCrc(crc, taille, p, tete.slice(p, p + o.length), o);
          tete.set(o, p);
          await recrire(o, debutDonnees + p);
        });
      },
      async fermer() {
        if (fermee) return;
        fermee = true;
        info.crc = crc;
        info.taille = taille;
        await proteger(() => recrire(champsTaille(info), info.position + 14));
        entrees.push(info);
        ouverte = null;
      },
    };
    ouverte = flux;
    return flux;
  }

  return {
    entree,
    async ajouter(nomEntree, donnees) {
      const e = await entree(nomEntree);
      if (donnees instanceof Uint8Array) await e.ecrire(donnees);
      else {
        const lecteur = donnees.stream().getReader();
        for (;;) {
          let lu: ReadableStreamReadResult<Uint8Array>;
          try {
            lu = await lecteur.read();
          } catch (err) {
            await annulerInterne();
            throw enErreurOcka(err, { message: 'Un fichier à mettre dans le ZIP n’a pas pu être lu.', code: 'stockage' });
          }
          if (lu.done) break;
          await e.ecrire(lu.value);
        }
      }
      await e.fermer();
    },
    async terminer() {
      if (ouverte) await ouverte.fermer();
      await proteger(async () => {
        await pousser(repertoireCentral(entrees, position));
        await vider();
        await disque.close();
      });
      etat = 'termine';
      const f = await poignee.getFile();
      return new File([f], nom, { type: nom.endsWith('.zip') ? 'application/zip' : 'application/octet-stream', lastModified: f.lastModified });
    },
    annuler: annulerInterne,
  };
}
