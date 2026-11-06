// Aperçu de la section dans le panneau des outils : les notes de la piste (couleur), les notes choisies (plus vives) et,
// en mode Avancé, les notes FANTÔMES des autres pistes (gris, affichage seulement ; leur motif boucle sur la longueur).

import type { Note } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { notesFantomes } from '../../edition/api-outils-notes';
import type { Cible } from './FormulairesOutils';
import { fantomesSurLongueur } from '../pianoroll/fantomes';
import { fantomesVisibles } from './reglages-outils';

const H = 72;

export function ApercuNotes({ c, notes, longueur, avance }: { c: Cible; notes: readonly Note[]; longueur: number; avance: boolean }) {
  const fantomes = avance && fantomesVisibles.value ? notesFantomes(c.m, c.piste.id, c.section) : [];
  const gris: Note[] = avance && fantomesVisibles.value ? fantomesSurLongueur(c.m, c.piste.id, c.section, longueur) : [];
  const toutes = [...notes, ...gris];
  const bas = toutes.length ? Math.min(...toutes.map((n) => n.midi)) - 1 : 59;
  const haut = toutes.length ? Math.max(...toutes.map((n) => n.midi)) + 1 : 72;
  const y = (midi: number) => ((haut - midi) / Math.max(1, haut - bas)) * (H - 4) + 1;
  const hNote = Math.max(2, Math.min(6, (H - 4) / Math.max(1, haut - bas)));
  const choisies = new Set(c.indices ?? []);
  const nomPiste = (id: string) => {
    const p = c.m.pistes.find((x) => x.id === id);
    return p?.genre === 'instrument' ? p.nom : id;
  };
  return (
    <div class="on-apercu-bloc">
      <svg class="on-apercu" viewBox={`0 0 ${longueur} ${H}`} preserveAspectRatio="none" role="img" aria-label={T.outilsNotes.apercu} data-testid="outils-apercu">
        {Array.from({ length: Math.floor(longueur / 4) }, (_, k) => (
          <line key={k} x1={k * 4} x2={k * 4} y1={0} y2={H} class={k % 4 === 0 ? 'on-mesure' : 'on-temps'} />
        ))}
        {gris.map((n, k) => (
          <rect key={`g${k}`} class="on-fantome" x={n.pas} y={y(n.midi)} width={Math.max(0.3, n.duree)} height={hNote} data-testid="fantome-note" />
        ))}
        {notes.map((n, k) => (
          <rect key={k} class={choisies.has(k) ? 'on-note on-choisie' : 'on-note'} x={n.pas} y={y(n.midi)} width={Math.max(0.3, n.duree)} height={hNote} />
        ))}
      </svg>
      {avance && (
        <label class="on-case">
          <input type="checkbox" role="switch" checked={fantomesVisibles.value} onChange={(e) => (fantomesVisibles.value = e.currentTarget.checked)} data-testid="outils-fantomes" />
          <span>
            {T.outilsNotes.fantomes}
            {fantomesVisibles.value && (
              <span class="on-fantomes-noms">
                {fantomes.length ? ` · ${fantomes.map((f) => nomPiste(f.piste)).join(', ')}` : ` · ${T.outilsNotes.aucunFantome}`}
              </span>
            )}
          </span>
        </label>
      )}
    </div>
  );
}
