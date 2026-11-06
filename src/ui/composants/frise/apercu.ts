// Aperçu d'un clip de la frise (pur) : des rectangles en coordonnées d'UNE boucle du motif (x et w en pas,
// y et h de 0 à 1, 0 = en haut), dessinés ensuite en motif SVG répété jusqu'à la fin de la section.

import type { Morceau, Motif, Piste } from '../../../morceau/types';
import { estPisteInstrument } from '../../../morceau/acces';
import { T } from '../../../textes-fr';

export interface Trait {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Opacité 0 à 1 (vélocité). */
  o: number;
}

export interface Apercu {
  /** Longueur d'une boucle (pas). */
  longueur: number;
  traits: Trait[];
}

/** Hauteurs → lignes : la plus aiguë en haut, au moins une octave visible. */
function parHauteur(notes: { pas: number; duree: number; h: number; vel?: number }[], longueur: number): Apercu {
  if (notes.length === 0) return { longueur, traits: [] };
  let bas = Math.min(...notes.map((n) => n.h));
  let haut = Math.max(...notes.map((n) => n.h));
  if (haut - bas < 12) {
    const milieu = (haut + bas) / 2;
    bas = milieu - 6;
    haut = milieu + 6;
  }
  const lignes = haut - bas + 1;
  const h = Math.max(0.06, Math.min(0.2, 1 / lignes));
  return {
    longueur,
    traits: notes.map((n) => ({
      x: n.pas,
      y: Math.min(1 - h, ((haut - n.h) / lignes) * (1 - h) + 0.02),
      w: Math.max(0.5, n.duree - 0.15),
      h,
      o: 0.45 + 0.55 * (n.vel ?? 0.8),
    })),
  };
}

/** L'aperçu d'un motif (null : rien à dessiner). */
export function apercuMotif(x: Motif | undefined | null): Apercu | null {
  if (!x) return null;
  switch (x.type) {
    case 'notes':
      return parHauteur(x.notes.map((n) => ({ pas: n.pas, duree: n.duree, h: n.midi, vel: n.vel })), x.pas);
    case 'basse':
      return parHauteur(x.notes.map((n) => ({ pas: n.pas, duree: n.duree, h: n.degre + 7 * (n.octave ?? 0), vel: n.vel })), x.pas);
    case 'accords':
      return { longueur: x.pas, traits: x.accords.map((a) => ({ x: a.pas, y: 0.18, w: Math.max(0.5, a.duree - 0.4), h: 0.64, o: 0.75 })) };
    case 'batterie': {
      const rangs = Object.entries(x.pistes).filter(([, v]) => v?.some((n) => n > 0));
      const h = 1 / Math.max(3, rangs.length);
      const traits: Trait[] = [];
      rangs.forEach(([, v], r) =>
        v!.forEach((vel, pas) => {
          if (vel > 0) traits.push({ x: pas + 0.1, y: r * h + h * 0.15, w: 0.8, h: h * 0.7, o: 0.4 + 0.6 * vel });
        }),
      );
      return { longueur: x.pas, traits };
    }
  }
}

/* ------------------------------------------------------------ pistes de la frise */

const COULEURS_FIXES: Record<string, string> = { batterie: '#a855f7', basse: '#ec4899', accords: '#38bdf8', sons: '#facc15', voix: '#e5e7eb' };
const COULEURS_INSTRUMENTS = ['#f59e0b', '#4ade80', '#f472b6', '#22d3ee', '#c084fc', '#fb7185', '#a3e635', '#60a5fa'];

/** Couleur d'une piste (fixe : la sienne ; instrument : selon sa place). */
export function couleurPiste(m: Morceau, p: Piste): string {
  if (!estPisteInstrument(p)) return COULEURS_FIXES[p.id] ?? '#a855f7';
  const i = m.pistes.filter(estPisteInstrument).indexOf(p);
  return COULEURS_INSTRUMENTS[Math.max(0, i) % COULEURS_INSTRUMENTS.length]!;
}

/** Pistes montrées dans la frise : batterie, basse, accords, instruments, puis tes sons et la voix s'ils servent. */
export function pistesFrise(m: Morceau): Piste[] {
  const sons = (m.sons?.length ?? 0) > 0 || m.sections.some((s) => s.boucle);
  return m.pistes.filter((p) => (p.id === 'sons' ? sons : p.id === 'voix' ? m.prises.length > 0 : true));
}

/** Nom affiché d'une piste (instrument : son nom ; fixe : « Batterie », « Basse »…). */
export function nomPiste(p: Piste): string {
  return estPisteInstrument(p) ? p.nom : (T.son.noms as Record<string, string>)[p.id] ?? p.id;
}
