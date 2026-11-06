// Clavier MIDI par Web MIDI (USB sur Android et PC) : liste des appareils, jeu en direct (Lecteur.entendreNote, avec
// la vélocité), enregistrement pendant la lecture en boucle de la section (latence de sortie retirée, notes sur la
// grille du 1/24 SANS caler : le panneau quantifie ensuite avec une force). Accès demandé au premier geste ; sans
// Web MIDI (iPhone, Firefox ancien) ou accès refusé : ErreurOcka « midi_indisponible » (message clair). Rien en ligne.

import { sectionDe } from '../morceau/acces';
import { debutOccurrence, dureePas, secondesVersPas } from '../morceau/temps';
import { BORNES_NOTE, type Morceau, type Note } from '../morceau/types';
import type { Lecteur } from '../moteur/api';
import { ErreurOcka } from '../moteur/erreur';
import { TEXTES_OUTILS_NOTES } from '../textes/outils-notes';
import { changerNotes, noteValide } from '../ui/edition/notes-motif';
import type { AppareilMidi, EnregistrementMidi, OptionsMidiDirect } from './api-midi';
import { lireMessage, type EntreeMidi, type MessageMidi } from './messages-midi';

const T = TEXTES_OUTILS_NOTES.midi;

interface AccesMidi {
  inputs: { forEach(f: (e: EntreeMidi) => void): void };
  onstatechange?: ((e: unknown) => void) | null;
}
type Demande = (o?: { sysex?: boolean }) => Promise<AccesMidi>;

let acces: Promise<AccesMidi> | null = null;

/** L'accès Web MIDI (demandé une fois, redemandé après un refus). */
export function obtenirAcces(): Promise<AccesMidi> {
  const nav = (globalThis as { navigator?: { requestMIDIAccess?: Demande } }).navigator;
  if (!nav || typeof nav.requestMIDIAccess !== 'function')
    return Promise.reject(new ErreurOcka(T.indisponible, 'midi_indisponible'));
  acces ??= nav.requestMIDIAccess.call(nav, { sysex: false }).catch(() => {
    acces = null;
    throw new ErreurOcka(T.refuse, 'midi_indisponible');
  });
  return acces;
}

/** Oublie l'accès (tests, ou après un débranchement complet). */
export function oublierAcces() {
  acces = null;
}

function entrees(a: AccesMidi, appareil?: string): EntreeMidi[] {
  const liste: EntreeMidi[] = [];
  a.inputs.forEach((e) => {
    if (!appareil || e.id === appareil) liste.push(e);
  });
  return liste;
}

export async function listerAppareilsMidi(): Promise<AppareilMidi[]> {
  const a = await obtenirAcces();
  return entrees(a).map((e) => ({
    id: String(e.id),
    nom: (e.name ?? '').slice(0, 60) || T.sansNom,
    fabricant: (e.manufacturer ?? '').slice(0, 60),
  }));
}

/** Écoute les messages des entrées choisies (et des claviers branchés ensuite) ; renvoie la fonction qui arrête. */
async function ecouter(o: OptionsMidiDirect, f: (msg: MessageMidi) => void): Promise<() => void> {
  const a = await obtenirAcces();
  const branchees = new Set<EntreeMidi>();
  const surMessage = (e: Event | { data?: Uint8Array; timeStamp?: number }) => {
    const msg = lireMessage(e as { data?: Uint8Array; timeStamp?: number });
    if (msg) f(msg);
  };
  const brancher = () => {
    for (const e of entrees(a, o.appareil)) {
      if (branchees.has(e)) continue;
      branchees.add(e);
      e.addEventListener('midimessage', surMessage);
    }
  };
  brancher();
  const avant = a.onstatechange;
  a.onstatechange = (ev) => {
    brancher();
    if (typeof avant === 'function') avant(ev);
  };
  return () => {
    for (const e of branchees) e.removeEventListener('midimessage', surMessage);
    branchees.clear();
    if (a.onstatechange !== avant) a.onstatechange = avant ?? null;
  };
}

