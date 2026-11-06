// Clavier de 32 px à gauche de la grille (gamme colorée, tonique en rose ; toucher = entendre la note) et règle des
// mesures au-dessus. Ils suivent le zoom et le défilement de la grille.

import type { Morceau } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { entendreNote } from '../../lecture';
import type { Geometrie } from './gestes';
import { couleurNote } from './vue';

/** « La4 », « Do♯3 » (do 4 = 60). */
export function nomMidi(midi: number): string {
  return T.pianoRoll.note(T.melodie.notes[midi % 12]!, Math.floor(midi / 12) - 1);
}

export function ClavierPiano({
  geo,
  tonalite,
  piste,
}: {
  geo: Geometrie;
  tonalite: Morceau['tonalite'];
  piste: string;
}) {
  const { h, haut } = geo;
  const touches = [];
  for (
    let r = Math.max(0, Math.floor(haut));
    r <= Math.min(geo.lignes.length - 1, Math.ceil(haut + geo.nLignes));
    r++
  ) {
    const midi = geo.lignes[r]!;
    const couleur = couleurNote(midi, tonalite);
    const nom = couleur === 'tonique' || midi % 12 === 0 || h >= 34 ? nomMidi(midi) : '';
    touches.push(
      <span
        key={midi}
        class="pr-touche"
        data-couleur={couleur}
        data-noire={[1, 3, 6, 8, 10].includes(midi % 12) ? '1' : '0'}
        style={{ top: `${(r - haut) * h}px`, height: `${h}px` }}
        onPointerDown={(e) => {
          e.preventDefault();
          entendreNote(piste, midi);
        }}
        aria-hidden="true"
      >
        {nom && <span class="pr-touche-nom">{nom}</span>}
      </span>,
    );
  }
  return (
    <div class="pr-clavier" aria-label={T.pianoRoll.clavier}>
      {touches}
    </div>
  );
}

export function Regle({ geo }: { geo: Geometrie }) {
  const { w, debut } = geo;
  const marques = [];
  const pasTemps = w * 4 >= 18 ? 4 : 16;
  for (let p = Math.floor(debut / pasTemps) * pasTemps; p <= debut + geo.largeur / w; p += pasTemps) {
    if (p < 0 || p >= geo.longueur) continue;
    const mesure = p % 16 === 0;
    marques.push(
      <span
        key={p}
        class="pr-marque"
        data-mesure={mesure ? '1' : '0'}
        style={{ left: `${(p - debut) * w}px` }}
      >
        {mesure ? p / 16 + 1 : ''}
      </span>,
    );
  }
  return (
    <div class="pr-regle chiffres" aria-hidden="true">
      <span class="pr-regle-coin" />
      <div class="pr-regle-bande">{marques}</div>
    </div>
  );
}
