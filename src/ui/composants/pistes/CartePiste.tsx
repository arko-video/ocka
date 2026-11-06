// Une carte de la vue Pistes : nom (modifiable), instrument (changeable), M/S, volume, aperçu des notes de la
// section courante (toucher = ouvrir le piano roll), menu « ⋯ » (renommer, dupliquer, monter, descendre, supprimer).

import { useEffect, useRef, useState } from 'preact/hooks';
import { pistesGelees } from '../../../moteur/api';
import { motifNotesDe } from '../../../morceau/acces';
import type { Morceau, MotifNotes, PisteInstrument } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { deplacerPiste, renommerPiste } from '../../edition/pistes';
import { modifier } from '../../etat';
import { versionGels } from '../../lecture';
import { ouvrirPianoRoll } from '../../navigation';
import { IconeBas, IconeCopier, IconeCrayon, IconeHaut, IconePlusDActions, IconePoubelle } from '../Icones';
import { dupliquer, ouvrirChoix, regler, supprimer } from './actions';
import { infoInstrument, nomInstrument } from './catalogue';

/** La piste est-elle gelée (V : « freeze », rendu à jour) ? Jamais d'erreur. */
function estGelee(m: Morceau, id: string): boolean {
  try {
    return pistesGelees(m).includes(id);
  } catch {
    return false;
  }
}

/** Aperçu des notes (une barre par note), sur la longueur du motif. */
export function ApercuNotes({ motif }: { motif: MotifNotes | null }) {
  if (!motif || motif.notes.length === 0) return <span class="pc-apercu-vide">{T.pistes.sansNotes}</span>;
  const bas = Math.min(...motif.notes.map((n) => n.midi));
  const haut = Math.max(...motif.notes.map((n) => n.midi), bas + 6);
  return (
    <svg class="pc-apercu-svg" viewBox={`0 0 ${motif.pas} 24`} preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: motif.pas / 16 - 1 }, (_, k) => (
        <rect key={`m${k}`} x={(k + 1) * 16 - 0.05} y="0" width="0.1" height="24" class="pc-apercu-mesure" />
      ))}
      {motif.notes.map((n, i) => (
        <rect
          key={i}
          x={n.pas}
          y={21 - (19 * (n.midi - bas)) / (haut - bas)}
          width={Math.max(0.35, n.duree - 0.15)}
          height="2.4"
          rx="0.6"
        />
      ))}
    </svg>
  );
}

