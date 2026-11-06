// Ambient : 70 BPM, nappes longues (la nappe des accords, une nappe haute OCKA, des cordes douces), harpe en
// arpège lent, vibraphone épars au refrain, basse 808 ronde et très douce en rondes. Presque pas de batterie :
// des petits « tok » et un kick feutré au refrain, rien à l'intro ni au pont.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, plaquer } from '../styles-ecriture';

const ambient: DefinitionStyle = {
  id: 'ambient',
  famille: 'cinema',
  textes: { nom: 'Ambient', phrase: 'Nappes lentes et calmes, presque sans batterie.' },
  genre: 'Instrumental',
  reglages: {
    tempo: 70,
    plage: [60, 90],
    swing: 0,
    tonique: 'D',
    mode: 'majeur',
    son: 'nappe',
    preset: 'chaud',
    kit: 'ambient@1',
    volumes: { batterie: 0.5, basse: 0.3, accords: 0.45 },
  },
  batterie: () => ({
    intro: motifBatterie({}),
    couplet: motifBatterie({ perc: 'x.......x....... ......x.........', charley: '........x.......' }),
    refrain: motifBatterie({ kick: 'x.......' + '........', perc: 'x.....x...x..... x.......x.....x.', charley: '....x.......x...' }),
    pont: motifBatterie({}),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 16, 0, { vel: 0.7 })]),
    refrain: quatreMesures([n(0, 12, 0, { vel: 0.75 }), n(12, 4, 4, { vel: 0.55 })]),
  }),
  suites: [
    { nom: 'Brume', degres: ['Imaj7', 'IVmaj7', 'vi7', 'IVmaj7'] },
    { nom: 'Lumière', degres: ['I', 'iii', 'IV', 'IV'] },
    { nom: 'Lointain', degres: ['vi7', 'IVmaj7', 'Imaj7', 'V'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Vibraphone', instrument: 'vcsl-vibraphone@1', role: 'melodie', volume: 1.2, pan: 0.25, notes: { ecrire: boucleDans('contrechant', 67, 86, 0.85), sections: ['refrain', 'outro'], idMotif: 'ambient-vibra' } },
    { id: 'nappe-haute', nom: 'Nappe haute', instrument: 'ocka-nappe@1', role: 'nappe', volume: 0.6, pan: -0.2, notes: { ecrire: plaquer({ bas: 67, haut: 86, rythme: [[[0, 16, 0.6]]] }), sections: ['intro', 'couplet', 'refrain', 'outro'], idMotif: 'ambient-nappe' } },
    { id: 'cordes', nom: 'Cordes douces', instrument: 'vsco-cordes@1', role: 'nappe', volume: 0.8, pan: 0.2, notes: { ecrire: plaquer({ bas: 48, haut: 66, rythme: [[[0, 16, 0.45]]] }), sections: ['couplet', 'refrain'], idMotif: 'ambient-cordes' } },
    { id: 'harpe', nom: 'Harpe', instrument: 'vcsl-harpe@1', role: 'arpege', volume: 1.0, pan: -0.3, notes: { ecrire: boucleDans('arpege', 55, 84, 0.75), sections: ['couplet', 'refrain'], idMotif: 'ambient-harpe' } },
  ],
  boucles: [['nappe', 'nappe'], ['contrechant', 'cloche'], ['arpege', 'pluck'], ['cloche', 'cloche'], ['refrain', 'epiano'], ['pince', 'epiano']],
  son: {
    kits: {
      // Tout feutré : kick sourd, « tok » boisé aigu, charley très doux.
      'ambient@1': {
        kick: { de: 90, a: 45, glisse: 0.05, tau: 0.12, duree: 0.45, clic: 0, force: 1.0 },
        snare: { corps: [170, 300], tauCorps: 0.04, tauBruit: 0.1, passeHaut: 1000, passeBas: 6000, force: 1.0 },
        charley: { passeHaut: 8000, tauFerme: 0.03, tauOuvert: 0.3, passeBas: 11000 },
        sourdine: 8000,
        perc: 1400,
        cretes: { charley: 0.15, perc: 0.25 },
      },
    },
    basse808: { tau: 3.0, force: 1.0, passeBas: 300, glisse: 0.1 },
    fill: [{ pas: 14, vel: 0.2, roul: 0 }],
  },
  onde: [30, 38, 45, 50, 52, 50, 45, 38],
};

export default ambient;