export async function jouerMidiDirect(lecteur: Lecteur, o: OptionsMidiDirect): Promise<() => void> {
  return ecouter(o, (msg) => {
    if (msg.midi < BORNES_NOTE.midiMin || msg.midi > BORNES_NOTE.midiMax) return;
    // Note tenue tant que la touche est enfoncée (relâchée au note-off).
    if (msg.type === 'on') lecteur.entendreNote(o.piste, msg.midi, { vel: Math.max(BORNES_NOTE.velMin, msg.vel / 127), tenue: true });
    else lecteur.relacherNote?.(o.piste, msg.midi);
  });
}

/** Heure du contexte audio d'un message (son timeStamp est en ms de performance.now()). */
function heureContexte(lecteur: Lecteur, ms: number): number | null {
  const ctx = lecteur.ctx;
  if (!ctx || typeof performance === 'undefined') return null;
  const age = Math.max(0, (performance.now() - ms) / 1000);
  return ctx.currentTime - Math.min(age, 1);
}

export async function enregistrerMidi(lecteur: Lecteur, m: Morceau, o: OptionsMidiDirect & { section: string }): Promise<EnregistrementMidi> {
  const section = sectionDe(m, o.section);
  const debutSection = debutOccurrence(m, o.section, 0);
  if (!section || debutSection === null) throw new ErreurOcka(T.sansSection, 'midi_indisponible');
  const piste = m.pistes.find((p) => p.id === o.piste);
  const temps = piste?.genre === 'instrument' && piste.swing !== undefined ? { tempo: m.tempo, swing: piste.swing } : m;
  const d = dureePas(m.tempo);
  const tour = section.mesures * 16 * d;
  const tenues = new Map<number, { t: number; vel: number }>();
  const prises: { t: number; fin: number; midi: number; vel: number }[] = [];
  let compte = 0;
  // Temps (s) depuis le début de la section, latence retirée (le son est entendu latenceSortie plus tard).
  let heureDebut = 0;
  const position = (msg: MessageMidi): number => {
    const h = heureContexte(lecteur, msg.ms);
    if (h !== null && lecteur.heureDe) return h - lecteur.latenceSortie - heureDebut;
    return lecteur.temps - debutSection - lecteur.latenceSortie;
  };
  const arreterEcoute = await ecouter(o, (msg) => {
    const t = position(msg);
    if (msg.type === 'on') {
      if (msg.midi < BORNES_NOTE.midiMin || msg.midi > BORNES_NOTE.midiMax) return;
      compte++;
      const ancienne = tenues.get(msg.midi);
      if (ancienne) prises.push({ t: ancienne.t, fin: t, midi: msg.midi, vel: ancienne.vel });
      tenues.set(msg.midi, { t, vel: msg.vel });
    } else {
      const n = tenues.get(msg.midi);
      if (!n) return;
      tenues.delete(msg.midi);
      prises.push({ t: n.t, fin: t, midi: msg.midi, vel: n.vel });
    }
  });
  lecteur.boucler(o.section);
  lecteur.aller(debutSection);
  lecteur.lire();
  heureDebut = lecteur.heureDe ? lecteur.heureDe(debutSection) : 0;
  return {
    get notes() {
      return compte;
    },
    async arreter() {
      arreterEcoute();
      const fin = lecteur.ctx && lecteur.heureDe ? lecteur.ctx.currentTime - lecteur.latenceSortie - heureDebut : lecteur.temps - debutSection;
      for (const [midi, n] of tenues) prises.push({ t: n.t, fin, midi, vel: n.vel });
      tenues.clear();
      lecteur.pause();
      return changerNotes(m, o.piste, o.section, (motif) => {
        const neuves: Note[] = [];
        for (const p of prises) {
          if (p.t < -d / 2) continue; // avant le début (décompte)
          const dansTour = p.t <= 0 ? 0 : p.t % tour;
          let pas = Math.round(secondesVersPas(temps, dansTour) * 24) / 24;
          if (pas >= section.mesures * 16) pas = 0;
          if (pas >= motif.pas) continue; // hors du motif
          const duree = Math.max(1 / 24, (p.fin - p.t) / d);
          const note = noteValide({ pas, duree, midi: p.midi, vel: Math.max(BORNES_NOTE.velMin, p.vel / 127) }, motif.pas);
          if (note) neuves.push(note);
        }
        return neuves.length ? [...motif.notes, ...neuves] : null;
      });
    },
  };
}
