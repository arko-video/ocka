// Orchestral : 90 BPM, cordes en section tenues, ostinato de cordes staccato en croches, violoncelles à la basse,
// cuivres au refrain (cors en accords + cuivres en section d'OCKA, C3, à la voix grave), violon solo, et des
// percussions de cinéma (toms graves comme des timbales, grosse caisse, crash). 808 et accords coupés.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, ligne, percus, plaquer, type Frappe, type NoteLigne } from '../styles-ecriture';

const heroique: Frappe[][] = [[[0, 6, 0.85], [6, 2, 0.7], [8, 8, 0.9]], [[0, 12, 0.85], [12, 4, 0.75]]];
const ostinato: NoteLigne[] = Array.from({ length: 8 }, (_, i) => [i * 2, 1.6, i % 2 === 0 ? 'R' : i % 4 === 1 ? 'Q' : 'O', i % 4 === 0 ? 0.85 : 0.6] as NoteLigne);

const orchestral: DefinitionStyle = {
  id: 'orchestral',
  famille: 'cinema',
  textes: { nom: 'Orchestral', phrase: 'Cordes, cuivres et timbales : comme au cinéma.' },
  genre: 'Instrumental',
  reglages: {
    tempo: 90,
    plage: [60, 130],
    swing: 0,
    tonique: 'D',
    mode: 'mineur',
    son: 'nappe',
    preset: 'chaud',
    kit: 'orchestral@1',
    volumes: { batterie: 0.3 },
    muettes: ['basse', 'accords'],
  },
  // Kit synthétisé : des coups de grosse caisse de cinéma (longs et graves), pas de charley.
  batterie: () => ({
    intro: motifBatterie({ kick: 'x............... ................' }),
    couplet: motifBatterie({ kick: 'X.......x....... X.......x.....x.' }),
    refrain: motifBatterie({ kick: 'X.....x.X....... X.....x.X...x.x.', snare: '................ ............x.xx', perc: '....x.......x...' }),
    pont: motifBatterie({ kick: 'X...............', perc: '........x.......' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 16, 0, { vel: 0.8 })]),
    refrain: quatreMesures([n(0, 8, 0), n(8, 8, 0, { vel: 0.8 })]),
  }),
  suites: [
    { nom: 'Épopée', degres: ['i', 'VI', 'III', 'VII'] },
    { nom: 'Destin', degres: ['i', 'iv', 'V', 'i'] },
    { nom: 'Aube', degres: ['VI', 'VII', 'i', 'i'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Violon solo', instrument: 'vsco-violon@1', role: 'melodie', volume: 1.0, pan: 0.15, notes: { ecrire: boucleDans('refrain', 64, 86, 0.85), sections: ['refrain'], idMotif: 'orch-violon' } },
    { id: 'cordes', nom: 'Cordes', instrument: 'vsco-cordes@1', role: 'nappe', volume: 0.6, pan: -0.15, notes: { ecrire: plaquer({ bas: 50, haut: 72, doublerHaut: true, rythme: [[[0, 16, 0.7]]] }), sections: ['intro', 'couplet', 'refrain', 'outro'], idMotif: 'orch-cordes' } },
    { id: 'ostinato', nom: 'Cordes staccato', instrument: 'vsco-cordes-staccato@1', role: 'arpege', volume: 0.5, pan: 0.3, notes: { ecrire: ligne([ostinato], 50), sections: ['couplet', 'refrain'], idMotif: 'orch-ostinato' } },
    { id: 'violoncelles', nom: 'Violoncelles', instrument: 'vsco-violoncelles@1', role: 'basse', volume: 0.75, pan: -0.25, notes: { ecrire: ligne([[[0, 16, 'R', 0.8]], [[0, 8, 'R', 0.8], [8, 8, 'Q', 0.7]]], 38), sections: ['intro', 'couplet', 'refrain', 'outro'], idMotif: 'orch-violoncelles' } },
    { id: 'cors', nom: 'Cuivres : cors', instrument: 'vsco-cor@1', role: 'contrechant', volume: 0.6, pan: 0.2, notes: { ecrire: plaquer({ bas: 46, haut: 62, rythme: heroique }), sections: ['refrain'], idMotif: 'orch-cors' } },
    { id: 'cuivres', nom: 'Cuivres en section', instrument: 'ocka-cuivres@1', role: 'contrechant', volume: 0.75, pan: -0.1, notes: { ecrire: plaquer({ bas: 41, haut: 58, voix: 0, rythme: heroique }), sections: ['refrain'], idMotif: 'orch-cuivres' } },
    {
      id: 'percussions',
      nom: 'Timbales et percussions',
      instrument: 'karoryfer-batterie@1',
      role: 'percussions',
      volume: 0.7,
      notes: {
        ecrire: percus(
          {
            43: 'X.....o.X....... X.....o.X....... X.....o.X....... X.....o.X.xxxXXX',
            36: 'X............... ........X....... X............... ........X.......',
            49: 'X............... ................ ................ ................',
          },
          { 43: '................ ................ ................ ..........22.2..' },
        ),
        sections: ['refrain'],
        idMotif: 'orch-percussions',
      },
    },
  ],
  boucles: [['refrain', 'lead'], ['contrechant', 'lead'], ['nappe', 'nappe'], ['arpege', 'pluck'], ['pince', 'pluck'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Grosse caisse d'orchestre : grave, longue, sans clic ; caisse claire militaire ; « tok » boisé grave.
      'orchestral@1': {
        kick: { de: 95, a: 42, glisse: 0.06, tau: 0.32, duree: 1.0, clic: 0.05, force: 1.2 },
        snare: { corps: [180, 300], tauCorps: 0.05, tauBruit: 0.2, passeHaut: 900, passeBas: 9000, force: 1.3 },
        charley: { passeHaut: 7000, tauFerme: 0.03, tauOuvert: 0.4, passeBas: 12000 },
        sourdine: 12000,
        perc: 220,
      },
    },
    basse808: { tau: 2.0, force: 1.0, passeBas: 500, glisse: 0.08 },
    fill: [{ pas: 8, vel: 0.4, roul: 2 }, { pas: 10, vel: 0.5, roul: 2 }, { pas: 12, vel: 0.65, roul: 3 }, { pas: 14, vel: 0.8, roul: 4 }, { pas: 15, vel: 0.95, roul: 4 }],
  },
  onde: [20, 35, 55, 75, 90, 70, 50, 35],
};

export default orchestral;
