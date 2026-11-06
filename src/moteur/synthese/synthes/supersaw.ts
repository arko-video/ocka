// « ocka-supersaw@1 » : 7 scies désaccordées (façon JP-8000), étalées en stéréo, pour la rage et l'hyperpop (L).
// Scies à tables (pas de repliement, testé jusqu'à C7), phases de départ fixes (même son à chaque fois), note tenue.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { FREQ } from '../briques';
import { aLaSonie, preparerBoucle } from '../outils-notes';
import { entreLog, nb, passeBas1 } from './communs';
import { lireTables, tablesScie } from './tables';

const DUREE = 3;
/** Écarts des 7 voix (fraction du désaccord) : resserrés au centre, comme le JP-8000. */
const ECARTS = [-1, -0.62, -0.21, 0, 0.19, 0.6, 0.97];
/** Place de chaque voix dans la stéréo (−1 gauche, 1 droite). */
const PLACES = [-1, 0.66, -0.33, 0, 0.33, -0.66, 1];
const PHASES = [0.11, 0.53, 0.87, 0, 0.29, 0.71, 0.42];

/** Fréquences des 7 voix d'une note (`desaccord` 0 à 1 : jusqu'à ±70 cents). Exporté pour les tests. */
export function frequencesSupersaw(f: number, desaccord: number): number[] {
  const cents = 70 * Math.pow(desaccord, 1.5);
  return ECARTS.map((e) => f * Math.pow(2, (e * cents) / 1200));
}

export function rendreSupersaw(midi: number, p: Record<string, number>): Float32Array[] {
  const n = nb(DUREE);
  const g = new Float32Array(n);
  const d = new Float32Array(n);
  const f = frequenceMidi(midi);
  const freqs = frequencesSupersaw(f, p.desaccord ?? 0.4);
  const cotes = p.melange ?? 0.7;
  const largeur = p.largeur ?? 0.8;
  const tables = tablesScie();
  const voix = new Float32Array(n);
  freqs.forEach((fv, v) => {
    voix.fill(0);
    lireTables(tables, voix, fv, v === 3 ? 1 : cotes, PHASES[v]!);
    const angle = ((1 + PLACES[v]! * largeur) * Math.PI) / 4;
    const gg = Math.cos(angle);
    const gd = Math.sin(angle);
    for (let i = 0; i < n; i++) {
      g[i] += voix[i]! * gg;
      d[i] += voix[i]! * gd;
    }
  });
  const a = Math.max(1, Math.round(entreLog(0.003, 0.6, p.attaque ?? 0.05) * FREQ));
  for (let i = 0; i < a; i++) {
    g[i] *= i / a;
    d[i] *= i / a;
  }
  const brillance = p.brillance ?? 0.85;
  if (brillance < 0.999) {
    const fc = Math.max(f * 1.5, entreLog(300, 20000, brillance));
    passeBas1(g, fc);
    passeBas1(d, fc);
  }
  return [g, d];
}

const def: DefinitionSynthe = {
  id: 'supersaw',
  nom: 'Supersaw',
  famille: 'Synthés',
  motsCles: ['supersaw', 'super saw', 'rage', 'hyperpop', 'trance', 'edm', 'lead', 'synthe'],
  pret: true,
  params: {
    desaccord: { defaut: 0.4 },
    melange: { defaut: 0.7 },
    largeur: { defaut: 0.8 },
    attaque: { defaut: 0.05 },
    brillance: { defaut: 0.85 },
  },
  relache: 0.12,
  tenu: true,
  mode: 'note',
  rendreNote(midi, r) {
    const c = rendreSupersaw(midi, r.params);
    aLaSonie(c, -2);
    return preparerBoucle(c, 1, DUREE, 0.5);
  },
};
export default def;
