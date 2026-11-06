// Le jeu en direct du looper (R) mis en SECTIONS : chaque « tour » (de mesure en mesure, un motif par piste) devient
// une suite de sections de 16 mesures au plus, qui repartent à leur début (comme toute section d'OCKA).
// Le looper joue EXACTEMENT ces sections (il charge ce morceau dans le lecteur) : ce qui est enregistré dans
// l'arrangement est donc ce qu'on a entendu, au temps près.

import type { Morceau, Section } from '../../morceau/types';
import type { LancementLooper } from '../api-performance';

/** Motif joué par chaque piste (null ou absent = rien). */
export type Actifs = Readonly<Record<string, string | null>>;

/** Un tour : à partir de la mesure `debut`, `mesures` mesures (Infinity = jusqu'à nouvel ordre) avec `actifs`. */
export interface Tour {
  debut: number;
  mesures: number;
  actifs: Actifs;
}

/** Mesures d'une section, au plus. */
export const MESURES_MAX_SECTION = 16;

/** État après les lancements (dans l'ordre) : un motif par piste ; null = arrêtée. */
export function appliquer(
  actifs: Actifs,
  lancements: readonly { piste: string; motif: string | null }[],
): Actifs {
  if (lancements.length === 0) return actifs;
  const out: Record<string, string | null> = { ...actifs };
  for (const l of lancements) out[l.piste] = l.motif;
  return out;
}

/** Les tours d'un journal de lancements (triés par mesure) : un tour par mesure où quelque chose change. */
export function toursDuJournal(journal: readonly LancementLooper[], depart: Actifs = {}): Tour[] {
  const tries = [...journal].sort((a, b) => a.mesure - b.mesure);
  const tours: Tour[] = [];
  let actifs = depart;
  for (let i = 0; i < tries.length;) {
    const mesure = tries[i]!.mesure;
    const lot: LancementLooper[] = [];
    while (i < tries.length && tries[i]!.mesure === mesure) lot.push(tries[i++]!);
    actifs = appliquer(actifs, lot);
    const dernier = tours[tours.length - 1];
    if (dernier) dernier.mesures = mesure - dernier.debut;
    tours.push({ debut: mesure, mesures: Infinity, actifs });
  }
  return tours.filter((t) => t.mesures > 0);
}

/** Empreinte lisible d'un état (pour réutiliser la même section). */
export function cleActifs(actifs: Actifs): string {
  return Object.keys(actifs)
    .filter((p) => actifs[p])
    .sort()
    .map((p) => `${p}=${actifs[p]}`)
    .join(';');
}

/** Les motifs d'une section pour un état : dictionnaire SANS prototype ; seuls les motifs qui existent. */
export function motifsSection(m: Morceau, actifs: Actifs): Record<string, string> {
  const out = Object.create(null) as Record<string, string>;
  for (const p of m.pistes) {
    const id = actifs[p.id];
    if (id && m.motifs[id]) out[p.id] = id;
  }
  return out;
}

export interface Decoupe {
  sections: Section[];
  ordre: string[];
}

/**
 * Découpe des tours en sections (16 mesures au plus ; une section par (état, longueur), réutilisée) :
 * `nommer(i)` donne le nom de la i-ème nouvelle section, `id(cle)` son id. `jusqua` borne un tour sans fin.
 */
export function decouper(
  m: Morceau,
  tours: readonly Tour[],
  jusqua: number,
  nommer: (i: number) => string,
  id: (cle: string, i: number) => string,
): Decoupe {
  const parCle = new Map<string, Section>();
  const ordre: string[] = [];
  for (const t of tours) {
    let reste = Math.min(t.mesures, Math.max(0, jusqua - t.debut));
    while (reste > 0) {
      const mesures = Math.min(MESURES_MAX_SECTION, reste);
      reste -= mesures;
      const cle = `${cleActifs(t.actifs)}#${mesures}`;
      let s = parCle.get(cle);
      if (!s) {
        const i = parCle.size;
        s = {
          id: id(cle, i),
          nom: nommer(i),
          mesures,
          motifs: motifsSection(m, t.actifs),
          coupure: 'aucune',
        };
        parCle.set(cle, s);
      }
      ordre.push(s.id);
    }
  }
  return { sections: [...parCle.values()], ordre };
}

/** La i-ème valeur libre de `motif(n)` (n = 1, 2…) qui n'est pas dans `pris`. */
function iemeLibre(pris: Set<string>, i: number, motif: (n: number) => string): string {
  for (let n = 1, vus = 0; ; n++) if (!pris.has(motif(n)) && vus++ === i) return motif(n);
}

/** Nom de la i-ème section ajoutée par le looper : « Direct 1 », « Direct 2 »… (jamais un nom déjà pris). */
export function nomSectionLibre(m: Morceau, i: number): string {
  return iemeLibre(new Set(m.sections.map((s) => s.nom)), i, (n) => `Direct ${n}`);
}

/** Id de la i-ème section ajoutée par le looper (jamais un id déjà pris). */
export function idSectionLibre(m: Morceau, i: number): string {
  return iemeLibre(new Set(m.sections.map((s) => s.id)), i, (n) => `direct-${n}`);
}
