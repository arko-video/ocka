// Couloir d'automation d'une piste dans UN passage de section (frise, réglage « Avancé »). On dessine au doigt :
// toucher le vide pose un point (puis on peut le glisser), glisser un point le déplace, toucher deux fois l'enlève.
// La courbe est celle de la section (elle revient avec la section). Points aimantés au pas, valeurs au centième.

import { useRef } from 'preact/hooks';
import { pisteDe } from '../../../morceau/acces';
import type { Occurrence } from '../../../morceau/temps';
import type { Cible, Morceau, PointCourbe } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { deplacerPoint, poserPoint, pointsDe, retirerPoint, valeurNeutre } from '../../edition/automation';
import { modifier, morceau } from '../../etat';
import { toastErreur } from '../../lecture';
import { pointChoisi } from '../frise/etat-frise';
import './automation.css';

export const HAUTEUR_COULOIR = 72;
const MARGE = 6;
const RAYON_TOUCHE = 22;

interface Props {
  m: Morceau;
  idPiste: string;
  cible: Cible;
  o: Occurrence;
  zoom: number;
  couleur: string;
}

let numeroGeste = 0;

/** Chemin SVG (pixels) de la courbe : plat avant le 1er point et après le dernier, paliers respectés. */
function chemin(points: readonly PointCourbe[], largeur: number, zoom: number, y: (v: number) => number): string {
  if (points.length === 0) return '';
  const d: string[] = [`M0 ${y(points[0]!.valeur)}`];
  points.forEach((p, i) => {
    const prec = points[i - 1];
    if (prec?.forme === 'palier') d.push(`H${p.pas * zoom}`);
    d.push(`L${p.pas * zoom} ${y(p.valeur)}`);
  });
  d.push(`H${largeur}`);
  return d.join(' ');
}

export function Couloir({ m, idPiste, cible, o, zoom, couleur }: Props) {
  const geste = useRef<{ cle: string; indice: number | null; bouge: boolean; touche: number | null; x0: number; y0: number } | null>(null);
  const dernierToucher = useRef<{ indice: number; t: number } | null>(null);
  const piste = pisteDe(m, idPiste);
  if (!piste) return null;
  const s = o.section;
  const fin = o.pas;
  const largeur = fin * zoom;
  const h = HAUTEUR_COULOIR;
  const y = (v: number) => MARGE + (1 - v) * (h - 2 * MARGE);
  const points = pointsDe(m, idPiste, cible, s.id);
  const neutre = valeurNeutre(piste, cible);
  const choisi = pointChoisi.value;

  /** Point (pas aimanté au pas entier, valeur au centième) sous le doigt. */
  const lire = (e: PointerEvent): PointCourbe => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const pas = Math.max(0, Math.min(fin, Math.round((e.clientX - r.left) / zoom)));
    const v = 1 - (e.clientY - r.top - MARGE) / (h - 2 * MARGE);
    return { pas, valeur: Math.round(Math.max(0, Math.min(1, v)) * 100) / 100 };
  };
  const indiceDe = (pas: number) => pointsDe(m2(), idPiste, cible, s.id).findIndex((p) => p.pas === pas);
  const appliquer = (op: (x: Morceau) => Morceau, cle: string) => {
    try {
      modifier(op, cle);
    } catch (e) {
      toastErreur(e);
    }
  };

  return (
    <svg
      class="couloir"
      width={largeur}
      height={h}
      viewBox={`0 0 ${largeur} ${h}`}
      style={{ '--c': couleur }}
      role="img"
      aria-label={`${T.automation.couloir} · ${s.nom}`}
      data-testid={`couloir-${idPiste}-${o.index}`}
      data-points={points.length}
      onPointerDown={(e) => {
        (e.currentTarget as SVGElement).setPointerCapture?.(e.pointerId);
        const pt = lire(e);
        const r = (e.currentTarget as SVGElement).getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        let touche: number | null = null;
        let meilleur = RAYON_TOUCHE;
        points.forEach((p, i) => {
          const dist = Math.hypot(p.pas * zoom - px, y(p.valeur) - py);
          if (dist <= meilleur) {
            meilleur = dist;
            touche = i;
          }
        });
        const cle = `auto:${idPiste}:${s.id}:${++numeroGeste}`;
        geste.current = { cle, indice: touche, bouge: false, touche, x0: e.clientX, y0: e.clientY };
        if (touche === null) {
          appliquer((x) => poserPoint(x, idPiste, cible, s.id, pt), cle);
          const i = indiceDe(pt.pas);
          geste.current.indice = i >= 0 ? i : null;
          pointChoisi.value = i >= 0 ? { piste: idPiste, section: s.id, indice: i } : null;
        }
      }}
      onPointerMove={(e) => {
        const g = geste.current;
        if (!g || g.indice === null) return;
        if (!g.bouge && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 6) return;
        g.bouge = true;
        const pt = lire(e);
        const indice = g.indice;
        appliquer((x) => deplacerPoint(x, idPiste, cible, s.id, indice, pt), g.cle);
        const i = indiceDe(pt.pas);
        if (i >= 0) g.indice = i;
        pointChoisi.value = { piste: idPiste, section: s.id, indice: g.indice };
      }}
      onPointerUp={() => {
        const g = geste.current;
        geste.current = null;
        if (!g || g.bouge || g.touche === null) return;
        const avant = dernierToucher.current;
        const maintenant = Date.now();
        if (avant && avant.indice === g.touche && maintenant - avant.t < 400) {
          const i = g.touche;
          appliquer((x) => retirerPoint(x, idPiste, cible, s.id, i), `${g.cle}:x`);
          pointChoisi.value = null;
          dernierToucher.current = null;
          return;
        }
        dernierToucher.current = { indice: g.touche, t: maintenant };
        pointChoisi.value = { piste: idPiste, section: s.id, indice: g.touche };
      }}
      onPointerCancel={() => (geste.current = null)}
    >
      <rect class="couloir-fond" width={largeur} height={h} />
      {[0.25, 0.5, 0.75].map((v) => (
        <line key={v} class="couloir-grille" x1="0" x2={largeur} y1={y(v)} y2={y(v)} />
      ))}
      {points.length === 0 ? (
        <line class="couloir-neutre" x1="0" x2={largeur} y1={y(neutre)} y2={y(neutre)} />
      ) : (
        <path class="couloir-courbe" d={chemin(points, largeur, zoom, y)} />
      )}
      {points.map((p, i) => (
        <circle
          key={`${p.pas}`}
          class="couloir-point"
          data-choisi={choisi && choisi.piste === idPiste && choisi.section === s.id && choisi.indice === i ? '1' : '0'}
          cx={p.pas * zoom}
          cy={y(p.valeur)}
          r="7"
        />
      ))}
    </svg>
  );
}

/** Le morceau à jour (après un `modifier` dans le même geste). */
function m2(): Morceau {
  return morceau.peek()!;
}
