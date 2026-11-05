// Le planning : la liste de TOUT ce qui se joue dans un morceau (frappes et pads perso, notes de 808, accords,
// notes de mélodie, relances des boucles de sons importés), avec le temps en secondes depuis le début.
// Pur (sans Web Audio) : testé dans Vitest, utilisé tel quel par l'écoute (fenêtre de 200 ms) et par l'export.

import { demiTonsDegre, fondamentale, hauteurTonique, lireDegre, voicingsSuite } from '../morceau/theorie';
import { arrangement, pasVersSecondes, type Occurrence } from '../morceau/temps';
import type { InstrumentBatterie, Morceau, MotifAccords, MotifBasse, MotifBatterie, MotifMelodie, Section, SonMelodie } from '../morceau/types';

export type Evenement =
  | { type: 'frappe'; t: number; instrument: InstrumentBatterie; vel: number }
  | { type: 'basse'; t: number; duree: number; midi: number; cible?: number; vel: number }
  | { type: 'accord'; t: number; duree: number; notes: number[]; son: NonNullable<MotifAccords['son']>; vel: number }
  | { type: 'note'; t: number; duree: number; midi: number; son: SonMelodie; vel: number }
  /** Relance d'une boucle de son importé : jouée de `t` à `t + duree` (prochaine relance ou fin de section). */
  | { type: 'boucle'; t: number; duree: number; son: string; mesures: number; caler: boolean };

/** Humanisation : la vélocité varie de ±8 %, toujours pareil pour un même morceau (graine fixe). */
export const HUMANISATION = 0.08;
/** Ordre fixe : l'indice sert de graine à l'humanisation (les pads perso sont ajoutés À LA FIN : rien ne bouge). */
const INSTRUMENTS: InstrumentBatterie[] = ['kick', 'snare', 'clap', 'charley', 'charleyOuvert', 'rim', 'cowbell', 'perc', 'perso1', 'perso2', 'perso3', 'perso4'];
/** Gain d'une note de mélodie à vélocité 1 (le même que chaque note d'un accord). */
export const GAIN_NOTE = 0.8;

