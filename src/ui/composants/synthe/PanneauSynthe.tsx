// Synthé de `pisteEditee` (L) : préréglages, paramètres de la DefinitionSynthe (curseurs au pouce de 0 à 1, puces
// pour les crans), onde dessinée au doigt, et en « Avancé » un lien vers les LFO (C1). Chaque geste = une étape
// d'Annuler (modifier avec une clé) ; le doigt levé fait entendre une note. Ouvert par ouvrirSynthe (piano roll).

import {
  definitionSynthe,
  dessinerOnde,
  reglagesLus,
  reglerParamSynthe,
  type DefinitionSynthe,
} from '../../../moteur/api';
import type { PisteInstrument } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { afficherToast, modeAvance, modifier, morceau, PANNEAUX, panneau, pisteEditee } from '../../etat';
import { entendreNote, toastErreur } from '../../lecture';
import { ouvrirPanneau } from '../../navigation';
import { PANNEAUX_FRISE, pisteAutomation } from '../frise/etat-frise';
import { Panneau } from '../Panneau';
import { Crans, Curseur } from './Curseur';
import { DessinOnde } from './DessinOnde';
import { PREREGLAGES } from './prereglages';
import './synthe.css';

/** Note d'écoute : grave pour les basses, sinon le do central. */
const noteEcoute = (def: DefinitionSynthe) => (def.id === '303' || def.id === 'logdrum' ? 36 : 60);

function essayer(op: Parameters<typeof modifier>[0], cle?: string) {
  try {
    modifier(op, cle);
  } catch (e) {
    toastErreur(e);
  }
}

function Reglages({ p, def }: { p: PisteInstrument; def: DefinitionSynthe }) {
  const lus = reglagesLus(def, p.synthe);
  const ecouter = () => entendreNote(p.id, noteEcoute(def));
  const presets = Object.entries(PREREGLAGES[def.id] ?? {});
  const actif = (vals: Record<string, number>) =>
    Object.entries(vals).every(([k, v]) => Math.abs((lus.params[k] ?? -1) - v) < 0.002);
  return (
    <>
      <div class="synthe-tete">
        <span class="reglage-label">{def.nom}</span>
        <button
          type="button"
          class="btn btn-petit btn-contour"
          onClick={ecouter}
          data-testid="synthe-ecouter"
        >
          {T.synthe.ecouter}
        </button>
      </div>

      {presets.length > 0 && (
        <div class="reglage">
          <span class="reglage-label" id="label-synthe-presets">
            {T.synthe.prereglages}
          </span>
          <div class="puces" role="radiogroup" aria-labelledby="label-synthe-presets">
            {presets.map(([cle, vals]) => (
              <button
                key={cle}
                type="button"
                role="radio"
                class="puce"
                aria-checked={actif(vals)}
                onClick={() => {
                  essayer((m) =>
                    Object.entries(vals).reduce((x, [k, v]) => reglerParamSynthe(x, p.id, k, v), m),
                  );
                  afficherToast(T.synthe.nomPreregle(T.synthe.presets[cle] ?? cle));
                  ecouter();
                }}
                data-testid={`synthe-preset-${cle}`}
              >
                {T.synthe.presets[cle] ?? cle}
              </button>
            ))}
          </div>
        </div>
      )}

      {def.points && lus.onde && (
        <div class="reglage">
          <span class="reglage-label">{T.synthe.onde}</span>
          <p class="aide">{T.synthe.ondeAide}</p>
          <DessinOnde
            onde={lus.onde}
            dessiner={(o) => essayer((m) => dessinerOnde(m, p.id, o), `onde:${p.id}`)}
            surFin={ecouter}
          />
        </div>
      )}

      {Object.keys(def.params).length > 0 && (
        <div class="reglage">
          <span class="reglage-label">{T.synthe.reglages}</span>
          {Object.entries(def.params).map(([cle, prm]) => {
            const nom = T.synthe.params[cle] ?? cle;
            const v = lus.params[cle] ?? prm.defaut;
            const regler = (x: number) =>
              essayer((m) => reglerParamSynthe(m, p.id, cle, x), `synthe:${p.id}:${cle}`);
            if (prm.crans && prm.crans > 1)
              return (
                <Crans
                  key={cle}
                  nom={nom}
                  valeur={v}
                  n={prm.crans}
                  etiquettes={T.synthe.crans[cle]}
                  regler={(x) => (regler(x), ecouter())}
                  testid={`synthe-${cle}`}
                />
              );
            return (
              <Curseur
                key={cle}
                nom={nom}
                position={v}
                affichage={String(Math.round(v * 100))}
                regler={regler}
                surFin={ecouter}
                testid={`synthe-${cle}`}
              />
            );
          })}
        </div>
      )}

      {modeAvance.value && (
        <button
          type="button"
          class="btn btn-petit btn-discret"
          onClick={() => {
            pisteAutomation.value = p.id;
            ouvrirPanneau(PANNEAUX_FRISE.automation);
          }}
          data-testid="synthe-lfo"
        >
          {T.synthe.lfo}
        </button>
      )}
    </>
  );
}

export function PanneauSynthe() {
  if (panneau.value !== PANNEAUX.synthe) return null;
  const p = morceau.value?.pistes.find((x) => x.id === pisteEditee.value);
  const def = p?.genre === 'instrument' ? definitionSynthe(p.instrument) : null;
  const vide =
    !p || p.genre !== 'instrument' || !def || (Object.keys(def.params).length === 0 && !def.points);
  return (
    <Panneau id={PANNEAUX.synthe} titre={T.synthe.titre} testid="panneau-synthe">
      {vide ? (
        <p class="aide" data-testid="synthe-sans-reglages">
          {T.synthe.pasDeReglage}
        </p>
      ) : (
        <Reglages p={p} def={def} />
      )}
    </Panneau>
  );
}
