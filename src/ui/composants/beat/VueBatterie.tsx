// Vue « Batterie » de l'étape Beat : motif de section, « Une autre idée » et « Revenir », vue d'ensemble,
// instruments (avec tes sons posés sur les pads perso), « + Ton son », pads 4×4, réglages du beat.

import { autreIdeeBatterie, poserBatterie } from '../../../moteur/api';
import { nombreIdees, noterIdee, prochaineGraine, remettreIdee, reprendreIdee } from '../../idees';
import { reglagesKit } from '../../../morceau/styles/index';
import type { InstrumentBatterie, Morceau, MotifBatterie } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { motifBatterie, motifsBatterie, nomMotif } from '../../edition/batterie';
import { estPadPerso, instrumentsDuMorceau, sonDuPad } from '../../edition/sons';
import { afficherToast, annulerAction, instrumentEdite, modifier, motifEdite, panneau, sectionCourante } from '../../etat';
import { entendre } from '../../lecture';
import { ouvrirBeatbox, ouvrirPanneau } from '../../navigation';
import { IconeDe, IconeMicro, IconePlus, IconeRetour } from '../Icones';
import { PanneauTonSon } from '../sons/PanneauTonSon';
import { Pads } from './Pads';
import { ReglagesBeat } from './ReglagesBeat';
import { VueEnsemble } from './VueEnsemble';

/** Nom affiché d'un instrument : pour un pad perso, le nom de ton son ; le perc d'un kit « vinyle » (boom bap) est un vinyle. */
export function nomInstrument(m: Morceau, i: InstrumentBatterie): string {
  if (i === 'perc' && reglagesKit(m.kit).vinyle) return T.allerVite.vinyle;
  return (estPadPerso(i) && sonDuPad(m, i)?.nom) || T.instruments[i];
}

/** « Une autre idée » : une variation du motif (graine gardée) ; une seule étape d'Annuler. */
function autreIdee(id: string, motif: MotifBatterie) {
  const cle = `bat|${id}`;
  const graine = prochaineGraine(cle);
  if (modifier((x) => poserBatterie(x, id, autreIdeeBatterie(motif, graine)))) {
    noterIdee(cle, motif, graine);
    afficherToast(T.allerVite.ideeBatterie, 4000, { label: T.annuler, agir: annulerAction });
  }
}

/** « Revenir » : reprend l'idée d'avant (une étape d'Annuler de plus). */
function revenir(id: string) {
  const cle = `bat|${id}`;
  const avant = reprendreIdee(cle);
  if (!avant || avant.type !== 'batterie') return;
  if (modifier((x) => poserBatterie(x, id, avant))) afficherToast(T.allerVite.revenu);
  else remettreIdee(cle, avant);
}

export function VueBatterie({ m }: { m: Morceau }) {
  const ids = motifsBatterie(m);
  // Motif édité : celui choisi, sinon celui de la section suivie, sinon le premier.
  const idSection = m.sections.find((s) => s.id === sectionCourante.value)?.motifs.batterie;
  const id = (motifEdite.value && ids.includes(motifEdite.value) ? motifEdite.value : idSection) ?? ids[0];
  const motif = id ? motifBatterie(m, id) : null;
  const instruments = instrumentsDuMorceau(m);
  // Un pad perso vidé (Annuler…) disparaît de la liste : on revient au kick.
  const inst = instruments.includes(instrumentEdite.value) ? instrumentEdite.value : 'kick';
  const noms = Object.fromEntries(instruments.map((i) => [i, nomInstrument(m, i)])) as Record<InstrumentBatterie, string>;

  const choisirMotif = (x: string) => {
    motifEdite.value = x;
    const s = m.ordre.find((sid) => m.sections.find((y) => y.id === sid)?.motifs.batterie === x);
    if (s) sectionCourante.value = s;
  };

  return (
    <>
      {!motif || !id ? (
        <p class="vide">{T.beat.aucunMotif}</p>
      ) : (
        <>
          <div class="segments segments-motif" role="radiogroup" aria-label={T.beat.motif}>
            {ids.map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={x === id}
                class="segment"
                onClick={() => choisirMotif(x)}
                data-testid={`motif-${x}`}
              >
                {nomMotif(m, x)}
              </button>
            ))}
          </div>

          <div class="ensemble-bloc">
            <div class="ensemble-tete">
              <span class="ensemble-titre">
                {T.beat.batterieDe} <strong>{nomMotif(m, id)}</strong>
              </span>
<span class="idees">
                {nombreIdees(`bat|${id}`) > 0 && (
                  <button type="button" class="btn btn-discret btn-petit" title={T.allerVite.revenirAide} onClick={() => revenir(id)} data-testid="revenir-batterie">
                    <IconeRetour taille={18} /> {T.allerVite.revenir}
                  </button>
                )}
                <button type="button" class="btn btn-contour btn-petit" onClick={() => autreIdee(id, motif)} data-testid="varier">
                  <IconeDe taille={18} /> {T.allerVite.autreIdee}
                </button>
              </span>
            </div>
            <VueEnsemble motif={motif} instruments={instruments} noms={noms} choisi={inst} />
          </div>

          <div class="puces puces-defile" role="radiogroup" aria-label={T.beat.instrument}>
            {instruments.map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={i === inst}
                class="puce"
                data-perso={estPadPerso(i) ? '1' : '0'}
                onClick={() => {
                  instrumentEdite.value = i;
                  entendre(i);
                }}
                data-testid={`instrument-${i}`}
              >
                <span class="texte-coupe">{noms[i]}</span>
              </button>
            ))}
            <button
              type="button"
              class="puce puce-ajout"
              aria-haspopup="dialog"
              onClick={() => ouvrirPanneau('ton-son')}
              data-testid="ton-son"
            >
              <IconePlus taille={18} /> {T.tesSons.ajouter}
            </button>
            {/* C2 (D) : la bouche joue la batterie. */}
            <button type="button" class="puce puce-ajout" aria-haspopup="dialog" title={T.beatbox.ouvrirAide} onClick={ouvrirBeatbox} data-testid="beatbox">
              <IconeMicro taille={18} /> {T.beatbox.ouvrir}
            </button>
          </div>

          <Pads idMotif={id} motif={motif} inst={inst} nom={noms[inst]} />
        </>
      )}
      <ReglagesBeat />
      {panneau.value === 'ton-son' && <PanneauTonSon />}
    </>
  );
}
