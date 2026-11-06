// « Chanter » en direct : le micro passe dans le worklet, qui pilote la voix d'instrument de la piste (gain,
// hauteur). Ici : la séance (une seule à la fois), les réglages envoyés au worklet, la note courante pour la roue,
// et l'écoute des notes pour l'enregistrement.

import { contexteAudio } from '../enregistrement/contexte';
import { pisteDe } from '../morceau/acces';
import type { Morceau, PisteInstrument } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import { TEXTES_DUBLER } from '../textes/dubler';
import type { NoteCourante, ReglagesDirect } from './api-dubler';
import { classesGamme } from './calage';
import { ouvrirChaine, type Chaine } from './chaine';
import type { EvenementNote, ReglagesDetecteur } from './detecteur';
import { creerInstrumentDirect, type InstrumentDirect } from './instrument-direct';

const SILENCE: NoteCourante = Object.freeze({
  midi: null,
  cents: Number.NaN,
  ecart: 0,
  niveau: 0,
  jouees: [],
}) as NoteCourante;
const E = TEXTES_DUBLER.chanter.erreurs;

interface Seance {
  m: Morceau;
  reglages: ReglagesDirect;
  chaine: Chaine;
  instrument: InstrumentDirect;
  tirage: GainNode;
  etat: NoteCourante;
  ecouteurs: Set<(e: EvenementNote) => void>;
  version: number;
}

let seance: Seance | null = null;
let demarrage = false;

/** Piste jouée : celle des accords si le mode accords en désigne une autre, sinon la piste chantée. */
function pisteJouee(m: Morceau, r: ReglagesDirect): PisteInstrument {
  const id = r.accords?.piste ?? r.piste;
  const p = pisteDe(m, id) ?? pisteDe(m, r.piste);
  if (p?.genre !== 'instrument') throw new ErreurOcka(E.pisteAbsente, 'piste_introuvable');
  return p;
}

function reglagesDetecteur(m: Morceau, r: ReglagesDirect, decroissance: number): ReglagesDetecteur {
  const gamme = classesGamme(m.tonalite);
  return {
    mode: r.mode,
    calage: r.calage === 'gamme' ? gamme : null,
    gamme,
    glisse: Math.max(0, Math.min(300, r.glisse || 0)),
    accords: r.accords?.type ?? null,
    suivreVolume: r.suivreVolume,
    decroissance,
  };
}

function brancher(s: Seance): void {
  s.instrument.brancher(s.chaine.noeud, s.reglages.suivreVolume);
  s.instrument.voix(s.reglages.accords ? (s.reglages.accords.type === 'septieme' ? 4 : 3) : 1);
}

function recevoir(s: Seance, d: { type: string } & Record<string, unknown>): void {
  if (seance !== s) return;
  if (d.type === 'etat') {
    s.etat = {
      midi: d.midi as number | null,
      cents: d.cents as number,
      ecart: d.ecart as number,
      niveau: d.niveau as number,
      jouees: d.jouees as number[],
    };
  } else if (d.type === 'note') {
    const e = d as unknown as EvenementNote;
    s.instrument.jouer(e.jouees, e.vel);
    s.ecouteurs.forEach((f) => f(e));
  }
}

/** Ouvre le micro et joue la piste en direct. Erreurs : micro_refuse, micro_absent, deja_en_cours, instrument_absent. */
export async function demarrerDirect(m: Morceau, reglages: ReglagesDirect): Promise<void> {
  if (seance || demarrage) throw new ErreurOcka(E.dejaEnCours, 'deja_en_cours');
  demarrage = true;
  let chaine: Chaine | null = null;
  try {
    const piste = pisteJouee(m, reglages);
    const ctx = contexteAudio();
    const instrument = await creerInstrumentDirect(ctx, piste);
    try {
      chaine = await ouvrirChaine('voix', reglagesDetecteur(m, reglages, instrument.decroissance));
    } catch (e) {
      instrument.arreter();
      throw e;
    }
    // Le worklet doit tourner même quand aucune note ne sonne : une sortie tirée à volume nul.
    const tirage = ctx.createGain();
    tirage.gain.value = 0;
    chaine.noeud.connect(tirage, 0).connect(ctx.destination);
    const s: Seance = {
      m,
      reglages: { ...reglages },
      chaine,
      instrument,
      tirage,
      etat: SILENCE,
      ecouteurs: new Set(),
      version: 0,
    };
    chaine.noeud.port.onmessage = (ev: MessageEvent) => recevoir(s, ev.data);
    brancher(s);
    seance = s;
  } catch (e) {
    chaine?.fermer();
    throw e;
  } finally {
    demarrage = false;
  }
}

/** Change les réglages pendant le jeu. Une autre piste (ou piste d'accords) : la voix d'instrument est refaite. */
export function reglerDirect(r: Partial<ReglagesDirect>): void {
  const s = seance;
  if (!s) return;
  const avant = s.reglages;
  s.reglages = { ...avant, ...r };
  const changePiste =
    (avant.accords?.piste ?? avant.piste) !== (s.reglages.accords?.piste ?? s.reglages.piste);
  const changeVolume = avant.suivreVolume !== s.reglages.suivreVolume;
  if (changePiste || changeVolume) {
    const v = ++s.version;
    void (async () => {
      try {
        const neuf = await creerInstrumentDirect(s.chaine.ctx, pisteJouee(s.m, s.reglages));
        if (seance !== s || v !== s.version) return neuf.arreter();
        try {
          s.chaine.noeud.disconnect();
        } catch {
          /* rien de branché */
        }
        s.chaine.noeud.connect(s.tirage, 0);
        s.instrument.arreter();
        s.instrument = neuf;
        brancher(s);
        s.chaine.noeud.port.postMessage({ type: 'reglages', reglages: { decroissance: neuf.decroissance } });
      } catch (e) {
        console.error(e);
      }
    })();
  } else brancher(s);
  const d = reglagesDetecteur(s.m, s.reglages, s.instrument.decroissance);
  s.chaine.noeud.port.postMessage({ type: 'reglages', reglages: d });
}

/** Arrête le direct et coupe le micro. */
export async function arreterDirect(): Promise<void> {
  const s = seance;
  if (!s) return;
  seance = null;
  s.ecouteurs.clear();
  s.instrument.arreter();
  s.chaine.fermer();
  s.tirage.disconnect();
}

/** La note courante (roue des 12 notes) ; hors du direct : le silence. */
export function noteCourante(): NoteCourante {
  return seance?.etat ?? SILENCE;
}

/** Pour l'enregistrement : écoute les notes jouées (null s'il n'y a pas de direct). Renvoie de quoi arrêter d'écouter. */
export function ecouterNotes(
  f: (e: EvenementNote) => void,
): { ctx: AudioContext; arreter: () => void } | null {
  const s = seance;
  if (!s) return null;
  s.ecouteurs.add(f);
  return { ctx: s.chaine.ctx, arreter: () => s.ecouteurs.delete(f) };
}

/** Les réglages du direct en cours (accords : quelle piste reçoit les notes), ou null. */
export function reglagesEnCours(): ReglagesDirect | null {
  return seance ? { ...seance.reglages } : null;
}
