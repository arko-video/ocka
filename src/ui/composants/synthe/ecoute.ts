// Écoute immédiate d'un son fabriqué (kick, bruitage) : joué tout de suite, hors du lecteur, comme l'écoute d'une
// prise. Un nouveau son coupe le précédent.
import { contexteAudio, type fabriquerSon } from '../../../moteur/api';

let arreter: (() => void) | null = null;

export async function ecouterPcm(pcm: ReturnType<typeof fabriquerSon>): Promise<void> {
  arreter?.();
  const ctx = contexteAudio();
  await ctx.resume();
  const c = pcm.canaux[0];
  if (!c || c.length === 0) return;
  const tampon = ctx.createBuffer(pcm.canaux.length, c.length, pcm.frequence);
  pcm.canaux.forEach((x, i) => tampon.copyToChannel(x as Float32Array<ArrayBuffer>, i));
  const source = ctx.createBufferSource();
  const volume = ctx.createGain();
  volume.gain.value = 0.8;
  source.buffer = tampon;
  source.connect(volume).connect(ctx.destination);
  source.start(ctx.currentTime + 0.01);
  let fini = false;
  const stop = () => {
    if (fini) return;
    fini = true;
    try {
      source.stop();
    } catch {
      // déjà finie
    }
    source.disconnect();
    volume.disconnect();
  };
  source.onended = stop;
  arreter = stop;
}
