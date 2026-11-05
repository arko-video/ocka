// « Tes sons » : import d'un fichier audio (WAV, MP3, M4A, OGG) et lecture de son PCM. Propriétaire : A2.
// Fichier dans OPFS « ocka-sons » : « son-<id>.f32 » = PCM flottant (petit-boutiste) PAR CANAL, à la fréquence
// d'origine : tout le canal 0, puis tout le canal 1 (stéréo). Le graphe (M1) le rééchantillonne une fois.
// Sécurité : la durée est lue AVANT de décoder (en-tête WAV, sinon métadonnées) : un petit MP3 de plusieurs
// heures ne doit jamais être décodé en entier (des Go en mémoire).

import { nouvelId } from '../enregistrement/contexte';
import { ErreurOcka } from '../moteur/erreur';
import type { PcmSon } from '../moteur/types-moteur';
import { lireWav } from '../moteur/wav';
import { PLAFONDS, REGLE_CLE_SON, type Morceau, type SonImporte } from '../morceau/types';
import { dossierOpfs, enErreurOcka, verifierPlace } from '../stockage/dossiers';

/** 20 Mo au plus par fichier importé. */
export const TAILLE_MAX_SON = 20e6;
const FREQ_MIN = 8000;
const FREQ_MAX = 192000;

export interface InfosAudio {
  duree: number;
  frequence: number;
  canaux: number;
}

const illisible = () => new ErreurOcka('Ce fichier audio est illisible. Essaie un WAV ou un MP3.', 'son_illisible');

/** Durée, fréquence et canaux d'un fichier audio SANS le décoder : en-tête WAV, sinon métadonnées (Mediabunny). */
export async function lireInfosAudio(f: Blob): Promise<InfosAudio | null> {
  const tete = new Uint8Array(await f.slice(0, 64 * 1024).arrayBuffer());
  const wav = lireWav(tete, f.size);
  if (wav) return wav.trames > 0 && wav.frequence > 0 ? { duree: wav.trames / wav.frequence, frequence: wav.frequence, canaux: wav.canaux } : null;
  if (String.fromCharCode(...tete.subarray(0, 4)) === 'RIFF') return null; // WAV abîmé
  try {
    const mb = await import('mediabunny');
    const entree = new mb.Input({ source: new mb.BlobSource(f), formats: mb.ALL_FORMATS });
    try {
      const piste = await entree.getPrimaryAudioTrack();
      if (!piste) return null;
      return { duree: await entree.computeDuration([piste]), frequence: piste.sampleRate, canaux: piste.numberOfChannels };
    } finally {
      entree.dispose();
    }
  } catch {
    return null;
  }
}

/** Nom affiché : le nom du fichier sans extension, propre, 60 caractères au plus. */
export function nomSon(nomFichier: string): string {
  const sans = nomFichier.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\.[A-Za-z0-9]{1,5}$/, '').trim();
  return sans.slice(0, 60) || 'Mon son';
}

const formater = (s: number) => `${Math.round(s * 10) / 10} s`.replace('.', ',');

/** Vérifie les plafonds du morceau (16 sons, 120 s en tout) pour un son de `duree` secondes. */
export function verifierPlafonds(morceau: Pick<Morceau, 'sons'>, duree: number): void {
  const sons = morceau.sons ?? [];
  if (sons.length >= PLAFONDS.sons) {
    throw new ErreurOcka(`Un morceau a ${PLAFONDS.sons} sons au plus. Retire un son avant d’en ajouter un.`, 'trop_de_sons');
  }
  const deja = sons.reduce((s, x) => s + (Number.isFinite(x.duree) ? x.duree : 0), 0);
  if (deja + duree > PLAFONDS.dureeSons) {
    const reste = Math.max(0, PLAFONDS.dureeSons - deja);
    throw new ErreurOcka(
      `Ce son dure ${formater(duree)} : il reste ${formater(reste)} pour les sons de ce morceau (${PLAFONDS.dureeSons} s en tout). Coupe-le, ou retire un son.`,
      'son_trop_long',
    );
  }
}

