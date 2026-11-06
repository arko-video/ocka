// Confort (R), suite : modèles de pistes (IndexedDB ocka-confort) et repères (Morceau.marqueurs, réglage « Avancé »).

import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
// prettier-ignore
import { ajouterMarqueur, appliquerModele, listerModeles, marqueursPlaces, modifierMarqueur, retirerMarqueur, sauverModele, supprimerModele, type ModelePistes } from '../../moteur/api';
import { occurrenceAuPas, secondesVersPas } from '../../morceau/temps';
import type { PisteInstrument } from '../../morceau/types';
import { T } from '../../textes-fr';
import { afficherToast, modeAvance, modifier, morceau } from '../etat';
import { allerAuTemps, tempsLecture, toastErreur } from '../lecture';

export function BlocModeles() {
  const t = T.confort;
  const modeles = useSignal<ModelePistes[]>([]);
  const recharger = () => listerModeles().then((x) => (modeles.value = x), toastErreur);
  useEffect(() => void recharger(), []);
  const m = morceau.value;
  const pistes = (m?.pistes ?? []).filter((p): p is PisteInstrument => p.genre === 'instrument');

  async function garder(p: PisteInstrument) {
    if (!m) return;
    try {
      await sauverModele(p.nom, { ...m, pistes: [p] });
      afficherToast(t.modeleGarde);
      await recharger();
    } catch (e) {
      toastErreur(e);
    }
  }
  function ajouter(x: ModelePistes) {
    afficherToast(modifier((mm) => appliquerModele(mm, x)) ? t.modeleAjoute : t.tropDePistes);
  }

  return (
    <section class="r-bloc">
      <h3>{t.modeles}</h3>
      <p class="aide">{t.modelesAide}</p>
      {pistes.length === 0 ? (
        <p class="aide">{t.aucunePiste}</p>
      ) : (
        <div class="r-ligne">
          {pistes.map((p) => (
            <button
              type="button"
              class="btn btn-petit btn-contour"
              onClick={() => void garder(p)}
              data-testid={`confort-garder-${p.id}`}
            >
              {t.garderPiste(p.nom)}
            </button>
          ))}
        </div>
      )}
      {modeles.value.length === 0 ? (
        <p class="aide">{t.aucunModele}</p>
      ) : (
        <ul class="r-liste" data-testid="confort-modeles">
          {modeles.value.map((x) => (
            <li>
              <span>{x.nom}</span>
              <button
                type="button"
                class="btn btn-petit btn-contour"
                onClick={() => ajouter(x)}
                data-testid={`confort-modele-ajouter-${x.id}`}
              >
                {t.ajouterModele}
              </button>
              <button
                type="button"
                class="btn btn-petit btn-discret"
                onClick={() => void supprimerModele(x.id).then(recharger)}
              >
                {t.supprimerModele}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BlocMarqueurs() {
  const t = T.confort;
  const m = morceau.value;
  if (!m) return null;
  if (!modeAvance.value) {
    return (
      <section class="r-bloc">
        <h3>{t.marqueurs}</h3>
        <p class="aide">{t.marqueursAvance}</p>
      </section>
    );
  }
  const places = marqueursPlaces(m);
  function poser() {
    const mm = morceau.peek()!;
    const pas = Math.floor(secondesVersPas(mm, tempsLecture.peek()) + 1e-6);
    const o = occurrenceAuPas(mm, pas) ?? occurrenceAuPas(mm, 0);
    if (!o) return;
    const mesure = Math.floor((Math.max(pas, o.debutPas) - o.debutPas) / 16);
    modifier((x) => ajouterMarqueur(x, '', { section: o.section.id, occurrence: o.occurrence, mesure }));
  }
  return (
    <section class="r-bloc">
      <h3>{t.marqueurs}</h3>
      <button type="button" class="btn btn-contour" onClick={poser} data-testid="confort-poser-marqueur">
        {t.poser}
      </button>
      {places.length === 0 ? (
        <p class="aide">{t.aucunMarqueur}</p>
      ) : (
        <ul class="r-liste" data-testid="confort-marqueurs">
          {places.map((x) => (
            <li>
              <input
                class="r-champ"
                value={x.nom}
                maxLength={40}
                aria-label={t.nomMarqueur}
                onInput={(e) =>
                  modifier(
                    (mm) => modifierMarqueur(mm, x.id, { nom: (e.target as HTMLInputElement).value }),
                    `marqueur-${x.id}`,
                  )
                }
              />
              <button
                type="button"
                class="btn btn-petit btn-contour"
                onClick={() => allerAuTemps(x.t)}
                data-testid={`confort-aller-${x.id}`}
              >
                {t.aller}
              </button>
              <button
                type="button"
                class="btn btn-petit btn-discret"
                onClick={() => modifier((mm) => retirerMarqueur(mm, x.id))}
              >
                {t.retirer}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
