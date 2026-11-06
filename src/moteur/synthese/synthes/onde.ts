// « ocka-onde@1 » : synthé à onde dessinée au doigt, façon BitInvader (L) : 64 points (PisteInstrument.synthe.onde),
// joués par des tables à plusieurs résolutions (tablesDeOnde : une par octave, sans repliement), une enveloppe
// (attaque, décroissance, tenue) et un filtre de brillance. Note tenue : boucle sans clic.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { FREQ } from '../briques';
import { aLaSonie, preparerBoucle } from '../outils-notes';
import { entreLog, nb, passeBas1 } from './communs';
import { lireTables, tablesDeOnde } from './tables';

const DUREE = 2.6;
const DEBUT_BOUCLE = 1.6;

/** Tables des dernières ondes jouées (le même dessin sert à toutes les notes d'une piste). */
const memoire = new Map<string, Float32Array[]>();
function tables(onde: readonly number[]): Float32Array[] {
  const cle = `${FREQ}|${onde.join(',')}`;
  let t = memoire.get(cle);
  if (!t) {
    if (memoire.size >= 8) memoire.delete(memoire.keys().next().value!);
    memoire.set(cle, (t = tablesDeOnde(onde)));
  }
  return t;
}

/** Rend une note (mono) : `onde` de −1 à 1, réglages 0 à 1. */
export function rendreOnde(midi: number, onde: readonly number[], p: Record<string, number>): Float32Array {
  const n = nb(DUREE);
  const c = new Float32Array(n);
  const f = frequenceMidi(midi);
  lireTables(tables(onde), c, f);
  // Enveloppe : attaque (1 ms à 0,8 s), décroissance (20 ms à 0,8 s) vers la tenue, puis constante.
  const a = Math.max(1, Math.round(entreLog(0.001, 0.8, p.attaque ?? 0.05) * FREQ));
  const d = Math.max(1, Math.round(entreLog(0.02, 0.8, p.decroissance ?? 0.4) * FREQ));
  const s = p.tenue ?? 0.7;
  for (let i = 0; i < n; i++) {
    const g = i < a ? i / a : i < a + d ? 1 - (1 - s) * ((i - a) / d) : s;
    c[i] *= g;
  }
  // Brillance : passe-bas de 200 Hz (sombre) à 20 kHz (le dessin tel quel), relatif à la note.
  const brillance = p.filtre ?? 1;
  if (brillance < 0.999) passeBas1(c, Math.max(f * 1.2, entreLog(200, 20000, brillance)));
  return c;
}

const def: DefinitionSynthe = {
  id: 'onde',
  nom: 'Onde dessinée',
  famille: 'Synthés',
  motsCles: ['onde', 'dessin', 'bitinvader', 'wavetable', 'synthe'],
  pret: true,
  params: {
    attaque: { defaut: 0.05 },
    decroissance: { defaut: 0.4 },
    tenue: { defaut: 0.7 },
    filtre: { defaut: 1 },
  },
  points: 64,
  relache: 0.2,
  tenu: true,
  mode: 'note',
  rendreNote(midi, r) {
    const c = [rendreOnde(midi, r.onde ?? [], r.params)];
    aLaSonie(c, -2);
    return preparerBoucle(c, DEBUT_BOUCLE, DUREE, 0.3);
  },
};
export default def;