/** Voir api-fichiers.ts. Ne modifie PAS le morceau : l'interface ajoute le SonImporte rendu dans morceau.sons. */
export async function importerSon(f: File, morceau: Morceau): Promise<SonImporte> {
  if (f.size > TAILLE_MAX_SON) throw new ErreurOcka('Ce fichier est trop gros (plus de 20 Mo). Coupe-le, ou exporte-le en MP3.', 'son_trop_gros');
  verifierPlafonds(morceau, 0);
  const infos = await lireInfosAudio(f);
  if (!infos || !(infos.duree > 0) || infos.frequence < FREQ_MIN || infos.frequence > FREQ_MAX) throw illisible();
  verifierPlafonds(morceau, infos.duree); // AVANT de décoder

  // Décodage à la fréquence d'origine (le contexte a cette fréquence : pas de rééchantillonnage ici).
  let audio: AudioBuffer;
  try {
    audio = await new OfflineAudioContext(1, 1, Math.round(infos.frequence)).decodeAudioData(await f.arrayBuffer());
  } catch {
    throw illisible();
  }
  const n = audio.length;
  if (n === 0) throw illisible();
  const duree = n / audio.sampleRate;
  verifierPlafonds(morceau, duree); // l'en-tête a pu mentir
  const canaux: 1 | 2 = audio.numberOfChannels >= 2 ? 2 : 1;
  const id = nouvelId();
  const fichier = `son-${id}.f32`;
  await verifierPlace(n * canaux * 4, 1.1);
  const d = await dossierOpfs('sons');
  try {
    const flux = await (await d.getFileHandle(fichier, { create: true })).createWritable();
    try {
      for (let c = 0; c < canaux; c++) await flux.write(audio.getChannelData(c) as Float32Array<ArrayBuffer>);
      await flux.close();
    } catch (e) {
      await flux.abort().catch(() => {});
      throw e;
    }
  } catch (e) {
    await d.removeEntry(fichier).catch(() => {});
    throw enErreurOcka(e, { message: 'Le son n’a pas pu être rangé sur le téléphone.', code: 'stockage' });
  }
  return { id, nom: nomSon(f.name), fichier, frequence: audio.sampleRate, duree, canaux };
}

/** Le fichier d'un son (lu plus tard, par morceaux), ou null s'il n'existe pas. */
export async function fichierSon(cle: string): Promise<File | null> {
  if (!REGLE_CLE_SON.test(cle)) return null;
  try {
    return await (await (await dossierOpfs('sons')).getFileHandle(cle)).getFile();
  } catch {
    return null;
  }
}

/** PCM d'un son importé (pour le graphe), ou null si son fichier n'existe plus. */
export async function lireSon(son: SonImporte): Promise<PcmSon | null> {
  if (son.canaux !== 1 && son.canaux !== 2) return null;
  const f = await fichierSon(son.fichier);
  if (!f) return null;
  const b = await f.arrayBuffer().catch(() => null);
  if (!b) return null;
  const n = Math.floor(b.byteLength / 4 / son.canaux);
  if (n === 0) return null;
  return { frequence: son.frequence, canaux: Array.from({ length: son.canaux }, (_, c) => new Float32Array(b, c * n * 4, n)) };
}

/** Copie le fichier d'un son (dupliquer un morceau) ; renvoie le son avec son NOUVEAU fichier (même id). */
export async function copierSon(son: SonImporte): Promise<SonImporte> {
  const source = await fichierSon(son.fichier);
  if (!source) throw new ErreurOcka('Le fichier d’un son est introuvable sur le téléphone : le morceau n’a pas été dupliqué.', 'duplication_impossible');
  const fichier = `son-${nouvelId()}.f32`;
  const d = await dossierOpfs('sons');
  try {
    await source.stream().pipeTo(await (await d.getFileHandle(fichier, { create: true })).createWritable());
  } catch {
    await d.removeEntry(fichier).catch(() => {});
    throw new ErreurOcka('La copie des sons a échoué (stockage du téléphone plein ?). Le morceau n’a pas été dupliqué.', 'duplication_impossible');
  }
  return { ...son, fichier };
}

/** Efface le fichier d'un son (nettoyage après un échec ; sinon c'est le ramasse-miettes qui s'en charge). */
export async function supprimerSon(cle: string): Promise<void> {
  if (!REGLE_CLE_SON.test(cle)) return;
  await (await dossierOpfs('sons')).removeEntry(cle).catch(() => {});
}