function NomModifiable({ p, onFin }: { p: PisteInstrument; onFin: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const valider = () => {
    modifier((x) => renommerPiste(x, p.id, ref.current?.value ?? p.nom));
    onFin();
  };
  return (
    <input
      ref={ref}
      class="champ-texte pc-nom-champ"
      maxLength={40}
      aria-label={T.pistes.nom}
      defaultValue={p.nom}
      onBlur={valider}
      onKeyDown={(e) => {
        if (e.key === 'Enter') valider();
        if (e.key === 'Escape') onFin();
      }}
      data-testid={`nom-piste-champ-${p.id}`}
    />
  );
}

interface Props {
  m: Morceau;
  p: PisteInstrument;
  idSection: string | null;
  premiere: boolean;
  derniere: boolean;
}

export function CartePiste({ m, p, idSection, premiere, derniere }: Props) {
  const [menu, setMenu] = useState(false);
  const [edition, setEdition] = useState(false);
  const motif = idSection ? motifNotesDe(m, idSection, p.id) : null;
  const info = infoInstrument(p.instrument);
  const aTelecharger = info?.source === 'banque' && !info.installe;
  const ouvrir = () => ouvrirPianoRoll(p.id, 'complet');
  const initiale = p.nom.trim().charAt(0).toUpperCase() || '♪';
  void versionGels.value; // badge « gelée » à jour quand un gel est prêt ou retiré
  const gelee = estGelee(m, p.id);

  return (
    <li class="pc" data-muet={p.muet ? '1' : '0'} data-testid={`carte-piste-${p.id}`}>
      <div class="pc-tete">
        <button
          type="button"
          class="pc-pastille"
          aria-label={T.pistes.ouvrir(p.nom)}
          onClick={ouvrir}
          data-testid={`ouvrir-piste-${p.id}`}
        >
          {initiale}
        </button>
        <div class="pc-titres">
          {edition ? (
            <NomModifiable p={p} onFin={() => setEdition(false)} />
          ) : (
            <button
              type="button"
              class="pc-nom"
              onClick={() => setEdition(true)}
              title={T.pistes.renommer}
              data-testid={`nom-piste-${p.id}`}
            >
              {p.nom}
            </button>
          )}
          <button
            type="button"
            class="pc-instrument"
            onClick={() => ouvrirChoix(p.id)}
            data-testid={`instrument-piste-${p.id}`}
          >
            {nomInstrument(p.instrument)}
            {aTelecharger && <span class="badge badge-magenta">{T.pistes.muette}</span>}
            {gelee && <span class="badge badge-magenta" data-testid={`gelee-piste-${p.id}`}>{T.voixAvancee.gel.gelee}</span>}
          </button>
        </div>
        <button
          type="button"
          class="pc-ms"
          aria-pressed={p.muet}
          aria-label={`${T.pistes.muet} : ${p.nom}`}
          onClick={() => regler(p.id, { muet: !p.muet })}
          data-testid={`muet-piste-${p.id}`}
        >
          M
        </button>
        <button
          type="button"
          class="pc-ms"
          data-solo="1"
          aria-pressed={p.solo}
          aria-label={`${T.pistes.solo} : ${p.nom}`}
          onClick={() => regler(p.id, { solo: !p.solo })}
          data-testid={`solo-piste-${p.id}`}
        >
          S
        </button>
        <button
          type="button"
          class="btn-icone pc-plus"
          aria-expanded={menu}
          aria-label={T.pistes.actions(p.nom)}
          onClick={() => setMenu(!menu)}
          data-testid={`menu-piste-${p.id}`}
        >
          <IconePlusDActions taille={20} />
        </button>
      </div>
      {menu && (
        <div class="pc-menu" role="group" aria-label={T.pistes.actions(p.nom)}>
          <button
            type="button"
            class="btn btn-petit btn-discret"
            onClick={() => (setMenu(false), setEdition(true))}
            data-testid={`renommer-${p.id}`}
          >
            <IconeCrayon taille={16} /> {T.pistes.renommer}
          </button>
          <button
            type="button"
            class="btn btn-petit btn-discret"
            onClick={() => (setMenu(false), dupliquer(p.id))}
            data-testid={`dupliquer-${p.id}`}
          >
            <IconeCopier taille={16} /> {T.pistes.dupliquer}
          </button>
          <button
            type="button"
            class="btn btn-petit btn-discret"
            disabled={premiere}
            onClick={() => modifier((x) => deplacerPiste(x, p.id, -1))}
            data-testid={`monter-${p.id}`}
          >
            <IconeHaut taille={16} /> {T.pistes.monter}
          </button>
          <button
            type="button"
            class="btn btn-petit btn-discret"
            disabled={derniere}
            onClick={() => modifier((x) => deplacerPiste(x, p.id, 1))}
            data-testid={`descendre-${p.id}`}
          >
            <IconeBas taille={16} /> {T.pistes.descendre}
          </button>
          <button
            type="button"
            class="btn btn-petit btn-discret btn-danger"
            onClick={() => (setMenu(false), supprimer(p.id, p.nom))}
            data-testid={`supprimer-${p.id}`}
          >
            <IconePoubelle taille={16} /> {T.pistes.supprimer}
          </button>
        </div>
      )}
      <button
        type="button"
        class="pc-apercu"
        aria-label={T.pistes.ouvrir(p.nom)}
        onClick={ouvrir}
        data-testid={`apercu-piste-${p.id}`}
      >
        <ApercuNotes motif={motif} />
        {motif && motif.notes.length > 0 && (
          <span class="pc-compte chiffres">{T.pistes.notes(motif.notes.length)}</span>
        )}
      </button>
      <input
        type="range"
        class="curseur pc-volume"
        min={0}
        max={1}
        step={0.01}
        value={p.volume}
        aria-label={T.pistes.volume(p.nom)}
        onInput={(e) =>
          regler(p.id, { volume: Number((e.target as HTMLInputElement).value) }, `volume-${p.id}`)
        }
        data-testid={`volume-piste-${p.id}`}
      />
    </li>
  );
}
