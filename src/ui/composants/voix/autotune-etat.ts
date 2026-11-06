// État de l'autotune avancé côté interface (A2) : analyses des prises (courbe et notes, cache par fichier), rendu en
// tâche de fond après chaque changement (badge « En préparation… », notes en recalcul), écoute Avant / Après et
// d'un passage, note de référence. Tant que le moteur (A1) lève « pas_encore » : un toast « bientôt », sans planter.

import { signal } from '@preact/signals';
import {
  analyserNotes,
  contexteAudio,
  detecterGamme,
  ErreurOcka,
  forceAutotune,
  lirePrise,
  rendreAutotune,
  reglagesDeForce,
  reglagesPreset,
  type AnalyseNotes,
  type GammeDetectee,
} from '../../../moteur/api';
import { frequenceMidi } from '../../../morceau/theorie';
import type { AutotunePrise, Morceau, NoteAutotune, Prise } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { notesChangees } from '../../edition/autotune';
import { afficherToast, morceau } from '../../etat';
import { obtenirLecteur } from '../../lecture';

type PcmVoix = NonNullable<Awaited<ReturnType<typeof rendreAutotune>>>;

export type EtatAnalyse =
  | { etat: 'calcul'; part: number }
  | { etat: 'pret'; analyse: AnalyseNotes; gammes: GammeDetectee[] }
  | { etat: 'bientot' | 'erreur' };
export type EtatRendu = { etat: 'calcul'; part: number; notes: number[] } | { etat: 'pret' | 'repli' | 'bientot' | 'erreur' };

/** Par fichier de prise. */
export const analyses = signal<ReadonlyMap<string, EtatAnalyse>>(new Map());
/** Par id de prise. */
export const rendus = signal<ReadonlyMap<string, EtatRendu>>(new Map());
/** Écoute en cours : Avant (prise brute) ou Après (rendu), pour une prise. */
export const ecouteAB = signal<{ idPrise: string; cote: 'avant' | 'apres' } | null>(null);

const avec = <V>(carte: ReadonlyMap<string, V>, cle: string, v: V) => new Map(carte).set(cle, v);
export const estBientot = (e: unknown) => e instanceof ErreurOcka && e.code === 'pas_encore';

/** Erreur montrée en toast : « bientôt » pour une partie pas encore livrée, rien pour une annulation. */
export function signaler(e: unknown): void {
  if (e instanceof ErreurOcka) {
    if (e.code === 'annule') return;
    afficherToast(e.code === 'pas_encore' ? T.autotuneAvance.bientot : e.message);
    return;
  }
  console.error(e);
  afficherToast(T.bientot);
}

/* ------------------------------------------------------------ analyse */

const analysesEnCours = new Map<string, Promise<AnalyseNotes | null>>();

/** Analyse (courbe + notes) d'une prise, une seule fois par fichier ; null si elle n'est pas possible. */
export function chargerAnalyse(prise: Prise, avecToast = true): Promise<AnalyseNotes | null> {
  const deja = analyses.peek().get(prise.fichier);
  if (deja?.etat === 'pret') return Promise.resolve(deja.analyse);
  if (deja?.etat === 'bientot' && !avecToast) return Promise.resolve(null);
  const enCours = analysesEnCours.get(prise.fichier);
  if (enCours) return enCours;
  const cle = prise.fichier;
  analyses.value = avec(analyses.peek(), cle, { etat: 'calcul', part: 0 });
  const p = (async () => {
    try {
      const analyse = await analyserNotes(prise, {
        surProgression: (part) => (analyses.value = avec(analyses.peek(), cle, { etat: 'calcul', part })),
      });
      let gammes: GammeDetectee[] = [];
      try {
        // La tonalité du morceau départage une voix qui hésite entre deux gammes (A1).
        gammes = detecterGamme(analyse.notes, morceau.peek()?.tonalite);
      } catch (e) {
        if (!estBientot(e)) console.error(e);
      }
      analyses.value = avec(analyses.peek(), cle, { etat: 'pret', analyse, gammes });
      return analyse;
    } catch (e) {
      analyses.value = avec(analyses.peek(), cle, { etat: estBientot(e) ? 'bientot' : 'erreur' });
      if (avecToast) signaler(e);
      return null;
    } finally {
      analysesEnCours.delete(cle);
    }
  })();
  analysesEnCours.set(cle, p);
  return p;
}

/** Réglages de départ d'une prise sans autotune : le curseur simple s'il est allumé, sinon « Naturel ». Peut lever. */
export function reglagesDepart(m: Morceau): AutotunePrise {
  const f = forceAutotune(m);
  return f > 0 ? reglagesDeForce(f) : reglagesPreset('naturel');
}

/* ------------------------------------------------------------ rendu en tâche de fond */

const prevus = new Map<string, string>();
const minuteurs = new Map<string, ReturnType<typeof setTimeout>>();
const annulations = new Map<string, AbortController>();
const notesRendues = new Map<string, readonly NoteAutotune[]>();
/** Dernier rendu réussi par prise (clé des réglages → PCM), pour l'écoute « Après ». */
const derniers = new Map<string, { cle: string; pcm: PcmVoix }>();

const cleRendu = (m: Morceau, p: Prise) => JSON.stringify([p.fichier, p.autotune, m.tonalite]);

/** Lance le rendu de la prise 0,6 s après le DERNIER changement de ses réglages (rien si rien n'a changé). */
export function planifierRendu(m: Morceau, prise: Prise): void {
  const cle = cleRendu(m, prise);
  if (prevus.get(prise.id) === cle) return;
  prevus.set(prise.id, cle);
  clearTimeout(minuteurs.get(prise.id));
  annulations.get(prise.id)?.abort();
  if (!prise.autotune) {
    const r = new Map(rendus.peek());
    r.delete(prise.id);
    rendus.value = r;
    return;
  }
  minuteurs.set(prise.id, setTimeout(() => void rendre(prise.id), 600));
}

