// Son v1 « ocka-pluck@1 » : corde pincée (Karplus-Strong). SON FIGÉ : empreintes testées (registre.test.ts).
import type { DefinitionSynthe } from '../../api-synthes';
import { pluck } from '../../instruments/melodie';
import { aLaSonie, fonduFin } from '../outils-notes';

const def: DefinitionSynthe = {
  id: 'pluck',
  nom: 'Pluck',
  famille: 'Synthés',
  motsCles: ['pluck', 'synthe', 'synth', 'pince'],
  pret: true,
  params: {},
  relache: 0.06,
  tenu: false,
  mode: 'note',
  rendreNote(midi) {
    const c = [pluck(midi)];
    aLaSonie(c, 1);
    fonduFin(c, 0.1);
    return { canaux: c };
  },
};
export default def;
