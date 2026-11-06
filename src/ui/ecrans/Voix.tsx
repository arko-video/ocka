// Étape 3 — Voix : calibrage, choix de la section, gros bouton rouge, prises (écouter, garder, supprimer),
// carte « Autotune » de la prise gardée (préréglages, gamme, Avant / Après, Corriger tout seul, IA ; C2, A2), son de la
// voix et effets (Réverbe, Écho, Radio, Doubler). En « Avancé » : « Notes » ouvre l'éditeur de notes de la prise.

import { EntreesVoix } from '../composants/EntreesC3';
import { useEffect, useState } from 'preact/hooks';
import { pisteVoix } from '../../morceau/acces';
import type { PisteFixe } from '../../morceau/types';
import { T } from '../../textes-fr';
import { prisesDe, reglerPiste } from '../edition/reglages';
import { dureeSection, occurrence } from '../edition/sections';
import { modeAvance, modifier, morceau, sectionCourante } from '../etat';
import { ouvrirEditeurAutotune } from '../navigation';
import { mmss } from '../format';
import {
  avertissementsMicro,
  basculerEcoute,
  conseilBluetooth,
  calibrage,
  calibrer,
  ecouteEnCours,
  enregistrer,
  erreurVoix,
  garder,
  latence,
  reglageFin,
  reglerFin,
  supprimer,
  suivreAppareil,
} from '../voix';
import { IconeAlerte, IconeLecture, IconeMicro, IconePoubelle, IconeStop } from '../composants/Icones';
import { CarteAutotune } from '../composants/voix/CarteAutotune';
import { EffetsVoix } from '../composants/voix/EffetsVoix';
import { Enregistrement } from '../composants/voix/Enregistrement';

const PRESETS: NonNullable<PisteFixe['preset']>[] = ['naturel', 'rap', 'chant'];

