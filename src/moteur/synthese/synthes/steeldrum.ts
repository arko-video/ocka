// « ocka-steeldrum@1 » : steel drum des Caraïbes (L) : chaque note de la tôle est accordée sur la fondamentale,
// l'octave et la douzième (×3) ; l'octave « fleurit » juste après la frappe de la mailloche en caoutchouc.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { aLaSonie, fonduFin } from '../outils-notes';
import { entre } from './communs';
import { rendreModal } from './modal';

export function rendreSteelDrum(midi: number, p: Record<string, number>): Float32Array {
  const f = frequenceMidi(midi);
  const brillance = entre(0.3, 1.8, p.brillance ?? 0.5);
  return rendreModal(
    f,
    [
      { ratio: 1, amp: 1, tau: 0.9 },
      { ratio: 2, amp: 0.55 * brillance, tau: 0.55, montee: 0.025 },
      { ratio: 3, amp: 0.22 * brillance, tau: 0.3 },
      { ratio: 4, amp: 0.08 * brillance, tau: 0.15 },
      { ratio: 2.41, amp: 0.05, tau: 0.04 },
    ],
    2.5,
    { echelle: entre(0.4, 1.6, p.longueur ?? 0.5), frappe: 0.05, couleurFrappe: 1500 },
  );
}

const def: DefinitionSynthe = {
  id: 'steeldrum',
  nom: 'Steel drum',
  famille: 'Percussions mélodiques',
  motsCles: ['steel drum', 'steelpan', 'caraibes', 'tropical', 'dancehall', 'reggaeton'],
  pret: true,
  params: { brillance: { defaut: 0.5 }, longueur: { defaut: 0.5 } },
  relache: 0.15,
  tenu: false,
  mode: 'note',
  rendreNote(midi, r) {
    const c = [rendreSteelDrum(midi, r.params)];
    aLaSonie(c, 0);
    fonduFin(c, 0.3);
    return { canaux: c };
  },
};
export default def;
