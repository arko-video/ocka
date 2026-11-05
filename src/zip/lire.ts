// Lecture sûre d'un ZIP par son répertoire central (interfaces et règles : ./types.ts). Propriétaire : A2.
// On ne lit que la fin du fichier (répertoire central), puis l'en-tête local de chaque entrée (File.slice) :
// rien n'est chargé d'un coup. Tout ce qui n'est pas permis est refusé (§5) : chiffré, ZIP64, méthode autre
// que 0 ou 8, noms en double ou hors liste blanche, nom local ≠ nom central, plages qui se chevauchent.
// Le deflate n'est permis que pour le JSON, et coupé à `maxDeflate` (bombe de décompression).

import { ErreurOcka } from '../moteur/erreur';
import { formaterOctets } from '../stockage/dossiers';
import { crc32 } from './crc32';
import { nomSur, SIG_CENTRAL, SIG_FIN, SIG_LOCAL, SIG_LOCALISATEUR64, TAILLE_CENTRAL, TAILLE_FIN, TAILLE_LOCAL } from './format';
import { TAILLE_MAX_ZIP, type EntreeZip, type LecteurZip, type ReglesLectureZip } from './types';

const MESSAGE = 'Ce fichier n’est pas un projet OCKA valable (abîmé ou modifié)';
const decodeur = new TextDecoder('utf-8', { fatal: true });

function refus(detail: string): ErreurOcka {
  return new ErreurOcka(`${MESSAGE} : ${detail}.`, 'projet_illisible');
}

async function octets(f: Blob, debut: number, fin: number): Promise<DataView> {
  if (debut < 0 || fin > f.size || fin < debut) throw refus('une partie du fichier manque');
  const b = await f.slice(debut, fin).arrayBuffer();
  if (b.byteLength !== fin - debut) throw refus('lecture incomplète');
  return new DataView(b);
}

/** true si `nom` est permis par la liste blanche (chaîne exacte, ou RegExp qui couvre TOUT le nom). */
export function nomPermis(nom: string, liste: readonly (string | RegExp)[]): boolean {
  return liste.some((r) => {
    if (typeof r === 'string') return r === nom;
    const re = new RegExp(r.source, r.flags.replace(/[gy]/g, ''));
    const m = re.exec(nom);
    return !!m && m.index === 0 && m[0].length === nom.length;
  });
}

interface Interne extends EntreeZip {
  debut: number; // en-tête local
  donnees: number; // début des données
}

/**
 * Ouvre `f` en lecture selon `regles`. Ne lit que la fin du fichier (répertoire central) puis les en-têtes locaux.
 * Erreurs : ErreurOcka « projet_illisible » (règle violée, fichier abîmé), « projet_trop_gros » (> regles.tailleMax).
 */
