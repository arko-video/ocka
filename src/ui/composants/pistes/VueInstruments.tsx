// Vue « Instruments » de l'étape Beat (v2) : la vue Pistes. En haut, la section ; puis une carte par piste instrument
// (nom, instrument, M/S, volume, aperçu des notes de la section ; toucher = piano roll), « Chanter » (C2, D) et
// « + Piste ». En dessous,
// la « Mélodie rapide » des phases 2 à 6 (mode Simple de la piste mélodie : 8 pads, clavier, grille), telle quelle :
// ses data-testid ne changent pas (« vue-melodie » ouvre cette vue).

import { EntreesPistes } from '../EntreesC3';
import { useEffect } from 'preact/hooks';
import { pisteMelodie, pistesInstrument } from '../../../morceau/acces';
import type { Morceau } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { PANNEAUX, panneau } from '../../etat';
import { ouvrirChanter, ouvrirPanneau } from '../../navigation';
import { IconeMicro, IconePlus } from '../Icones';
import { SegmentsSections, sectionAffichee, VueMelodie } from '../melodie/VueMelodie';
import { ouvrirChoix } from './actions';
import { CartePiste } from './CartePiste';
import { chargerCatalogue } from './catalogue';
import './pistes.css';

export function VueInstruments({ m }: { m: Morceau }) {
  useEffect(() => void chargerCatalogue(), []);
  const pistes = pistesInstrument(m);
  const section = sectionAffichee(m);
  // Le piano roll (plein écran) a sa propre mélodie « Simple » : pas deux fois les mêmes data-testid.
  const pianoRoll = panneau.value === PANNEAUX.pianoRoll;
  return (
    <>
      <SegmentsSections m={m} />
      <section class="carte pistes" aria-labelledby="titre-pistes" data-testid="vue-pistes">
        <div class="pistes-tete">
          <h2 id="titre-pistes" class="carte-titre">
            {T.pistes.titre}
            {section && <span class="pistes-section"> · {section.nom}</span>}
          </h2>
          <span class="pistes-actions">
            {pistes.length > 0 && (
              <button
                type="button"
                class="btn btn-contour btn-petit"
                title={T.chanter.ouvrirAide(pistes[0]!.nom)}
                onClick={() => ouvrirChanter((pisteMelodie(m) ?? pistes[0]!).id)}
                data-testid="pistes-chanter"
              >
                <IconeMicro taille={16} /> {T.chanter.ouvrir}
              </button>
            )}
            <button
              type="button"
              class="btn btn-discret btn-petit"
              onClick={() => ouvrirPanneau(PANNEAUX.gererInstruments)}
              data-testid="gerer-instruments"
            >
              {T.banque.gerer}
            </button>
            <EntreesPistes />
          </span>
        </div>
        {pistes.length === 0 ? (
          <p class="aide">{T.pistes.vide}</p>
        ) : (
          <>
            <ul class="pistes-liste">
              {pistes.map((p, i) => (
                <CartePiste
                  key={p.id}
                  m={m}
                  p={p}
                  idSection={section?.id ?? null}
                  premiere={i === 0}
                  derniere={i === pistes.length - 1}
                />
              ))}
            </ul>
            <p class="aide">{T.pistes.aideCarte}</p>
          </>
        )}
        <button
          type="button"
          class="btn btn-contour pistes-ajouter"
          onClick={() => ouvrirChoix(null)}
          data-testid="ajouter-piste"
        >
          <IconePlus taille={20} /> {T.pistes.plusPiste.replace('+ ', '')}
        </button>
      </section>
      {!pianoRoll && (
        <>
          <h2 class="pistes-rapide-titre">{T.pistes.melodieRapide}</h2>
          <VueMelodie m={m} sansSections />
        </>
      )}
    </>
  );
}
