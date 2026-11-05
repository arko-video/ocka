// Format d'un projet OCKA (ZIP « stocké ») — partagé par l'export et l'import. Propriétaire : A2.
//   Titre.ocka         : ocka.json { type: 'morceau', version: 1 }, morceau.json,
//                        prises/<clé>.wav (WAV 32 bits flottants, mono), sons/<clé>.wav (1 ou 2 canaux)
//   Titre.ocka-sortie  : ocka.json { type: 'sortie', version: 1 }, sortie.json, pochette.jpg,
//                        morceaux/<id>.ocka (un projet complet par titre, imbriqué, lu par File.slice)
// Les noms des fichiers dans le ZIP viennent des clés OPFS (« prise-x.f32 » → « prises/prise-x.wav ») : ils ne
// servent qu'à relier le JSON aux fichiers. À l'import, chaque fichier reçoit une clé NEUVE.

import { ErreurOcka } from '../moteur/erreur';
import { PLAFONDS } from '../morceau/types';
import { TAILLE_MAX_ZIP, type LecteurZip, type ReglesLectureZip } from '../zip/types';

export const VERSION_PROJET = 1;
const MAX_JSON = 2 * 1024 * 1024;
const PRISE = /^prises\/prise-[A-Za-z0-9_-]{1,40}\.wav$/;
const SON = /^sons\/son-[A-Za-z0-9_-]{1,40}\.wav$/;
const MORCEAU = /^morceaux\/[A-Za-z0-9_-]{1,40}\.ocka$/;

export const REGLES_MORCEAU: ReglesLectureZip = {
  tailleMax: 1e9,
  noms: ['ocka.json', 'morceau.json', PRISE, SON],
  deflate: ['ocka.json', 'morceau.json'],
  maxDeflate: MAX_JSON,
  maxEntrees: 2 + PLAFONDS.prises + PLAFONDS.sons,
};

export const REGLES_SORTIE: ReglesLectureZip = {
  tailleMax: TAILLE_MAX_ZIP,
  noms: ['ocka.json', 'sortie.json', 'pochette.jpg', MORCEAU],
  deflate: ['ocka.json', 'sortie.json'],
  maxDeflate: MAX_JSON,
  maxEntrees: 3 + PLAFONDS.titresParSortie,
};

/** Première lecture, avant de connaître le type : l'union des deux listes. */
export const REGLES_TOUT: ReglesLectureZip = {
  tailleMax: TAILLE_MAX_ZIP,
  noms: [...new Set([...REGLES_MORCEAU.noms, ...REGLES_SORTIE.noms])],
  deflate: ['ocka.json', 'morceau.json', 'sortie.json'],
  maxDeflate: MAX_JSON,
  maxEntrees: Math.max(REGLES_MORCEAU.maxEntrees, REGLES_SORTIE.maxEntrees),
};

export const nomZipPrise = (cle: string) => `prises/${cle.replace(/\.f32$/, '')}.wav`;
export const nomZipSon = (cle: string) => `sons/${cle.replace(/\.f32$/, '')}.wav`;
export const nomZipMorceau = (id: string) => `morceaux/${id}.ocka`;

/** « Mon titre.ocka » : nom de fichier propre (ni « / », ni « : », ni caractère de contrôle). */
export function nomProjet(titre: string, extension: 'ocka' | 'ocka-sortie'): string {
  const propre = titre.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
  return `${propre || 'Projet'}.${extension}`;
}

export const json = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));

export function illisible(detail: string): ErreurOcka {
  return new ErreurOcka(`Ce fichier n’est pas un projet OCKA valable : ${detail}.`, 'projet_illisible');
}

/** Lit un JSON du ZIP (texte vérifié par lireZip). */
export async function lireJson(z: LecteurZip, nom: string): Promise<unknown> {
  const texte = await z.texte(nom);
  try {
    return JSON.parse(texte) as unknown;
  } catch {
    throw illisible(`« ${nom} » n’est pas du JSON`);
  }
}

/** Type et version du projet (ocka.json). « format_recent » si la version dépasse celle de cette appli. */
export async function lireType(z: LecteurZip): Promise<'morceau' | 'sortie'> {
  const o = (await lireJson(z, 'ocka.json')) as { type?: unknown; version?: unknown } | null;
  if (!o || typeof o !== 'object' || (o.type !== 'morceau' && o.type !== 'sortie')) throw illisible('type inconnu');
  if (typeof o.version !== 'number' || !Number.isInteger(o.version) || o.version < 1) throw illisible('version inconnue');
  if (o.version > VERSION_PROJET) {
    throw new ErreurOcka('Ce projet vient d’une version plus récente d’OCKA. Mets OCKA à jour, puis réessaie.', 'format_recent');
  }
  return o.type;
}

/** Vérifie l'annulation entre deux morceaux de travail. */
export function verifierAnnulation(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ErreurOcka('Annulé.', 'annule');
}