async function rendre(idPrise: string): Promise<PcmVoix | null> {
  const m = morceau.peek();
  const prise = m?.prises.find((p) => p.id === idPrise);
  if (!m || !prise?.autotune) return null;
  const cle = cleRendu(m, prise);
  annulations.get(idPrise)?.abort();
  const c = new AbortController();
  annulations.set(idPrise, c);
  const notes = notesChangees(notesRendues.get(idPrise), prise.autotune.notes ?? []);
  const noter = (e: EtatRendu) => (rendus.value = avec(rendus.peek(), idPrise, e));
  noter({ etat: 'calcul', part: 0, notes });
  try {
    const pcm = await rendreAutotune(prise, prise.autotune, m.tonalite, {
      signal: c.signal,
      surProgression: (part) => !c.signal.aborted && noter({ etat: 'calcul', part, notes }),
    });
    if (c.signal.aborted) return null;
    notesRendues.set(idPrise, prise.autotune.notes ?? []);
    if (pcm) derniers.set(idPrise, { cle, pcm });
    noter({ etat: pcm ? 'pret' : 'repli' });
    // L'écoute avec le beat passe au nouveau rendu.
    const actuel = morceau.peek();
    if (actuel) void obtenirLecteur()?.charger(actuel).catch((e: unknown) => console.error(e));
    return pcm;
  } catch (e) {
    if (c.signal.aborted) return null;
    noter({ etat: estBientot(e) ? 'bientot' : 'erreur' });
    signaler(e);
    return null;
  } finally {
    if (annulations.get(idPrise) === c) annulations.delete(idPrise);
  }
}

/* ------------------------------------------------------------ écoute */

let arretEcoute: (() => void) | null = null;
let minuteurEcoute: ReturnType<typeof setTimeout> | undefined;

export function arreterEcoute(): void {
  arretEcoute?.();
  arretEcoute = null;
  clearTimeout(minuteurEcoute);
  ecouteAB.value = null;
}

async function jouer(pcm: Float32Array, frequence: number, depuis: number, jusqua: number, gain: number): Promise<number> {
  const ctx = contexteAudio();
  await ctx.resume();
  const a = Math.max(0, Math.floor(depuis * frequence));
  const b = Math.min(pcm.length, Math.ceil(jusqua * frequence));
  if (b - a < 16) return 0;
  const tampon = ctx.createBuffer(1, b - a, frequence);
  tampon.copyToChannel(pcm.slice(a, b), 0);
  const volume = ctx.createGain();
  volume.gain.value = gain;
  const source = ctx.createBufferSource();
  source.buffer = tampon;
  source.connect(volume).connect(ctx.destination);
  source.start(ctx.currentTime + 0.02);
  arretEcoute = () => {
    try {
      source.stop();
    } catch {
      /* déjà finie */
    }
    source.disconnect();
    volume.disconnect();
  };
  return (b - a) / frequence;
}

/**
 * Joue la prise Avant (brute) ou Après (rendue) — toute la partie gardée, ou la zone [debut, fin] (secondes dans le
 * fichier). Toucher le même côté arrête. « Après » attend le rendu (déjà en cache le plus souvent).
 */
export async function ecouter(prise: Prise, cote: 'avant' | 'apres', zone?: { debut: number; fin: number }): Promise<void> {
  const memeCote = ecouteAB.peek();
  arreterEcoute();
  if (!zone && memeCote?.idPrise === prise.id && memeCote.cote === cote) return;
  ecouteAB.value = { idPrise: prise.id, cote };
  try {
    let source: { pcm: Float32Array; frequence: number } | null;
    if (cote === 'avant' || !prise.autotune) source = await lirePrise(prise);
    else {
      const m = morceau.peek();
      const cle = m ? cleRendu(m, prise) : '';
      const d = derniers.get(prise.id);
      source = d?.cle === cle ? d.pcm : await rendre(prise.id);
      if (!source) {
        if (rendus.peek().get(prise.id)?.etat === 'repli') afficherToast(T.autotuneAvance.repli);
        ecouteAB.value = null;
        return;
      }
    }
    if (!source) throw new ErreurOcka('Le fichier de cette prise est introuvable sur le téléphone.', 'prise_introuvable');
    if (ecouteAB.peek()?.idPrise !== prise.id || ecouteAB.peek()?.cote !== cote) return;
    const debut = zone ? zone.debut : prise.debutCoupe;
    const fin = zone ? zone.fin : prise.finCoupe;
    const duree = await jouer(source.pcm, source.frequence, debut, fin, prise.gain);
    minuteurEcoute = setTimeout(() => (ecouteAB.value = null), duree * 1000 + 100);
  } catch (e) {
    ecouteAB.value = null;
    signaler(e);
  }
}

/** Le passage autour d'une note (±0,25 s) : rendu s'il est prêt, sinon la prise brute. */
export function ecouterPassage(prise: Prise, debut: number, fin: number): void {
  const pret = rendus.peek().get(prise.id)?.etat === 'pret';
  void ecouter(prise, pret ? 'apres' : 'avant', { debut: Math.max(0, debut - 0.25), fin: fin + 0.25 });
}

/** Note de référence (son doux, 0,3 s) pendant qu'on glisse une note. */
export function jouerReference(midi: number): void {
  try {
    const ctx = contexteAudio();
    void ctx.resume();
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = frequenceMidi(midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.32);
    o.onended = () => g.disconnect();
  } catch (e) {
    console.error(e);
  }
}
