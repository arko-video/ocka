// « ocka-choeurs@1 » : chœur de synthèse pour le gospel (L), d'après voix-synthese.ts : une source de voix (scie
// adoucie, à tables) passe dans 4 formants (voyelle « ah » ou « oh », et tout ce qu'il y a entre), 5 chanteurs un
// peu désaccordés, chacun avec son vibrato, étalés en stéréo, et un souffle léger. Note tenue (boucle sans clic).
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { bruit, FREQ } from '../briques';
import { aLaSonie, preparerBoucle } from '../outils-notes';
import { courbeFrequence, entre, entreLog, formant, nb, passeBas1, passeHaut1 } from './communs';
import { lireTables, tablesScie } from './tables';

const DUREE = 3.2;
/** Formants (Hz, largeur Hz, gain) d'un chœur mixte : « ah » puis « oh ». */
const AH: [number, number, number][] = [[800, 80, 1], [1150, 90, 0.6], [2900, 120, 0.25], [3900, 130, 0.12]]; // prettier-ignore
const OH: [number, number, number][] = [[450, 70, 1], [800, 80, 0.55], [2830, 100, 0.12], [3800, 130, 0.07]]; // prettier-ignore
/** Les 5 chanteurs : désaccord (cents), vitesse du vibrato (Hz), phase, place stéréo. */
const CHANTEURS: [number, number, number, number][] = [[0, 5.1, 0, 0], [-9, 5.6, 1.7, -0.7], [8, 4.8, 3.1, 0.7], [-4, 5.3, 4.4, -0.35], [5, 5.9, 0.9, 0.35]]; // prettier-ignore

export function rendreChoeurs(midi: number, p: Record<string, number>): Float32Array[] {
  const n = nb(DUREE);
  const f = frequenceMidi(midi);
  const voyelle = p.voyelle ?? 0;
  const vib = 30 * (p.vibrato ?? 0.5);
  const largeur = p.largeur ?? 0.7;
  const tables = tablesScie();
  const sources = [new Float32Array(n), new Float32Array(n)];
  const voix = new Float32Array(n);
  for (const [cents, vitesse, phase, place] of CHANTEURS) {
    voix.fill(0);
    const fr = courbeFrequence(n, f * Math.pow(2, cents / 1200), {
      cents: vib,
      vitesse,
      delai: 0.25,
      monte: 0.6,
      phase,
      glisseCents: -30,
      tauGlisse: 0.04,
    });
    lireTables(tables, voix, fr, 1, phase / 6.3);
    const angle = ((1 + place * largeur) * Math.PI) / 4;
    for (let i = 0; i < n; i++) {
      sources[0]![i] += voix[i]! * Math.cos(angle);
      sources[1]![i] += voix[i]! * Math.sin(angle);
    }
  }
  const souffle = bruit(DUREE, 0x6f70 + midi);
  passeHaut1(souffle, 1500);
  const sortie = sources.map((s) => {
    passeBas1(s, 2200);
    for (let i = 0; i < n; i++) s[i] += souffle[i]! * 0.04 * (p.souffle ?? 0.5);
    const o = new Float32Array(n);
    for (let k = 0; k < 4; k++) {
      const [fa, la, ga] = AH[k]!;
      const [fo, lo, go] = OH[k]!;
      formant(s, o, entreLog(fa, fo, voyelle), entre(la, lo, voyelle), entre(ga, go, voyelle));
    }
    return o;
  });
  const a = Math.max(1, Math.round(entreLog(0.02, 0.8, p.attaque ?? 0.4) * FREQ));
  for (const c of sortie) for (let i = 0; i < a; i++) c[i] *= i / a;
  return sortie;
}

const def: DefinitionSynthe = {
  id: 'choeurs',
  nom: 'Chœurs',
  famille: 'Chœurs',
  motsCles: ['choeurs', 'choeur', 'chorale', 'gospel', 'voix', 'ah', 'oh', 'choir'],
  pret: true,
  params: {
    voyelle: { defaut: 0 },
    vibrato: { defaut: 0.5 },
    largeur: { defaut: 0.7 },
    attaque: { defaut: 0.4 },
    souffle: { defaut: 0.5 },
  },
  relache: 0.35,
  tenu: true,
  mode: 'note',
  rendreNote(midi, r) {
    const c = rendreChoeurs(midi, r.params);
    aLaSonie(c, -2);
    return preparerBoucle(c, 1.6, DUREE, 0.6);
  },
};
export default def;
