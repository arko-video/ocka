// Voix avancée (V) : punch-in avec pré-roll, comping, nettoyeur, doublage, chaînes de voix prêtes, gel d'une piste ;
// `priseEditee` facultative. Ouvert par ouvrirVoixAvancee (Voix). Tout ce panneau est « Avancé » (décisions §6) :
// on y vient par un bouton discret de l'étape Voix.

import { useState } from 'preact/hooks';
import { T } from '../../../textes-fr';
import { morceau, PANNEAUX, panneau, priseEditee, sectionCourante } from '../../etat';
import { Panneau } from '../../composants/Panneau';
import { CarteComping } from './CarteComping';
import { CarteNettoyeur } from './CarteNettoyeur';
import { CartePunch } from './CartePunch';
import { CarteChaines, CarteGel } from './CartesPistes';
import { apparitions, nomPrise } from './outils';
import './voix-avancee.css';

export function PanneauVoixAvancee() {
  const [choixAp, setChoixAp] = useState<string | null>(null);
  const [choixPrise, setChoixPrise] = useState<string | null>(null);
  if (panneau.value !== PANNEAUX.voixAvancee) return null;
  const m = morceau.value;
  if (!m) return null;
  const aps = apparitions(m);
  const cle = (a: (typeof aps)[number]) => `${a.section.id}:${a.occurrence}`;
  const editee = m.prises.find((p) => p.id === priseEditee.value);
  // Apparition : celle choisie, sinon celle de la prise éditée, sinon la section suivie, sinon la 1re avec des prises.
  const ap =
    aps.find((a) => cle(a) === choixAp) ??
    (editee && aps.find((a) => a.section.id === editee.ancre.section && a.occurrence === editee.ancre.occurrence)) ??
    aps.find((a) => a.section.id === sectionCourante.value) ??
    aps[0];
  const prise = ap && (ap.prises.find((p) => p.id === choixPrise) ?? ap.prises.find((p) => p.id === priseEditee.value) ?? ap.prises.find((p) => p.choisie) ?? ap.prises[0]);

  return (
    <Panneau id={PANNEAUX.voixAvancee} titre={T.voixAvancee.titre}>
      <div class="va" data-testid="voix-avancee-panneau">
        <p class="aide" data-testid="voix-avancee-intro">{T.voixAvancee.intro}</p>
        {!ap || !prise ? (
          <p class="aide" data-testid="va-aucune-prise">{T.voixAvancee.aucunePrise}</p>
        ) : (
          <>
            {aps.length > 1 && (
              <div class="reglage">
                <span class="reglage-label" id="va-label-passage">{T.voixAvancee.passage}</span>
                <div class="puces puces-defile" role="radiogroup" aria-labelledby="va-label-passage">
                  {aps.map((a) => (
                    <button key={cle(a)} type="button" role="radio" aria-checked={a === ap} class="puce" onClick={() => (setChoixAp(cle(a)), setChoixPrise(null))} data-testid={`va-apparition-${cle(a)}`}>
                      <span class="puce-nom">{T.voixAvancee.apparition(a.section.nom, a.occurrence)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div class="reglage">
              <span class="reglage-label" id="va-label-prise">{T.voixAvancee.prise}</span>
              <div class="puces puces-defile" role="radiogroup" aria-labelledby="va-label-prise">
                {ap.prises.map((p, k) => (
                  <button key={p.id} type="button" role="radio" aria-checked={p === prise} class="puce" onClick={() => setChoixPrise(p.id)} data-testid={`va-prise-${k}`}>
                    <span class="puce-nom">{nomPrise(ap, p)}</span>
                    {p.choisie && <span class="puce-detail">· {T.voixAvancee.choisie}</span>}
                  </button>
                ))}
              </div>
            </div>
            <CartePunch ap={ap} />
            <CarteComping ap={ap} />
            <CarteNettoyeur prise={prise} />
          </>
        )}
        <CarteChaines />
        <CarteGel m={m} />
      </div>
    </Panneau>
  );
}
