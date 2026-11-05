// Structures du ZIP (APPNOTE de PKWARE), en petit-boutiste. Fonctions pures, partagées par l'écriture et la lecture.
// OCKA n'écrit que la méthode « stocké » (0), noms en UTF-8 (bit 11), sans ZIP64 ni descripteur de données.

export const SIG_LOCAL = 0x04034b50;
export const SIG_CENTRAL = 0x02014b50;
export const SIG_FIN = 0x06054b50;
export const SIG_LOCALISATEUR64 = 0x07064b50;
export const TAILLE_LOCAL = 30;
export const TAILLE_CENTRAL = 46;
export const TAILLE_FIN = 22;
/** Bit 11 : nom en UTF-8. */
export const DRAPEAU_UTF8 = 0x0800;
/** Version 2.0 : stocké ou deflate, sans ZIP64. */
export const VERSION = 20;
/** « Fait par » Unix (3), version 2.0 : les droits ci-dessous sont lus comme des droits Unix. */
const FAIT_PAR = (3 << 8) | VERSION;
/** -rw-r--r-- (fichier normal), dans les 16 bits hauts des attributs externes. */
const ATTRIBUTS = (0o100644 << 16) >>> 0;
/** Longueur maximale d'un nom (octets UTF-8). */
export const NOM_MAX = 1024;

const encodeur = new TextEncoder();

/** Date et heure au format DOS (heure locale, à 2 s près ; 1980 au plus tôt). */
export function dateDos(d: Date): { heure: number; date: number } {
  const annee = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    heure: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((annee - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Nom d'entrée sûr : chemin relatif en « / », sans « .. » ni « . », sans segment vide, sans « \ », « : »
 * ni caractère de contrôle. Renvoie ses octets UTF-8, ou null s'il est refusé.
 */
export function nomSur(nom: string): Uint8Array | null {
  if (typeof nom !== 'string' || nom.length === 0) return null;
  if (/[\u0000-\u001f\u007f\\:]/.test(nom)) return null;
  const segments = nom.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return null;
  const octets = encodeur.encode(nom);
  return octets.length <= NOM_MAX ? octets : null;
}

export interface InfosEntree {
  nom: Uint8Array;
  crc: number;
  taille: number;
  heure: number;
  date: number;
  /** Position de l'en-tête local dans le fichier. */
  position: number;
}

/** En-tête local (CRC et tailles à 0 tant que l'entrée n'est pas fermée). */
export function enTeteLocal(e: InfosEntree): Uint8Array<ArrayBuffer> {
  const o = new Uint8Array(TAILLE_LOCAL + e.nom.length);
  const v = new DataView(o.buffer);
  v.setUint32(0, SIG_LOCAL, true);
  v.setUint16(4, VERSION, true);
  v.setUint16(6, DRAPEAU_UTF8, true);
  v.setUint16(8, 0, true); // stocké
  v.setUint16(10, e.heure, true);
  v.setUint16(12, e.date, true);
  o.set(champsTaille(e), 14);
  v.setUint16(26, e.nom.length, true);
  v.setUint16(28, 0, true); // pas de champ « extra »
  o.set(e.nom, TAILLE_LOCAL);
  return o;
}

/** Les 12 octets corrigés à la fermeture : CRC, taille compressée, taille (égales : stocké). */
export function champsTaille(e: Pick<InfosEntree, 'crc' | 'taille'>): Uint8Array<ArrayBuffer> {
  const o = new Uint8Array(12);
  const v = new DataView(o.buffer);
  v.setUint32(0, e.crc >>> 0, true);
  v.setUint32(4, e.taille, true);
  v.setUint32(8, e.taille, true);
  return o;
}

/** Répertoire central + fin de répertoire, écrits à `debut` (position du répertoire dans le fichier). */
export function repertoireCentral(entrees: InfosEntree[], debut: number): Uint8Array<ArrayBuffer> {
  const taille = entrees.reduce((s, e) => s + TAILLE_CENTRAL + e.nom.length, 0);
  const o = new Uint8Array(taille + TAILLE_FIN);
  const v = new DataView(o.buffer);
  let p = 0;
  for (const e of entrees) {
    v.setUint32(p, SIG_CENTRAL, true);
    v.setUint16(p + 4, FAIT_PAR, true);
    v.setUint16(p + 6, VERSION, true);
    v.setUint16(p + 8, DRAPEAU_UTF8, true);
    v.setUint16(p + 10, 0, true);
    v.setUint16(p + 12, e.heure, true);
    v.setUint16(p + 14, e.date, true);
    o.set(champsTaille(e), p + 16);
    v.setUint16(p + 28, e.nom.length, true);
    // extra, commentaire, disque, attributs internes : 0
    v.setUint32(p + 38, ATTRIBUTS, true);
    v.setUint32(p + 42, e.position, true);
    o.set(e.nom, p + TAILLE_CENTRAL);
    p += TAILLE_CENTRAL + e.nom.length;
  }
  v.setUint32(p, SIG_FIN, true);
  v.setUint16(p + 8, entrees.length, true);
  v.setUint16(p + 10, entrees.length, true);
  v.setUint32(p + 12, taille, true);
  v.setUint32(p + 16, debut, true);
  return o;
}
