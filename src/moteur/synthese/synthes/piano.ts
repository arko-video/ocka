// Son v1 « ocka-piano@1 » : piano par résonateurs (phases 2 à 6). SON FIGÉ : empreintes testées (registre.test.ts).
import type { DefinitionSynthe } from '../../api-synthes';
import { piano } from '../../instruments/melodie';
import { aLaSonie, fonduFin } from '../outils-notes';

const def: DefinitionSynthe = {
  id: 'piano',
  nom: 'Piano d’OCKA',
  famille: 'Claviers',
  motsCles: ['piano', 'clavier'],
  pret: true,
  params: {},
  relache: 0.15,
  tenu: false,
  mode: 'note',
  rendreNote(midi) {
    const c = [piano(midi)];
    aLaSonie(c, 0);
    fonduFin(c, 0.4);
    return { canaux: c };
  },
};
export default def;
