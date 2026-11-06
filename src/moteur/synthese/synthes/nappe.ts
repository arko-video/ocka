// Son v1 « ocka-nappe@1 » (et la nappe des accords) : 3 scies désaccordées, stéréo, tenue. SON FIGÉ (registre.test.ts).
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { nappe, RELACHE_ACCORD } from '../../instruments/melodiques';
import { crete, CRETE_ACCORD, multiplier, preparerBoucle } from '../outils-notes';

const def: DefinitionSynthe = {
  id: 'nappe',
  nom: 'Nappe',
  famille: 'Synthés',
  motsCles: ['nappe', 'pad', 'synthe', 'synth'],
  pret: true,
  params: {},
  relache: RELACHE_ACCORD,
  tenu: true,
  mode: 'note',
  rendreNote(midi) {
    const f = frequenceMidi(midi);
    // Stéréo : gauche et droite désaccordées autrement (une nappe un peu large), crête commune.
    const c = [nappe(f, 4, [-9, 0, 5]), nappe(f, 4, [-5, 0, 9])];
    multiplier(c, CRETE_ACCORD / Math.max(1e-9, crete(c)));
    return preparerBoucle(c, 2, 4, 0.6);
  },
};
export default def;
