// Nettoyeur (Léger / Moyen / Fort, écouter avant d'appliquer) et doublage auto d'une prise (V). Chacun écrit une
// NOUVELLE prise (« … (nettoyée) », « … (doublée) »), gardée à la place de l'ancienne (une étape d'Annuler).

import { useEffect, useState } from 'preact/hooks';
import { doublerPrise, ecouterReglage, nettoyerPrise } from '../../../moteur/api';
import { positionAncre } from '../../../morceau/temps';
import type { Prise } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { morceau } from '../../etat';
import { lecteurPret, obtenirLecteur, toastErreur } from '../../lecture';
import { agir, DOUBLAGE, INTENSITES, occupe } from './outils';

const N = () => T.voixAvancee.nettoyeur;
type Intensite = keyof typeof INTENSITES;

export function CarteNettoyeur({ prise }: { prise: Prise }) {
  const [intensite, setIntensite] = useState<Intensite>('moyen');
  const [ecoute, setEcoute] = useState(false);
  // On quitte la carte (ou la prise change) : l'écoute s'arrête.
  useEffect(() => () => arreterEcoute(prise.id), [prise.id]);

  function arreterEcoute(id: string) {
    try {
      ecouterReglage(id, null);
    } catch {
      // bouchon
    }
  }

  async function basculerEcoute(i = intensite, actif = !ecoute) {
    try {
      ecouterReglage(prise.id, actif ? { nettoyeur: INTENSITES[i] } : null);
      setEcoute(actif);
      const m = morceau.peek();
      const l = obtenirLecteur();
      if (actif && m && l) {
        await lecteurPret();
        l.aller(positionAncre(m, prise.ancre) ?? 0);
        l.lire();
      }
    } catch (e) {
      toastErreur(e);
    }
  }

  const choisir = (i: Intensite) => {
    setIntensite(i);
    if (ecoute) void basculerEcoute(i, true);
  };

  const appliquer = () => {
    const m = morceau.peek();
    if (!m) return;
    setEcoute(false);
    void agir('nettoyer', () => nettoyerPrise(m, prise.id, INTENSITES[intensite]));
  };
  const doubler = () => {
    const m = morceau.peek();
    if (m) void agir('doubler', () => doublerPrise(m, prise.id, DOUBLAGE));
  };

  return (
    <>
      <section class="carte va-carte" data-testid="va-nettoyeur">
        <h3 class="carte-titre">{N().titre}</h3>
        <p class="aide">{N().aide}</p>
        <div class="segments" role="radiogroup" aria-label={N().titre}>
          {(Object.keys(INTENSITES) as Intensite[]).map((i) => (
            <button key={i} type="button" role="radio" aria-checked={intensite === i} class="segment" onClick={() => choisir(i)} data-testid={`nettoyeur-${i}`}>
              {N().intensites[i]}
            </button>
          ))}
        </div>
        <div class="va-ligne">
          <button type="button" class="btn btn-contour" aria-pressed={ecoute} onClick={() => void basculerEcoute()} data-testid="nettoyeur-ecouter">
            {ecoute ? N().arreterEcoute : N().ecouter}
          </button>
          <button type="button" class="btn btn-principal" disabled={occupe.value !== null} onClick={appliquer} data-testid="nettoyeur-appliquer">
            {occupe.value === 'nettoyer' ? T.voixAvancee.calcul : N().appliquer}
          </button>
        </div>
      </section>
      <section class="carte va-carte" data-testid="va-doublage">
        <h3 class="carte-titre">{T.voixAvancee.doublage.titre}</h3>
        <p class="aide">{T.voixAvancee.doublage.aide}</p>
        <button type="button" class="btn btn-contour" disabled={occupe.value !== null} onClick={doubler} data-testid="doublage-appliquer">
          {occupe.value === 'doubler' ? T.voixAvancee.calcul : T.voixAvancee.doublage.appliquer}
        </button>
      </section>
    </>
  );
}
