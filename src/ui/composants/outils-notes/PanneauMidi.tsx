// MIDI (P) : import et export .mid (toujours), clavier MIDI (Web MIDI : appareils, jeu en direct, enregistrement) en
// mode Avancé (decisions-v2 §6), sur `pisteEditee` (ou la 1re piste instrument). Ouvert par ouvrirMidi (piano roll,
// vue Pistes). L'import est une seule étape d'Annuler ; ses avertissements (tempo borné, pistes en trop…) sont listés.

import { signal } from '@preact/signals';
import { exporterMidi, importerMidi } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { afficherToast, annulerAction, modeAvance, modifier, morceau, PANNEAUX, panneau, reglerAvance } from '../../etat';
import { toastErreur } from '../../lecture';
import { Panneau } from '../Panneau';
import { ClavierMidi } from './ClavierMidi';
import './outils-notes.css';

const TM = T.midi;
/** Taille d'un .mid acceptée par le panneau (le lecteur refuse aussi au-delà). */
const TAILLE_MAX = 4 * 1024 * 1024;
const avertissements = signal<string[]>([]);
const occupe = signal(false);

async function importer(fichier: File | undefined) {
  if (!fichier) return;
  if (fichier.size > TAILLE_MAX) return afficherToast(TM.tropGros);
  const m = morceau.peek();
  if (!m) return;
  occupe.value = true;
  try {
    const r = importerMidi(new Uint8Array(await fichier.arrayBuffer()), m);
    avertissements.value = r.avertissements;
    if (modifier(() => r.m)) afficherToast(TM.importe(r.pistes.length), 6000, { label: T.annuler, agir: annulerAction });
  } catch (e) {
    avertissements.value = [];
    toastErreur(e);
  } finally {
    occupe.value = false;
  }
}

function exporter() {
  const m = morceau.peek();
  if (!m) return;
  try {
    const octets = exporterMidi(m);
    const nom = `${(m.titre || 'ocka').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'ocka'}.mid`;
    const url = URL.createObjectURL(new Blob([octets as BlobPart], { type: 'audio/midi' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    afficherToast(TM.exporte(nom));
  } catch (e) {
    toastErreur(e);
  }
}

export function PanneauMidi() {
  if (panneau.value !== PANNEAUX.midi) return null;
  const m = morceau.value;
  return (
    <Panneau id={PANNEAUX.midi} titre={TM.titre}>
      <div class="on" data-testid="midi">
        <section class="midi-bloc">
          <h3>{TM.fichiers}</h3>
          <p class="aide">{TM.fichiersAide}</p>
          <div class="on-deux">
            <label class={`btn btn-contour${occupe.value ? ' desactive' : ''}`} data-testid="midi-importer">
              {occupe.value ? TM.lecture : TM.importer}
              <input
                type="file"
                class="midi-fichier"
                accept=".mid,.midi,audio/midi,audio/x-midi"
                disabled={occupe.value}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  void importer(f);
                }}
                data-testid="midi-fichier"
              />
            </label>
            <button type="button" class="btn btn-principal" disabled={!m} onClick={exporter} data-testid="midi-exporter">
              {TM.exporter}
            </button>
          </div>
          {avertissements.value.length > 0 && (
            <ul class="midi-avertissements" data-testid="midi-avertissements">
              {avertissements.value.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </section>
        {m && modeAvance.value && <ClavierMidi m={m} />}
        {!modeAvance.value && (
          <div class="on-avance">
            <p class="aide">{TM.clavierAide}</p>
            <button type="button" class="btn btn-contour btn-petit" onClick={() => reglerAvance(true)} data-testid="midi-avance">
              {T.outilsNotes.activerAvance}
            </button>
          </div>
        )}
      </div>
    </Panneau>
  );
}
