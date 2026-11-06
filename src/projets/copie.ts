// Import d'un projet : recopie EN FLUX des WAV du ZIP vers OPFS (ocka-prises, ocka-sons), sous leur clé neuve.
// Le CRC32 de l'entrée est recalculé pendant la copie : un fichier abîmé fait échouer l'import (tout ou rien).
// Sons stéréo : le WAV est entrelacé (G D G D…), le fichier d'OCKA est par canal (tout G, puis tout D).
// SoundFonts (C3, `wav` null) : recopiées telles quelles.

import type { OptionsLongues } from '../moteur/api-fichiers';
import type { InfosWav } from '../moteur/wav';
import { crc32 } from '../zip/crc32';
import { illisible, verifierAnnulation } from './commun';

export interface Copie {
  dossier: 'prises' | 'sons' | 'sf2';
  /** Clé NEUVE du fichier dans OPFS. */
  cle: string;
  /** L'entrée du ZIP (WAV complet : en-tête + données), sans copie (File.slice). */
  blob: Blob;
  /** null : fichier recopié tel quel (SoundFont). */
  wav: InfosWav | null;
  /** CRC32 annoncé par le ZIP. */
  crc: number;
}

/** Un fichier créé pendant l'import (effacé si l'import échoue). */
export interface Cree {
  dossier: FileSystemDirectoryHandle;
  nom: string;
}

type Dossiers = Record<Copie['dossier'], FileSystemDirectoryHandle>;

/** Recopie chaque fichier ; progression = (fait + octets recopiés) / total. */
export async function copierVersOpfs(copies: Copie[], dossiers: Dossiers, crees: Cree[], options: OptionsLongues, total: number, fait: number): Promise<void> {
  for (const c of copies) {
    verifierAnnulation(options.signal);
    const d = dossiers[c.dossier];
    crees.push({ dossier: d, nom: c.cle });
    const flux = await (await d.getFileHandle(c.cle, { create: true })).createWritable();
    try {
      await copierEntree(c, flux, options, (n) => {
        fait += n;
        options.surProgression?.(Math.min(1, fait / total));
      });
      await flux.close();
    } catch (e) {
      await flux.abort().catch(() => {});
      throw e;
    }
  }
}

async function copierEntree(c: Copie, flux: FileSystemWritableFileStream, options: OptionsLongues, avancer: (n: number) => void): Promise<void> {
  if (!c.wav) return copierTelQuel(c, flux, options, avancer);
  const { donnees, trames, canaux } = c.wav;
  const fin = donnees + trames * 4 * canaux;
  const ecrire = (position: number, data: Uint8Array | Float32Array) => flux.write({ type: 'write', position, data: data as Uint8Array<ArrayBuffer> });
  let crc = 0;
  let pos = 0; // position dans l'entrée
  let reste = new Uint8Array(0); // stéréo : octets d'une trame incomplète
  let trame = 0;
  const lecteur = c.blob.stream().getReader();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    verifierAnnulation(options.signal);
    crc = crc32(value, crc);
    const a = Math.max(donnees, pos);
    const b = Math.min(fin, pos + value.length);
    if (b > a) {
      const utile = value.subarray(a - pos, b - pos);
      if (canaux === 1) await ecrire(a - donnees, utile);
      else {
        const tout = new Uint8Array(reste.length + utile.length);
        tout.set(reste);
        tout.set(utile, reste.length);
        const k = Math.floor(tout.length / 8);
        const x = new Float32Array(tout.buffer, 0, 2 * k);
        const g = new Float32Array(k);
        const d = new Float32Array(k);
        for (let i = 0; i < k; i++) {
          g[i] = x[2 * i]!;
          d[i] = x[2 * i + 1]!;
        }
        await ecrire(trame * 4, g);
        await ecrire((trames + trame) * 4, d);
        trame += k;
        reste = tout.slice(8 * k);
      }
      avancer(b - a);
    }
    pos += value.length;
  }
  if (pos !== c.blob.size || crc !== c.crc) throw illisible('un fichier audio est abîmé (contrôle faux)');
}

/** Copie brute (SoundFont) : CRC32 vérifié. */
async function copierTelQuel(c: Copie, flux: FileSystemWritableFileStream, options: OptionsLongues, avancer: (n: number) => void): Promise<void> {
  let crc = 0;
  let pos = 0;
  const lecteur = c.blob.stream().getReader();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    verifierAnnulation(options.signal);
    crc = crc32(value, crc);
    await flux.write({ type: 'write', position: pos, data: value as Uint8Array<ArrayBuffer> });
    pos += value.length;
    avancer(value.length);
  }
  if (pos !== c.blob.size || crc !== c.crc) throw illisible('une SoundFont est abîmée (contrôle faux)');
}
