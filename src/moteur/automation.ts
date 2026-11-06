// Automation et LFO (propriétaire : M2, vague C1). Règles (décisions v2 §3) : courbes d'AudioParam ; phase des LFO
// calée sur le TEMPS DU MORCEAU (un saut à l'écoute donne le même son qu'à l'export) ; fader, sidechain et
// automation agissent sur des gains SÉPARÉS (effets/tranche.ts).
// Une cible bouge par sa courbe (points PAR SECTION, interpolés, « palier » = marche) puis par ses LFO (ajoutés,
// profondeur = part de la plage). Le temps en pas est linéaire (sans swing) : pas = t / dureePas(tempo).
// La programmation passe par effets/programme.ts : points sur une grille de 10 ms (plus les marches), rampes.

import { pisteDe } from '../morceau/acces';
import { arrangement, dureePas } from '../morceau/temps';
import { PARAMS_EFFETS, type Cible, type Lfo, type Morceau, type Piste, type PointCourbe, type ReglageParam } from '../morceau/types';
import { programmerParam, sourceGrille, type SourceAuto } from './effets/programme';
import { hasardFixe } from './planning';

export const memeCible = (a: Cible, b: Cible): boolean =>
  a.type === b.type && (a.type !== 'insert' || (b.type === 'insert' && a.insert === b.insert && a.param === b.param));

/** La cible d'une clé de paramètre (« volume », « pan », « hauteur », « <idInsert>.<param> »). */
export function cibleDeCle(cle: string): Cible | null {
  if (cle === 'volume' || cle === 'pan' || cle === 'hauteur') return { type: cle };
  const i = cle.indexOf('.');
  return i > 0 ? { type: 'insert', insert: cle.slice(0, i), param: cle.slice(i + 1) } : null;
}

function reglageDe(piste: Piste, cible: Cible): { r: ReglageParam; actuel: number } | null {
  if (cible.type !== 'insert') return null;
  const ins = piste.inserts?.find((x) => x.id === cible.insert);
  const r = ins && Object.hasOwn(PARAMS_EFFETS[ins.type], cible.param) ? PARAMS_EFFETS[ins.type][cible.param] : undefined;
  if (!ins || !r) return null;
  const v = Object.hasOwn(ins.params, cible.param) ? ins.params[cible.param]! : r.defaut;
  return { r, actuel: v };
}

/** Valeur réelle → normalisée (0 à 1) d'un réglage (échelle log si `log`). */
export function versNormalise(r: ReglageParam, x: number): number {
  const v = r.log ? Math.log(x / r.min) / Math.log(r.max / r.min) : (x - r.min) / (r.max - r.min);
  return Math.min(1, Math.max(0, v));
}

/** Valeur normalisée → réelle d'un réglage. */
export function versReel(r: ReglageParam, v: number): number {
  const u = Math.min(1, Math.max(0, v));
  const x = r.log ? r.min * Math.pow(r.max / r.min, u) : r.min + u * (r.max - r.min);
  return r.entier ? Math.round(x) : x;
}

/** Valeur normalisée d'une cible sans courbe ni LFO : 1 (volume), 0,5 (pan, hauteur), le réglage de l'insert. */
export function neutre(piste: Piste, cible: Cible): number {
  if (cible.type === 'volume') return 1;
  if (cible.type !== 'insert') return 0.5;
  const x = reglageDe(piste, cible);
  return x ? versNormalise(x.r, x.actuel) : 0.5;
}

/** Valeur réelle d'une cible (gain, pan, demi-tons, réglage d'insert en log si `log`) depuis sa valeur normalisée. Pure. */
export function valeurReelle(piste: Piste, cible: Cible, v: number): number {
  const u = Math.min(1, Math.max(0, v));
  if (cible.type === 'volume') return u;
  if (cible.type === 'pan') return Math.min(1, Math.max(-1, piste.pan + (u - 0.5) * 2));
  if (cible.type === 'hauteur') return (u - 0.5) * 24;
  const x = reglageDe(piste, cible);
  return x ? versReel(x.r, u) : u;
}

/** Forme d'un LFO (−1 à 1) à la phase φ (en périodes). « hasard » : une valeur fixe par période (graine = n° de LFO). */
export function formeLfo(lfo: Lfo, phi: number, graine: number): number {
  const k = Math.floor(phi);
  const x = phi - k;
  switch (lfo.forme) {
    case 'sinus':
      return Math.sin(2 * Math.PI * x);
    case 'triangle':
      return x < 0.25 ? 4 * x : x < 0.75 ? 2 - 4 * x : 4 * x - 4;
    case 'carre':
      return x < 0.5 ? 1 : -1;
    case 'scie':
      return 2 * x - 1;
    default:
      return 2 * hasardFixe(k, graine, 7) - 1;
  }
}

/** Ce qui fait bouger une cible : valeur normalisée au temps t (gauche = limite à gauche) et marches de la courbe. */
export interface Mouvement {
  f(t: number, gauche?: boolean): number;
  ruptures(de: number, a: number): number[];
}

const mouvements = new WeakMap<Morceau, Map<string, Mouvement | null>>();

