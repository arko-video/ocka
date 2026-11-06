// Son v1 « ocka-epiano@1 » (et le « piano » des accords) : piano électrique FM ; variante « lofi » (style lo-fi).
// SON FIGÉ : empreintes testées (registre.test.ts).
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { epiano, RELACHE_ACCORD } from '../../instruments/melodiques';
import { crete, CRETE_ACCORD, fonduFin, multiplier } from '../outils-notes';

const def: DefinitionSynthe = {
  id: 'epiano',
  nom: 'Piano électrique',
  famille: 'Claviers',
  motsCles: ['piano electrique', 'rhodes', 'fm', 'clavier'],
  pret: true,
  params: {},
  relache: RELACHE_ACCORD,
  tenu: false,
  mode: 'note',
  rendreNote(midi, _r, variante) {
    const c = [epiano(frequenceMidi(midi), 5, variante === 'lofi')];
    multiplier(c, CRETE_ACCORD / Math.max(1e-9, crete(c)));
    fonduFin(c, 0.4);
    return { canaux: c };
  },
};
export default def;
