// Son v1 « ocka-lead@1 » : lead tenu, avec une boucle sans clic. SON FIGÉ : empreintes testées (registre.test.ts).
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { lead } from '../../instruments/melodie';
import { aLaSonie, preparerBoucle } from '../outils-notes';

const def: DefinitionSynthe = {
  id: 'lead',
  nom: 'Lead',
  famille: 'Synthés',
  motsCles: ['lead', 'synthe', 'synth'],
  pret: true,
  params: {},
  relache: 0.08,
  tenu: true,
  mode: 'note',
  rendreNote(midi) {
    const c = [lead(frequenceMidi(midi), 2.6)];
    aLaSonie(c, -1);
    return preparerBoucle(c, 1, 2.6, 0.4);
  },
};
export default def;
