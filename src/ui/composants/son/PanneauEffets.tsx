// « Effets (n) » d'une piste : chaîne d'inserts (ajouter depuis la liste, activer/contourner, réordonner avec les
// flèches, retirer), préréglages, réglages de chaque effet en mode Avancé, et « Pompe » (sidechain) — propriétaire : U2.

import { useState } from 'preact/hooks';
import { pisteDe } from '../../../morceau/acces';
import { presetsInserts } from '../../../moteur/api-effets';
import { ErreurOcka } from '../../../moteur/erreur';
import { PLAFONDS, TYPES_EFFETS, type Insert } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { ajouterInsert, appliquerPresetInserts, deplacerInsert, reglerInsert, reglerSidechain, retirerInsert, SIDECHAIN_DEFAUT } from '../../edition/mixage';
import { afficherToast, annulerAction, modeAvance, modifier, morceau, PANNEAUX, pisteEditee } from '../../etat';
import { toastErreur } from '../../lecture';
import { IconeBas, IconeHaut, IconePoubelle } from '../Icones';
import { Panneau } from '../Panneau';
import { nomPiste } from '../frise/apercu';
import { ParamsInsert } from './ParamsInsert';
import { essayer } from './TrancheCompacte';
import './melangeur.css';

/** Préréglages de M2, ou null tant qu'ils n'existent pas (« pas_encore »). */
function lirePresets(): { nom: string; inserts: Insert[] }[] | null {
  try {
    return presetsInserts();
  } catch (e) {
    if (e instanceof ErreurOcka && e.code === 'pas_encore') return null;
    console.error(e);
    return null;
  }
}

function LigneInsert({ idPiste, x, i, n }: { idPiste: string; x: Insert; i: number; n: number }) {
  const nom = T.effets.noms[x.type];
  return (
    <li class="carte insert" data-actif={x.actif ? '1' : '0'} data-testid={`insert-${x.id}`}>
      <div class="insert-tete">
        <span class="insert-rang chiffres">{i + 1}</span>
        <span class="insert-nom texte-coupe">{nom}</span>
        <button type="button" class="btn-bascule btn-carre" aria-label={`${T.melangeur.monter} ${nom}`} disabled={i === 0} onClick={() => essayer((m) => deplacerInsert(m, idPiste, x.id, -1))} data-testid={`insert-monter-${x.id}`}>
          <IconeHaut />
        </button>
        <button type="button" class="btn-bascule btn-carre" aria-label={`${T.melangeur.descendre} ${nom}`} disabled={i === n - 1} onClick={() => essayer((m) => deplacerInsert(m, idPiste, x.id, 1))} data-testid={`insert-descendre-${x.id}`}>
          <IconeBas />
        </button>
        <button
          type="button"
          class="btn-bascule btn-carre"
          aria-label={`${T.melangeur.retirer} ${nom}`}
          onClick={() => {
            try {
              if (modifier((m) => retirerInsert(m, idPiste, x.id))) afficherToast(`${nom} : ${T.melangeur.retirer.toLowerCase()}`, 4000, { label: T.annuler, agir: annulerAction });
            } catch (e) {
              toastErreur(e);
            }
          }}
          data-testid={`insert-retirer-${x.id}`}
        >
          <IconePoubelle />
        </button>
      </div>
      <label class="interrupteur insert-actif">
        <span class="aide">{T.melangeur.actif}</span>
        <input type="checkbox" role="switch" checked={x.actif} onChange={(e) => essayer((m) => reglerInsert(m, idPiste, x.id, { actif: e.currentTarget.checked }))} data-testid={`insert-actif-${x.id}`} />
      </label>
      {modeAvance.value && <ParamsInsert idPiste={idPiste} x={x} />}
    </li>
  );
}

