// Grille simple de la mélodie : les 8 lignes de la gamme (la plus aiguë en haut) × les pas du motif,
// défilement horizontal. Toucher une case vide pose une note de la durée choisie ; toucher une note l'efface.
// Aucun appui long ni glissé. La colonne du pas joué s'allume pendant la lecture.

import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { ID_MELODIE } from '../../../morceau/acces';
import type { Morceau, MotifNotes } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import {
  basculerNote,
  changerLongueur,
  DUREES,
  effacerMelodie,
  longueurDefaut,
  LONGUEURS,
  noteA,
  notesHorsVue,
  notesPerdues,
} from '../../edition/melodie';
import { afficherToast, annulerAction, modifier } from '../../etat';
import { entendreNote, pasDansSection } from '../../lecture';
import { IconePoubelle } from '../Icones';
import { nomNote } from './PadsNotes';
import { dureeNote } from './reglages-melodie';

interface Props {
  m: Morceau;
  idSection: string;
  motif: MotifNotes | null;
  /** Les 8 notes MIDI de la gamme affichées (de la plus grave à la plus aiguë). */
  lignes: number[];
  /** Piste instrument jouée (la piste mélodie), ou null. */
  piste: string | null;
  /** Pendant l'enregistrement au clavier : la grille ne bouge pas. */
  bloque: boolean;
  /** Piste instrument éditée (piano roll « Simple ») ; absent = la piste mélodie. */
  edite?: string;
}

type EtatCase = 'debut' | 'suite' | 'fin' | 'seule';

/** État de chaque case occupée par une note : « midi|pas » → début, suite, fin ou note d'un seul pas. */
function casesOccupees(motif: MotifNotes | null): Map<string, EtatCase> {
  const cases = new Map<string, EtatCase>();
  for (const n of motif?.notes ?? []) {
    for (let k = 0; k < n.duree; k++) {
      const etat: EtatCase =
        n.duree === 1 ? 'seule' : k === 0 ? 'debut' : k === n.duree - 1 ? 'fin' : 'suite';
      cases.set(`${n.midi}|${n.pas + k}`, etat);
    }
  }
  return cases;
}

/** Pendant ce temps (ms) après un geste dans la grille, elle ne suit plus la lecture. */
const PAUSE_SUIVI_MS = 3000;

interface PropsColonne {
  idSection: string;
  longueur: number;
  defile: RefObject<HTMLDivElement | null>;
  /** Heure (Date.now) du dernier geste de l'utilisateur dans la grille. */
  geste: RefObject<number>;
}

/**
 * La colonne du pas joué : seul ce petit composant suit la lecture (la grille n'est pas redessinée).
 * Quand elle sort de l'écran, la grille tourne la page, sauf juste après un geste de l'utilisateur.
 */
function ColonneCourante({ idSection, longueur, defile, geste }: PropsColonne) {
  const pas = pasDansSection(idSection, longueur);
  const colonne = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = defile.current;
    const c = colonne.current;
    if (!el || !c || Date.now() - (geste.current ?? 0) < PAUSE_SUIVI_MS) return;
    const x = c.offsetLeft;
    if (x < el.scrollLeft || x + c.offsetWidth > el.scrollLeft + el.clientWidth)
      el.scrollLeft = Math.max(0, x - 4);
  }, [pas]);
  if (pas < 0) return null;
  return (
    <span
      ref={colonne}
      class="grille-courant"
      style={{ '--pas': pas }}
      data-pas={pas}
      data-testid="colonne-courante"
      aria-hidden="true"
    />
  );
}