/** Le mouvement d'une cible d'une piste (null si ni courbe ni LFO ne la vise). Gardé par morceau. */
export function mouvement(m: Morceau, piste: Piste, cible: Cible): Mouvement | null {
  let cache = mouvements.get(m);
  if (!cache) mouvements.set(m, (cache = new Map()));
  const cle = `${piste.id}|${JSON.stringify(cible)}`;
  if (cache.has(cle)) return cache.get(cle)!;
  const courbe = piste.auto?.find((c) => memeCible(c.cible, cible));
  const lfos = (piste.lfo ?? []).map((l, i) => ({ l, i })).filter((x) => memeCible(x.l.cible, cible));
  let mv: Mouvement | null = null;
  if (courbe || lfos.length > 0) {
    const dp = dureePas(m.tempo);
    const repos = neutre(piste, cible);
    const occ = arrangement(m).map((o) => ({
      debut: o.debutPas * dp,
      fin: (o.debutPas + o.pas) * dp,
      pas: o.pas,
      points: courbe && Object.hasOwn(courbe.sections, o.section.id) ? courbe.sections[o.section.id]! : [],
    }));
    const dansSection = (pts: PointCourbe[], x: number, gauche: boolean): number => {
      if (pts.length === 0) return repos;
      let i = -1;
      for (let k = 0; k < pts.length && (gauche ? pts[k]!.pas < x : pts[k]!.pas <= x); k++) i = k;
      if (i < 0) return pts[0]!.valeur;
      const p = pts[i]!;
      const q = pts[i + 1];
      if (!q || p.forme === 'palier') return p.valeur;
      return p.valeur + ((q.valeur - p.valeur) * (x - p.pas)) / (q.pas - p.pas);
    };
    const indice = (t: number, gauche: boolean): number => {
      let bas = 0;
      let haut = occ.length;
      while (bas < haut) {
        const k = (bas + haut) >> 1;
        if (gauche ? occ[k]!.debut < t : occ[k]!.debut <= t) bas = k + 1;
        else haut = k;
      }
      return bas - 1;
    };
    const base = (t: number, gauche: boolean): number => {
      if (!courbe) return repos;
      const k = indice(t, gauche);
      const o = occ[Math.max(0, k)];
      if (!o) return repos;
      return dansSection(o.points, Math.min(o.pas, Math.max(0, t - o.debut) / dp), gauche);
    };
    const graine = (i: number) => (i + 1) * 7919 + (cible.type === 'insert' ? cible.insert.length * 31 + cible.param.length : cible.type.length);
    mv = {
      f(t, gauche = false) {
        let v = base(t, gauche);
        for (const { l, i } of lfos) v += 0.5 * l.profondeur * formeLfo(l, l.phase + t / dp / l.periode, graine(i));
        return Math.min(1, Math.max(0, v));
      },
      ruptures(de, a) {
        if (!courbe) return [];
        const out: number[] = [];
        for (let k = 0; k < occ.length; k++) {
          const o = occ[k]!;
          if (o.debut > a) break;
          if (o.fin <= de) continue;
          if (k > 0 && o.debut > de && base(o.debut, true) !== base(o.debut, false)) out.push(o.debut);
          o.points.forEach((p, i) => {
            const q = o.points[i + 1];
            const t = q ? o.debut + q.pas * dp : NaN;
            if (q && p.forme === 'palier' && q.valeur !== p.valeur && t > de && t <= a && t < o.fin) out.push(t);
          });
        }
        return out;
      },
    };
  }
  cache.set(cle, mv);
  return mv;
}

/**
 * Valeur NORMALISÉE (0 à 1, voir Cible) d'une cible d'une piste au temps `t` (s) du morceau : courbe de la section
 * jouée à cet instant (interpolée, « palier » respecté), puis LFO. null si rien ne vise cette cible. Pure.
 */
export function valeurCible(m: Morceau, idPiste: string, cible: Cible, t: number): number | null {
  const piste = pisteDe(m, idPiste);
  const mv = piste ? mouvement(m, piste, cible) : null;
  return mv ? mv.f(t) : null;
}

/** Convertisseurs propres à certains AudioParam (Q en dB d'un filtre…), posés par les inserts. Défaut : la valeur réelle. */
export const convertisseurs = new WeakMap<AudioParam, (reel: number) => number>();

/** Valeur posée sur l'AudioParam d'une clé (gain d'automation, décalage de pan, cents, réglage converti). */
function versParam(piste: Piste, cible: Cible, param: AudioParam, v: number): number {
  if (cible.type === 'volume') return v;
  if (cible.type === 'pan') return (v - 0.5) * 2;
  if (cible.type === 'hauteur') return (v - 0.5) * 2400;
  const reel = valeurReelle(piste, cible, v);
  return convertisseurs.get(param)?.(reel) ?? reel;
}

const sourcesParParam = new WeakMap<AudioParam, { m: Morceau; source: SourceAuto | null }>();

/**
 * Programme l'automation et les LFO de la piste sur ses AudioParam pour [de, a[ (s du morceau ; `origine` = heure du
 * contexte du temps 0). Appelé à chaque planification, à l'écoute comme à l'export (tranche de la piste).
 * Clés : « volume » (gain d'automation), « pan » (décalage ajouté au pan), « hauteur » (cents), « <idInsert>.<param> ».
 */
export function programmerAutomation(m: Morceau, idPiste: string, params: Map<string, AudioParam>, de: number, a: number, origine: number): void {
  const piste = pisteDe(m, idPiste);
  if (!piste) return;
  for (const [cle, param] of params) {
    let s = sourcesParParam.get(param);
    if (!s || s.m !== m) {
      const cible = cibleDeCle(cle);
      const mv = cible ? mouvement(m, piste, cible) : null;
      const source = cible && mv ? sourceGrille((t, g) => versParam(piste, cible, param, mv.f(t, g)), (x, y) => mv.ruptures(x, y)) : null;
      sourcesParParam.set(param, (s = { m, source }));
    }
    if (s.source) programmerParam(param, s.source, de, a, origine);
  }
}
