// Édition pure des motifs de batterie : cases (fort → doux → vide), roulements, « Varier ».
// Le morceau n'est jamais modifié : chaque fonction renvoie un nouveau morceau (ou le même si rien ne change).

import type { InstrumentBatterie, Morceau, MotifBatterie } from '../../morceau/types';
import { varier } from '../../morceau/varier';

export const INSTRUMENTS: InstrumentBatterie[] = [
  'kick',
  'snare',
  'clap',
  'charley',
  'charleyOuvert',
  'rim',
  'cowbell',
  'perc',
];
export const VEL_FORT = 1;
export const VEL_DOUX = 0.5;
export const ROULEMENTS = [0, 2, 3, 4, 6] as const;
export type Roulement = (typeof ROULEMENTS)[number];

export function motifBatterie(m: Morceau, id: string): MotifBatterie | null {
  const x = m.motifs[id];
  return x && x.type === 'batterie' ? x : null;
}

/** Ids des motifs de batterie, dans l'ordre où l'arrangement les utilise (les inutilisés à la fin). */
export function motifsBatterie(m: Morceau): string[] {
  const ids: string[] = [];
  for (const idSection of m.ordre) {
    const id = m.sections.find((s) => s.id === idSection)?.motifs.batterie;
    if (id && motifBatterie(m, id) && !ids.includes(id)) ids.push(id);
  }
  for (const id of Object.keys(m.motifs)) if (motifBatterie(m, id) && !ids.includes(id)) ids.push(id);
  return ids;
}

const NOMS_CONNUS = ['intro', 'couplet', 'refrain', 'pont', 'outro'];

/** Nom lisible d'un motif : « bat-pont » → « Pont », sinon les noms des sections qui l'utilisent, sinon son id. */
export function nomMotif(m: Morceau, id: string): string {
  const suffixe = id.split(/[-_.:]/).pop()?.toLowerCase() ?? '';
  if (NOMS_CONNUS.includes(suffixe)) return suffixe.charAt(0).toUpperCase() + suffixe.slice(1);
  const noms = [...new Set(m.sections.filter((s) => Object.values(s.motifs).includes(id)).map((s) => s.nom))];
  if (noms.length) return noms.join(' / ');
  const fin = id.split(/[-_.:]/).pop() || id;
  return fin.charAt(0).toUpperCase() + fin.slice(1);
}

/** Ligne de vélocités d'un instrument, toujours de la longueur du motif. */
export function ligne(motif: MotifBatterie, inst: InstrumentBatterie): number[] {
  const l = motif.pistes[inst] ?? [];
  return Array.from({ length: motif.pas }, (_, i) => l[i] ?? 0);
}

export function ligneRoulements(motif: MotifBatterie, inst: InstrumentBatterie): number[] {
  const l = motif.roulements?.[inst] ?? [];
  return Array.from({ length: motif.pas }, (_, i) => l[i] ?? 0);
}

/** Fort → doux → vide → fort. */
export function prochaineVelocite(v: number): number {
  if (v <= 0) return VEL_FORT;
  if (v > 0.7) return VEL_DOUX;
  return 0;
}

export function etatCase(v: number): 'fort' | 'doux' | 'vide' {
  if (v <= 0) return 'vide';
  return v > 0.7 ? 'fort' : 'doux';
}

function avecMotif(m: Morceau, id: string, motif: MotifBatterie): Morceau {
  return { ...m, motifs: { ...m.motifs, [id]: motif } };
}

function ecrire(motif: MotifBatterie, inst: InstrumentBatterie, vels: number[], rouls: number[]): MotifBatterie {
  const pistes = { ...motif.pistes, [inst]: vels };
  const aRoulements = rouls.some((r) => r > 0) || motif.roulements?.[inst] !== undefined;
  if (!aRoulements) return { ...motif, pistes };
  return { ...motif, pistes, roulements: { ...motif.roulements, [inst]: rouls } };
}

/** Un appui sur une case : fort → doux → vide (le roulement est retiré quand la case se vide). */
export function basculerPas(m: Morceau, idMotif: string, inst: InstrumentBatterie, pas: number): Morceau {
  const motif = motifBatterie(m, idMotif);
  if (!motif || pas < 0 || pas >= motif.pas) return m;
  const vels = ligne(motif, inst);
  const rouls = ligneRoulements(motif, inst);
  vels[pas] = prochaineVelocite(vels[pas]!);
  if (vels[pas] === 0) rouls[pas] = 0;
  return avecMotif(m, idMotif, ecrire(motif, inst, vels, rouls));
}

/** Règle le roulement d'une case (0 = frappe simple). Une case vide devient forte. */
export function reglerRoulement(
  m: Morceau,
  idMotif: string,
  inst: InstrumentBatterie,
  pas: number,
  n: Roulement,
): Morceau {
  const motif = motifBatterie(m, idMotif);
  if (!motif || pas < 0 || pas >= motif.pas || !ROULEMENTS.includes(n)) return m;
  const vels = ligne(motif, inst);
  const rouls = ligneRoulements(motif, inst);
  if (rouls[pas] === n && vels[pas]! > 0) return m;
  rouls[pas] = n;
  if (vels[pas] === 0) vels[pas] = VEL_FORT;
  return avecMotif(m, idMotif, ecrire(motif, inst, vels, rouls));
}

/**
 * « Varier » : variante du motif calculée par le moteur (src/morceau/varier.ts), reproductible pour une graine.
 * L'ossature reste (kick du 1er pas, caisse claire principale) ; les détails changent.
 */
export function varierMotif(m: Morceau, idMotif: string, graine: number): Morceau {
  const motif = motifBatterie(m, idMotif);
  if (!motif) return m;
  const nouveau = varier(motif, graine);
  return JSON.stringify(nouveau) === JSON.stringify(motif) ? m : avecMotif(m, idMotif, nouveau);
}
