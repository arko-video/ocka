// Bas du piano roll « Complet » : rangée de la sélection (Vélocité ▾, n notes choisies, Effacer), puis la barre
// Quantif · Accord · Copier · Coller · Chanter (panneau de D, C2) · Outils, avec leurs menus qui montent au-dessus.

import { EntreesPianoRoll } from '../EntreesC3';
import { useState } from 'preact/hooks';
import type { MotifNotes, Note } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { TYPES_ACCORD } from '../../edition/accords';
import {
  changerLongueurMotif,
  collerNotes,
  copierNotes,
  quantifier,
  rendreUniqueMotif,
  supprimerNotes,
} from '../../edition/notes';
import { afficherToast, annulerAction, modifier } from '../../etat';
import { ouvrirChanter } from '../../navigation';
import { IconeCopier, IconeMicro, IconePlusDActions, IconePoubelle } from '../Icones';
import {
  aimanter,
  choisies,
  cleNote,
  couloirOuvert,
  mesuresVues,
  presse,
  QUANTIFS,
  quantif,
  typeAccord,
  ZOOM,
} from './vue';

interface Props {
  piste: string;
  idSection: string;
  motif: MotifNotes | null;
  notes: readonly Note[];
  indices: readonly number[];
  partage: number;
}

type Menu = 'quantif' | 'accord' | 'outils' | null;
let origineCopie = 0;

