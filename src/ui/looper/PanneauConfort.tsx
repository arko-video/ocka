// Confort (R) : tap tempo, son du métronome, historique d'Annuler, modèles de pistes, marqueurs, raccourcis clavier.
// Ouvert par ouvrirConfort (en-tête du studio) ; « ? » au clavier l'ouvre aussi.

import { signal, useSignal } from '@preact/signals';
import {
  etapesHistorique,
  metronomeChoisi,
  reglerMetronome,
  reglerVolumeMetronome,
  SONS_METRONOME,
  tapTempo,
  volumeMetronome,
  type SonMetronome,
} from '../../moteur/api';
import { T } from '../../textes-fr';
import { annulerAction, historique, modifier, morceau, PANNEAUX, panneau, retablirAction } from '../etat';
import { reglerTempo } from '../edition/reglages';
import { metronomeActif } from '../lecture';
import { Panneau } from '../composants/Panneau';
import { BlocMarqueurs, BlocModeles } from './ConfortListes';
import './looper.css';

/** Frappes du tap tempo (ms) : partagées avec la touche T du clavier. */
export const frappesTap = signal<number[]>([]);
export function taper() {
  frappesTap.value = [...frappesTap.peek(), performance.now()].slice(-8);
}

function BlocTap() {
  const t = T.confort;
  const bpm = tapTempo(frappesTap.value);
  return (
    <section class="r-bloc">
      <h3>{t.tap}</h3>
      <button type="button" class="btn btn-contour r-tap" onPointerDown={taper} data-testid="confort-tap">
        {bpm ? t.tapResultat(bpm) : t.tapAide}
      </button>
      {bpm && bpm !== morceau.value?.tempo && (
        <button
          type="button"
          class="btn btn-principal"
          onClick={() => (modifier((m) => reglerTempo(m, bpm)), (frappesTap.value = []))}
          data-testid="confort-tap-appliquer"
        >
          {t.tapAppliquer(bpm)}
        </button>
      )}
    </section>
  );
}

function BlocMetronome() {
  const t = T.confort;
  const son = useSignal<SonMetronome>(metronomeChoisi());
  const volume = useSignal(volumeMetronome());
  return (
    <section class="r-bloc">
      <h3>{t.metronome}</h3>
      <div class="r-ligne" role="radiogroup" aria-label={t.metronome}>
        {SONS_METRONOME.map((s) => (
          <button
            type="button"
            class="puce"
            role="radio"
            aria-checked={son.value === s}
            onClick={() => ((son.value = s), void reglerMetronome(s), (metronomeActif.value = true))}
            data-testid={`confort-metronome-${s}`}
          >
            {t.sons[s]}
          </button>
        ))}
      </div>
      <label class="r-mesure">
        {t.volume}
        <input
          class="r-volume"
          type="range"
          min={0}
          max={100}
          value={Math.round(volume.value * 100)}
          onInput={(e) => (
            (volume.value = Number((e.target as HTMLInputElement).value) / 100),
            void reglerVolumeMetronome(volume.peek())
          )}
          data-testid="confort-volume"
        />
      </label>
    </section>
  );
}

function BlocHistorique() {
  const t = T.confort;
  const h = historique.value;
  if (!h) return null;
  const etapes = etapesHistorique(h.passe, h.present, h.futur).reverse();
  const aller = (position: number) => {
    for (let i = 0; i < -position; i++) annulerAction();
    for (let i = 0; i < position; i++) retablirAction();
  };
  return (
    <section class="r-bloc">
      <h3>{t.historique}</h3>
      <p class="aide">{t.historiqueAide}</p>
      <ul class="r-liste r-historique" data-testid="confort-historique">
        {etapes.map((e) => (
          <li data-position={e.position} data-futur={e.position > 0 ? '1' : '0'}>
            <button
              type="button"
              class="r-etape"
              onClick={() => aller(e.position)}
              aria-current={e.position === 0 ? 'step' : undefined}
              data-testid={`confort-etape-${e.position}`}
            >
              {e.libelle}
              {e.position === 0 ? ` · ${t.present}` : ''}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Demande d'ouvrir le panneau sur la liste des raccourcis (« ? »). */
export const voirRaccourcis = signal(false);

function BlocRaccourcis() {
  const t = T.confort;
  return (
    <section
      class="r-bloc"
      id="confort-raccourcis"
      data-testid="confort-raccourcis"
      ref={(el) => {
        if (el && voirRaccourcis.peek())
          ((voirRaccourcis.value = false), el.scrollIntoView({ block: 'start' }));
      }}
    >
      <h3>{t.raccourcis}</h3>
      <dl class="r-touches">
        {t.listeRaccourcis.map(([k, v]) => (
          <>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </>
        ))}
      </dl>
    </section>
  );
}

export function PanneauConfort() {
  if (panneau.value !== PANNEAUX.confort) return null;
  return (
    <Panneau id={PANNEAUX.confort} titre={T.confort.titre}>
      <p class="aide" data-testid="confort-intro">
        {T.confort.intro}
      </p>
      <BlocTap />
      <BlocMetronome />
      <BlocHistorique />
      <BlocModeles />
      <BlocMarqueurs />
      <BlocRaccourcis />
    </Panneau>
  );
}
