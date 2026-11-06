// Pop-punk : 168 BPM, batterie acoustique enregistrée (couplet « oum-pa » kick/caisse en croches, refrain droit
// avec crash), guitare saturée en quintes à vide toutes en croches (coups vers le bas), basse en croches,
// mélodie de guitare saturée au refrain. Kit synthétisé discret, 808 et accords coupés.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, ligne, percus, plaquer, FORMES, type Frappe, type NoteLigne } from '../styles-ecriture';

const croches: Frappe[] = Array.from({ length: 8 }, (_, i) => [i * 2, 1.8, i % 2 === 0 ? 0.95 : 0.8] as Frappe);
const basse: NoteLigne[] = Array.from({ length: 8 }, (_, i) => [i * 2, 2, i === 6 ? 'Q' : 'R', i % 2 === 0 ? 0.95 : 0.8] as NoteLigne);

/** Batterie : 2 mesures « oum-pa » (kick sur les temps, caisse sur les contretemps), puis 2 mesures droites + roulement. */
const batterie = percus({
  36: 'X...X...X...X... X...X...X...X... X.....X.X.X..... X.....X.X.......',
  38: '..o...o...o...o. ..o...o...o...o. ....X.......X... ....X...XoXoXXXX',
  42: '................ ................ X.x.X.x.X.x.X.x. X.x.X.x.........',
  51: 'o.o.o.o.o.o.o.o. o.o.o.o.o.o.o.o. ................ ................',
  49: 'X............... ................ X............... ................',
});

const poppunk: DefinitionStyle = {
  id: 'poppunk',
  famille: 'poprockjazz',
  textes: { nom: 'Pop-punk', phrase: 'Rapide, guitares saturées, refrains à crier.' },
  genre: 'Rock',
  reglages: {
    tempo: 168,
    plage: [150, 190],
    swing: 0,
    tonique: 'D',
    mode: 'majeur',
    son: 'nappe',
    preset: 'clair',
    kit: 'poppunk@1',
    volumes: { batterie: 0.12 },
    muettes: ['basse', 'accords'],
  },
  batterie: () => ({
    intro: motifBatterie({ kick: 'X...............', charley: 'X.x.X.x.X.x.X.x.', snare: '................ ............xxXX' }),
    couplet: motifBatterie({ kick: 'X...X...X...X...', snare: '..o...o...o...o.', charley: 'x.x.x.x.x.x.x.x.' }),
    refrain: motifBatterie({ kick: 'X.....X.X.X.....', snare: '....X.......X...', charleyOuvert: 'o.o.o.o.o.o.o.o.' }),
    pont: motifBatterie({ kick: 'X.......X.......', snare: '....X.......X...', charley: 'x.x.x.x.x.x.x.x.' }),
  }),
  basse: () => ({
    couplet: quatreMesures(Array.from({ length: 8 }, (_, i) => n(i * 2, 2, 0, { vel: i % 2 === 0 ? 0.9 : 0.75 }))),
    refrain: quatreMesures(Array.from({ length: 8 }, (_, i) => n(i * 2, 2, i >= 6 ? 4 : 0, { vel: i % 2 === 0 ? 0.9 : 0.75 }))),
  }),
  suites: [
    { nom: 'Été', degres: ['I', 'V', 'vi', 'IV'] },
    { nom: 'Lycée', degres: ['vi', 'IV', 'I', 'V'] },
    { nom: 'Skate', degres: ['I', 'IV', 'vi', 'V'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Guitare mélodie', instrument: 'freepats-guitare-saturee@1', role: 'lead', volume: 0.95, pan: 0.35, notes: { ecrire: boucleDans('refrain', 62, 81, 1), sections: ['refrain'], idMotif: 'punk-melodie' } },
    {
      id: 'guitare',
      nom: 'Guitare saturée',
      instrument: 'freepats-guitare-saturee@1',
      role: 'accords',
      volume: 0.72,
      pan: -0.35,
      notes: { ecrire: plaquer({ bas: 40, haut: 62, forme: FORMES.puissance, rythme: [croches] }), sections: ['intro', 'couplet', 'refrain'], idMotif: 'punk-guitare' },
    },
    { id: 'basse-electrique', nom: 'Basse électrique', instrument: 'karoryfer-basse@1', role: 'basse', volume: 0.85, notes: { ecrire: ligne([basse], 26), sections: ['couplet', 'refrain'], idMotif: 'punk-basse' } },
    { id: 'batterie-punk', nom: 'Batterie', instrument: 'karoryfer-batterie@1', role: 'percussions', volume: 0.6, notes: { ecrire: batterie, sections: ['couplet', 'refrain'], idMotif: 'punk-batterie' } },
  ],
  boucles: [['refrain', 'lead'], ['contrechant', 'lead'], ['pince', 'pluck'], ['arpege', 'pluck'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      'poppunk@1': {
        kick: { de: 160, a: 58, glisse: 0.025, tau: 0.08, duree: 0.28, clic: 0.8, force: 1.8 },
        snare: { corps: [200, 360], tauCorps: 0.04, tauBruit: 0.13, passeHaut: 1400, passeBas: 12000, force: 1.8 },
        charley: { passeHaut: 7500, tauFerme: 0.035, tauOuvert: 0.3, passeBas: 15000 },
        sourdine: 18000,
      },
    },
    basse808: { tau: 0.6, force: 1.8, passeBas: 1500, glisse: 0.04 },
    fill: [8, 9, 10, 11, 12, 13, 14, 15].map((pas, k) => ({ pas, vel: 0.5 + k * 0.07, roul: 0 })),
  },
  onde: [95, 80, 95, 85, 100, 80],
};

export default poppunk;
