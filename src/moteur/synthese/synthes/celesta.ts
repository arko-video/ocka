// « ocka-celesta@1 » : célesta (L) : des lames d'acier frappées par des marteaux feutrés, au-dessus de résonateurs en
// bois. Le résonateur renforce la fondamentale ; les partiels de la lame libre (2,76 ; 5,40) sonnent peu et vite.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { aLaSonie, fonduFin } from '../outils-notes';
import { entre } from './communs';
import { rendreModal } from './modal';

export function rendreCelesta(midi: number, p: Record<string, number>): Float32Array {
  const f = frequenceMidi(midi);
  const eclat = entre(0.3, 2.5, p.eclat ?? 0.4);
  return rendreModal(
    f,
    [
      { ratio: 1, amp: 1, tau: 1.5 },
      { ratio: 2, amp: 0.1, tau: 0.6 },
      { ratio: 2.756, amp: 0.07 * eclat, tau: 0.25 },
      { ratio: 5.404, amp: 0.035 * eclat, tau: 0.08 },
    ],
    3,
    { echelle: entre(0.4, 1.6, p.longueur ?? 0.5), frappe: 0.02, couleurFrappe: 1200 },
  );
}

const def: DefinitionSynthe = {
  id: 'celesta',
  nom: 'Célesta',
  famille: 'Percussions mélodiques',
  motsCles: ['celesta', 'boite a musique', 'clochettes', 'noel', 'feerique', 'glockenspiel'],
  pret: true,
  params: { eclat: { defaut: 0.4 }, longueur: { defaut: 0.5 } },
  relache: 0.2,
  tenu: false,
  mode: 'note',
  rendreNote(midi, r) {
    const c = [rendreCelesta(midi, r.params)];
    aLaSonie(c, -1);
    fonduFin(c, 0.4);
    return { canaux: c };
  },
};
export default def;
