// Dessin de l'éditeur de notes : clavier de 32 px (gamme colorée, toucher = entendre la note), lignes chromatiques
// colorées par la gamme visée, courbe de hauteur (voix chantée en pâle, voix corrigée en vif), notes en blocs, la note
// choisie avec ses poignées de justesse et de vibrato, et un petit indicateur sur les notes en recalcul.

import type { Ref } from 'preact';
import type { NoteAutotune } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { nomMidi } from '../pianoroll/ClavierPiano';
import type { ApercuNotes } from './gestes-notes';
import { couleurLigne, ligneDeMidi, midiDeLigne, type GeoNotes } from './vue-notes';

const E = () => T.autotuneAvance.editeur;

interface Gestionnaires {
  onPointerDown(e: PointerEvent): void;
  onPointerMove(e: PointerEvent): void;
  onPointerUp(e: PointerEvent): void;
  onPointerCancel(e: PointerEvent): void;
}

interface Props {
  geo: GeoNotes;
  notes: readonly NoteAutotune[];
  choisie: number | null;
  apercu: ApercuNotes;
  classes: ReadonlySet<number> | null;
  tonique: number | null;
  chemins: { brute: string; corrigee: string } | null;
  enCalcul: ReadonlySet<number>;
  gestes: Gestionnaires;
  grille: Ref<HTMLDivElement>;
  /** Clavier : entendre une note ; poignées au clavier (flèches). */
  entendre(midi: number): void;
  clavierPoignee(type: 'justesse' | 'vibrato', i: number, sens: number): void;
}

function vue(n: NoteAutotune, i: number, a: ApercuNotes): NoteAutotune {
  if (a?.i !== i) return n;
  if (a.type === 'deplacer') return { ...n, midi: a.midi };
  if (a.type === 'justesse') return { ...n, cents: a.cents };
  return { ...n, vibrato: a.vibrato };
}

function lignesVisibles(geo: GeoNotes): number[] {
  const out: number[] = [];
  for (let r = Math.max(0, Math.floor(geo.haut)); r <= Math.ceil(geo.haut + geo.nLignes); r++) out.push(r);
  return out;
}

export function ClavierNotes({ geo, classes, tonique, entendre }: Pick<Props, 'geo' | 'classes' | 'tonique' | 'entendre'>) {
  return (
    <div class="pr-clavier" aria-label={E().clavier}>
      {lignesVisibles(geo).map((r) => {
        const midi = midiDeLigne(r);
        const couleur = couleurLigne(midi, classes, tonique);
        const nom = couleur === 'tonique' || midi % 12 === 0 || geo.h >= 34 ? nomMidi(midi) : '';
        return (
          <span
            key={midi}
            class="pr-touche"
            data-couleur={couleur}
            data-noire={[1, 3, 6, 8, 10].includes(midi % 12) ? '1' : '0'}
            style={{ top: `${(r - geo.haut) * geo.h}px`, height: `${geo.h}px` }}
            onPointerDown={(e) => {
              e.preventDefault();
              entendre(midi);
            }}
            aria-hidden="true"
          >
            {nom && <span class="pr-touche-nom">{nom}</span>}
          </span>
        );
      })}
    </div>
  );
}

export function GrilleNotes(p: Props) {
  const { geo, apercu } = p;
  const { pxS, h, t0, haut } = geo;
  const rangees = lignesVisibles(geo).map((r) => {
    const midi = midiDeLigne(r);
    return (
      <div
        key={midi}
        class="pr-rangee"
        data-couleur={couleurLigne(midi, p.classes, p.tonique)}
        data-do={midi % 12 === 0 ? '1' : '0'}
        style={{ top: `${(r - haut) * h}px`, height: `${h}px` }}
      />
    );
  });
  let poignees = null;
  const blocs = p.notes.map((n0, i) => {
    const n = vue(n0, i, apercu);
    const x = (n.debut - t0) * pxS;
    const l = Math.max(6, (n.fin - n.debut) * pxS - 2);
    const y = (ligneDeMidi(n.midi) - haut - n.cents / 100) * h;
    if (x + l < 0 || x > geo.largeur || y + h < 0 || y > geo.hauteur) return null;
    const choisie = i === p.choisie;
    if (choisie) {
      const haute = y - 34 >= 0;
      poignees = (
        <>
          <span
            class="an-poignee an-poignee-justesse"
            data-poignee="justesse"
            data-i={i}
            role="slider"
            tabIndex={0}
            aria-label={E().justesse}
            aria-valuemin={-100}
            aria-valuemax={100}
            aria-valuenow={n.cents}
            aria-valuetext={E().cents(n.cents)}
            onKeyDown={(e) => clavier(e, (s) => p.clavierPoignee('justesse', i, s))}
            style={{ left: `${x + l / 2 - 22}px`, top: `${haute ? y - 34 : y + h + 4}px` }}
            data-testid="poignee-justesse"
          >
            {E().cents(n.cents)}
          </span>
          <span
            class="an-poignee an-poignee-vibrato"
            data-poignee="vibrato"
            data-i={i}
            role="slider"
            tabIndex={0}
            aria-label={E().vibrato}
            aria-valuemin={0}
            aria-valuemax={200}
            aria-valuenow={Math.round(n.vibrato * 100)}
            aria-valuetext={E().pourcent(n.vibrato)}
            onKeyDown={(e) => clavier(e, (s) => p.clavierPoignee('vibrato', i, s))}
            style={{ left: `${Math.min(geo.largeur - 50, x + l + 2)}px`, top: `${y + h / 2 - 14}px` }}
            data-testid="poignee-vibrato"
          >
            ∿ {E().pourcent(n.vibrato)}
          </span>
        </>
      );
    }
    return (
      <span
        key={`${n0.debut}|${i}`}
        class="an-note"
        data-i={i}
        data-choisie={choisie ? '1' : '0'}
        data-hors={couleurLigne(n.midi, p.classes, p.tonique) === 'hors' ? '1' : '0'}
        style={{ left: `${x}px`, top: `${y + 2}px`, width: `${l}px`, height: `${Math.max(6, h - 4)}px` }}
        data-testid="an-note"
        data-midi={n0.midi}
        data-debut={n0.debut}
      >
        {l > 34 && h >= 18 && <span class="an-note-nom">{nomMidi(n.midi)}</span>}
        {p.enCalcul.has(i) && <span class="an-calcul" role="status" aria-label={E().calcul} data-testid="note-calcul" />}
      </span>
    );
  });

  return (
    <div
      ref={p.grille}
      class="pr-grille an-grille"
      role="application"
      aria-label={E().grille}
      onPointerDown={p.gestes.onPointerDown}
      onPointerMove={p.gestes.onPointerMove}
      onPointerUp={p.gestes.onPointerUp}
      onPointerCancel={p.gestes.onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="an-grille"
      data-h={h}
      data-pxs={pxS}
      data-t0={t0}
      data-haut={haut}
    >
      {rangees}
      {blocs}
      {p.chemins && (
        <svg class="an-courbe" width={geo.largeur} height={geo.hauteur} aria-hidden="true" data-testid="an-courbe">
          <path class="an-courbe-brute" d={p.chemins.brute} />
          <path class="an-courbe-corrigee" d={p.chemins.corrigee} />
        </svg>
      )}
      {poignees}
    </div>
  );
}

function clavier(e: KeyboardEvent, f: (sens: number) => void) {
  const sens = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
  if (!sens) return;
  e.preventDefault();
  e.stopPropagation();
  f(sens);
}
