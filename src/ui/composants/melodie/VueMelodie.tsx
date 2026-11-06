// Vue « Mélodie » de l'étape Beat : section, son, « Boucles OCKA » / « Une autre idée » / « Revenir », octave,
// 8 pads de la gamme, « Enregistrer au clavier », puis la grille simple. Le premier geste crée le motif s'il manque.

import { useEffect } from 'preact/hooks';
import { autreIdeeMelodie, poserMelodie } from '../../../moteur/api';
import { nombreIdees, noterIdee, prochaineGraine, remettreIdee, reprendreIdee } from '../../idees';
import { SONS_MELODIE, type Morceau, type MotifNotes } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import {
  choisirSon,
  idPisteMelodie,
  motifMelodie,
  notesGamme,
  OCTAVES,
  sonMelodie,
} from '../../edition/melodie';
import { afficherToast, annulerAction, modifier, panneau, sectionCourante } from '../../etat';
import { entendreNote } from '../../lecture';
import { ouvrirPanneau } from '../../navigation';
import { IconeDe, IconeRetour } from '../Icones';
import { PANNEAU_BOUCLES, PanneauBoucles } from './PanneauBoucles';
import {
  arreterClavier,
  clavierActif,
  decompteClavier,
  demarrerClavier,
  frappesClavier,
  phaseClavier,
} from './clavier';
import { GrilleMelodie } from './GrilleMelodie';
import { PadsNotes } from './PadsNotes';
import { octaveMelodie } from './reglages-melodie';

/** Sections de l'arrangement, sans doublon, dans l'ordre. */
export function sectionsUniques(m: Morceau) {
  const vues = new Set<string>();
  return m.ordre.flatMap((id) => {
    const s = m.sections.find((x) => x.id === id);
    if (!s || vues.has(id)) return [];
    vues.add(id);
    return [s];
  });
}

/** Motif vide (pour noter l'« avant » d'une section qui n'avait pas encore de mélodie). */
const VIDE = (pas: number): MotifNotes => ({ type: 'notes', pas, notes: [] });

/** « Une autre idée » : variation de la mélodie (ou une boucle au hasard si elle est vide), graine gardée. */
function autreIdee(m: Morceau, idSection: string, actuel: MotifNotes | null) {
  const cle = `mel|${idSection}`;
  const graine = prochaineGraine(cle);
  const idee = autreIdeeMelodie(m, idSection, graine);
  if (modifier((x) => poserMelodie(x, idSection, idee))) {
    noterIdee(cle, actuel ?? VIDE(idee.pas), graine);
    afficherToast(T.allerVite.ideeMelodie, 4000, { label: T.annuler, agir: annulerAction });
  }
}

/** « Revenir » : l'idée d'avant (une étape d'Annuler de plus). */
function revenir(idSection: string) {
  const cle = `mel|${idSection}`;
  const avant = reprendreIdee(cle);
  if (!avant || avant.type !== 'notes') return;
  if (modifier((x) => poserMelodie(x, idSection, avant))) afficherToast(T.allerVite.revenu);
  else remettreIdee(cle, avant);
}

function BandeauClavier({ idSection, piste }: { idSection: string; piste?: string }) {
  const phase = phaseClavier.value;
  if (phase === 'repos')
    return (
      <div class="clavier-bloc">
        <button
          type="button"
          class="btn btn-contour btn-clavier"
          onClick={() => void demarrerClavier(idSection, piste)}
          data-testid="enregistrer-clavier"
        >
          <span class="point-rec" aria-hidden="true" /> {T.melodie.enregistrer}
        </button>
        <p class="aide">{T.melodie.aideEnregistrer}</p>
      </div>
    );
  return (
    <div
      class="clavier-bloc clavier-actif"
      role="status"
      aria-live="polite"
      data-phase={phase}
      data-testid="clavier-en-cours"
    >
      <span class="pastille-rec" data-actif={phase === 'enregistrement' ? '1' : '0'}>
        {phase === 'enregistrement' ? 'REC' : decompteClavier.value}
      </span>
      <span class="clavier-texte">
        {phase === 'enregistrement' ? T.melodie.joue : T.melodie.pret}
        {phase === 'enregistrement' && <span class="aide">{T.melodie.jouees(frappesClavier.value)}</span>}
      </span>
      <button
        type="button"
        class="btn btn-petit btn-rouge"
        onClick={arreterClavier}
        data-testid="arreter-clavier"
      >
        {T.melodie.arreter}
      </button>
    </div>
  );
}

/** La section affichée : la section courante, sinon la 1re de l'arrangement. */
export function sectionAffichee(m: Morceau) {
  const sections = sectionsUniques(m);
  return sections.find((s) => s.id === sectionCourante.value) ?? sections[0];
}

