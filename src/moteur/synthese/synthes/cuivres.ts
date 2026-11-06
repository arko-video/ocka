// « ocka-cuivres@1 » : cuivres en section (L) : 4 musiciens (scies à tables, un peu désaccordés, étalés en stéréo),
// chacun attaque un peu par en dessous (« scoop »), un éclat (« blat ») qui retombe, un vibrato qui arrive tard,
// et un filtre qui s'ouvre avec le souffle (plus fort = plus brillant). Note tenue. Pour le funk, la K-pop, la trap.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { FREQ } from '../briques';
import { aLaSonie, preparerBoucle } from '../outils-notes';
import { courbeFrequence, entreLog, nb, passeBas1 } from './communs';
import { lireTables, tablesScie } from './tables';

const DUREE = 3;
/** Les 4 musiciens : désaccord (cents), retard (s), vitesse du vibrato (Hz), place stéréo. */
const MUSICIENS: [number, number, number, number][] = [[0, 0, 5.2, -0.2], [-7, 0.012, 5.7, 0.6], [6, 0.006, 4.9, -0.6], [-3, 0.018, 5.4, 0.25]]; // prettier-ignore

export function rendreCuivres(midi: number, p: Record<string, number>): Float32Array[] {
  const n = nb(DUREE);
  const f = frequenceMidi(midi);
  const tables = tablesScie();
  const brillance = p.brillance ?? 0.6;
  const attaque = entreLog(0.015, 0.25, p.attaque ?? 0.3);
  const eclat = 0.5 * (p.eclat ?? 0.5);
  const largeur = p.largeur ?? 0.7;
  const sortie = [new Float32Array(n), new Float32Array(n)];
  const voix = new Float32Array(n);
  const coupure = new Float32Array(n);
  for (const [cents, retard, vitesse, place] of MUSICIENS) {
    voix.fill(0);
    const d0 = Math.round(retard * FREQ);
    const fr = courbeFrequence(n, f * Math.pow(2, cents / 1200), {
      cents: 18 * (p.vibrato ?? 0.4),
      vitesse,
      delai: 0.45,
      monte: 0.5,
      glisseCents: -60,
      tauGlisse: 0.035,
    });
    lireTables(tables, voix, fr, 1, (retard * 37) % 1, d0);
    for (let i = 0; i < n; i++) {
      const t = Math.max(0, i - d0) / FREQ;
      const env =
        i < d0 ? 0 : Math.min(1, t / attaque) * (1 + eclat * Math.exp(-Math.max(0, t - attaque) / 0.08));
      voix[i] *= env;
      coupure[i] = f * (1.5 + (3 + 14 * brillance) * Math.min(1.3, env));
    }
    passeBas1(voix, coupure);
    passeBas1(voix, coupure);
    const angle = ((1 + place * largeur) * Math.PI) / 4;
    for (let i = 0; i < n; i++) {
      sortie[0]![i] += voix[i]! * Math.cos(angle);
      sortie[1]![i] += voix[i]! * Math.sin(angle);
    }
  }
  return sortie;
}

const def: DefinitionSynthe = {
  id: 'cuivres',
  nom: 'Cuivres en section',
  famille: 'Vents',
  motsCles: ['cuivres', 'section', 'brass', 'trompette', 'trombone', 'funk', 'kpop', 'fanfare'],
  pret: true,
  params: {
    brillance: { defaut: 0.6 },
    attaque: { defaut: 0.3 },
    eclat: { defaut: 0.5 },
    vibrato: { defaut: 0.4 },
    largeur: { defaut: 0.7 },
  },
  relache: 0.12,
  tenu: true,
  mode: 'note',
  rendreNote(midi, r) {
    const c = rendreCuivres(midi, r.params);
    aLaSonie(c, -1);
    return preparerBoucle(c, 1.4, DUREE, 0.5);
  },
};
export default def;
