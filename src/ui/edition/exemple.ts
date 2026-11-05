// Morceau d'exemple (trap) pour les tests des fonctions d'édition. Pas utilisé par l'appli.

import { FORMAT_MORCEAU, type Morceau, type Prise } from '../../morceau/types';

const vide = () => Array<number>(16).fill(0);
const avec = (pas: number[], v = 1) => vide().map((_, i) => (pas.includes(i) ? v : 0));

export function exempleMorceau(): Morceau {
  return {
    format: FORMAT_MORCEAU,
    titre: 'Mon morceau',
    style: 'trap',
    tempo: 140,
    swing: 0,
    tonalite: { tonique: 'A', mode: 'mineur' },
    kit: 'trap@1',
    motifs: {
      'bat-intro': { type: 'batterie', pas: 16, pistes: { charley: avec([0, 4, 8, 12], 0.5) } },
      'bat-couplet': {
        type: 'batterie',
        pas: 16,
        pistes: { kick: avec([0, 7, 10]), snare: avec([8]), charley: avec([0, 2, 4, 6, 8, 10, 12, 14], 0.8) },
        roulements: { charley: [0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      },
      'bat-refrain': {
        type: 'batterie',
        pas: 16,
        pistes: { kick: avec([0, 3, 7, 10]), snare: avec([8]), clap: avec([8]), charley: avec([0, 2, 4, 6, 8, 10, 12, 14]) },
      },
      'bat-pont': { type: 'batterie', pas: 16, pistes: { kick: avec([0]), rim: avec([4, 12], 0.5) } },
      'basse-1': { type: 'basse', pas: 16, notes: [{ pas: 0, duree: 6, degre: 0 }], suitAccords: true },
      'accords-1': {
        type: 'accords',
        pas: 64,
        accords: [
          { pas: 0, duree: 16, degre: 'i' },
          { pas: 16, duree: 16, degre: 'VI' },
          { pas: 32, duree: 16, degre: 'III' },
          { pas: 48, duree: 16, degre: 'VII' },
        ],
        son: 'piano',
      },
    },
    sections: [
      { id: 'intro', nom: 'Intro', mesures: 4, motifs: { batterie: 'bat-intro', accords: 'accords-1' }, coupure: 'aucune', paroles: '' },
      {
        id: 'couplet',
        nom: 'Couplet',
        mesures: 8,
        motifs: { batterie: 'bat-couplet', basse: 'basse-1', accords: 'accords-1' },
        fill: true,
        coupure: 'aucune',
        paroles: 'Première ligne du couplet\nDeuxième ligne',
      },
      {
        id: 'refrain',
        nom: 'Refrain',
        mesures: 8,
        motifs: { batterie: 'bat-refrain', basse: 'basse-1', accords: 'accords-1' },
        coupure: 'drop',
        paroles: 'Le refrain qui reste en tête',
      },
      { id: 'outro', nom: 'Outro', mesures: 4, motifs: { accords: 'accords-1' }, coupure: 'aucune', paroles: '' },
    ],
    ordre: ['intro', 'couplet', 'refrain', 'couplet', 'refrain', 'outro'],
    pistes: [
      { id: 'batterie', volume: 0.8, pan: 0, muet: false, solo: false },
      { id: 'basse', volume: 0.8, pan: 0, muet: false, solo: false },
      { id: 'accords', volume: 0.6, pan: 0, muet: false, solo: false },
      { id: 'voix', volume: 1, pan: 0, muet: false, solo: false, preset: 'naturel' },
    ],
    prises: [],
    master: { preset: 'neutre', niveau: 'standard', chaine: 2 },
  };
}

export function exemplePrise(id: string, section: string, occurrence: number, choisie = false): Prise {
  return {
    id,
    ancre: { section, occurrence, mesure: 0 },
    tempo: 140,
    fichier: `prise-${id}.f32`,
    frequence: 48000,
    duree: 12,
    debutCoupe: 0,
    finCoupe: 12,
    decalage: 0.02,
    gain: 1,
    choisie,
  };
}
