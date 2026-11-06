// La roue des 12 notes (comme Dubler) : do en haut, la gamme du morceau en couleur, la note jouée allumée (et les
// notes de l'accord en mode accords), une aiguille qui montre l'écart de la voix (±50 cents), le niveau en anneau.
// Lue à chaque image (requestAnimationFrame) pendant le direct.

import { useEffect, useState } from 'preact/hooks';
import { noteCourante, type NoteCourante } from '../../../moteur/api';
import { GAMMES, hauteurTonique } from '../../../morceau/theorie';
import type { Morceau } from '../../../morceau/types';
import { T } from '../../../textes-fr';

const C = 120;
const R_EXT = 112;
const R_INT = 70;

function point(r: number, angle: number): string {
  const a = ((angle - 90) * Math.PI) / 180;
  return `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
}

/** Secteur d'anneau de la classe `i` (30° chacun, do en haut). */
function secteur(i: number): string {
  const a0 = i * 30 - 14;
  const a1 = i * 30 + 14;
  return `M ${point(R_EXT, a0)} A ${R_EXT} ${R_EXT} 0 0 1 ${point(R_EXT, a1)} L ${point(R_INT, a1)} A ${R_INT} ${R_INT} 0 0 0 ${point(R_INT, a0)} Z`;
}

/** La note courante, relue à chaque image tant que `actif`. */
export function useNoteCourante(actif: boolean): NoteCourante {
  const [n, setN] = useState<NoteCourante>(noteCourante());
  useEffect(() => {
    if (!actif) {
      setN(noteCourante());
      return;
    }
    let id = 0;
    let avant = '';
    const tour = () => {
      const x = noteCourante();
      const cle = `${x.midi}|${Math.round(x.ecart / 3)}|${Math.round(x.niveau * 20)}|${x.jouees.join(',')}`;
      if (cle !== avant) {
        avant = cle;
        setN(x);
      }
      id = requestAnimationFrame(tour);
    };
    id = requestAnimationFrame(tour);
    return () => cancelAnimationFrame(id);
  }, [actif]);
  return n;
}

export const nomMidi = (midi: number) =>
  `${T.melodie.notes[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

interface Props {
  tonalite: Morceau['tonalite'];
  note: NoteCourante;
}

export function RoueNotes({ tonalite, note }: Props) {
  const t = hauteurTonique(tonalite.tonique);
  const gamme = new Set(GAMMES[tonalite.mode].map((d) => (t + d) % 12));
  const classe = note.midi === null ? -1 : ((note.midi % 12) + 12) % 12;
  const accord = new Set(note.jouees.map((m) => ((m % 12) + 12) % 12));
  const angle = classe * 30 + (note.ecart / 100) * 30;
  const nom = note.midi === null ? T.chanter.silence : nomMidi(note.midi);
  const niveau = Math.max(0, Math.min(1, note.niveau));
  const circonference = 2 * Math.PI * 116;
  return (
    <div class="roue-notes" data-testid="roue-notes" data-note={note.midi ?? ''}>
      <svg viewBox="0 0 240 240" role="img" aria-label={T.chanter.roue(nom)}>
        <circle class="roue-niveau-fond" cx={C} cy={C} r={116} />
        <circle
          class="roue-niveau"
          cx={C}
          cy={C}
          r={116}
          stroke-dasharray={`${(niveau * circonference).toFixed(1)} ${circonference.toFixed(1)}`}
          transform={`rotate(-90 ${C} ${C})`}
        />
        {T.melodie.notes.map((n, i) => {
          const etat = i === classe ? 'jouee' : accord.has(i) ? 'accord' : gamme.has(i) ? 'gamme' : 'hors';
          return (
            <g key={n} class={`roue-case roue-${etat}`} data-testid={`roue-${i}`} data-etat={etat}>
              <path d={secteur(i)} />
              <text
                x={point(91, i * 30).split(' ')[0]}
                y={point(91, i * 30).split(' ')[1]}
                dy="0.35em"
                text-anchor="middle"
              >
                {n}
              </text>
            </g>
          );
        })}
        {note.midi !== null && (
          <line
            class="roue-aiguille"
            x1={C}
            y1={C - R_INT + 4}
            x2={C}
            y2={C - R_EXT - 2}
            transform={`rotate(${angle.toFixed(1)} ${C} ${C})`}
          />
        )}
        <text class="roue-nom" x={C} y={C - 4} text-anchor="middle">
          {nom}
        </text>
        {note.midi !== null && (
          <text class="roue-ecart" x={C} y={C + 22} text-anchor="middle">
            {`${note.ecart > 0 ? '+' : ''}${Math.round(note.ecart)} c`}
          </text>
        )}
      </svg>
    </div>
  );
}