export function PanneauEffets() {
  const [liste, setListe] = useState(false);
  const m = morceau.value;
  const id = pisteEditee.value;
  const p = m && id ? pisteDe(m, id) : undefined;
  const inserts = p?.inserts ?? [];
  const titre = p ? T.melangeur.effetsDe(nomPiste(p), inserts.length) : T.effets.titre(0);
  const presets = p ? lirePresets() : null;
  const plein = inserts.length >= PLAFONDS.inserts;
  return (
    <Panneau id={PANNEAUX.effetsPiste} titre={titre} testid="panneau-effets">
      {p && (
        <div class="chaine" data-testid="chaine-inserts">
          {inserts.length === 0 && <p class="aide">{T.melangeur.aucunEffet}</p>}
          <ol class="liste-inserts">
            {inserts.map((x, i) => (
              <LigneInsert key={x.id} idPiste={p.id} x={x} i={i} n={inserts.length} />
            ))}
          </ol>
          {inserts.length > 0 && !modeAvance.value && <p class="aide">{T.melangeur.reglagesAvance}</p>}

          <button type="button" class="btn btn-contour" aria-expanded={liste} disabled={plein} onClick={() => setListe(!liste)} data-testid="ajouter-insert">
            {plein ? T.melangeur.plein : `+ ${T.melangeur.ajouter}`}
          </button>
          {liste && !plein && (
            <div class="grille-choix" data-testid="liste-effets">
              {TYPES_EFFETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  class="choix choix-contour"
                  onClick={() => {
                    essayer((x) => ajouterInsert(x, p.id, t));
                    setListe(false);
                  }}
                  data-testid={`ajouter-${t}`}
                >
                  {T.effets.noms[t]}
                </button>
              ))}
            </div>
          )}

          <h3 class="sous-titre">{T.melangeur.prereglages}</h3>
          {presets === null ? (
            <p class="aide">{T.melangeur.prereglagesBientot}</p>
          ) : (
            <div class="puces puces-defile" data-testid="presets-inserts">
              {presets.map((pr) => (
                <button
                  key={pr.nom}
                  type="button"
                  class="puce"
                  onClick={() => {
                    try {
                      if (modifier((x) => appliquerPresetInserts(x, p.id, pr.inserts))) afficherToast(T.melangeur.prereglageApplique(pr.nom), 4000, { label: T.annuler, agir: annulerAction });
                    } catch (e) {
                      toastErreur(e);
                    }
                  }}
                >
                  {pr.nom}
                </button>
              ))}
            </div>
          )}

          {p.id !== 'batterie' && (
            <>
              <h3 class="sous-titre">{T.effets.pompe}</h3>
              <label class="interrupteur">
                <span class="aide">{T.effets.pompeAide}</span>
                <input type="checkbox" role="switch" checked={!!p.sidechain} onChange={(e) => essayer((x) => reglerSidechain(x, p.id, e.currentTarget.checked ? SIDECHAIN_DEFAUT : null))} data-testid="panneau-pompe" />
              </label>
              {p.sidechain && (
                <>
                  <label class="tranche-ligne">
                    <span class="tranche-label tranche-label-large">{T.melangeur.pompeForce}</span>
                    <input type="range" class="curseur" min={0} max={1} step={0.01} value={p.sidechain.force} onInput={(e) => essayer((x) => reglerSidechain(x, p.id, { ...p.sidechain!, force: e.currentTarget.valueAsNumber }), `pompe:${p.id}`)} />
                    <span class="tranche-valeur chiffres">{Math.round(p.sidechain.force * 100)}</span>
                  </label>
                  {modeAvance.value && (
                    <label class="tranche-ligne">
                      <span class="tranche-label tranche-label-large">{T.melangeur.pompeRelache}</span>
                      <input type="range" class="curseur" min={0.02} max={0.6} step={0.01} value={p.sidechain.relache} onInput={(e) => essayer((x) => reglerSidechain(x, p.id, { ...p.sidechain!, relache: e.currentTarget.valueAsNumber }), `pompe-r:${p.id}`)} />
                      <span class="tranche-valeur chiffres">{Math.round(p.sidechain.relache * 1000)}</span>
                    </label>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </Panneau>
  );
}
