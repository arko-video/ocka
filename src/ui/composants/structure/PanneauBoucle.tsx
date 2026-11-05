// « Boucle » d'une section (Structure) : choisir un de tes sons (ou en importer un), 1, 2, 4 ou 8 mesures,
// « Caler au tempo ». Avertissement si le calage change la hauteur de plus d'un demi-ton.

import { MESURES_BOUCLE } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { ecartCalage } from '../../../moteur/api';
import { boucleProposee, dureeMesures, reglerBoucle, SEUIL_DEMI_TON, sonParId, type Boucle } from '../../edition/sons';
import { modifier, morceau } from '../../etat';
import { nombre } from '../../format';
import { IconeAlerte } from '../Icones';
import { Panneau } from '../Panneau';
import { ImporterSon } from '../sons/ImporterSon';

export function PanneauBoucle({ idSection }: { idSection: string }) {
  const m = morceau.value;
  const s = m?.sections.find((x) => x.id === idSection);
  if (!m || !s) return null;
  const boucle = s.boucle ?? null;
  const son = sonParId(m, boucle?.son);
  const sons = m.sons ?? [];
  const regler = (b: Boucle | null) => modifier((x) => reglerBoucle(x, idSection, b));
  const cible = boucle ? dureeMesures(m.tempo, boucle.mesures) : 0;
  const ecart = son && boucle ? ecartCalage(son.duree, boucle.mesures, m.tempo) : 0;
  const prevenir = !!boucle?.caler && Math.abs(ecart) > SEUIL_DEMI_TON;

  return (
    <Panneau id="boucle" titre={T.structure.boucleTitre(s.nom)}>
      <p class="aide">{T.structure.boucleAide}</p>

      <div class="reglage">
        <span class="reglage-label" id="label-son-boucle">
          {T.structure.boucleSon}
        </span>
        <div class="puces puces-colonne" role="radiogroup" aria-labelledby="label-son-boucle">
          <button type="button" role="radio" aria-checked={!boucle} class="puce puce-large" onClick={() => regler(null)} data-testid="boucle-aucune">
            <span class="puce-nom">{T.structure.sansBoucle}</span>
          </button>
          {sons.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={boucle?.son === x.id}
              class="puce puce-large"
              onClick={() => regler(boucle ? { ...boucle, son: x.id } : boucleProposee(m, x))}
              data-testid={`boucle-son-${x.id}`}
            >
              <span class="puce-nom texte-coupe">{x.nom}</span>
              <span class="puce-detail chiffres">{T.tesSons.secondes(nombre(x.duree))}</span>
            </button>
          ))}
        </div>
      </div>

      <ImporterSon
        surImport={(x) => {
          const apres = morceau.peek();
          if (apres) modifier((y) => reglerBoucle(y, idSection, boucleProposee(apres, x)));
        }}
      />

      {boucle && son && (
        <>
          <div class="reglage">
            <span class="reglage-label" id="label-mesures-boucle">
              {T.structure.boucleMesures}
            </span>
            <div class="segments" role="radiogroup" aria-labelledby="label-mesures-boucle">
              {MESURES_BOUCLE.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={boucle.mesures === n}
                  class="segment"
                  onClick={() => regler({ ...boucle, mesures: n })}
                  data-testid={`boucle-mesures-${n}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <span class="aide chiffres">{T.structure.durees(nombre(son.duree), nombre(cible))}</span>
          </div>

          <label class="interrupteur">
            <span>
              <span class="reglage-label">{T.structure.caler}</span>
              <span class="aide">{T.structure.calerAide}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={boucle.caler}
              onChange={(e) => regler({ ...boucle, caler: e.currentTarget.checked })}
              data-testid="boucle-caler"
            />
          </label>

          {prevenir && (
            <div class="message message-alerte" role="status" data-testid="avertissement-hauteur">
              <IconeAlerte taille={20} />
              <span>{T.structure.hauteur(nombre(Math.abs(ecart)), ecart < 0 ? 'grave' : 'aigu')}</span>
            </div>
          )}
        </>
      )}
    </Panneau>
  );
}
