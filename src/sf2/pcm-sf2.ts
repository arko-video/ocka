// PCM d'une zone de SoundFont : lu dans le bloc « smpl » (16 bits petit-boutiste) par morceaux, converti en flottant,
// puis l'enveloppe simple de la zone y est appliquée (attaque ; sans boucle : maintien, chute vers le soutien).
// Avec une boucle, seule l'attaque (avant la boucle) est appliquée : la boucle reste un passage constant.

import type { PcmSon } from '../moteur/types-moteur';
import type { Lecteur } from './riff';
import type { ZoneSf2 } from './zones-sf2';

function versFlottant(o: Uint8Array): Float32Array {
  const v = new DataView(o.buffer, o.byteOffset, o.byteLength);
  const n = Math.floor(o.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = v.getInt16(i * 2, true) / 32768;
  return out;
}

/** Applique l'enveloppe de la zone (gain par échantillon). */
export function appliquerEnveloppe(x: Float32Array, z: Pick<ZoneSf2, 'attaque' | 'maintien' | 'chute' | 'soutienDb' | 'boucle' | 'debut' | 'frequence'>): void {
  const sr = z.frequence;
  const limite = z.boucle ? z.boucle.debut - z.debut : x.length;
  const a = Math.min(Math.round(z.attaque * sr), limite);
  for (let i = 0; i < a; i++) x[i] = x[i]! * ((i + 0.5) / a);
  if (z.boucle || z.soutienDb >= 0) return;
  const h = a + Math.round(z.maintien * sr);
  // SF2 : la chute est le temps pour descendre de 100 dB ; on s'arrête au soutien.
  const parEchantillon = 100 / Math.max(1, z.chute * sr);
  for (let i = h; i < x.length; i++) {
    const db = Math.max(z.soutienDb, -(i - h) * parEchantillon);
    x[i] = x[i]! * Math.pow(10, db / 20);
  }
}

/** Le PCM d'une zone (`smpl` : position du bloc dans le fichier). */
export async function lirePcmZone(lire: Lecteur, smpl: number, z: ZoneSf2): Promise<PcmSon> {
  const canal = async (debut: number) => {
    const x = versFlottant(await lire(smpl + debut * 2, smpl + (debut + z.fin - z.debut) * 2));
    appliquerEnveloppe(x, z);
    return x;
  };
  const canaux = [await canal(z.debut)];
  if (z.droite !== undefined && z.droiteDebut !== undefined) canaux.push(await canal(z.droiteDebut));
  return { frequence: z.frequence, canaux };
}
