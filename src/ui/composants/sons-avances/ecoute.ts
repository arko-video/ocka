// Écoute d'un passage d'un son (découpe, sélection) dans l'éditeur : une source sur le contexte audio commun.
// Une seule écoute à la fois ; le tampon du son est créé une fois par PCM.

import { contexteAudio, type PcmSon } from '../../../moteur/api';

export type { PcmSon };

let source: AudioBufferSourceNode | null = null;
const tampons = new WeakMap<PcmSon, AudioBuffer>();

function tampon(pcm: PcmSon): AudioBuffer {
  let b = tampons.get(pcm);
  if (!b) {
    const n = Math.min(...pcm.canaux.map((c) => c.length));
    b = new AudioBuffer({ numberOfChannels: pcm.canaux.length, length: Math.max(1, n), sampleRate: pcm.frequence });
    pcm.canaux.forEach((c, i) => b!.copyToChannel(c.subarray(0, n) as Float32Array<ArrayBuffer>, i));
    tampons.set(pcm, b);
  }
  return b;
}

/** Joue [debut, fin[ (s) du son ; arrête l'écoute d'avant. */
export function ecouterPassage(pcm: PcmSon, debut: number, fin: number): void {
  try {
    arreterEcoute();
    const ctx = contexteAudio();
    void ctx.resume();
    const s = ctx.createBufferSource();
    s.buffer = tampon(pcm);
    s.connect(ctx.destination);
    s.start(ctx.currentTime + 0.01, Math.max(0, debut), Math.max(0.005, fin - debut));
    s.onended = () => source === s && (source = null);
    source = s;
  } catch (e) {
    console.error(e);
  }
}

export function arreterEcoute(): void {
  try {
    source?.stop();
  } catch {
    /* déjà finie */
  }
  source = null;
}
