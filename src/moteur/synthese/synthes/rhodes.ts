// « ocka-rhodes@1 » : piano électrique Rhodes, synthèse MODALE (L) : la lame vibre presque en sinus, le micro
// (asymétrique) ajoute les harmoniques paires qui « grognent », une touche de cloche au début (le « ding » de la
// lame), et le trémolo stéréo du Suitcase (le son passe de gauche à droite). Pour le R&B, la soul, la lo-fi.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { aLaSonie, crete, fonduFin } from '../outils-notes';
import { entre, tremolo } from './communs';
import { micro, rendreModal, type Partiel } from './modal';

const DUREE = 4;
const PARTIELS: Partiel[] = [
  { ratio: 1, amp: 1, tau: 1.8 },
  { ratio: 2, amp: 0.12, tau: 0.9 },
  { ratio: 3, amp: 0.05, tau: 0.5 },
  { ratio: 7.1, amp: 0.1, tau: 0.035 },
  { ratio: 13.4, amp: 0.04, tau: 0.012 },
];

export function rendreRhodes(midi: number, p: Record<string, number>): Float32Array[] {
  const f = frequenceMidi(midi);
  const cloche = entre(0.3, 2.2, p.cloche ?? 0.4);
  const partiels = PARTIELS.map((x) => (x.ratio > 6 ? { ...x, amp: x.amp * cloche } : x));
  const c = rendreModal(f, partiels, DUREE, {
    echelle: entre(0.4, 1.6, p.longueur ?? 0.5),
    frappe: 0.03,
    couleurFrappe: 1800,
  });
  micro(c, p.grogne ?? 0.35, crete([c]));
  const g = c.slice();
  const d = c;
  const prof = 0.6 * (p.tremolo ?? 0.3);
  const vitesse = entre(1.5, 7, p.vitesse ?? 0.4);
  tremolo(g, vitesse, prof, 0);
  tremolo(d, vitesse, prof, 0.5);
  return [g, d];
}

const def: DefinitionSynthe = {
  id: 'rhodes',
  nom: 'Rhodes',
  famille: 'Claviers',
  motsCles: ['rhodes', 'piano electrique', 'fender', 'soul', 'rnb', 'neo soul', 'lofi', 'clavier'],
  pret: true,
  params: {
    grogne: { defaut: 0.35 },
    cloche: { defaut: 0.4 },
    longueur: { defaut: 0.5 },
    tremolo: { defaut: 0.3 },
    vitesse: { defaut: 0.4 },
  },
  relache: 0.25,
  tenu: false,
  mode: 'note',
  rendreNote(midi, r) {
    const c = rendreRhodes(midi, r.params);
    aLaSonie(c, 0);
    fonduFin(c, 0.4);
    return { canaux: c };
  },
};
export default def;
