// « ocka-wurlitzer@1 » : piano électrique Wurlitzer, synthèse MODALE (L) : une anche frappée, riche en harmoniques
// (plus nasillarde que le Rhodes), un petit « mordant » à l'attaque, une saturation légère et le trémolo de volume
// du 200A. Pour la soul, le funk, la lo-fi.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { aLaSonie, fonduFin } from '../outils-notes';
import { entre, saturerDoux, tremolo } from './communs';
import { rendreModal, type Partiel } from './modal';

const DUREE = 3.5;
const PARTIELS: Partiel[] = [
  { ratio: 1, amp: 1, tau: 1.3 },
  { ratio: 2, amp: 0.42, tau: 0.7 },
  { ratio: 3, amp: 0.38, tau: 0.45 },
  { ratio: 4, amp: 0.16, tau: 0.35 },
  { ratio: 5, amp: 0.14, tau: 0.25 },
  { ratio: 6, amp: 0.06, tau: 0.18 },
  { ratio: 5.63, amp: 0.15, tau: 0.02 },
];

export function rendreWurlitzer(midi: number, p: Record<string, number>): Float32Array {
  const f = frequenceMidi(midi);
  const mordant = entre(0.2, 2.5, p.mordant ?? 0.4);
  const partiels = PARTIELS.map((x) => (Number.isInteger(x.ratio) ? x : { ...x, amp: x.amp * mordant }));
  const c = rendreModal(f, partiels, DUREE, {
    echelle: entre(0.4, 1.6, p.longueur ?? 0.5),
    frappe: 0.04,
    couleurFrappe: 2500,
  });
  let max = 0;
  for (let i = 0; i < c.length; i++) max = Math.max(max, Math.abs(c[i]!));
  for (let i = 0; i < c.length; i++) c[i] /= max || 1;
  saturerDoux(c, 0.4 * (p.saturation ?? 0.3));
  tremolo(c, entre(3, 7.5, p.vitesse ?? 0.5), 0.55 * (p.tremolo ?? 0.25));
  return c;
}

const def: DefinitionSynthe = {
  id: 'wurlitzer',
  nom: 'Wurlitzer',
  famille: 'Claviers',
  motsCles: ['wurlitzer', 'wurli', 'piano electrique', 'soul', 'funk', 'lofi', 'clavier'],
  pret: true,
  params: {
    mordant: { defaut: 0.4 },
    saturation: { defaut: 0.3 },
    longueur: { defaut: 0.5 },
    tremolo: { defaut: 0.25 },
    vitesse: { defaut: 0.5 },
  },
  relache: 0.2,
  tenu: false,
  mode: 'note',
  rendreNote(midi, r) {
    const c = [rendreWurlitzer(midi, r.params)];
    aLaSonie(c, 0);
    fonduFin(c, 0.35);
    return { canaux: c };
  },
};
export default def;