/** Nombre pseudo-aléatoire entre 0 et 1 fixé par 3 entiers (même entrée → même nombre). */
export function hasardFixe(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x27d4eb2f, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function humaniser(vel: number, pasGlobal: number, inst: number, k: number): number {
  const v = vel * (1 + HUMANISATION * (2 * hasardFixe(pasGlobal, inst, k) - 1));
  return Math.min(1, Math.max(0, v));
}

/**
 * Fill de la dernière mesure (pas 8 à 15) : caisse claire qui monte, en roulements en trap et en drill.
 * Phonk : roulements en triolets ; pop : croches puis double-croches ; boom bap : 3 coups secs, comme un batteur.
 */
function fill(morceau: Morceau): { pas: number; vel: number; roul: number }[] {
  if (morceau.style === 'lofi') return [{ pas: 13, vel: 0.4, roul: 0 }, { pas: 14, vel: 0.6, roul: 0 }, { pas: 15, vel: 0.8, roul: 0 }];
  if (morceau.style === 'phonk') return [{ pas: 12, vel: 0.5, roul: 3 }, { pas: 13, vel: 0.6, roul: 3 }, { pas: 14, vel: 0.75, roul: 3 }, { pas: 15, vel: 0.9, roul: 3 }];
  if (morceau.style === 'pop')
    return [8, 10, 12, 13, 14, 15].map((pas, k) => ({ pas, vel: 0.45 + k * 0.1, roul: 0 }));
  if (morceau.style === 'boombap') return [{ pas: 11, vel: 0.45, roul: 0 }, { pas: 14, vel: 0.65, roul: 0 }, { pas: 15, vel: 0.85, roul: 0 }];
  return [
    { pas: 12, vel: 0.5, roul: 2 },
    { pas: 13, vel: 0.6, roul: 2 },
    { pas: 14, vel: 0.75, roul: 3 },
    { pas: 15, vel: 0.9, roul: 4 },
  ];
}

function planifierBatterie(m: Morceau, o: Occurrence, motif: MotifBatterie, sortie: Evenement[]) {
  const derniere = (o.section.mesures - 1) * 16;
  const coupure = o.section.coupure ?? 'aucune';
  const frappe = (pasGlobal: number, inst: InstrumentBatterie, vel: number, roul: number) => {
    const n = roul >= 2 ? roul : 1;
    for (let k = 0; k < n; k++) {
      const v = humaniser(vel * (k === 0 ? 1 : 0.8), pasGlobal, INSTRUMENTS.indexOf(inst), k);
      sortie.push({ type: 'frappe', t: pasVersSecondes(m, pasGlobal + k / n), instrument: inst, vel: v });
    }
  };
  for (let p = 0; p < o.pas; p++) {
    if (coupure === 'break' && p >= derniere) break; // dernière mesure sans batterie
    if (coupure === 'drop' && p < 16) continue; // première mesure sans batterie
    const enFill = o.section.fill === true && p >= derniere + 8;
    const i = p % motif.pas;
    for (const inst of INSTRUMENTS) {
      if (enFill && (inst === 'snare' || inst === 'clap')) continue;
      const vel = motif.pistes[inst]?.[i] ?? 0;
      if (vel > 0) frappe(o.debutPas + p, inst, vel, motif.roulements?.[inst]?.[i] ?? 0);
    }
    if (enFill) for (const f of fill(m)) if (f.pas === p - derniere) frappe(o.debutPas + p, 'snare', f.vel, f.roul);
  }
}

/** Note MIDI de la fondamentale de la basse : la tonique entre E1 (28) et D#2 (39), le grave d'une 808. */
function midiBasse(m: Morceau): number {
  return 28 + ((hauteurTonique(m.tonalite.tonique) - 4 + 12) % 12);
}

/** Accord joué au pas `p` de la section (selon le motif d'accords), ou null. */
function accordAuPas(motif: MotifAccords | undefined, p: number): string | null {
  if (!motif) return null;
  const i = p % motif.pas;
  const a = motif.accords.find((x) => i >= x.pas && i < x.pas + x.duree);
  return a ? a.degre : null;
}

function planifierBasse(m: Morceau, o: Occurrence, motif: MotifBasse, accords: MotifAccords | undefined, sortie: Evenement[]) {
  const mode = m.tonalite.mode;
  const base = midiBasse(m);
  const notes: { debut: number; fin: number; midi: number; glisse: boolean; vel: number }[] = [];
  for (let cycle = 0; cycle * motif.pas < o.pas; cycle++) {
    for (const n of motif.notes) {
      const debut = cycle * motif.pas + n.pas;
      if (debut >= o.pas) break;
      if (o.section.coupure === 'drop' && debut < 16) continue;
      let racine = base;
      let demiTons = demiTonsDegre(mode, n.degre);
      const lu = motif.suitAccords ? lireDegre(accordAuPas(accords, debut) ?? '') : null;
      if (lu) {
        // La basse suit l'accord : on part de sa fondamentale et on monte de `degre` notes dans la gamme.
        racine = base + fondamentale(mode, lu);
        if (racine > 40) racine -= 12;
        demiTons = demiTonsDegre(mode, lu.degre + n.degre) - demiTonsDegre(mode, lu.degre);
      }
      const fin = Math.min(debut + n.duree, o.pas);
      notes.push({ debut, fin, midi: racine + demiTons + 12 * (n.octave ?? 0), glisse: n.glisse === true, vel: n.vel ?? 1 });
    }
  }
  notes.forEach((n, k) => {
    const t = pasVersSecondes(m, o.debutPas + n.debut);
    const suivante = notes[k + 1];
    const ev: Evenement = { type: 'basse', t, duree: pasVersSecondes(m, o.debutPas + n.fin) - t, midi: n.midi, vel: n.vel };
    if (n.glisse && suivante && suivante.midi !== n.midi) ev.cible = suivante.midi;
    sortie.push(ev);
  });
}

function planifierAccords(m: Morceau, o: Occurrence, motif: MotifAccords, sortie: Evenement[]) {
  const voicings = voicingsSuite(m.tonalite.tonique, m.tonalite.mode, motif.accords.map((a) => a.degre));
  for (let cycle = 0; cycle * motif.pas < o.pas; cycle++) {
    motif.accords.forEach((a, k) => {
      const debut = cycle * motif.pas + a.pas;
      if (debut >= o.pas) return;
      const fin = Math.min(debut + a.duree, o.pas);
      const t = pasVersSecondes(m, o.debutPas + debut);
      const notes = voicings[k] ?? [];
      if (notes.length > 0) sortie.push({ type: 'accord', t, duree: pasVersSecondes(m, o.debutPas + fin) - t, notes, son: motif.son ?? 'piano', vel: 0.8 });
    });
  }
}

/** Mélodie : le motif (1 à 4 mesures) se répète sur la section ; une note est coupée à la fin de la section. */
function planifierMelodie(m: Morceau, o: Occurrence, motif: MotifMelodie, sortie: Evenement[]) {
  for (let cycle = 0; cycle * motif.pas < o.pas; cycle++) {
    for (const n of motif.notes) {
      const debut = cycle * motif.pas + n.pas;
      if (debut >= o.pas) break;
      const fin = Math.min(debut + Math.max(1, n.duree), cycle * motif.pas + motif.pas, o.pas);
      const t = pasVersSecondes(m, o.debutPas + debut);
      const duree = pasVersSecondes(m, o.debutPas + fin) - t;
      sortie.push({ type: 'note', t, duree, midi: n.midi, son: motif.son, vel: GAIN_NOTE * (n.vel ?? 1) });
    }
  }
}

/** Boucle d'un son importé : relancée au début de la section, puis toutes les `mesures` mesures. */
function planifierBoucle(m: Morceau, o: Occurrence, b: NonNullable<Section['boucle']>, sortie: Evenement[]) {
  const longueur = b.mesures * 16;
  for (let debut = 0; debut < o.pas; debut += longueur) {
    const t = pasVersSecondes(m, o.debutPas + debut);
    const duree = pasVersSecondes(m, o.debutPas + Math.min(debut + longueur, o.pas)) - t;
    sortie.push({ type: 'boucle', t, duree, son: b.son, mesures: b.mesures, caler: b.caler });
  }
}

/** Tout le planning du morceau, trié par temps. */
export function calculerPlanning(morceau: Morceau): Evenement[] {
  const sortie: Evenement[] = [];
  for (const o of arrangement(morceau)) {
    const ids = o.section.motifs;
    const bat = ids.batterie ? morceau.motifs[ids.batterie] : undefined;
    const basse = ids.basse ? morceau.motifs[ids.basse] : undefined;
    const acc = ids.accords ? morceau.motifs[ids.accords] : undefined;
    const mel = ids.melodie ? morceau.motifs[ids.melodie] : undefined;
    const accords = acc?.type === 'accords' ? acc : undefined;
    if (bat?.type === 'batterie') planifierBatterie(morceau, o, bat, sortie);
    else if (o.section.fill) planifierBatterie(morceau, o, { type: 'batterie', pas: 16, pistes: {} }, sortie);
    if (basse?.type === 'basse') planifierBasse(morceau, o, basse, accords, sortie);
    if (accords) planifierAccords(morceau, o, accords, sortie);
    if (mel?.type === 'melodie') planifierMelodie(morceau, o, mel, sortie);
    if (o.section.boucle && o.section.boucle.mesures > 0) planifierBoucle(morceau, o, o.section.boucle, sortie);
  }
  return sortie.sort((a, b) => a.t - b.t);
}

/** Les événements qui commencent dans [de, a[ (recherche par dichotomie dans un planning trié). */
export function evenementsEntre(planning: Evenement[], de: number, a: number): Evenement[] {
  let bas = 0;
  let haut = planning.length;
  while (bas < haut) {
    const milieu = (bas + haut) >> 1;
    if (planning[milieu]!.t < de) bas = milieu + 1;
    else haut = milieu;
  }
  const liste: Evenement[] = [];
  for (let i = bas; i < planning.length && planning[i]!.t < a; i++) liste.push(planning[i]!);
  return liste;
}
