// « Chanter » (Ta voix → instrument, façon Dubler 2) : la roue des 12 notes, le jeu en direct de la piste, le mode
// accords, le glissé, l'enregistrement en notes dans le piano roll. Propriétaire : D.
// Panneau branché par le contrat C2 (PANNEAUX.chanter, `pisteEditee`, ouvrirChanter depuis le piano roll et la vue
// Pistes). Le direct s'arrête (micro coupé) quand le panneau se ferme.

import { useEffect, useState } from 'preact/hooks';
import {
  arreterDirect,
  demarrerDirect,
  mesurerLatenceDetection,
  reglerDirect,
  type LatenceDetection,
} from '../../../moteur/api';
import { pisteMelodie, pistesInstrument } from '../../../morceau/acces';
import { T } from '../../../textes-fr';
import { morceau, PANNEAUX, panneau, pisteEditee } from '../../etat';
import { toastErreur } from '../../lecture';
import { Panneau } from '../Panneau';
import { bluetoothProbable, latenceSortie } from './casque';
import { EnregistrerNotes } from './EnregistrerNotes';
import { reglagesChant, ReglagesChanter, type ReglagesChant } from './ReglagesChanter';
import { RoueNotes, useNoteCourante } from './RoueNotes';
import './dubler.css';

export function PanneauChanter() {
  if (panneau.value !== PANNEAUX.chanter) return null;
  return <ContenuChanter />;
}

function ContenuChanter() {
  const m = morceau.value;
  const pistes = m ? pistesInstrument(m) : [];
  const idPiste = pistes.some((p) => p.id === pisteEditee.value)
    ? pisteEditee.value!
    : ((m && pisteMelodie(m)?.id) ?? null);
  const [onglet, setOnglet] = useState<'direct' | 'enregistrer'>('direct');
  const [enDirect, setEnDirect] = useState(false);
  const [demarre, setDemarre] = useState(false);
  const [latence, setLatence] = useState<LatenceDetection | null>(null);
  const [bluetooth, setBluetooth] = useState(false);
  const note = useNoteCourante(enDirect);
  const r = reglagesChant.value;

  // Panneau fermé : le micro est coupé.
  useEffect(() => () => void arreterDirect().catch(() => undefined), []);
  // Latence de détection du mode choisi (mesurée sur le même détecteur que le worklet).
  useEffect(() => {
    let vivant = true;
    setLatence(null);
    void mesurerLatenceDetection(r.mode)
      .then((l) => vivant && setLatence(l))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [r.mode]);

  if (!m || !idPiste) {
    return (
      <Panneau id={PANNEAUX.chanter} titre={T.chanter.titre} testid="panneau-chanter">
        <p class="vide">{T.chanter.aucunePiste}</p>
      </Panneau>
    );
  }

  function changer(x: Partial<ReglagesChant>) {
    reglagesChant.value = { ...reglagesChant.peek(), ...x };
    if (enDirect) reglerDirect(x);
  }

  function choisirPiste(id: string) {
    pisteEditee.value = id;
    if (enDirect) reglerDirect({ piste: id });
  }

  async function basculer() {
    if (demarre) return;
    if (enDirect) {
      setEnDirect(false);
      await arreterDirect();
      return;
    }
    setDemarre(true);
    try {
      await demarrerDirect(morceau.peek()!, { piste: idPiste!, ...reglagesChant.peek() });
      setEnDirect(true);
      void bluetoothProbable().then(setBluetooth);
    } catch (e) {
      toastErreur(e, T.chanter.erreurs.echec);
    } finally {
      setDemarre(false);
    }
  }

  const sortie = enDirect ? latenceSortie() : 0;
  return (
    <Panneau id={PANNEAUX.chanter} titre={T.chanter.titre} testid="panneau-chanter">
      <div class="dubler" data-testid="chanter-contenu" data-direct={enDirect ? 'oui' : 'non'}>
        <p class="aide">{T.chanter.intro}</p>
        {pistes.length > 1 && (
          <>
            <p class="dubler-etiquette" id="chanter-piste">
              {T.chanter.piste}
            </p>
            <div class="puces puces-defile" role="radiogroup" aria-labelledby="chanter-piste">
              {pistes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  class="puce"
                  aria-checked={p.id === idPiste}
                  onClick={() => choisirPiste(p.id)}
                  data-testid={`chanter-piste-${p.id}`}
                >
                  {p.nom}
                </button>
              ))}
            </div>
          </>
        )}
        {pistes.length <= 1 && <p class="dubler-piste">{pistes[0]?.nom}</p>}

        <RoueNotes tonalite={m.tonalite} note={note} />

        <div class="segments" role="radiogroup" aria-label={T.chanter.titre}>
          {(['direct', 'enregistrer'] as const).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              class="segment"
              aria-checked={onglet === o}
              onClick={() => setOnglet(o)}
              data-testid={`chanter-onglet-${o}`}
            >
              {T.chanter.modes[o]}
            </button>
          ))}
        </div>

        <button
          type="button"
          class={`btn dubler-bouton ${enDirect ? 'btn-contour' : 'btn-principal'}`}
          disabled={demarre}
          aria-pressed={enDirect}
          onClick={() => void basculer()}
          data-testid="chanter-direct"
        >
          {enDirect ? T.chanter.arreter : T.chanter.demarrer}
        </button>
        {enDirect && onglet === 'direct' && (
          <p class="dubler-etat" aria-live="polite">
            {note.midi === null ? T.chanter.ecoute : T.chanter.chante}
          </p>
        )}

        {onglet === 'enregistrer' && (
          <EnregistrerNotes
            piste={r.accords?.piste ?? idPiste}
            enDirect={enDirect}
            textes={{
              poser: T.chanter.poser,
              enregistre: T.chanter.enregistre,
              posees: T.chanter.posees,
              rienEntendu: T.chanter.rienEntendu,
              lancerDabord: T.chanter.lancerDabord,
            }}
          />
        )}

        {bluetooth ? (
          <p class="message message-erreur" role="alert" data-testid="chanter-bluetooth">
            {T.chanter.bluetooth}
          </p>
        ) : (
          <p class="dubler-casque">{T.chanter.hautParleur}</p>
        )}

        <ReglagesChanter tonalite={m.tonalite} changer={changer} />

        <p class="aide dubler-retard" data-testid="chanter-retard">
          {T.chanter.retard}
        </p>
        <p class="aide chiffres" data-testid="chanter-latence">
          {latence ? T.chanter.latence(Math.round(latence.moyenneMs).toString()) : T.chanter.mesure}
          {latence && sortie > 0 ? ` · ${T.chanter.latenceSortie(Math.round(sortie * 1000).toString())}` : ''}
        </p>
      </div>
    </Panneau>
  );
}
