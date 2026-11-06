// « Beatbox » : on entraîne 4 sons (5 exemples chacun, le 4e est facultatif), puis la bouche joue les pads du kit du
// morceau en direct ; « Enregistrer » pose les frappes dans le motif de batterie de la section. Propriétaire : D.
// Panneau branché par le contrat C2 (PANNEAUX.beatbox, ouvrirBeatbox depuis la vue Batterie).

import { useEffect, useState } from 'preact/hooks';
import {
  arreterBeatbox,
  demarrerBeatbox,
  lireEntrainement,
  type EntrainementBeatbox as Entrainement,
} from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { morceau, PANNEAUX, panneau } from '../../etat';
import { toastErreur } from '../../lecture';
import { Panneau } from '../Panneau';
import { bluetoothProbable } from './casque';
import { EnregistrerNotes } from './EnregistrerNotes';
import { EntrainementBeatbox, entrainementComplet, entrainementVide } from './EntrainementBeatbox';
import './dubler.css';

export function PanneauBeatbox() {
  if (panneau.value !== PANNEAUX.beatbox) return null;
  return <ContenuBeatbox />;
}

function ContenuBeatbox() {
  const [entrainement, setEntrainement] = useState<Entrainement | null>(null);
  const [charge, setCharge] = useState(false);
  const [entrainer, setEntrainer] = useState(false);
  const [onglet, setOnglet] = useState<'direct' | 'enregistrer'>('direct');
  const [joue, setJoue] = useState(false);
  const [demarre, setDemarre] = useState(false);
  const [bluetooth, setBluetooth] = useState(false);

  useEffect(() => {
    let vivant = true;
    void lireEntrainement()
      .catch(() => null)
      .then((e) => {
        if (!vivant) return;
        setEntrainement(e ?? entrainementVide());
        setEntrainer(!entrainementComplet(e));
        setCharge(true);
      });
    return () => {
      vivant = false;
      void arreterBeatbox().catch(() => undefined);
    };
  }, []);

  async function basculer() {
    if (demarre || !entrainement) return;
    if (joue) {
      setJoue(false);
      await arreterBeatbox();
      return;
    }
    setDemarre(true);
    try {
      await demarrerBeatbox(morceau.peek()!, entrainement);
      setJoue(true);
      void bluetoothProbable().then(setBluetooth);
    } catch (e) {
      toastErreur(e, T.chanter.erreurs.echec);
    } finally {
      setDemarre(false);
    }
  }

  async function reentrainer() {
    if (joue) {
      setJoue(false);
      await arreterBeatbox();
    }
    setEntrainer(true);
  }

  const pret = entrainementComplet(entrainement);
  return (
    <Panneau id={PANNEAUX.beatbox} titre={T.beatbox.titre} testid="panneau-beatbox">
      <div class="dubler" data-testid="beatbox-contenu" data-pret={pret ? 'oui' : 'non'}>
        <p class="aide">{T.beatbox.intro}</p>
        {charge && entrainement && (entrainer || !pret) && (
          <>
            <EntrainementBeatbox entrainement={entrainement} changer={setEntrainement} />
            {pret && (
              <button
                type="button"
                class="btn btn-principal dubler-bouton"
                onClick={() => setEntrainer(false)}
                data-testid="beatbox-fini"
              >
                {T.beatbox.pret}
              </button>
            )}
          </>
        )}
        {charge && entrainement && pret && !entrainer && (
          <>
            <p class="dubler-piste">
              {T.beatbox.pret} · {T.beatbox.garde}
            </p>
            <div class="segments" role="radiogroup" aria-label={T.beatbox.titre}>
              {(['direct', 'enregistrer'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  class="segment"
                  aria-checked={onglet === o}
                  onClick={() => setOnglet(o)}
                  data-testid={`beatbox-onglet-${o}`}
                >
                  {T.chanter.modes[o]}
                </button>
              ))}
            </div>
            <button
              type="button"
              class={`btn dubler-bouton ${joue ? 'btn-contour' : 'btn-principal'}`}
              disabled={demarre}
              aria-pressed={joue}
              onClick={() => void basculer()}
              data-testid="beatbox-jouer"
            >
              {joue ? T.beatbox.arreter : T.beatbox.jouer}
            </button>
            {joue && <p class="dubler-etat">{T.beatbox.joue}</p>}
            {onglet === 'enregistrer' && (
              <EnregistrerNotes
                piste="batterie"
                enDirect={joue}
                textes={{
                  poser: T.beatbox.poser,
                  enregistre: T.beatbox.enregistre,
                  posees: T.beatbox.posees,
                  rienEntendu: T.beatbox.rienEntendu,
                  lancerDabord: T.beatbox.lancerDabord,
                }}
              />
            )}
            <button
              type="button"
              class="btn btn-discret btn-petit"
              onClick={() => void reentrainer()}
              data-testid="beatbox-reentrainer"
            >
              {T.beatbox.reentrainer}
            </button>
          </>
        )}
        {bluetooth ? (
          <p class="message message-erreur" role="alert">
            {T.chanter.bluetooth}
          </p>
        ) : (
          <p class="dubler-casque">{T.chanter.casque}</p>
        )}
        <p class="aide dubler-retard">{T.chanter.retard}</p>
      </div>
    </Panneau>
  );
}
