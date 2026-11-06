// Couloir de vélocité (repliable) sous la grille : une tige par note visible ; glisser verticalement règle la
// vélocité de la note touchée (ou de toutes les notes choisies si elle en fait partie). Un seul pas d'Annuler par geste.

import { useRef } from 'preact/hooks';
import type { Note } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { reglerVelocite } from '../../edition/notes';
import { modifier } from '../../etat';
import type { Geometrie } from './gestes';

const HAUTEUR = 64;

interface Props {
  geo: Geometrie;
  notes: readonly Note[];
  choisies: readonly number[];
  piste: string;
  idSection: string;
}

export function CouloirVelocite({ geo, notes, choisies, piste, idSection }: Props) {
  const cible = useRef<number[] | null>(null);
  const cle = useRef('');

  const lire = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, v: 1 - (e.clientY - r.top - 4) / (HAUTEUR - 8) };
  };
  const regler = (indices: number[], v: number) =>
    modifier((m) => reglerVelocite(m, piste, idSection, indices, v), cle.current);

  return (
    <div
      class="pr-couloir"
      style={{ height: `${HAUTEUR}px` }}
      role="group"
      aria-label={T.pianoRoll.velocite}
      onPointerDown={(e) => {
        const { x, v } = lire(e);
        let meilleur = -1;
        let ecart = 16;
        notes.forEach((n, i) => {
          const d = Math.abs((n.pas - geo.debut) * geo.w + 3 - x);
          if (d < ecart || (d === ecart && choisies.includes(i))) ((meilleur = i), (ecart = d));
        });
        if (meilleur < 0) return;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* sans capture */
        }
        cible.current = choisies.includes(meilleur) ? [...choisies] : [meilleur];
        cle.current = `vel-${piste}-${Date.now()}`;
        regler(cible.current, v);
      }}
      onPointerMove={(e) => {
        if (cible.current) regler(cible.current, lire(e).v);
      }}
      onPointerUp={() => (cible.current = null)}
      onPointerCancel={() => (cible.current = null)}
      data-testid="pr-couloir"
    >
      {notes.map((n, i) => {
        const x = (n.pas - geo.debut) * geo.w;
        if (x < -4 || x > geo.largeur) return null;
        return (
          <span
            key={`${n.pas}|${n.midi}`}
            class="pr-tige"
            data-choisie={choisies.includes(i) ? '1' : '0'}
            style={{ left: `${x}px`, height: `${Math.round(n.vel * (HAUTEUR - 8))}px` }}
            title={T.pianoRoll.velociteNote(n.vel)}
          />
        );
      })}
    </div>
  );
}
