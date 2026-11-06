// Latence de DÉTECTION (sans la sortie audio) : on fait chanter au détecteur du worklet (le même code) une voix
// de synthèse dont on connaît chaque changement de note, par blocs de 128 échantillons comme dans le fil audio,
// et on mesure le temps entre le vrai début de la note et le moment où elle est jouée.

import type { LatenceDetection, ModeDetection } from './api-dubler';
import { classesGamme } from './calage';
import { DetecteurVoix } from './detecteur';
import { voixSegments, type SegmentVoix } from './signaux-test';

const FS = 48000;
const NOTES = [220, 262, 330, 247, 196, 294, 392, 220];

function segmentsTest(): SegmentVoix[] {
  const s: SegmentVoix[] = [{ hz: null, duree: 0.3 }];
  for (const hz of NOTES) s.push({ hz, duree: 0.35 });
  for (const hz of [262, 330, 196]) s.push({ hz: null, duree: 0.25 }, { hz, duree: 0.35 });
  s.push({ hz: null, duree: 0.3 });
  return s;
}

/** Mesure synchrone (tests). */
export function mesurerLatence(mode: ModeDetection): LatenceDetection {
  const segments = segmentsTest();
  const pcm = voixSegments(segments, FS, 30);
  const d = new DetecteurVoix(FS, {
    mode,
    calage: null,
    gamme: classesGamme({ tonique: 'C', mode: 'majeur' }),
    glisse: 0,
    accords: null,
    suivreVolume: true,
    decroissance: 0,
  });
  const detections: { midi: number; t: number }[] = [];
  for (let i = 0; i + 128 <= pcm.length; i += 128) {
    d.traiter(pcm.subarray(i, i + 128), i);
    for (const e of d.evenements)
      if (e.midi !== null) detections.push({ midi: e.midi, t: (e.detecte + 128) / FS });
    d.evenements.length = 0;
  }
  const ecarts: number[] = [];
  let t0 = 0;
  for (const s of segments) {
    if (s.hz !== null) {
      const midi = Math.round(69 + 12 * Math.log2(s.hz / 440));
      const e = detections.find((x) => x.midi === midi && x.t >= t0 && x.t < t0 + s.duree);
      if (e) ecarts.push((e.t - t0) * 1000);
    }
    t0 += s.duree;
  }
  const n = ecarts.length;
  return {
    moyenneMs: n ? ecarts.reduce((a, b) => a + b, 0) / n : Number.NaN,
    maxMs: n ? Math.max(...ecarts) : Number.NaN,
    mesures: n,
  };
}

/** Pour l'appli : la même mesure, après avoir laissé l'interface se dessiner. */
export async function mesurerLatenceDetection(mode: ModeDetection): Promise<LatenceDetection> {
  await new Promise((ok) => setTimeout(ok, 0));
  return mesurerLatence(mode);
}
