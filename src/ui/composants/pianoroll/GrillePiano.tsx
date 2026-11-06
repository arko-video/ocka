// Dessin de la grille du piano roll « Complet » : lignes du clavier (gamme colorée), traits des pas, temps et mesures,
// notes (avec l'aperçu d'un glissé), poignée de 24 px sous la note choisie, zone hors du motif, pas joué.
// Les gestes sont dans gestes.ts ; seul ce composant reçoit les Pointer Events de la grille.

import type { Ref } from 'preact';
import type { Morceau, Note } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { pasDansSection } from '../../lecture';
import type { Apercu, Geometrie } from './gestes';
import { couleurNote, ligneDe } from './vue';

interface Gestionnaires {
  onPointerDown(e: PointerEvent): void;
  onPointerMove(e: PointerEvent): void;
  onPointerUp(e: PointerEvent): void;
  onPointerCancel(e: PointerEvent): void;
}

interface Props {
  geo: Geometrie;
  notes: readonly Note[];
  choisies: readonly number[];
  apercu: Apercu;
  tonalite: Morceau['tonalite'];
  idSection: string;
  gestes: Gestionnaires;
  grille: Ref<HTMLDivElement>;
  /** Notes fantômes des autres pistes (mode Avancé) : grises, sous les notes, intouchables. */
  fantomes?: readonly Note[];
}

/** Le pas joué (seul ce petit composant suit la lecture). */
function TeteLecture({ idSection, geo }: { idSection: string; geo: Geometrie }) {
  const pas = pasDansSection(idSection, geo.longueur);
  if (pas < 0) return null;
  const x = (pas - geo.debut) * geo.w;
  if (x < -geo.w || x > geo.largeur) return null;
  return (
    <span
      class="pr-tete"
      style={{ left: `${x}px`, width: `${Math.max(2, geo.w)}px` }}
      data-pas={pas}
      data-testid="pr-pas-joue"
      aria-hidden="true"
    />
  );
}

/** La note telle qu'elle s'affiche (avec l'aperçu d'un glissé ou d'une poignée tirée). */
function vue(n: Note, i: number, a: Apercu): Note {
  if (a?.type === 'deplacer' && a.indices.includes(i))
    return { ...n, pas: n.pas + a.dPas, midi: n.midi + a.dMidi };
  if (a?.type === 'allonger' && a.i === i) return { ...n, duree: a.duree };
  return n;
}

export function GrillePiano({ geo, notes, choisies, apercu, tonalite, idSection, gestes, grille, fantomes = [] }: Props) {
  const { w, h, debut, haut } = geo;
  const premiere = Math.max(0, Math.floor(haut));
  const derniere = Math.min(geo.lignes.length - 1, Math.ceil(haut + geo.nLignes));
  const rangees = [];
  for (let r = premiere; r <= derniere; r++) {
    const midi = geo.lignes[r]!;
    rangees.push(
      <div
        key={midi}
        class="pr-rangee"
        data-couleur={couleurNote(midi, tonalite)}
        data-do={midi % 12 === 0 ? '1' : '0'}
        style={{ top: `${(r - haut) * h}px`, height: `${h}px` }}
      />,
    );
  }
  const decalage = `${-debut * w}px 0`;
  const fond = {
    backgroundSize: `${16 * w}px 100%, ${4 * w}px 100%, ${geo.q * w}px 100%`,
    backgroundPosition: `${decalage}, ${decalage}, ${decalage}`,
  };
  const finMotif = (geo.longueur - debut) * w;
  const seule = choisies.length === 1 ? choisies[0]! : -1;
  let poignee = null;

  const gris = fantomes.map((n, k) => {
    const x = (n.pas - debut) * w;
    const l = Math.max(4, n.duree * w - 1);
    const y = (ligneDe(n.midi, geo.lignes) - haut) * h;
    if (x + l < 0 || x > geo.largeur || y + h < 0 || y > geo.hauteur) return null;
    // prettier-ignore
    return <span key={`f${k}`} class="pr-fantome" style={{ left: `${x}px`, top: `${y + 1}px`, width: `${l}px`, height: `${Math.max(4, h - 2)}px` }} data-testid="pr-fantome" aria-hidden="true" />;
  });

  const dessinees = notes.map((n0, i) => {
    const n = vue(n0, i, apercu);
    const x = (n.pas - debut) * w;
    const l = Math.max(4, n.duree * w - 1);
    const y = (ligneDe(n.midi, geo.lignes) - haut) * h;
    if (x + l < 0 || x > geo.largeur || y + h < 0 || y > geo.hauteur) return null;
    const choisie = choisies.includes(i);
    if (i === seule) {
      const dessous = y + h + 24 <= geo.hauteur;
      poignee = (
        <span
          class="pr-poignee"
          data-poignee={i}
          role="slider"
          aria-label={T.pianoRoll.poignee}
          aria-valuenow={n.duree}
          style={{ left: `${Math.max(x, x + l - 28)}px`, top: `${dessous ? y + h : y - 24}px` }}
          data-testid="pr-poignee"
        />
      );
    }
    return (
      <span
        key={`${n0.pas}|${n0.midi}`}
        class="pr-note"
        data-i={i}
        data-choisie={choisie ? '1' : '0'}
        data-hors={couleurNote(n.midi, tonalite) === 'hors' ? '1' : '0'}
        style={{
          left: `${x}px`,
          top: `${y + 1}px`,
          width: `${l}px`,
          height: `${Math.max(4, h - 2)}px`,
          '--vel': n.vel,
        }}
        data-testid="pr-note"
        data-pas={n0.pas}
        data-midi={n0.midi}
      />
    );
  });

  return (
    <div
      ref={grille}
      class="pr-grille"
      role="application"
      aria-label={T.pianoRoll.grille}
      onPointerDown={gestes.onPointerDown}
      onPointerMove={gestes.onPointerMove}
      onPointerUp={gestes.onPointerUp}
      onPointerCancel={gestes.onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="pr-grille"
      data-w={w}
      data-h={h}
      data-debut={debut}
      data-haut={haut}
      data-lignes={geo.lignes.join(',')}
      data-longueur={geo.longueur}
    >
      {rangees}
      <div class="pr-traits" style={fond} />
      {finMotif < geo.largeur && <div class="pr-hors-motif" style={{ left: `${Math.max(0, finMotif)}px` }} />}
      {gris}
      {dessinees}
      {poignee}
      <TeteLecture idSection={idSection} geo={geo} />
    </div>
  );
}