export function GrilleMelodie({ m, idSection, motif, lignes, piste, bloque, edite }: Props) {
  const section = m.sections.find((s) => s.id === idSection);
  const longueur = motif?.pas ?? (section ? longueurDefaut(section) : 32);
  const duree = dureeNote.value;
  const cases = casesOccupees(motif);
  const hors = notesHorsVue(motif, lignes);
  const hautEnBas = lignes.map((midi, ligne) => ({ midi, ligne })).reverse();
  const defile = useRef<HTMLDivElement>(null);
  const geste = useRef(0);
  const noterGeste = () => (geste.current = Date.now());

  const toucher = (pas: number, midi: number) => {
    if (bloque) return;
    const etait = motif ? noteA(motif, pas, midi) : undefined;
    if (modifier((x) => basculerNote(x, idSection, pas, midi, duree, edite)) && !etait)
      entendreNote(piste ?? ID_MELODIE, midi);
  };
  const changer = (mesures: number) => {
    const perdues = notesPerdues(motif, mesures);
    if (modifier((x) => changerLongueur(x, idSection, mesures, edite)) && perdues > 0)
      afficherToast(T.melodie.perdues(perdues), 5000, { label: T.annuler, agir: annulerAction });
  };
  const effacer = () => {
    if (modifier((x) => effacerMelodie(x, idSection, edite)))
      afficherToast(T.melodie.effacee, 5000, { label: T.annuler, agir: annulerAction });
  };

  return (
    <section class="carte grille-carte" aria-labelledby="titre-grille">
      <div class="grille-entete">
        <h2 id="titre-grille" class="carte-titre">
          {T.melodie.grille}
        </h2>
        <button
          type="button"
          class="btn btn-petit btn-discret btn-danger"
          disabled={bloque || !motif?.notes.length}
          onClick={effacer}
          data-testid="effacer-melodie"
        >
          <IconePoubelle taille={18} /> {T.melodie.effacer}
        </button>
      </div>

      <div class="reglage">
        <span class="reglage-label" id="label-longueur-melodie">
          {T.melodie.longueur}
        </span>
        <div class="segments" role="radiogroup" aria-labelledby="label-longueur-melodie">
          {LONGUEURS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={longueur === n * 16}
              class="segment"
              disabled={bloque}
              onClick={() => changer(n)}
              data-testid={`longueur-${n}`}
            >
              {T.structure.mesures(n)}
            </button>
          ))}
        </div>
      </div>

      <div class="reglage">
        <span class="reglage-label" id="label-duree-note">
          {T.melodie.duree}
        </span>
        <div class="puces puces-durees" role="radiogroup" aria-labelledby="label-duree-note">
          {DUREES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={duree === d}
              aria-label={`${T.melodie.durees[d]} (${T.melodie.dureesNoms[d]})`}
              class="puce chiffres"
              onClick={() => (dureeNote.value = d)}
              data-testid={`duree-${d}`}
            >
              {T.melodie.durees[d]}
            </button>
          ))}
        </div>
      </div>

      <div class="grille-cadre" data-bloque={bloque ? '1' : '0'}>
        <div class="grille-noms" aria-hidden="true">
          <span />
          {hautEnBas.map(({ midi, ligne }) => (
            <span key={ligne} data-tonique={ligne === 0 || ligne === 7 ? '1' : '0'}>
              {nomNote(midi)}
            </span>
          ))}
        </div>
        <div
          ref={defile}
          class="grille-defile"
          role="group"
          aria-label={T.melodie.grille}
          onPointerDown={noterGeste}
          onWheel={noterGeste}
          onTouchStart={noterGeste}
          onKeyDown={noterGeste}
          data-testid="grille-melodie"
        >
          <div class="grille-cases" style={{ '--colonnes': longueur }}>
            {Array.from({ length: longueur }, (_, pas) => (
              <span key={`m${pas}`} class="grille-repere chiffres" aria-hidden="true">
                {pas % 16 === 0 ? pas / 16 + 1 : pas % 4 === 0 ? '·' : ''}
              </span>
            ))}
            {hautEnBas.map(({ midi, ligne }) =>
              Array.from({ length: longueur }, (_, pas) => {
                const etat = cases.get(`${midi}|${pas}`);
                return (
                  <button
                    key={`${ligne}-${pas}`}
                    type="button"
                    class="case-note"
                    data-note={etat ?? 'vide'}
                    data-temps={pas % 4 === 0 ? '1' : '0'}
                    data-mesure={pas % 16 === 0 && pas > 0 ? '1' : '0'}
                    data-tonique={ligne === 0 || ligne === 7 ? '1' : '0'}
                    aria-pressed={etat !== undefined}
                    aria-label={T.melodie.caseNote(nomNote(midi), pas + 1, etat !== undefined)}
                    onClick={() => toucher(pas, midi)}
                    data-testid={`case-${ligne}-${pas}`}
                  />
                );
              }),
            )}
            <ColonneCourante idSection={idSection} longueur={longueur} defile={defile} geste={geste} />
          </div>
        </div>
      </div>
      <p class="aide">{T.melodie.aideGrille}</p>
      {hors > 0 && (
        <p class="aide" data-testid="notes-hors-vue">
          {T.melodie.horsVue(hors)}
        </p>
      )}
    </section>
  );
}
