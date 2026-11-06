// Clavier MIDI (P, mode Avancé) : chercher les claviers (Web MIDI, USB), choisir la piste jouée, jouer en direct
// (entendreNote avec la vélocité) et enregistrer pendant que la section tourne en boucle (latence retirée), avec ou
// sans calage à la double-croche. Sans Web MIDI : un message clair, jamais de plantage. Le jeu en direct reste actif
// quand on ferme le panneau (on joue alors dans le piano roll) jusqu'à « Jouer en direct » décoché.

import { signal } from '@preact/signals';
import { motifNotesDe, pistesInstrument } from '../../../morceau/acces';
import type { Morceau } from '../../../morceau/types';
import { enregistrerMidi, jouerMidiDirect, listerAppareilsMidi, type AppareilMidi, type EnregistrementMidi } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { quantifier } from '../../edition/api-outils-notes';
import { afficherToast, annulerAction, modifier, morceau, pisteEditee } from '../../etat';
import { obtenirLecteur } from '../../lecture';
import { sectionAffichee, sectionsUniques } from '../melodie/VueMelodie';

const TM = T.midi;
const appareils = signal<AppareilMidi[] | null>(null);
const erreur = signal<string | null>(null);
const appareil = signal('');
const pisteJouee = signal<string | null>(null);
const enDirect = signal<{ piste: string; arreter: () => void } | null>(null);
const enregistrement = signal<{ rec: EnregistrementMidi; section: string; piste: string } | null>(null);
const notesRec = signal(0);
const calage = signal(true);
const sectionRec = signal<string | null>(null);

const message = (e: unknown) => (e instanceof Error && e.message ? e.message : TM.indisponible);

async function chercher() {
  try {
    erreur.value = null;
    appareils.value = await listerAppareilsMidi();
  } catch (e) {
    appareils.value = null;
    erreur.value = message(e);
  }
}

async function demarrerDirect(piste: string): Promise<boolean> {
  enDirect.peek()?.arreter();
  enDirect.value = null;
  const l = obtenirLecteur();
  if (!l) return false;
  try {
    const arreter = await jouerMidiDirect(l, { piste, ...(appareil.peek() ? { appareil: appareil.peek() } : {}) });
    enDirect.value = { piste, arreter };
    return true;
  } catch (e) {
    erreur.value = message(e);
    return false;
  }
}

function arreterDirect() {
  enDirect.peek()?.arreter();
  enDirect.value = null;
}

let minuteur: ReturnType<typeof setInterval> | undefined;

async function enregistrer(m: Morceau, piste: string, section: string) {
  const l = obtenirLecteur();
  if (!l) return;
  if (enDirect.peek()?.piste !== piste && !(await demarrerDirect(piste))) return;
  try {
    await l.charger(m);
    const rec = await enregistrerMidi(l, m, { piste, section, ...(appareil.peek() ? { appareil: appareil.peek() } : {}) });
    enregistrement.value = { rec, section, piste };
    notesRec.value = 0;
    minuteur = setInterval(() => (notesRec.value = rec.notes), 200);
  } catch (e) {
    erreur.value = message(e);
  }
}

async function arreterEnregistrement() {
  const e = enregistrement.peek();
  if (!e) return;
  clearInterval(minuteur);
  enregistrement.value = null;
  const avant = morceau.peek();
  const avantNotes = new Set((avant ? motifNotesDe(avant, e.section, e.piste)?.notes ?? [] : []).map((n) => `${n.pas}|${n.midi}`));
  const brut = await e.rec.arreter();
  const notes = motifNotesDe(brut, e.section, e.piste)?.notes ?? [];
  const neuves = notes.flatMap((n, i) => (avantNotes.has(`${n.pas}|${n.midi}`) ? [] : [i]));
  if (neuves.length === 0) return afficherToast(TM.rienJoue);
  const final = calage.peek() ? quantifier(brut, e.piste, e.section, neuves, 1, 1) : brut;
  if (modifier(() => final)) afficherToast(TM.enregistre(neuves.length), 5000, { label: T.annuler, agir: annulerAction });
}

export function ClavierMidi({ m }: { m: Morceau }) {
  const pistes = pistesInstrument(m);
  const choisie = pistes.find((p) => p.id === (pisteJouee.value ?? pisteEditee.value)) ?? pistes[0];
  const sections = sectionsUniques(m);
  const section = sections.find((s) => s.id === sectionRec.value) ?? sectionAffichee(m);
  const rec = enregistrement.value;
  const direct = enDirect.value;
  return (
    <section class="midi-bloc" data-testid="midi-clavier">
      <h3>{TM.clavier}</h3>
      <p class="aide">{TM.clavierAide}</p>
      <button type="button" class="btn btn-contour" onClick={() => void chercher()} data-testid="midi-chercher">
        {TM.chercher}
      </button>
      {erreur.value && (
        <p class="aide" role="alert" data-testid="midi-erreur">
          {erreur.value}
        </p>
      )}
      {appareils.value && appareils.value.length === 0 && <p class="aide">{TM.aucunClavier}</p>}
      {appareils.value && appareils.value.length > 0 && (
        <div class="puces puces-defile" role="radiogroup" aria-label={TM.clavier} data-testid="midi-appareils">
          {[{ id: '', nom: TM.tous, fabricant: '' }, ...appareils.value].map((a) => (
            <button key={a.id} type="button" role="radio" class="puce" aria-checked={appareil.value === a.id} onClick={() => ((appareil.value = a.id), direct && void demarrerDirect(direct.piste))} data-testid={`midi-appareil-${a.id || 'tous'}`}>
              {a.nom}
            </button>
          ))}
        </div>
      )}
      {!choisie ? (
        <p class="aide">{TM.aucunePiste}</p>
      ) : (
        appareils.value && appareils.value.length > 0 && (
          <>
            <label class="curseur-ligne">
              <span class="curseur-label">{TM.piste}</span>
              <select class="champ-texte midi-select" value={choisie.id} onChange={(e) => ((pisteJouee.value = e.currentTarget.value), direct && void demarrerDirect(e.currentTarget.value))} data-testid="midi-piste">
                {pistes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
            <label class="on-case">
              <input type="checkbox" role="switch" checked={!!direct} onChange={(e) => (e.currentTarget.checked ? void demarrerDirect(choisie.id) : arreterDirect())} data-testid="midi-direct" />
              <span>{TM.jouer}</span>
            </label>
            {direct && (
              <p class="midi-etat" data-actif="1" data-testid="midi-direct-etat">
                {TM.jeuActif}
              </p>
            )}
            <label class="curseur-ligne">
              <span class="curseur-label">{TM.section_}</span>
              <select class="champ-texte midi-select" value={section?.id} disabled={!!rec} onChange={(e) => (sectionRec.value = e.currentTarget.value)} data-testid="midi-section">
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
              </select>
            </label>
            <label class="on-case">
              <input type="checkbox" role="switch" checked={calage.value} onChange={(e) => (calage.value = e.currentTarget.checked)} data-testid="midi-caler" />
              <span>{TM.caler}</span>
            </label>
            <button type="button" class="btn btn-contour midi-rec on-appliquer" data-actif={rec ? '1' : '0'} disabled={!section} onClick={() => (rec ? void arreterEnregistrement() : section && void enregistrer(m, choisie.id, section.id))} data-testid="midi-enregistrer">
              {rec ? `■ ${TM.arreter} · ${TM.enCours(notesRec.value)}` : `● ${TM.enregistrer}`}
            </button>
          </>
        )
      )}
    </section>
  );
}