/** Choix de la section (vue Instruments et mélodie) : bloqué pendant « Enregistrer au clavier ». */
export function SegmentsSections({ m }: { m: Morceau }) {
  const choisie = sectionAffichee(m);
  return (
    <div class="segments segments-motif" role="radiogroup" aria-label={T.melodie.section}>
      {sectionsUniques(m).map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={s.id === choisie?.id}
          class="segment"
          disabled={phaseClavier.value !== 'repos'}
          onClick={() => (sectionCourante.value = s.id)}
          data-testid={`melodie-section-${s.id}`}
        >
          {s.nom}
        </button>
      ))}
    </div>
  );
}

interface Props {
  m: Morceau;
  /** Piste instrument éditée (piano roll « Simple ») : sans choix du son ni idées. Absent = la piste mélodie. */
  piste?: string;
  /** La section se choisit ailleurs (vue Instruments, barre du piano roll). */
  sansSections?: boolean;
}

export function VueMelodie({ m, piste, sansSections }: Props) {
  // En quittant la vue (onglet, bascule), un enregistrement en cours s'arrête et ses notes sont gardées.
  useEffect(() => () => (clavierActif() ? arreterClavier() : undefined), []);
  const choisie = sectionAffichee(m);
  if (!choisie) return <p class="vide">{T.structure.silence}</p>;
  const idSection = choisie.id;
  const motif = motifMelodie(m, idSection, piste);
  const son = sonMelodie(m);
  const octave = octaveMelodie.value;
  const lignes = notesGamme(m.tonalite, octave);
  const bloque = phaseClavier.value !== 'repos';
  const jouee = piste ?? idPisteMelodie(m);
  const melodie = piste === undefined;

  return (
    <>
      {!sansSections && <SegmentsSections m={m} />}

      {melodie && (
        <div class="puces puces-defile" role="radiogroup" aria-label={T.melodie.son}>
          {SONS_MELODIE.map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={x === son}
              class="puce"
              onClick={() => {
                modifier((y) => choisirSon(y, idSection, x));
                const p = idPisteMelodie(m);
                if (p) entendreNote(p, lignes[0]!, { instrument: `ocka-${x}@1` });
              }}
              data-testid={`son-melodie-${x}`}
            >
              {T.melodie.sons[x]}
            </button>
          ))}
        </div>
      )}

      {melodie && (
        <div class="idees">
          <button
            type="button"
            class="btn btn-contour btn-petit"
            aria-haspopup="dialog"
            disabled={bloque}
            onClick={() => ouvrirPanneau(PANNEAU_BOUCLES)}
            data-testid="boucles-ocka"
          >
            {T.allerVite.boucles}
          </button>
          <button
            type="button"
            class="btn btn-contour btn-petit"
            disabled={bloque}
            onClick={() => autreIdee(m, idSection, motif)}
            data-testid="autre-idee-melodie"
          >
            <IconeDe taille={18} /> {T.allerVite.autreIdee}
          </button>
          {nombreIdees(`mel|${idSection}`) > 0 && (
            <button
              type="button"
              class="btn btn-discret btn-petit"
              disabled={bloque}
              title={T.allerVite.revenirAide}
              onClick={() => revenir(idSection)}
              data-testid="revenir-melodie"
            >
              <IconeRetour taille={18} /> {T.allerVite.revenir}
            </button>
          )}
        </div>
      )}

      <section class="carte carte-pads-notes" aria-labelledby="titre-pads-notes">
        <div class="pads-notes-tete">
          <h2 id="titre-pads-notes" class="carte-titre">
            {T.melodie.pads}
          </h2>
          <div class="segments segments-octave" role="radiogroup" aria-label={T.melodie.octave}>
            {OCTAVES.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={o === octave}
                class="segment"
                onClick={() => (octaveMelodie.value = o)}
                data-testid={`octave-${o < 0 ? 'moins' : o > 0 ? 'plus' : '0'}`}
              >
                {T.melodie.octaves[String(o)]}
              </button>
            ))}
          </div>
        </div>
        <PadsNotes notes={lignes} piste={jouee} />
        <p class="aide">{T.melodie.aidePads}</p>
        <BandeauClavier idSection={idSection} piste={piste} />
      </section>

      <GrilleMelodie
        m={m}
        idSection={idSection}
        motif={motif}
        lignes={lignes}
        piste={jouee}
        bloque={bloque}
        edite={piste}
      />
      {melodie && panneau.value === PANNEAU_BOUCLES && (
        <PanneauBoucles m={m} idSection={idSection} nomSection={choisie.nom} />
      )}
    </>
  );
}
