// Notes mélodiques SANS durée (accords et mélodie) : chaque son a une longueur fixe, indépendante du tempo.
// Le graphe joue le tampon puis, à la fin de la note, baisse le gain en ligne droite (RELACHES) et arrête la source.
// Les sons tenus (nappe, lead) ont une boucle sans clic : le tampon reboucle tant que la note dure.
// Tampons mono, sauf la nappe (stéréo). Synthèse JS pure, dans le Worker de synthèse (ou le fil principal en secours).

import type { SonMelodie } from '../../morceau/types';
import { frequenceMidi } from '../../morceau/theorie';
import { FREQ } from '../synthese/briques';
import { filtreK } from '../sonie';
import { cloche, epiano, nappe, RELACHE_ACCORD } from './melodiques';
import { cowbellAccordee } from './batterie';
import { lead, pluck, piano } from './melodie';

export interface NoteSynthe {
  /** 1 canal (mono) ou 2 (nappe). */
  canaux: Float32Array[];
  /** Boucle [début, fin] en secondes (sons tenus) : le graphe met `loop` sur la source. */
  boucle?: [number, number];
}

/** Relâchement (s) de chaque son à la fin de la note. Les sons des accords gardent celui de la phase 1. */
export const RELACHES: Record<SonMelodie, number> = {
  piano: 0.15,
  epiano: RELACHE_ACCORD,
  cloche: RELACHE_ACCORD,
  nappe: RELACHE_ACCORD,
  lead: 0.08,
  pluck: 0.06,
};

/** Sons tenus (avec boucle) : ils ne s'éteignent pas seuls. */
export const SONS_TENUS: ReadonlySet<SonMelodie> = new Set<SonMelodie>(['nappe', 'lead']);

/** Son de synthèse d'un motif d'accords : le « piano » des accords est le piano électrique FM (`epiano`). */
export function sonAccord(son: 'piano' | 'nappe' | 'cloche'): SonMelodie {
  return son === 'piano' ? 'epiano' : son;
}

/**
 * Variante d'un son selon le style. Fait partie de la clé du cache. Le piano électrique a une version lo-fi ;
 * la cloche du phonk est la cloche 808 accordée (« cowbell »). Les autres styles ne changent pas.
 */
export function varianteNote(son: SonMelodie, style: string): string {
  if (son === 'epiano' && style === 'lofi') return 'lofi';
  if (son === 'cloche' && style === 'phonk') return 'cowbell';
  return '';
}

/** Longueur (s) d'une note de cloche 808 accordée (phonk) : elle s'éteint d'elle-même bien avant. */
const DUREE_COWBELL = 1.2;

/** Crête d'une note d'accord (phase 1) : 0,22. Les sons de la mélodie sont réglés à la même sonie. */
const CRETE_ACCORD = 0.22;
/** Crête maximale d'une note de mélodie après le réglage de sonie. */
const CRETE_MAX = 0.6;
/** Petits ajustements à l'oreille (dB) autour de la sonie du piano électrique. */
const AJUSTEMENT_DB: Partial<Record<SonMelodie, number>> = { lead: -1, pluck: 1 };

function crete(canaux: Float32Array[]): number {
  let max = 0;
  for (const c of canaux) for (let i = 0; i < c.length; i++) max = Math.max(max, Math.abs(c[i]!));
  return max;
}

function multiplier(canaux: Float32Array[], k: number) {
  for (const c of canaux) for (let i = 0; i < c.length; i++) c[i] *= k;
}

/** Sonie courte : RMS du son filtré K (BS.1770) sur ses 500 premières ms (l'attaque et le corps de la note). */
export function sonieCourte(c: Float32Array): number {
  const n = Math.min(c.length, Math.round(0.5 * FREQ));
  const [a, b] = filtreK(FREQ);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0, e = 0;
  for (let i = 0; i < n; i++) {
    const x = c[i]!;
    const y = a.b0 * x + a.b1 * x1 + a.b2 * x2 - a.a1 * y1 - a.a2 * y2;
    x2 = x1; x1 = x;
    const z = b.b0 * y + b.b1 * y1 + b.b2 * y2 - b.a1 * z1 - b.a2 * z2;
    y2 = y1; y1 = y;
    z2 = z1; z1 = z;
    e += z * z;
  }
  return Math.sqrt(e / Math.max(1, n));
}