export function BarreOutils({ piste, idSection, motif, notes, indices, partage }: Props) {
  const [menu, setMenu] = useState<Menu>(null);
  const basculer = (x: Menu) => setMenu(menu === x ? null : x);
  const q = quantif.value;
  const tous = notes.map((_, i) => i);
  const effacer = () => {
    const n = indices.length;
    if (modifier((m) => supprimerNotes(m, piste, idSection, indices))) {
      choisies.value = new Set();
      afficherToast(T.pianoRoll.effacees(n), 5000, { label: T.annuler, agir: annulerAction });
    }
  };
  const copier = () => {
    if (!motif || indices.length === 0) return afficherToast(T.pianoRoll.rienACopier);
    presse.value = copierNotes(motif, indices);
    origineCopie = Math.min(...indices.map((i) => notes[i]!.pas));
    afficherToast(T.pianoRoll.copiees(indices.length), 2500);
  };
  const coller = () => {
    const c = presse.peek();
    if (!c) return;
    const longueur = motif?.pas ?? 32;
    let pas = aimanter(origineCopie + c.longueur + q - 1e-6, q, true);
    if (pas >= longueur) pas = 0;
    if (modifier((m) => collerNotes(m, piste, idSection, c, pas))) {
      choisies.value = new Set(
        c.notes.map((n) => cleNote({ pas: Math.round((pas + n.pas) * 24) / 24, midi: n.midi })),
      );
      origineCopie = pas;
      afficherToast(T.pianoRoll.collees(c.notes.length), 4000, { label: T.annuler, agir: annulerAction });
    }
  };
  const caler = () => {
    if (modifier((m) => quantifier(m, piste, idSection, indices.length ? indices : null, q, 1)))
      afficherToast(T.pianoRoll.quantifiees, 4000, { label: T.annuler, agir: annulerAction });
    choisies.value = new Set();
    setMenu(null);
  };
  const nomAccord = typeAccord.value ? T.pianoRoll.accordsCourts[typeAccord.value] : null;

  return (
    <div class="pr-bas">
      {menu && (
        <div class="pr-menu" role="dialog" aria-label={T.pianoRoll[menu]} data-testid={`pr-menu-${menu}`}>
          {menu === 'quantif' && (
            <>
              <p class="pr-menu-titre">{T.pianoRoll.quantifAide}</p>
              <div class="pr-choix" role="radiogroup" aria-label={T.pianoRoll.quantif}>
                {QUANTIFS.map((x) => (
                  <button
                    key={x.nom}
                    type="button"
                    role="radio"
                    aria-checked={Math.abs(x.v - q) < 1e-9}
                    class="puce chiffres"
                    onClick={() => (quantif.value = x.v)}
                    data-testid={`quantif-${x.nom.replace(/\W/g, '')}`}
                  >
                    {x.nom}
                  </button>
                ))}
              </div>
              <button
                type="button"
                class="btn btn-contour btn-petit"
                disabled={notes.length === 0}
                onClick={caler}
                data-testid="pr-quantifier"
              >
                {T.pianoRoll.quantifier}
              </button>
            </>
          )}
          {menu === 'accord' && (
            <>
              <p class="pr-menu-titre">{T.pianoRoll.accordAide}</p>
              <div class="pr-choix" role="radiogroup" aria-label={T.pianoRoll.accord}>
                {[null, ...TYPES_ACCORD].map((t) => (
                  <button
                    key={t ?? 'note'}
                    type="button"
                    role="radio"
                    aria-checked={typeAccord.value === t}
                    class="puce"
                    onClick={() => ((typeAccord.value = t), setMenu(null))}
                    data-testid={`accord-${t ?? 'aucun'}`}
                  >
                    {t ? T.pianoRoll.accords[t] : T.pianoRoll.sansAccord}
                  </button>
                ))}
              </div>
            </>
          )}
          {menu === 'outils' && (
            <>
              <div class="pr-choix">
                <button
                  type="button"
                  class="btn btn-petit btn-discret"
                  disabled={notes.length === 0}
                  onClick={() => ((choisies.value = new Set(notes.map(cleNote))), setMenu(null))}
                  data-testid="pr-tout-choisir"
                >
                  {T.pianoRoll.toutChoisir}
                </button>
                <button
                  type="button"
                  class="btn btn-petit btn-discret btn-danger"
                  disabled={notes.length === 0}
                  onClick={() => (
                    modifier((m) => supprimerNotes(m, piste, idSection, tous)) &&
                      afficherToast(T.pianoRoll.effacees(tous.length), 5000, {
                        label: T.annuler,
                        agir: annulerAction,
                      }),
                    setMenu(null)
                  )}
                  data-testid="pr-tout-effacer"
                >
                  {T.pianoRoll.toutEffacer}
                </button>
              </div>
              <p class="pr-menu-titre">{T.pianoRoll.longueur}</p>
              <div class="pr-choix" role="radiogroup" aria-label={T.pianoRoll.longueur}>
                {[1, 2, 4, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={(motif?.pas ?? 32) === n * 16}
                    class="puce"
                    onClick={() => modifier((m) => changerLongueurMotif(m, piste, idSection, n * 16))}
                    data-testid={`pr-longueur-${n}`}
                  >
                    {T.pianoRoll.mesures(n)}
                  </button>
                ))}
              </div>
              <div class="pr-choix">
                <button
                  type="button"
                  class="btn btn-petit btn-discret"
                  disabled={mesuresVues.value <= ZOOM.mesuresMin}
                  onClick={() => (mesuresVues.value = Math.max(ZOOM.mesuresMin, mesuresVues.peek() / 2))}
                >
                  {T.pianoRoll.zoomPlus}
                </button>
                <button
                  type="button"
                  class="btn btn-petit btn-discret"
                  disabled={mesuresVues.value >= ZOOM.mesuresMax}
                  onClick={() => (mesuresVues.value = Math.min(ZOOM.mesuresMax, mesuresVues.peek() * 2))}
                >
                  {T.pianoRoll.zoomMoins}
                </button>
                {partage > 1 && (
                  <button
                    type="button"
                    class="btn btn-petit btn-contour"
                    onClick={() => (
                      modifier((m) => rendreUniqueMotif(m, idSection, piste)) &&
                        afficherToast(T.pianoRoll.rendu),
                      setMenu(null)
                    )}
                    data-testid="pr-rendre-unique-outils"
                  >
                    {T.pianoRoll.rendreUnique}
                  </button>
                )}
              </div>
              <EntreesPianoRoll piste={piste} fermer={() => setMenu(null)} />
            </>
          )}
        </div>
      )}
      <div class="pr-selection">
        <button
          type="button"
          class="pr-lien"
          aria-expanded={couloirOuvert.value}
          onClick={() => (couloirOuvert.value = !couloirOuvert.peek())}
          data-testid="pr-velocite"
        >
          {T.pianoRoll.velocite} {couloirOuvert.value ? '▾' : '▸'}
        </button>
        <span class="pr-selection-texte">
          {indices.length > 0 ? T.pianoRoll.choisies(indices.length) : ''}
        </span>
        {indices.length > 0 && (
          <button type="button" class="pr-lien pr-effacer" onClick={effacer} data-testid="pr-effacer">
            <IconePoubelle taille={16} /> {T.pianoRoll.effacer}
          </button>
        )}
      </div>
      <div class="pr-outils" role="toolbar" aria-label={T.pianoRoll.outils}>
        <button
          type="button"
          class="pr-outil"
          aria-expanded={menu === 'quantif'}
          onClick={() => basculer('quantif')}
          data-testid="pr-quantif"
        >
          <span class="pr-outil-valeur chiffres">{QUANTIFS.find((x) => Math.abs(x.v - q) < 1e-9)?.nom}</span>
          {T.pianoRoll.quantif}
        </button>
        <button
          type="button"
          class="pr-outil"
          data-actif={nomAccord ? '1' : '0'}
          aria-expanded={menu === 'accord'}
          onClick={() => basculer('accord')}
          data-testid="pr-accord"
        >
          <span class="pr-outil-valeur">{nomAccord ?? '♪'}</span>
          {T.pianoRoll.accord}
        </button>
        <button type="button" class="pr-outil" onClick={copier} data-testid="pr-copier">
          <IconeCopier taille={18} />
          {T.pianoRoll.copier}
        </button>
        <button
          type="button"
          class="pr-outil"
          disabled={!presse.value}
          onClick={coller}
          data-testid="pr-coller"
        >
          <span class="pr-outil-valeur">⎘</span>
          {T.pianoRoll.coller}
        </button>
        <button type="button" class="pr-outil" onClick={() => ouvrirChanter(piste)} data-testid="pr-chanter">
          <IconeMicro taille={18} />
          {T.pianoRoll.chanter}
        </button>
        <button
          type="button"
          class="pr-outil"
          aria-expanded={menu === 'outils'}
          onClick={() => basculer('outils')}
          data-testid="pr-outils"
        >
          <IconePlusDActions taille={18} />
          {T.pianoRoll.outils}
        </button>
      </div>
    </div>
  );
}
