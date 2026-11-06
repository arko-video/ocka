// « Outils malins » du piano roll (P) : riff machine (toujours), puis en mode Avancé (decisions-v2 §6) caler avec une
// force, arpège, strum, humaniser, glissé, swing de la piste et notes fantômes, sur `pisteEditee` dans la section du
// piano roll. Les outils agissent sur les notes choisies dans le piano roll, sinon sur toutes. Barre d'onglets au pouce.
// Ouvert par ouvrirOutilsNotes (menu « Outils » du piano roll Complet) ; Retour ramène au piano roll.

import { motifNotesDe, pisteDe } from '../../../morceau/acces';
import { T } from '../../../textes-fr';
import { modeAvance, morceau, PANNEAUX, panneau, pisteEditee, reglerAvance } from '../../etat';
import { sectionAffichee } from '../melodie/VueMelodie';
import { Panneau } from '../Panneau';
import { choisies, cleNote } from '../pianoroll/vue';
import { ApercuNotes } from './ApercuNotes';
import { FormArpege, FormCaler, FormGlisse, FormHumaniser, FormRiff, FormStrum, FormSwing, type Cible } from './FormulairesOutils';
import { ONGLETS, onglet, type Onglet } from './reglages-outils';
import './outils-notes.css';

const FORMS: Record<Onglet, (p: { c: Cible }) => preact.JSX.Element> = {
  riff: FormRiff,
  caler: FormCaler,
  arpege: FormArpege,
  strum: FormStrum,
  humaniser: FormHumaniser,
  glisse: FormGlisse,
  swing: FormSwing,
};

function Contenu() {
  const m = morceau.value;
  const p = m && pisteEditee.value ? pisteDe(m, pisteEditee.value) : undefined;
  const section = m ? sectionAffichee(m) : undefined;
  if (!m || p?.genre !== 'instrument' || !section) return <p class="aide">{T.outilsNotes.aucunePiste}</p>;
  const motif = motifNotesDe(m, section.id, p.id);
  const notes = motif?.notes ?? [];
  const sel = notes.flatMap((n, i) => (choisies.value.has(cleNote(n)) ? [i] : []));
  const c: Cible = { m, piste: p, section: section.id, indices: sel.length ? sel : null, nNotes: notes.length };
  const avance = modeAvance.value;
  const ouverts = avance ? ONGLETS : (['riff'] as const);
  const actif: Onglet = ouverts.includes(onglet.value as never) ? onglet.value : 'riff';
  const Form = FORMS[actif];
  return (
    <div class="on" data-testid="outils-notes">
      <p class="on-cible">
        <strong>{p.nom}</strong> · {section.nom} · <span data-testid="outils-sur">{notes.length ? T.outilsNotes.sur(sel.length || notes.length, sel.length === 0) : T.outilsNotes.vide}</span>
      </p>
      <ApercuNotes c={c} notes={notes} longueur={motif?.pas ?? 32} avance={avance} />
      <div class="on-onglets puces puces-defile" role="tablist" aria-label={T.outilsNotes.outils} data-testid="outils-barre">
        {ouverts.map((id) => (
          <button key={id} type="button" role="tab" class="puce" aria-selected={id === actif} aria-checked={id === actif} onClick={() => (onglet.value = id)} data-testid={`outils-onglet-${id}`}>
            {T.outilsNotes.onglets[id]}
          </button>
        ))}
      </div>
      <div class="on-corps" role="tabpanel" data-testid={`outils-corps-${actif}`}>
        <Form c={c} />
      </div>
      {!avance && (
        <div class="on-avance">
          <p class="aide">{T.outilsNotes.avanceAide}</p>
          <button type="button" class="btn btn-contour btn-petit" onClick={() => reglerAvance(true)} data-testid="outils-avance">
            {T.outilsNotes.activerAvance}
          </button>
        </div>
      )}
    </div>
  );
}

export function PanneauOutilsNotes() {
  if (panneau.value !== PANNEAUX.outilsNotes) return null;
  return (
    <Panneau id={PANNEAUX.outilsNotes} titre={T.outilsNotes.titre}>
      <Contenu />
    </Panneau>
  );
}
