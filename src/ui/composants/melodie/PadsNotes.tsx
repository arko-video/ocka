// Les 8 pads de la gamme (une octave, la tonique en rose) : toucher = entendre la note ; pendant
// « Enregistrer au clavier », chaque toucher est aussi daté. Le son part au pointerdown (pas d'attente du clic).

import type { SonMelodie } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { entendreNote } from '../../lecture';
import { frapperClavier } from './clavier';

interface Props {
  notes: number[];
  son: SonMelodie;
}

export const nomNote = (midi: number) => T.melodie.notes[((midi % 12) + 12) % 12]!;

export function PadsNotes({ notes, son }: Props) {
  const jouer = (midi: number, timeStamp: number) => {
    frapperClavier(midi, timeStamp);
    entendreNote(son, midi);
  };
  return (
    <div class="pads-notes" role="group" aria-label={T.melodie.pads} data-testid="pads-notes">
      {notes.map((midi, i) => {
        const tonique = i === 0 || i === 7;
        return (
          <button
            key={i}
            type="button"
            class="pad-note"
            data-tonique={tonique ? '1' : '0'}
            aria-label={T.melodie.padNote(nomNote(midi), tonique)}
            onPointerDown={(e) => {
              if (e.button === 0) jouer(midi, e.timeStamp);
            }}
            onClick={(e) => {
              // Clavier (Entrée, Espace) : pas de pointerdown avant.
              if (e.detail === 0) jouer(midi, e.timeStamp);
            }}
            onContextMenu={(e) => e.preventDefault()}
            data-testid={`pad-note-${i}`}
          >
            <span class="pad-note-nom">{nomNote(midi)}</span>
            <span class="pad-note-degre chiffres" aria-hidden="true">
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}
