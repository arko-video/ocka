// Son v1 « ocka-cloche@1 » (et la cloche des accords) : cloche FM ; variante « cowbell » (phonk : cloche 808 accordée).
// SON FIGÉ : empreintes testées (registre.test.ts).
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { cowbellAccordee } from '../../instruments/batterie';
import { cloche, RELACHE_ACCORD } from '../../instruments/melodiques';
import { crete, CRETE_ACCORD, fonduFin, multiplier } from '../outils-notes';

/** Longueur (s) d'une note de cloche 808 accordée (phonk) : elle s'éteint d'elle-même bien avant. */
const DUREE_COWBELL = 1.2;

const def: DefinitionSynthe = {
  id: 'cloche',
  nom: 'Cloche',
  famille: 'Percussions mélodiques',
  motsCles: ['cloche', 'bell', 'carillon'],
  pret: true,
  params: {},
  relache: RELACHE_ACCORD,
  tenu: false,
  mode: 'note',
  rendreNote(midi, _r, variante) {
    const f = frequenceMidi(midi);
    const c = [variante === 'cowbell' ? cowbellAccordee(f, DUREE_COWBELL) : cloche(f, 4)];
    multiplier(c, CRETE_ACCORD / Math.max(1e-9, crete(c)));
    fonduFin(c, variante === 'cowbell' ? 0.2 : 0.4);
    return { canaux: c };
  },
};
export default def;