/** Sonie de référence (par fréquence) : le piano électrique, do central, à la crête des accords. */
const references = new Map<number, number>();
function sonieReference(): number {
  let r = references.get(FREQ);
  if (r === undefined) {
    const ep = epiano(frequenceMidi(60), 0.6, false);
    multiplier([ep], CRETE_ACCORD / crete([ep]));
    r = sonieCourte(ep);
    references.set(FREQ, r);
  }
  return r;
}

/** Règle la sonie courte d'une note sur celle du piano électrique (± ajustement), crête bornée. */
function aLaSonie(canaux: Float32Array[], son: SonMelodie) {
  const s = sonieCourte(canaux[0]!);
  if (s > 0) multiplier(canaux, (sonieReference() * Math.pow(10, (AJUSTEMENT_DB[son] ?? 0) / 20)) / s);
  const c = crete(canaux);
  if (c > CRETE_MAX) multiplier(canaux, CRETE_MAX / c);
}

/** Fondu linéaire vers 0 sur les `duree` dernières secondes (une note très longue s'éteint sans clic). */
function fonduFin(canaux: Float32Array[], duree: number) {
  for (const c of canaux) {
    const n = Math.min(c.length, Math.round(duree * FREQ));
    for (let k = 0; k < n; k++) c[c.length - n + k] *= 1 - (k + 1) / n;
  }
}

/**
 * Boucle sans clic : la fin de la boucle [debut, fin[ est fondue (sur `fondu` s) avec ce qui précède son début,
 * donc le dernier échantillon enchaîne exactement sur le premier. Le tampon s'arrête à la fin de la boucle.
 */
export function preparerBoucle(canaux: Float32Array[], debut: number, fin: number, fondu: number): NoteSynthe {
  const S = Math.round(debut * FREQ);
  const E = Math.min(Math.round(fin * FREQ), canaux[0]!.length);
  const F = Math.min(Math.round(fondu * FREQ), S, E - S - 1);
  const L = E - S;
  const sortie = canaux.map((c) => {
    const s = c.slice(0, E);
    for (let k = 0; k < F; k++) {
      const i = E - F + k;
      const w = (k + 1) / (F + 1);
      s[i] = c[i]! * (1 - w) + c[i - L]! * w;
    }
    return s;
  });
  return { canaux: sortie, boucle: [S / FREQ, E / FREQ] };
}

/** Synthétise une note sans durée. `variante` : voir varianteNote (« lofi » pour le piano électrique lo-fi). */
export function synthetiserNote(son: SonMelodie, variante: string, midi: number): NoteSynthe {
  const f = frequenceMidi(midi);
  switch (son) {
    case 'epiano':
    case 'cloche': {
      const c = [
        son === 'epiano' ? epiano(f, 5, variante === 'lofi') : variante === 'cowbell' ? cowbellAccordee(f, DUREE_COWBELL) : cloche(f, 4),
      ];
      multiplier(c, CRETE_ACCORD / Math.max(1e-9, crete(c)));
      fonduFin(c, variante === 'cowbell' ? 0.2 : 0.4);
      return { canaux: c };
    }
    case 'nappe': {
      // Stéréo : gauche et droite désaccordées autrement (une nappe un peu large), crête commune.
      const c = [nappe(f, 4, [-9, 0, 5]), nappe(f, 4, [-5, 0, 9])];
      multiplier(c, CRETE_ACCORD / Math.max(1e-9, crete(c)));
      return preparerBoucle(c, 2, 4, 0.6);
    }
    case 'lead': {
      const c = [lead(f, 2.6)];
      aLaSonie(c, son);
      return preparerBoucle(c, 1, 2.6, 0.4);
    }
    case 'piano':
    case 'pluck': {
      const c = [son === 'piano' ? piano(midi) : pluck(midi)];
      aLaSonie(c, son);
      fonduFin(c, son === 'piano' ? 0.4 : 0.1);
      return { canaux: c };
    }
  }
}
