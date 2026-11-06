// Entrées vers les panneaux de la vague C3 (intégrateur) : de petits boutons posés en UNE ligne dans les écrans
// existants, pour que P, S, L, R et V n'éditent que leurs propres panneaux. Les data-testid ci-dessous sont FIGÉS.
// Les panneaux décident eux-mêmes de ce qu'ils montrent en « Avancé » (decisions-v2 §6) ; les entrées restent visibles.

import { T } from '../../textes-fr';
import { morceau, sectionCourante } from '../etat';
import {
  ouvrirConfort,
  ouvrirEditeurSon,
  ouvrirLooper,
  ouvrirMidi,
  ouvrirOutilsNotes,
  ouvrirPerformance,
  ouvrirReference,
  ouvrirSonsCourts,
  ouvrirSynthe,
  ouvrirVoixAvancee,
} from '../navigation';
import { IconePlusDActions } from './Icones';

interface PropsBouton {
  testid: string;
  texte: string;
  agir: () => void;
  discret?: boolean;
}

function Bouton({ testid, texte, agir, discret }: PropsBouton) {
  return (
    <button type="button" class={`btn btn-petit ${discret ? 'btn-discret' : 'btn-contour'}`} onClick={agir} data-testid={testid}>
      {texte}
    </button>
  );
}

/** Menu « Outils » du piano roll Complet : outils malins (P), MIDI (P), synthé de la piste « ocka-… » (L). */
export function EntreesPianoRoll({ piste, fermer }: { piste: string; fermer: () => void }) {
  const p = morceau.value?.pistes.find((x) => x.id === piste);
  const synthe = p?.genre === 'instrument' && p.instrument.startsWith('ocka-');
  return (
    <div class="pr-choix">
      <Bouton testid="pr-outils-malins" texte={T.outilsNotes.ouvrir} agir={() => (fermer(), ouvrirOutilsNotes(piste))} discret />
      <Bouton testid="pr-midi" texte={T.midi.ouvrir} agir={() => (fermer(), ouvrirMidi(piste))} discret />
      {synthe && <Bouton testid="pr-synthe" texte={T.synthe.ouvrir} agir={() => (fermer(), ouvrirSynthe(piste))} discret />}
    </div>
  );
}

/** Vue Pistes : MIDI (fichiers .mid, clavier ; P). */
export function EntreesPistes() {
  return <Bouton testid="pistes-midi" texte={T.midi.ouvrir} agir={() => ouvrirMidi(null)} discret />;
}

/** « Tes sons » : découper / modifier le son choisi (S) ; fabriquer un son (L). */
export function EntreesSons({ idSon }: { idSon: string | null }) {
  return (
    <div class="pr-choix">
      {idSon && <Bouton testid="son-editer" texte={T.editeurSon.ouvrir} agir={() => ouvrirEditeurSon(idSon)} />}
      <Bouton testid="sons-fabriquer" texte={T.sonsCourts.ouvrir} agir={ouvrirSonsCourts} discret />
    </div>
  );
}

/** Structure : « Jouer en direct » (looper, R) et effets de performance de la section courante (R). */
export function EntreesStructure() {
  return (
    <>
      <Bouton testid="structure-looper" texte={T.looper.ouvrir} agir={ouvrirLooper} />
      <Bouton testid="structure-perf" texte={T.performance.ouvrir} agir={() => ouvrirPerformance(sectionCourante.peek())} discret />
    </>
  );
}

/** Voix : voix avancée (V). */
export function EntreesVoix() {
  return <Bouton testid="voix-avancee" texte={T.voixAvancee.ouvrir} agir={() => ouvrirVoixAvancee(null)} discret />;
}

/** Son : écoute de référence (V). */
export function EntreesSon() {
  return <Bouton testid="son-reference" texte={T.reference.ouvrir} agir={ouvrirReference} discret />;
}

/** En-tête du studio : confort (R). */
export function EntreeConfort() {
  return (
    <button type="button" class="btn-icone" aria-label={T.confort.titre} title={T.confort.titre} onClick={ouvrirConfort} data-testid="ouvrir-confort">
      <IconePlusDActions />
    </button>
  );
}
