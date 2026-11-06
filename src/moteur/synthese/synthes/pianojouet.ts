// « ocka-pianojouet@1 » : piano jouet (L) : des tiges de métal frappées (partiels de la poutre encastrée : 1 ; 6,27 ;
// 17,55), deux tiges un peu fausses l'une par rapport à l'autre qui battent (la note juste est entre les deux), et
// le « clonc » du petit marteau en bois.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { aLaSonie, fonduFin } from '../outils-notes';
import { entre } from './communs';
import { rendreModal } from './modal';

export function rendrePianoJouet(midi: number, p: Record<string, number>): Float32Array {
  const f = frequenceMidi(midi);
  const faux = 1 + 0.004 * (p.faux ?? 0.4);
  const metal = entre(0.3, 2, p.metal ?? 0.5);
  return rendreModal(
    f,
    [
      { ratio: 1 / Math.sqrt(faux), amp: 0.7, tau: 1.1 },
      { ratio: Math.sqrt(faux), amp: 0.6, tau: 0.9 },
      { ratio: 6.27, amp: 0.22 * metal, tau: 0.22 },
      { ratio: 17.55, amp: 0.08 * metal, tau: 0.05 },
    ],
    2.5,
    {
      echelle: entre(0.4, 1.6, p.longueur ?? 0.5),
      frappe: 0.18 * (p.clonc ?? 0.5),
      couleurFrappe: 900,
      dureeFrappe: 0.02,
    },
  );
}

const def: DefinitionSynthe = {
  id: 'pianojouet',
  nom: 'Piano jouet',
  famille: 'Claviers',
  motsCles: ['piano jouet', 'toy piano', 'jouet', 'boite a musique', 'lofi', 'clavier'],
  pret: true,
  params: {
    metal: { defaut: 0.5 },
    faux: { defaut: 0.4 },
    clonc: { defaut: 0.5 },
    longueur: { defaut: 0.5 },
  },
  relache: 0.15,
  tenu: false,
  mode: 'note',
  rendreNote(midi, r) {
    const c = [rendrePianoJouet(midi, r.params)];
    aLaSonie(c, -1);
    fonduFin(c, 0.3);
    return { canaux: c };
  },
};
export default def;