export async function lireZip(f: File, regles: ReglesLectureZip): Promise<LecteurZip> {
  if (f.size > Math.min(regles.tailleMax, TAILLE_MAX_ZIP)) {
    throw new ErreurOcka(`Ce fichier est trop gros pour être importé (plus de ${formaterOctets(Math.min(regles.tailleMax, TAILLE_MAX_ZIP))}).`, 'projet_trop_gros');
  }
  if (f.size < TAILLE_FIN) throw refus('fichier trop court');

  // 1. Fin du répertoire central : cherchée à reculons (un commentaire de 65 535 octets au plus peut suivre).
  const debutFin = Math.max(0, f.size - TAILLE_FIN - 0xffff);
  const queue = await octets(f, debutFin, f.size);
  let fin = -1;
  for (let p = queue.byteLength - TAILLE_FIN; p >= 0; p--) {
    if (queue.getUint32(p, true) === SIG_FIN && p + TAILLE_FIN + queue.getUint16(p + 20, true) === queue.byteLength) {
      fin = p;
      break;
    }
  }
  if (fin < 0) throw refus('fin du ZIP introuvable');
  const posFin = debutFin + fin;
  if (fin >= 20 && queue.getUint32(fin - 20, true) === SIG_LOCALISATEUR64) throw refus('format ZIP64 refusé');
  const disque = queue.getUint16(fin + 4, true);
  const disqueRep = queue.getUint16(fin + 6, true);
  const ici = queue.getUint16(fin + 8, true);
  const total = queue.getUint16(fin + 10, true);
  const tailleRep = queue.getUint32(fin + 12, true);
  const debutRep = queue.getUint32(fin + 16, true);
  if (total === 0xffff || tailleRep === 0xffffffff || debutRep === 0xffffffff) throw refus('format ZIP64 refusé');
  if (disque !== 0 || disqueRep !== 0 || ici !== total) throw refus('ZIP en plusieurs morceaux refusé');
  if (total > regles.maxEntrees) throw refus(`trop de fichiers (${total})`);
  if (debutRep + tailleRep !== posFin) throw refus('répertoire central mal placé');

  // 2. Répertoire central.
  const rep = await octets(f, debutRep, posFin);
  const entrees: Interne[] = [];
  const noms = new Set<string>();
  let p = 0;
  for (let i = 0; i < total; i++) {
    if (p + TAILLE_CENTRAL > rep.byteLength || rep.getUint32(p, true) !== SIG_CENTRAL) throw refus('répertoire central abîmé');
    const drapeaux = rep.getUint16(p + 8, true);
    const methode = rep.getUint16(p + 10, true);
    const crc = rep.getUint32(p + 16, true);
    const tailleCompressee = rep.getUint32(p + 20, true);
    const taille = rep.getUint32(p + 24, true);
    const lNom = rep.getUint16(p + 28, true);
    const lExtra = rep.getUint16(p + 30, true);
    const lCommentaire = rep.getUint16(p + 32, true);
    const debut = rep.getUint32(p + 42, true);
    if (p + TAILLE_CENTRAL + lNom + lExtra + lCommentaire > rep.byteLength) throw refus('répertoire central abîmé');
    if (drapeaux & 0x2041) throw refus('fichier chiffré refusé');
    if (methode !== 0 && methode !== 8) throw refus(`compression ${methode} refusée`);
    if (tailleCompressee === 0xffffffff || taille === 0xffffffff || debut === 0xffffffff) throw refus('format ZIP64 refusé');
    if (contientZip64(rep, p + TAILLE_CENTRAL + lNom, lExtra)) throw refus('format ZIP64 refusé');
    let nom: string;
    try {
      nom = decodeur.decode(new Uint8Array(rep.buffer, p + TAILLE_CENTRAL, lNom));
    } catch {
      throw refus('nom illisible');
    }
    if (!nomSur(nom)) throw refus(`nom dangereux « ${nom.slice(0, 60)} »`);
    if (!nomPermis(nom, regles.noms)) throw refus(`fichier inattendu « ${nom.slice(0, 60)} »`);
    if (noms.has(nom)) throw refus(`deux fichiers s’appellent « ${nom.slice(0, 60)} »`);
    noms.add(nom);
    if (methode === 8 && !regles.deflate.includes(nom)) throw refus(`« ${nom} » ne doit pas être compressé`);
    if (methode === 0 && tailleCompressee !== taille) throw refus(`tailles incohérentes pour « ${nom} »`);
    if (methode === 8 && taille > regles.maxDeflate) throw refus(`« ${nom} » est trop gros`);
    entrees.push({ nom, taille, tailleCompressee, methode, crc32: crc, debut, donnees: 0 });
    p += TAILLE_CENTRAL + lNom + lExtra + lCommentaire;
  }
  if (p !== rep.byteLength) throw refus('répertoire central abîmé');

  // 3. En-têtes locaux : même nom, même méthode, pas chiffré ; plages sans chevauchement, avant le répertoire.
  const encodeur = new TextEncoder();
  for (const e of entrees) {
    if (e.debut + TAILLE_LOCAL > debutRep) throw refus(`en-tête de « ${e.nom} » introuvable`);
    const t = await octets(f, e.debut, e.debut + TAILLE_LOCAL);
    if (t.getUint32(0, true) !== SIG_LOCAL) throw refus(`en-tête de « ${e.nom} » introuvable`);
    if (t.getUint16(6, true) & 0x2041) throw refus('fichier chiffré refusé');
    if (t.getUint16(8, true) !== e.methode) throw refus(`méthode incohérente pour « ${e.nom} »`);
    const lNom = t.getUint16(26, true);
    const lExtra = t.getUint16(28, true);
    const attendu = encodeur.encode(e.nom);
    if (lNom !== attendu.length || e.debut + TAILLE_LOCAL + lNom + lExtra > debutRep) throw refus(`nom local différent pour « ${e.nom} »`);
    const v = await octets(f, e.debut + TAILLE_LOCAL, e.debut + TAILLE_LOCAL + lNom + lExtra);
    const lu = new Uint8Array(v.buffer, 0, lNom);
    if (lu.some((o, i) => o !== attendu[i])) throw refus(`nom local différent pour « ${e.nom} »`);
    if (contientZip64(v, lNom, lExtra)) throw refus('format ZIP64 refusé');
    e.donnees = e.debut + TAILLE_LOCAL + lNom + lExtra;
  }
  const triees = [...entrees].sort((a, b) => a.debut - b.debut);
  let limite = 0;
  for (const e of triees) {
    const finDonnees = e.donnees + e.tailleCompressee;
    if (e.debut < limite) throw refus('des fichiers se chevauchent');
    if (finDonnees > debutRep) throw refus(`« ${e.nom} » déborde`);
    limite = finDonnees;
  }

  const trouver = (nom: string): Interne => {
    const e = entrees.find((x) => x.nom === nom);
    if (!e) throw refus(`« ${nom} » manque`);
    return e;
  };
  return {
    entrees: entrees.map(({ nom, taille, tailleCompressee, methode, crc32: c }) => ({ nom, taille, tailleCompressee, methode, crc32: c })),
    blob(nom) {
      const e = trouver(nom);
      if (e.methode !== 0) throw refus(`« ${nom} » est compressé`);
      return f.slice(e.donnees, e.donnees + e.taille);
    },
    async texte(nom) {
      const e = trouver(nom);
      if (e.taille > regles.maxDeflate) throw refus(`« ${nom} » est trop gros`);
      const brut = f.slice(e.donnees, e.donnees + e.tailleCompressee);
      const contenu = e.methode === 0 ? new Uint8Array(await brut.arrayBuffer()) : await decompresser(brut, e.taille, nom);
      if (contenu.length !== e.taille || crc32(contenu) !== e.crc32) throw refus(`« ${nom} » est abîmé (contrôle faux)`);
      try {
        return decodeur.decode(contenu);
      } catch {
        throw refus(`« ${nom} » n’est pas du texte`);
      }
    },
  };
}

/** true si le champ « extra » contient un bloc ZIP64 (identifiant 0x0001). */
function contientZip64(v: DataView, debut: number, longueur: number): boolean {
  let p = debut;
  while (p + 4 <= debut + longueur) {
    if (v.getUint16(p, true) === 0x0001) return true;
    p += 4 + v.getUint16(p + 2, true);
  }
  return false;
}

/** Deflate brut → octets, coupé dès qu'on dépasse la taille annoncée (bombe de décompression). */
async function decompresser(b: Blob, annonce: number, nom: string): Promise<Uint8Array> {
  const sortie = new Uint8Array(annonce);
  let n = 0;
  const lecteur = b.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      if (n + value.length > annonce) throw refus(`« ${nom} » est plus gros qu’annoncé`);
      sortie.set(value, n);
      n += value.length;
    }
  } catch (e) {
    void lecteur.cancel().catch(() => {});
    if (e instanceof ErreurOcka) throw e;
    throw refus(`« ${nom} » est mal compressé`);
  }
  if (n !== annonce) throw refus(`« ${nom} » est plus petit qu’annoncé`);
  return sortie;
}
