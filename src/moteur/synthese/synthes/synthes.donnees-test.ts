// Données communes des tests des synthés (L) : un motif de 303 de 16 doubles-croches à 120 BPM, avec accents et slides.
import type { NoteMotifSynthe } from '../../api-synthes';

const HAUTEURS = [36, 36, 48, 39, 36, 43, 41, 36, 46, 36, 48, 36, 39, 43, 36, 31];
export const MOTIF_TEST: NoteMotifSynthe[] = HAUTEURS.map((midi, i) => {
  const n: NoteMotifSynthe = { t: i * 0.125, duree: 0.09, midi, vel: i % 4 === 0 || i === 10 ? 0.95 : 0.6 };
  if (i === 2 || i === 9 || i === 13) n.glisse = HAUTEURS[i + 1]!;
  return n;
});
