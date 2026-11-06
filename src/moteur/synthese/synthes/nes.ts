// « ocka-nes@1 » : chiptune façon NES (L). Impulsion 12,5 / 25 / 50 %, triangle à 32 marches (4 bits), bruit LFSR
// 15 bits (long : 32 767 pas ; court : 93 pas, métallique). Volume en 16 niveaux (4 bits), mis à jour 60 fois par
// seconde comme la console ; arpège rapide façon jeu vidéo (une note par image : 60 Hz) et vibrato.
// Impulsions et triangle : tables à bande limitée (pas de repliement) ; le bruit garde son grain d'origine.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { FREQ } from '../briques';
import { aLaSonie, preparerBoucle } from '../outils-notes';
import { courbeFrequence, nb } from './communs';
import { lireTables, tablesDepuisPeriode, tablesEnCache, tablesImpulsion, TAILLE_TABLE } from './tables';

/** Formes (cran du réglage `forme`). */
export const FORMES_NES = [
  'impulsion-12',
  'impulsion-25',
  'impulsion-50',
  'triangle',
  'bruit-long',
  'bruit-court',
] as const;
/** Arpèges (cran du réglage `arpege`) : demi-tons joués en boucle, une note par image ; « piece » : un saut, une fois. */
export const ARPEGES_NES: readonly (readonly number[])[] = [[0], [0, 4, 7], [0, 3, 7], [0, 12], [0, 5]];
const IMAGE = 1 / 60;
/** Durée rendue et boucle [1, 2] s : 60 images (3 et 4 notes d'arpège, 6 cycles de vibrato y tiennent juste). */
const DUREE = 2;

/** Triangle de la NES : 32 marches (0 à 15 puis 15 à 0), de −1 à 1. */
const tablesTriangle = () =>
  tablesEnCache('triangle-nes', () => {
    const p = new Float64Array(TAILLE_TABLE);
    for (let j = 0; j < TAILLE_TABLE; j++) {
      const pas = Math.floor((j * 32) / TAILLE_TABLE);
      p[j] = ((pas < 16 ? 15 - pas : pas - 16) / 15) * 2 - 1;
    }
    return tablesDepuisPeriode(p);
  });

/** Bruit LFSR 15 bits (court : prise au bit 6), horloge `horloge` Hz, valeurs ±1. */
function bruitLfsr(sortie: Float32Array, horloge: number, court: boolean): void {
  let reg = 1;
  let p = 0;
  const pas = horloge / FREQ;
  let v = 1;
  for (let i = 0; i < sortie.length; i++) {
    p += pas;
    while (p >= 1) {
      p -= 1;
      const bit = (reg ^ (reg >> (court ? 6 : 1))) & 1;
      reg = (reg >> 1) | (bit << 14);
      v = reg & 1 ? -1 : 1;
    }
    sortie[i] = v;
  }
}

/** Volume 4 bits par image : de 15 à `tenue` × 15 en `chute` s, puis tenu. */
function volume(n: number, chute: number, tenue: number): Float32Array {
  const out = new Float32Array(n);
  const fin = Math.round(tenue * 15);
  const parImage = Math.round(IMAGE * FREQ);
  for (let i = 0; i < n; i++) {
    const t = Math.floor(i / parImage) * IMAGE;
    const niveau = chute <= 0 ? fin : Math.max(fin, Math.round(15 - (15 - fin) * Math.min(1, t / chute)));
    out[i] = niveau / 15;
  }
  return out;
}

export function rendreNes(midi: number, p: Record<string, number>): Float32Array {
  const n = nb(DUREE);
  const forme = FORMES_NES[Math.round((p.forme ?? 0.4) * (FORMES_NES.length - 1))]!;
  const arp = ARPEGES_NES[Math.round((p.arpege ?? 0) * (ARPEGES_NES.length - 1))]!;
  const unSaut = arp.length === 2 && arp[1] === 5;
  const vib = courbeFrequence(n, 1, { cents: 40 * (p.vibrato ?? 0), vitesse: 6, delai: 0.15, monte: 0.2 });
  const parImage = Math.round(IMAGE * FREQ);
  const freq = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const image = Math.floor(i / parImage);
    const demiTons = unSaut ? (image < 4 ? 0 : arp[1]!) : arp[image % arp.length]!;
    freq[i] = frequenceMidi(midi + demiTons) * vib[i]!;
  }
  const c = new Float32Array(n);
  if (forme.startsWith('bruit')) {
    // Horloge du LFSR suivant la note (aigu = grain fin) ; le mode court sonne comme une note métallique.
    const court = forme === 'bruit-court';
    bruitLfsr(c, Math.min(FREQ, frequenceMidi(midi) * (court ? 93 : 16)), court);
  } else {
    const tables =
      forme === 'triangle'
        ? tablesTriangle()
        : tablesImpulsion(forme === 'impulsion-12' ? 0.125 : forme === 'impulsion-25' ? 0.25 : 0.5);
    lireTables(tables, c, freq);
  }
  const chute = 0.02 + 0.98 * (p.decroissance ?? 0.5);
  const vol = volume(
    n,
    (p.decroissance ?? 0.5) <= 0 ? 0 : chute,
    forme === 'triangle' ? 1 : (p.tenue ?? 0.5),
  );
  for (let i = 0; i < n; i++) c[i] *= vol[i]!;
  // 5 ms d'entrée (pas de clic) ; le reste de la note ne change plus après 1 s (boucle).
  const e = Math.round(0.002 * FREQ);
  for (let i = 0; i < e; i++) c[i] *= i / e;
  return c;
}

const def: DefinitionSynthe = {
  id: 'nes',
  nom: 'Chiptune 8-bit',
  famille: 'Synthés',
  motsCles: ['chiptune', '8 bit', 'nes', 'jeu video', 'gaming', 'retro', 'synthe'],
  pret: true,
  params: {
    forme: { defaut: 0.4, crans: 6 }, // 12,5 % | 25 % | 50 % | triangle | bruit long | bruit court
    arpege: { defaut: 0, crans: 5 }, // aucun | majeur | mineur | octave | pièce (saut d'une quarte)
    decroissance: { defaut: 0.3 },
    tenue: { defaut: 0.6 },
    vibrato: { defaut: 0 },
  },
  relache: 0.03,
  tenu: true,
  mode: 'note',
  rendreNote(midi, r) {
    const c = [rendreNes(midi, r.params)];
    aLaSonie(c, -3);
    return preparerBoucle(c, 1.2, DUREE, 0.15);
  },
};
export default def;
