// Vue « Mélodie » de l'étape Beat : section, son, « Boucles OCKA » / « Une autre idée » / « Revenir », octave,
// 8 pads de la gamme, « Enregistrer au clavier », puis la grille simple. Le premier geste crée le motif s'il manque.

import { useEffect } from 'preact/hooks';
import { autreIdeeMelodie, poserMelodie } from '../../../moteur/api';
import { nombreIdees, noterIdee, prochaineGraine, remettreIdee, reprendreIdee } from '../../idees';
import { SONS_MELODIE, type Morceau, type MotifMelodie } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { choisirSon, motifMelodie, notesGamme, OCTAVES, SON_DEFAUT } from '../../edition/melodie';
import { afficherToast, annulerAction, modifier, panneau, sectionCourante } from '../../etat';
import { entendreNote } from '../../lecture';
import { ouvrirPanneau } from '../../navigation';
import { IconeDe, IconeRetour } from '../Icones';
import { PANNEAU_BOUCLES, PanneauBoucles } from './PanneauBoucles';
import { arreterClavier, clavierActif, decompteClavier, demarrerClavier, frappesClavier, phaseClavier } from './clavier';
import { GrilleMelodie } from './GrilleMelodie';
import { PadsNotes } from './PadsNotes';
import { octaveMelodie } from './reglages-melodie';

/** Sections de l'arrangement, sans doublon, dans l'ordre. */
function sectionsUniques(m: Morceau) {
  const vues = new Set<string>();
  return m.ordre.flatMap((id) => {
    const s = m.sections.find((x) => x.id === id);
    if (!s || vues.has(id)) return [];
    vues.add(id);
    return [s];
  });
}

/** Motif vide (pour noter l'« avant » d'une section qui n'avait pas encore de mélodie). */
const VIDE = (pas: number): MotifMelodie => ({ type: 'melodie', pas, notes: [], son: 'piano' });

/** « Une autre idée » : variation de la mélodie (ou une boucle au hasard si elle est vide), graine gardée. */
function autreIdee(m: Morceau, idSection: string, actuel: MotifMelodie | null) {
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
  if (!avant || avant.type !== 'melodie') return;
  if (modifier((x) => poserMelodie(x, idSection, avant))) afficherToast(T.allerVite.revenu);
  else remettreIdee(cle, avant);
}

function BandeauClavier({ idSection }: { idSection: string }) {
  const phase = phaseClavier.value;
  if (phase === 'repos')
    return (
      <div class="clavier-bloc">
        <button type="button" class="btn btn-contour btn-clavier" onClick={() => void demarrerClavier(idSection)} data-testid="enregistrer-clavier">
          <span class="point-rec" aria-hidden="true" /> {T.melodie.enregistrer}
        </button>
        <p class="aide">{T.melodie.aideEnregistrer}</p>
      </div>
    );
  return (
    <div class="clavier-bloc clavier-actif" role="status" aria-live="polite" data-phase={phase} data-testid="clavier-en-cours">
      <span class="pastille-rec" data-actif={phase === 'enregistrement' ? '1' : '0'}>
        {phase === 'enregistrement' ? 'REC' : decompteClavier.value}
      </span>
      <span class="clavier-texte">
        {phase === 'enregistrement' ? T.melodie.joue : T.melodie.pret}
        {phase === 'enregistrement' && <span class="aide">{T.melodie.jouees(frappesClavier.value)}</span>}
      </span>
      <button type="button" class="btn btn-petit btn-rouge" onClick={arreterClavier} data-testid="arreter-clavier">
        {T.melodie.arreter}
      </button>
    </div>
  );
}

export function VueMelodie({ m }: { m: Morceau }) {
  // En quittant la vue (onglet, bascule), un enregistrement en cours s'arrête et ses notes sont gardées.
  useEffect(() => () => (clavierActif() ? arreterClavier() : undefined), []);
  const sections = sectionsUniques(m);
  const choisie = sections.find((s) => s.id === sectionCourante.value) ?? sections[0];
  if (!choisie) return <p class="vide">{T.structure.silence}</p>;
  const idSection = choisie.id;
  const motif = motifMelodie(m, idSection);
  const son = motif?.son ?? SON_DEFAUT;
  const octave = octaveMelodie.value;
  const lignes = notesGamme(m.tonalite, octave);
  const bloque = phaseClavier.value !== 'repos';

  return (
    <>
      <div class="segments segments-motif" role="radiogroup" aria-label={T.melodie.section}>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={s.id === idSection}
            class="segment"
            disabled={bloque}
            onClick={() => (sectionCourante.value = s.id)}
            data-testid={`melodie-section-${s.id}`}
          >
            {s.nom}
          </button>
        ))}
      </div>

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
              entendreNote(x, lignes[0]!);
            }}
            data-testid={`son-melodie-${x}`}
          >
            {T.melodie.sons[x]}
          </button>
        ))}
      </div>

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
        <button type="button" class="btn btn-contour btn-petit" disabled={bloque} onClick={() => autreIdee(m, idSection, motif)} data-testid="autre-idee-melodie">
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
        <PadsNotes notes={lignes} son={son} />
        <p class="aide">{T.melodie.aidePads}</p>
        <BandeauClavier idSection={idSection} />
      </section>

      <GrilleMelodie m={m} idSection={idSection} motif={motif} lignes={lignes} son={son} bloque={bloque} />
      {panneau.value === PANNEAU_BOUCLES && <PanneauBoucles m={m} idSection={idSection} nomSection={choisie.nom} />}
    </>
  );
}
