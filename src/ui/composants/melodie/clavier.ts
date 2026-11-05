// « Enregistrer au clavier » : décompte d'une mesure (4 clics), puis la section tourne en boucle ; chaque toucher
// d'un pad de la gamme est daté sur l'horloge audio. À l'arrêt, les frappes sont calées (edition/clavier.ts)
// et posées dans le motif en UNE seule étape d'Annuler.

import { signal } from '@preact/signals';
import { contexteAudio, type Lecteur } from '../../../moteur/api';
import { debutOccurrence } from '../../../morceau/temps';
import { T } from '../../../textes-fr';
import { calerFrappes, DELAI_TOUCHER, type Frappe } from '../../edition/clavier';
import { longueurDefaut, motifMelodie, poserNotes } from '../../edition/melodie';
import { afficherToast, annulerAction, modifier, morceau, sectionCourante } from '../../etat';
import { lecteurPret, obtenirLecteur, reappliquerReglages, toastErreur } from '../../lecture';
import { dureeNote } from './reglages-melodie';

export type PhaseClavier = 'repos' | 'decompte' | 'enregistrement';
export const phaseClavier = signal<PhaseClavier>('repos');
export const decompteClavier = signal(4);
/** Nombre de frappes depuis la fin du décompte (affiché pendant l'enregistrement). */
export const frappesClavier = signal(0);

interface Session {
  lecteur: Lecteur;
  ctx: AudioContext;
  idSection: string;
  /** Heure du contexte où le 1er pas de la section part vers la sortie (connue quand la lecture démarre). */
  heureDebut: number | null;
  retrait: number;
  frappes: Frappe[];
  minuteries: ReturnType<typeof setTimeout>[];
  desabonner: (() => void) | null;
}
let session: Session | null = null;

/** Joue 4 clics (le 1er plus aigu) et renvoie l'heure du contexte où la mesure de décompte se termine. */
function jouerDecompte(ctx: AudioContext, tempo: number): number {
  const noire = 60 / tempo;
  const debut = ctx.currentTime + 0.12;
  for (let i = 0; i < 4; i++) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = i === 0 ? 1600 : 1000;
    const t = debut + i * noire;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }
  return debut + 4 * noire;
}

function lireLatence(l: Lecteur): number {
  try {
    const x = l.latenceSortie;
    return Number.isFinite(x) && x > 0 ? x : 0;
  } catch {
    return 0;
  }
}

function nettoyer() {
  const s = session;
  session = null;
  if (s) {
    s.minuteries.forEach(clearTimeout);
    s.desabonner?.();
  }
  phaseClavier.value = 'repos';
}

export function clavierActif(): boolean {
  return session !== null;
}

/** Démarre l'enregistrement au clavier sur la section (1re apparition dans l'arrangement). */
export async function demarrerClavier(idSection: string) {
  const m = morceau.peek();
  const s = m?.sections.find((x) => x.id === idSection);
  if (!m || !s || session) return;
  const l = obtenirLecteur();
  if (!l) return;
  const ctx = l.ctx ?? contexteAudio();
  const sess: Session = { lecteur: l, ctx, idSection, heureDebut: null, retrait: 0, frappes: [], minuteries: [], desabonner: null };
  session = sess;
  phaseClavier.value = 'decompte';
  decompteClavier.value = 4;
  frappesClavier.value = 0;
  try {
    await ctx.resume();
    await lecteurPret();
    if (session !== sess) return;
    if (l.enLecture) l.pause();
    sess.retrait = lireLatence(l) + DELAI_TOUCHER;
    // La boucle de la barre suit sectionCourante : on la pose d'abord, puis on boucle nous-mêmes sur la section.
    sectionCourante.value = idSection;
    const debut = debutOccurrence(m, idSection, 0) ?? 0;
    l.boucler(idSection);
    l.aller(debut);
    const noire = 60 / m.tempo;
    const fin = jouerDecompte(ctx, m.tempo);
    const dans = (heure: number) => Math.max(0, (heure - ctx.currentTime) * 1000);
    for (let i = 1; i < 4; i++) sess.minuteries.push(setTimeout(() => (decompteClavier.value = 4 - i), dans(fin - (4 - i) * noire)));
    sess.minuteries.push(
      setTimeout(() => {
        if (session !== sess) return;
        l.lire();
        const h = l.heureDe?.(debut);
        sess.heureDebut = h !== undefined && Number.isFinite(h) ? h : ctx.currentTime;
        phaseClavier.value = 'enregistrement';
        // Lecture arrêtée par la barre (Pause) : on termine l'enregistrement.
        sess.desabonner = l.surChangement(() => {
          if (session === sess && !l.enLecture) arreterClavier();
        });
      }, dans(fin) - 15),
    );
  } catch (e) {
    nettoyer();
    toastErreur(e, T.barre.pasPret);
  }
}

/** Un pad de la gamme touché (`timeStamp` de l'évènement, pour dater au plus juste). */
export function frapperClavier(midi: number, timeStamp: number) {
  const s = session;
  if (!s) return;
  const retard = Math.min(0.1, Math.max(0, (performance.now() - timeStamp) / 1000));
  s.frappes.push({ heure: s.ctx.currentTime - retard, midi });
  if (phaseClavier.peek() === 'enregistrement') frappesClavier.value++;
}

/** Arrête : les frappes sont calées et posées dans le motif (une étape d'Annuler). */
export function arreterClavier() {
  const s = session;
  if (!s) return;
  nettoyer();
  if (s.lecteur.enLecture) s.lecteur.pause();
  reappliquerReglages();
  const m = morceau.peek();
  const section = m?.sections.find((x) => x.id === s.idSection);
  if (!m || !section || s.heureDebut === null) return;
  const avant = motifMelodie(m, s.idSection);
  const notes = calerFrappes(s.frappes, {
    heureDebut: s.heureDebut,
    retrait: s.retrait,
    tempo: m.tempo,
    swing: m.swing,
    pasSection: section.mesures * 16,
    pasMotif: avant?.pas ?? longueurDefaut(section),
    duree: dureeNote.peek(),
  });
  if (notes.length && modifier((x) => poserNotes(x, s.idSection, notes))) {
    const apres = motifMelodie(morceau.peek()!, s.idSection);
    const n = (apres?.notes.length ?? 0) - (avant?.notes.length ?? 0);
    afficherToast(T.melodie.posees(n), 5000, { label: T.annuler, agir: annulerAction });
  } else afficherToast(T.melodie.aucunePosee);
}