export function Voix() {
  const m = morceau.value;
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => suivreAppareil(), []);
  if (!m) return null;
  // Position choisie : celle demandée, sinon la 1re apparition de la section suivie, sinon la 2e position.
  const parDefaut = Math.max(0, m.ordre.indexOf(sectionCourante.value ?? ''));
  const i = index !== null && index < m.ordre.length ? index : parDefaut;
  const idSection = m.ordre[i]!;
  const section = m.sections.find((s) => s.id === idSection)!;
  const occ = occurrence(m.ordre, i);
  const prises = prisesDe(m, idSection, occ);
  const kChoisie = prises.findIndex((p) => p.choisie);
  const voix = pisteVoix(m);
  const lat = latence.value;
  const cal = calibrage.value;
  const err = erreurVoix.value;

  return (
    <div class="etape-voix">
      {err && (
        <div class="message message-erreur" role="alert" data-testid="erreur-voix" data-code={err.code}>
          <IconeAlerte taille={20} />
          <span>{err.message}</span>
        </div>
      )}

      {conseilBluetooth.value && (
        <div class="message message-alerte" role="status" data-testid="conseil-bluetooth">
          <IconeAlerte taille={20} />
          <span>{T.voix.conseilBluetooth}</span>
        </div>
      )}
      {avertissementsMicro.value.map((a) => (
        <div key={a} class="message message-alerte" role="status" data-testid="avertissement-micro">
          <IconeAlerte taille={20} />
          <span>{a}</span>
        </div>
      ))}

      <div class="reglage">
        <span class="reglage-label" id="label-section-voix">
          {T.voix.section}
        </span>
        <div class="puces puces-defile" role="radiogroup" aria-labelledby="label-section-voix">
          {m.ordre.map((id, k) => {
            const s = m.sections.find((x) => x.id === id);
            if (!s) return null;
            const repetee = m.ordre.filter((x) => x === id).length > 1;
            const n = prisesDe(m, id, occurrence(m.ordre, k)).length;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={k === i}
                class="puce"
                onClick={() => {
                  setIndex(k);
                  sectionCourante.value = id;
                }}
                data-testid={`voix-section-${k}`}
              >
                {s.nom}
                {repetee && <span class="puce-detail">· {T.structure.foisCourt(occurrence(m.ordre, k))}</span>}
                {n > 0 && <span class="puce-compte" aria-label={`${n} prise(s)`}>{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div class="zone-rec">
        <button
          type="button"
          class="btn-rec"
          aria-label={`${T.voix.enregistrer} : ${section.nom}`}
          onClick={() => void enregistrer({ section: idSection, occurrence: occ })}
          data-testid="enregistrer"
        >
          <IconeMicro taille={40} />
        </button>
        <span class="zone-rec-texte">
          {T.voix.enregistrer} · {section.nom} <span class="chiffres doux">({mmss(dureeSection(m, section))})</span>
        </span>
      </div>
      <EntreesVoix />

      <section class="carte" aria-labelledby="titre-prises">
        <h2 id="titre-prises" class="carte-titre">
          {T.voix.prises}
        </h2>
        {prises.length === 0 ? (
          <p class="aide">{T.voix.aucunePrise}</p>
        ) : (
          <ul class="liste-prises" data-testid="liste-prises">
            {prises.map((p, k) => {
              const ecoute = ecouteEnCours.value === p.id;
              return (
                <li key={p.id} class="prise" data-choisie={p.choisie ? '1' : '0'} data-testid="prise">
                  <button
                    type="button"
                    class="btn-icone encadre"
                    aria-label={`${ecoute ? T.voix.stop : T.voix.ecouter} ${T.voix.prise(k + 1)}`}
                    onClick={() => void basculerEcoute(p)}
                  >
                    {ecoute ? <IconeStop taille={18} /> : <IconeLecture taille={18} />}
                  </button>
                  <span class="prise-textes">
                    <span class="prise-nom">{p.nom ?? T.voix.prise(k + 1)}</span>
                    <span class="aide chiffres">{mmss(p.finCoupe - p.debutCoupe)}</span>
                  </span>
                  <button
                    type="button"
                    class="btn btn-petit"
                    aria-pressed={p.choisie}
                    data-actif={p.choisie ? '1' : '0'}
                    onClick={() => garder(p)}
                    data-testid="garder-prise"
                  >
                    {p.choisie ? T.voix.gardee : T.voix.garder}
                  </button>
                  {modeAvance.value && (
                    <button
                      type="button"
                      class="btn btn-petit btn-discret"
                      aria-label={T.autotuneAvance.editerAide(p.nom ?? T.voix.prise(k + 1))}
                      onClick={() => ouvrirEditeurAutotune(p.id)}
                      data-testid="editer-notes-prise"
                    >
                      {T.autotuneAvance.editer}
                    </button>
                  )}
                  <button type="button" class="btn-icone" aria-label={`${T.voix.supprimer} ${T.voix.prise(k + 1)}`} onClick={() => supprimer(p)}>
                    <IconePoubelle taille={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {kChoisie >= 0 && <CarteAutotune m={m} prise={prises[kChoisie]!} nom={prises[kChoisie]!.nom ?? T.voix.prise(kChoisie + 1)} />}

      <section class="carte" aria-labelledby="titre-preset-voix">
        <h2 id="titre-preset-voix" class="carte-titre">
          {T.voix.preset}
        </h2>
        <div class="segments" role="radiogroup" aria-labelledby="titre-preset-voix">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={(voix?.preset ?? 'naturel') === p}
              class="segment"
              onClick={() => modifier((x) => reglerPiste(x, 'voix', { preset: p }))}
              data-testid={`preset-voix-${p}`}
            >
              {T.voix.presets[p]}
            </button>
          ))}
        </div>
      </section>

      <EffetsVoix m={m} />

      <section class="carte" aria-labelledby="titre-latence">
        <h2 id="titre-latence" class="carte-titre">
          {T.voix.latence}
        </h2>
        <p class="aide">{T.voix.aideCalibrage}</p>
        <div class="ligne-calibrage">
          <span data-testid="latence">{lat === null ? T.voix.jamaisCalibre : T.voix.latenceMesuree(Math.round(lat * 1000))}</span>
          <button type="button" class="btn btn-contour btn-petit" disabled={cal !== null} onClick={() => void calibrer()} data-testid="calibrer">
            {cal !== null ? `${T.voix.calibrage} ${Math.round(cal * 100)} %` : T.voix.calibrer}
          </button>
        </div>
        <div class="reglage">
          <div class="reglage-tete">
            <label for="reglage-fin">{T.voix.reglageFin}</label>
            <span class="reglage-valeur chiffres">
              {reglageFin.value > 0 ? '+' : ''}
              {reglageFin.value} ms
            </span>
          </div>
          <input
            id="reglage-fin"
            type="range"
            class="curseur"
            min={-100}
            max={100}
            step={1}
            value={reglageFin.value}
            aria-valuetext={`${reglageFin.value} ms`}
            aria-describedby="aide-reglage-fin"
            onInput={(e) => reglerFin(e.currentTarget.valueAsNumber)}
            data-testid="reglage-latence"
          />
          <p id="aide-reglage-fin" class="aide">
            {T.voix.reglageAide}
          </p>
        </div>
      </section>

      <Enregistrement section={section} duree={dureeSection(m, section)} />
    </div>
  );
}
