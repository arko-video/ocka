// Une cellule de la frise : le clip d'une piste dans un passage de section. Le motif boucle jusqu'à la fin de la
// section (motif SVG répété, avec un trait à chaque reprise). Toucher : éditer ; appui long : menu du clip.

import { useRef } from 'preact/hooks';
import { idMotifDe, motifParId } from '../../../morceau/acces';
import { dureePas } from '../../../morceau/temps';
import type { Morceau, Piste } from '../../../morceau/types';
import type { Occurrence } from '../../../morceau/temps';
import { T } from '../../../textes-fr';
import { usagesMotif } from '../../edition/sections';
import { apercuMotif, type Trait } from './apercu';

interface Props {
  m: Morceau;
  p: Piste;
  nom: string;
  o: Occurrence;
  couleur: string;
  zoom: number;
  toucher: () => void;
  appuiLong: () => void;
}

const DELAI_APPUI = 480;

/** Prises choisies de la voix posées dans ce passage (début et longueur en pas). */
function prisesIci(m: Morceau, o: Occurrence): Trait[] {
  const d = dureePas(m.tempo);
  return m.prises
    .filter((x) => x.choisie && x.ancre.section === o.section.id && x.ancre.occurrence === o.occurrence)
    .map((x) => ({ x: x.ancre.mesure * 16, y: 0.2, w: Math.max(1, (x.finCoupe - x.debutCoupe) / d), h: 0.6, o: 0.8 }));
}

export function Clip({ m, p, nom, o, couleur, zoom, toucher, appuiLong }: Props) {
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const long = useRef(false);
  const depart = useRef<[number, number]>([0, 0]);
  const s = o.section;
  const fin = o.pas;
  const idMotif = idMotifDe(s, p.id);
  const ap = p.id === 'voix' ? { longueur: fin, traits: prisesIci(m, o) } : p.id === 'sons' ? null : apercuMotif(motifParId(m, idMotif));
  const boucle = p.id === 'sons' ? s.boucle : undefined;
  const plein = (ap && ap.traits.length > 0) || !!boucle || (idMotif !== undefined && p.id !== 'voix');
  const n = idMotif ? usagesMotif(m, idMotif) : 0;
  const idPat = `pat-${p.id}-${o.index}`.replace(/[^A-Za-z0-9_-]/g, '-');
  const L = ap ? Math.max(1, Math.min(ap.longueur, fin)) : fin;
  const reprises: number[] = [];
  if (ap && idMotif) for (let x = ap.longueur; x < fin; x += ap.longueur) reprises.push(x);

  const annuler = () => clearTimeout(minuteur.current);
  const ouvrirMenu = () => {
    long.current = true;
    annuler();
    navigator.vibrate?.(15);
    appuiLong();
  };

  return (
    <button
      type="button"
      class="clip"
      data-plein={plein ? '1' : '0'}
      style={{ width: `${fin * zoom}px`, '--c': couleur }}
      aria-label={`${T.frise.clipDe(nom, s.nom)}${n > 1 ? ` · ${T.frise.dansSections(n)}` : ''}`}
      onPointerDown={(e) => {
        long.current = false;
        depart.current = [e.clientX, e.clientY];
        annuler();
        minuteur.current = setTimeout(ouvrirMenu, DELAI_APPUI);
      }}
      onPointerMove={(e) => {
        if (Math.hypot(e.clientX - depart.current[0], e.clientY - depart.current[1]) > 10) annuler();
      }}
      onPointerUp={annuler}
      onPointerCancel={annuler}
      onPointerLeave={annuler}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!long.current) ouvrirMenu();
      }}
      onClick={() => {
        if (long.current) {
          long.current = false;
          return;
        }
        toucher();
      }}
      data-testid={`clip-${p.id}-${o.index}`}
      data-motif={idMotif ?? ''}
    >
      {ap && ap.traits.length > 0 && (
        <svg class="clip-apercu" viewBox={`0 0 ${fin} 100`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id={idPat} patternUnits="userSpaceOnUse" width={L} height="100">
              {ap.traits.map((t, i) => (
                <rect key={i} x={t.x} y={t.y * 100} width={t.w} height={t.h * 100} rx="0.3" fill-opacity={t.o} />
              ))}
            </pattern>
          </defs>
          <rect width={fin} height="100" fill={`url(#${idPat})`} />
          {reprises.map((x) => (
            <line key={x} x1={x} x2={x} y1="0" y2="100" class="clip-reprise" vector-effect="non-scaling-stroke" />
          ))}
        </svg>
      )}
      {boucle && <span class="clip-texte texte-coupe">{m.sons?.find((x) => x.id === boucle.son)?.nom ?? T.frise.boucle}</span>}
      {n > 1 && (
        <span class="clip-lien" data-testid="clip-partage">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 014.5 9l1-1" />
          </svg>
          {n}
        </span>
      )}
    </button>
  );
}
