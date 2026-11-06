// Enregistrement en notes : décompte d'une mesure (4 clics), puis le beat boucle sur la section pendant qu'on chante
// (ou qu'on fait du beatbox) ; à l'arrêt, les notes sont recalées (latence aller-retour du calibrage, et le début
// estimé de chaque note par le détecteur), repliées sur le motif, quantifiées, les trop courtes ignorées.

import { contexteAudio } from '../enregistrement/contexte';
import { latenceMemorisee } from '../enregistrement/latence';
import { motifBatterieDe, sectionDe } from '../morceau/acces';
import { arrangement, dureePas } from '../morceau/temps';
import type { Morceau } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import { TEXTES_DUBLER } from '../textes/dubler';
import type { NotesChantees, OptionsEnregistrementNotes } from './api-dubler';
import { ecouterFrappes } from './beatbox-direct';
import { lecteurOcka } from './chaine';
import { ecouterNotes } from './direct';
import {
  ID_BATTERIE,
  notesDepuisEvenements,
  quantifierNotesChantees,
  type CadreEnregistrement,
  type EvenementDate,
} from './notes';

const E = TEXTES_DUBLER.chanter.erreurs;

interface Prise {
  options: OptionsEnregistrementNotes;
  ctx: AudioContext;
  evenements: EvenementDate[];
  cadre: Promise<CadreEnregistrement>;
  arreterEcoute: () => void;
  minuteries: ReturnType<typeof setTimeout>[];
  fin: () => Promise<void>;
}

let prise: Prise | null = null;

/** 4 clics (le 1er plus aigu) ; renvoie l'heure du contexte où la mesure de décompte se termine. */
function jouerDecompte(ctx: AudioContext, tempo: number): number {
  const noire = 60 / tempo;
  const debut = ctx.currentTime + 0.1;
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

/** Latence aller-retour : celle du calibrage, sinon une estimation (sortie + base + 10 ms d'entrée). */
function latence(ctx: AudioContext): number {
  return latenceMemorisee() ?? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + 0.01;
}

/** Lance le beat en boucle sur la section et enregistre (direct « Chanter » ou beatbox en cours requis). */
export async function demarrerEnregistrementNotes(
  m: Morceau,
  options: OptionsEnregistrementNotes,
): Promise<void> {
  if (prise) throw new ErreurOcka(E.dejaEnCours, 'deja_en_cours');
  const evenements: EvenementDate[] = [];
  const batterie = options.piste === ID_BATTERIE;
  const fs = contexteAudio().sampleRate;
  const ecoute = batterie
    ? ecouterFrappes((e) => evenements.push(e))
    : ecouterNotes((e) => evenements.push({ heure: e.debut / fs, jouees: e.jouees, vel: e.vel }));
  if (!ecoute)
    throw new ErreurOcka(batterie ? TEXTES_DUBLER.beatbox.erreurs.pasEnCours : E.pasEnCours, 'pas_en_cours');
  const section = sectionDe(m, options.section);
  const occ = arrangement(m).find((o) => o.section.id === options.section);
  if (!section || !occ) {
    ecoute.arreter();
    throw new ErreurOcka(E.sectionAbsente, 'ancre_introuvable');
  }
  const { lecteur, pret, reappliquer } = await lecteurOcka();
  if (!lecteur) {
    ecoute.arreter();
    throw new ErreurOcka(E.lecteur, 'inconnu');
  }
  await pret().catch(() => undefined);
  const ctx = ecoute.ctx;
  const pasSection = section.mesures * 16;
  const pasMotif = batterie
    ? (motifBatterieDe(m, section)?.pas ?? Math.min(256, pasSection))
    : Math.min(128, pasSection);
  const debutSection = occ.debutPas * dureePas(m.tempo);
  lecteur.pause();
  lecteur.boucler(options.section);
  lecteur.aller(debutSection);
  const finDecompte = jouerDecompte(ctx, m.tempo);
  const minuteries: Prise['minuteries'] = [];
  const cadre = new Promise<CadreEnregistrement>((ok) => {
    minuteries.push(
      setTimeout(
        () => {
          lecteur.lire();
          const h = lecteur.heureDe?.(debutSection) ?? ctx.currentTime + 0.05;
          ok({
            tempo: m.tempo,
            swing: m.swing,
            heureSection: h,
            latence: latence(ctx),
            pasSection,
            pasMotif,
            frappes: batterie,
          });
        },
        Math.max(0, (finDecompte - ctx.currentTime) * 1000 - 60),
      ),
    );
  });
  prise = {
    options,
    ctx,
    evenements,
    cadre,
    arreterEcoute: ecoute.arreter,
    minuteries,
    fin: async () => {
      lecteur.pause();
      reappliquer();
    },
  };
  await cadre;
}

/** Arrête : notes recalées et quantifiées, prêtes pour le piano roll (ou la grille de batterie). */
export async function arreterEnregistrementNotes(): Promise<NotesChantees> {
  const p = prise;
  if (!p) throw new ErreurOcka(E.pasEnCours, 'pas_en_cours');
  prise = null;
  const fin = p.ctx.currentTime;
  p.arreterEcoute();
  p.minuteries.forEach((x) => clearTimeout(x));
  await p.fin();
  const cadre = await p.cadre;
  const brutes = notesDepuisEvenements(p.evenements, fin, cadre);
  const quantif = cadre.frappes ? (p.options.quantif ?? 1) : p.options.quantif;
  // Une note calée tout au bout du motif repart au début (le motif boucle).
  const notes = quantifierNotesChantees(brutes, quantif, p.options.force ?? 1).map((n) =>
    n.pas < cadre.pasMotif ? n : { ...n, pas: n.pas - cadre.pasMotif },
  );
  return { piste: p.options.piste, section: p.options.section, pas: cadre.pasMotif, notes };
}

/** true pendant un enregistrement en notes. */
export function enregistrementEnCours(): boolean {
  return prise !== null;
}
