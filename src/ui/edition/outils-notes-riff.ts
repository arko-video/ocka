// « Riff machine » (P) : une mélodie générée par des RÈGLES (pas d'IA), déterministe (graine), dans la gamme choisie,
// calée sur les accords de la section. Règles de bon sens : notes de l'accord sur les temps forts, mouvements conjoints
// (pas de saut de plus d'une quarte, un saut est suivi d'un retour), rythme du style (gabarit de poids par pas),
// phrases de 2 mesures dont le rythme revient, dernière note sur la tonique ou la fondamentale. Remplace le motif.

import { motifAccordsDe } from '../../morceau/acces';
import { hauteurTonique, notesAccord } from '../../morceau/theorie';
import type { Morceau, MotifAccords, Note } from '../../morceau/types';
import type { ReglagesRiff } from './api-outils-notes';
import { borner, changerNotes, noteValide } from './notes-motif';
import { hasardGraine } from './outils-notes';

type Gamme = ReglagesRiff['gamme'];
type StyleRiff = ReglagesRiff['style'];

/** Écarts (demi-tons) de chaque gamme, selon le mode du morceau. */
export function ecartsGamme(gamme: Gamme, mode: Morceau['tonalite']['mode']): number[] {
  const mineur = mode === 'mineur';
  switch (gamme) {
    case 'pentatonique':
      return mineur ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
    case 'blues':
      return mineur ? [0, 3, 5, 6, 7, 10] : [0, 2, 3, 4, 7, 9];
    case 'harmonique':
      return mineur ? [0, 2, 3, 5, 7, 8, 11] : [0, 2, 4, 5, 7, 8, 11];
    default:
      return mineur ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  }
}

interface Style {
  /** Poids de chaque pas d'une mesure (0 à 1) : chance d'y poser une note, multipliée par la densité. */
  poids: number[];
  /** Durées possibles (pas). */
  durees: number[];
  /** Registre (MIDI). */
  bas: number;
  haut: number;
  /** Chance d'un saut (tierce de l'accord) au lieu d'un pas conjoint. */
  saut: number;
}

const p = (x: string) => x.split('').map((c) => Number(c) / 9);
export const STYLES: Record<StyleRiff, Style> = {
  calme: { poids: p('9001003050010030'), durees: [4, 3, 2], bas: 60, haut: 76, saut: 0.15 },
  rebondi: { poids: p('9006008090608060'), durees: [2, 1, 2], bas: 62, haut: 79, saut: 0.25 },
  rapide: { poids: p('9686968696869686'), durees: [1, 1, 1], bas: 64, haut: 84, saut: 0.2 },
  trap: { poids: p('9004007090060070'), durees: [3, 1, 2], bas: 60, haut: 79, saut: 0.3 },
  melancolique: { poids: p('9000005070000040'), durees: [6, 4, 3], bas: 57, haut: 74, saut: 0.2 },
};

/** Les notes de la gamme dans le registre [bas, haut], montantes. */
export function notesGamme(tonique: number, ecarts: readonly number[], bas: number, haut: number): number[] {
  const r: number[] = [];
  for (let midi = bas; midi <= haut; midi++) if (ecarts.includes((((midi - tonique) % 12) + 12) % 12)) r.push(midi);
  return r;
}

/** Classes de hauteur (0 à 11) de l'accord joué au pas `pas` de la section (accord de tonique sans motif). */
function accordAuPas(m: Morceau, motif: MotifAccords | undefined, pas: number): number[] {
  const t = m.tonalite;
  const i = motif && motif.pas > 0 ? pas % motif.pas : 0;
  const a = motif?.accords.find((x) => i >= x.pas && i < x.pas + x.duree);
  const notes = notesAccord(t.tonique, t.mode, a?.degre ?? (t.mode === 'mineur' ? 'i' : 'I'));
  return notes.map((n) => n % 12);
}

/** Rythme d'une phrase de 2 mesures : départs (pas) selon les poids du style et la densité ; le 1er temps toujours. */
function rythme(style: Style, densite: number, hasard: () => number): number[] {
  const departs: number[] = [];
  for (let pas = 0; pas < 32; pas++) {
    const w = style.poids[pas % 16]!;
    if (pas === 0 || hasard() < Math.min(1, w * densite * 1.4)) departs.push(pas);
  }
  return departs;
}

/** Indice (dans `gamme`) de la note de l'accord la plus proche de `pres`. */
function plusProcheAccord(gamme: readonly number[], accord: readonly number[], pres: number): number {
  let meilleur = -1;
  gamme.forEach((midi, i) => {
    if (!accord.includes(midi % 12)) return;
    if (meilleur < 0 || Math.abs(midi - pres) < Math.abs(gamme[meilleur]! - pres)) meilleur = i;
  });
  return meilleur;
}

/** « Riff machine » : remplace les notes du motif de la piste dans la section. */
export function riffMachine(m: Morceau, piste: string, section: string, r: ReglagesRiff): Morceau {
  if (!r || !Number.isFinite(r.densite) || !(r.style in STYLES)) return m;
  const style = STYLES[r.style];
  const densite = borner(r.densite, 0.05, 1);
  const hasard = hasardGraine(r.graine);
  const tonique = hauteurTonique(m.tonalite.tonique);
  const gamme = notesGamme(tonique, ecartsGamme(r.gamme, m.tonalite.mode), style.bas, style.haut);
  const accords = motifAccordsDe(m, section);
  return changerNotes(m, piste, section, (motif) => {
    const longueur = motif.pas;
    const phrase = rythme(style, densite, hasard);
    const departs: number[] = [];
    for (let debut = 0; debut < longueur; debut += 32) for (const x of phrase) if (debut + x < longueur) departs.push(debut + x);
    const notes: Note[] = [];
    let i = plusProcheAccord(gamme, accordAuPas(m, accords, 0), (style.bas + style.haut) / 2);
    let elan = 0;
    departs.forEach((pas, k) => {
      const accord = accordAuPas(m, accords, pas);
      const fort = pas % 4 === 0;
      const derniere = k === departs.length - 1;
      if (k > 0) {
        if (derniere) {
          // Fin de phrase : la tonique (ou la fondamentale de l'accord) la plus proche.
          const cible = gamme.findIndex((x) => x % 12 === tonique % 12 && Math.abs(x - gamme[i]!) <= 7);
          i = cible >= 0 ? cible : plusProcheAccord(gamme, accord, gamme[i]!);
        } else if (fort) {
          i = plusProcheAccord(gamme, accord, gamme[i]! + elan);
        } else {
          // Après un saut, on revient par un pas conjoint dans l'autre sens.
          const sens = elan !== 0 ? -Math.sign(elan) : hasard() < 0.5 ? -1 : 1;
          const ecart = elan === 0 && hasard() < style.saut ? 2 : 1;
          let j = i + sens * ecart;
          if (j < 0 || j >= gamme.length) j = i - sens * ecart;
          elan = ecart > 1 ? sens * ecart : 0;
          i = borner(j, 0, gamme.length - 1);
        }
        if (fort) elan = 0;
      }
      if (i < 0) i = 0;
      const suivant = departs[k + 1] ?? longueur;
      const voulue = style.durees[Math.floor(hasard() * style.durees.length)]!;
      const duree = Math.max(1, Math.min(voulue, suivant - pas, longueur - pas));
      const vel = Math.round((fort ? 0.9 : 0.72 + 0.1 * hasard()) * 100) / 100;
      const n = noteValide({ pas, duree, midi: gamme[i]!, vel }, longueur);
      if (n) notes.push(n);
    });
    return notes;
  });
}
