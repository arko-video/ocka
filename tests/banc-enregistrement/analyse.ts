// Petits outils d'analyse pour le banc : morceau de test et détection des clics dans le PCM.
import { FORMAT_MORCEAU, type Morceau } from '../../src/morceau/types';

/** Morceau minimal : Intro (2 mesures) puis Couplet (4 mesures), au tempo donné. */
export function morceauDeTest(tempo: number): Morceau {
  return {
    format: FORMAT_MORCEAU,
    titre: 'Banc enregistrement',
    style: 'trap',
    tempo,
    swing: 0,
    tonalite: { tonique: 'A', mode: 'mineur' },
    kit: 'trap@1',
    motifs: { b1: { type: 'batterie', pas: 16, pistes: { kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] } } },
    sections: [
      { id: 'intro', nom: 'Intro', mesures: 2, motifs: { batterie: 'b1' } },
      { id: 'couplet', nom: 'Couplet', mesures: 4, motifs: { batterie: 'b1' } },
    ],
    ordre: ['intro', 'couplet'],
    pistes: [
      { id: 'batterie', volume: 0.8, pan: 0, muet: false, solo: false },
      { id: 'voix', volume: 0.8, pan: 0, muet: false, solo: false, preset: 'naturel' },
    ],
    prises: [],
    master: { preset: 'neutre', niveau: 'standard', chaine: 1 },
  };
}

/** Positions (échantillons) des débuts de clics : 1er échantillon au-dessus du seuil après un silence. */
export function debutsDeClics(pcm: Float32Array, seuil: number, silenceMin: number): number[] {
  const debuts: number[] = [];
  let dernier = -Infinity;
  for (let i = 0; i < pcm.length; i++) {
    if (Math.abs(pcm[i]!) >= seuil) {
      if (i - dernier > silenceMin) debuts.push(i);
      dernier = i;
    }
  }
  return debuts;
}

/** Crête (valeur absolue max). */
export function crete(pcm: Float32Array): number {
  let c = 0;
  for (const x of pcm) c = Math.max(c, Math.abs(x));
  return c;
}
