// Édition pure de l'automation (points par section) et des LFO — propriétaire : U2, vague C1.
// Signatures figées dans api-edition.ts. Règles : 8 courbes et 64 points par section au plus, points sur la grille
// du 1/24 de pas, dans [0, longueur de la section], triés, un seul point par pas ; valeurs normalisées 0 à 1 (voir
// Cible), 2 LFO au plus ; une cible doit exister (insert et réglage connus, hauteur : piste instrument) ; jamais de mutation.

import { estPisteInstrument, pisteDe, sectionDe } from '../../morceau/acces';
import { FORMES_LFO, GRILLE_PAS, PARAMS_EFFETS, PLAFONDS, type Cible, type Courbe, type Lfo, type Morceau, type Piste, type PointCourbe } from '../../morceau/types';
import { avecPiste } from './mixage';

const borner = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const arrondir = (x: number) => Math.round(x * 1000) / 1000;

/** Même cible (type, et pour un insert : même effet et même réglage). */
export function memeCible(a: Cible, b: Cible): boolean {
  if (a.type !== b.type) return false;
  return a.type !== 'insert' || (b.type === 'insert' && a.insert === b.insert && a.param === b.param);
}

/** Clé texte d'une cible (« volume », « insert:saturation:force ») pour les listes et les testid. */
export function cleCible(c: Cible): string {
  return c.type === 'insert' ? `insert:${c.insert}:${c.param}` : c.type;
}

/** true si la cible existe sur cette piste. */
export function cibleValide(p: Piste, c: Cible): boolean {
  if (c.type === 'volume' || c.type === 'pan') return true;
  if (c.type === 'hauteur') return estPisteInstrument(p);
  const x = p.inserts?.find((i) => i.id === c.insert);
  return !!x && Object.hasOwn(PARAMS_EFFETS[x.type], c.param);
}

/** Les cibles possibles d'une piste : volume, pan, (hauteur), puis chaque réglage de chaque effet. */
export function ciblesPossibles(p: Piste): Cible[] {
  const l: Cible[] = [{ type: 'volume' }, { type: 'pan' }];
  if (estPisteInstrument(p)) l.push({ type: 'hauteur' });
  for (const x of p.inserts ?? []) for (const param of Object.keys(PARAMS_EFFETS[x.type])) l.push({ type: 'insert', insert: x.id, param });
  return l;
}

/** Valeur neutre d'une cible (quand rien ne la vise) : volume 1, pan et hauteur 0,5, réglage d'effet : sa valeur. */
export function valeurNeutre(p: Piste, c: Cible): number {
  if (c.type === 'volume') return 1;
  if (c.type !== 'insert') return 0.5;
  const x = p.inserts?.find((i) => i.id === c.insert);
  const r = x ? PARAMS_EFFETS[x.type][c.param] : undefined;
  if (!x || !r) return 0.5;
  const v = Object.hasOwn(x.params, c.param) ? x.params[c.param]! : r.defaut;
  if (r.log && r.min > 0) return borner(Math.log(v / r.min) / Math.log(r.max / r.min), 0, 1);
  return borner((v - r.min) / (r.max - r.min), 0, 1);
}

/** Points d'une cible dans une section ([] si aucun). */
export function pointsDe(m: Morceau, idPiste: string, cible: Cible, idSection: string): PointCourbe[] {
  const c = pisteDe(m, idPiste)?.auto?.find((x) => memeCible(x.cible, cible));
  return c && Object.hasOwn(c.sections, idSection) ? c.sections[idSection]! : [];
}

/**
 * Valeur d'une suite de points au pas `pas` (ligne droite ou palier vers le suivant ; avant le 1er point : sa valeur,
 * après le dernier : la sienne). null s'il n'y a aucun point. Pour dessiner les couloirs.
 */
export function valeurAuPas(points: readonly PointCourbe[], pas: number): number | null {
  if (points.length === 0) return null;
  if (pas <= points[0]!.pas) return points[0]!.valeur;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (pas > b.pas) continue;
    if (a.forme === 'palier' || b.pas === a.pas) return pas < b.pas ? a.valeur : b.valeur;
    return a.valeur + ((b.valeur - a.valeur) * (pas - a.pas)) / (b.pas - a.pas);
  }
  return points[points.length - 1]!.valeur;
}

/** Un point propre : pas sur la grille du 1/24 et dans [0, fin], valeur 0 à 1 (3 décimales). */
export function pointPropre(p: PointCourbe, fin: number): PointCourbe | null {
  if (!Number.isFinite(p.pas) || !Number.isFinite(p.valeur)) return null;
  const pas = borner(Math.round(borner(p.pas, 0, fin) * GRILLE_PAS) / GRILLE_PAS, 0, fin);
  const n: PointCourbe = { pas, valeur: arrondir(borner(p.valeur, 0, 1)) };
  if (p.forme === 'palier' || p.forme === 'ligne') n.forme = p.forme;
  return n;
}

/**
 * Applique `op` aux points d'une cible dans une section. `op` renvoie la nouvelle liste (ou la même pour « rien »).
 * Crée la courbe au besoin (8 au plus) ; retire la section vide, la courbe vide et `auto` vide.
 */
function avecPoints(m: Morceau, idPiste: string, cible: Cible, idSection: string, op: (pts: PointCourbe[], fin: number) => PointCourbe[]): Morceau {
  const s = sectionDe(m, idSection);
  if (!s) return m;
  const fin = s.mesures * 16;
  return avecPiste(m, idPiste, (p) => {
    if (!cibleValide(p, cible)) return p;
    const courbes = p.auto ?? [];
    const i = courbes.findIndex((c) => memeCible(c.cible, cible));
    const avant = i >= 0 && Object.hasOwn(courbes[i]!.sections, idSection) ? courbes[i]!.sections[idSection]! : [];
    const apres = op(avant, fin);
    if (apres === avant) return p;
    if (i < 0 && courbes.length >= PLAFONDS.courbes) return p;
    const sections = Object.create(null) as Record<string, PointCourbe[]>;
    if (i >= 0) for (const [k, v] of Object.entries(courbes[i]!.sections)) if (k !== idSection) sections[k] = v;
    if (apres.length > 0) sections[idSection] = apres;
    const courbe: Courbe = { cible: i >= 0 ? courbes[i]!.cible : copieCible(cible), sections };
    const vide = Object.keys(sections).length === 0;
    const auto = i < 0 ? [...courbes, courbe] : vide ? courbes.filter((_, k) => k !== i) : courbes.map((c, k) => (k === i ? courbe : c));
    const n = { ...p };
    if (auto.length > 0) n.auto = auto;
    else delete n.auto;
    return n;
  });
}

function copieCible(c: Cible): Cible {
  return c.type === 'insert' ? { type: 'insert', insert: c.insert, param: c.param } : { type: c.type };
}

/** Pose un point (au même pas qu'un point existant : il le remplace). 64 points au plus par section. */
export function poserPoint(m: Morceau, idPiste: string, cible: Cible, idSection: string, point: PointCourbe): Morceau {
  return avecPoints(m, idPiste, cible, idSection, (pts, fin) => {
    const n = pointPropre(point, fin);
    if (!n) return pts;
    const j = pts.findIndex((x) => x.pas === n.pas);
    if (j >= 0) return JSON.stringify(pts[j]) === JSON.stringify(n) ? pts : pts.map((x, k) => (k === j ? n : x));
    if (pts.length >= PLAFONDS.pointsParCourbe) return pts;
    return [...pts, n].sort((a, b) => a.pas - b.pas);
  });
}

/** Déplace le point n° `indice` (refusé s'il tomberait sur le pas d'un autre point). La liste reste triée. */
export function deplacerPoint(m: Morceau, idPiste: string, cible: Cible, idSection: string, indice: number, point: PointCourbe): Morceau {
  return avecPoints(m, idPiste, cible, idSection, (pts, fin) => {
    const a = pts[indice];
    const n = pointPropre({ forme: a?.forme, ...point }, fin);
    if (!a || !n) return pts;
    if (pts.some((x, k) => k !== indice && x.pas === n.pas)) return pts;
    if (n.pas === a.pas && n.valeur === a.valeur && n.forme === a.forme) return pts;
    return pts.map((x, k) => (k === indice ? n : x)).sort((x, y) => x.pas - y.pas);
  });
}

export function retirerPoint(m: Morceau, idPiste: string, cible: Cible, idSection: string, indice: number): Morceau {
  return avecPoints(m, idPiste, cible, idSection, (pts) => (indice >= 0 && indice < pts.length ? pts.filter((_, k) => k !== indice) : pts));
}

/** Efface la courbe d'une cible dans une section (ou partout si `idSection` est null). */
export function effacerCourbe(m: Morceau, idPiste: string, cible: Cible, idSection: string | null): Morceau {
  if (idSection !== null) return avecPoints(m, idPiste, cible, idSection, (pts) => (pts.length > 0 ? [] : pts));
  return avecPiste(m, idPiste, (p) => {
    const auto = p.auto ?? [];
    const reste = auto.filter((c) => !memeCible(c.cible, cible));
    if (reste.length === auto.length) return p;
    const n = { ...p };
    if (reste.length > 0) n.auto = reste;
    else delete n.auto;
    return n;
  });
}

/** Un LFO propre (cible vérifiée à part) : forme connue, période 0,25 à 256 pas, profondeur et phase 0 à 1. */
export function lfoPropre(l: Lfo): Lfo {
  const nombre = (x: number, d: number) => (Number.isFinite(x) ? x : d);
  return {
    cible: copieCible(l.cible),
    forme: (FORMES_LFO as readonly string[]).includes(l.forme) ? l.forme : 'sinus',
    periode: arrondir(borner(nombre(l.periode, 16), 0.25, 256)),
    profondeur: arrondir(borner(nombre(l.profondeur, 0.5), 0, 1)),
    phase: arrondir(borner(nombre(l.phase, 0), 0, 1)),
  };
}

/** Règle le LFO n° `indice` (0 ou 1 ; au-delà de la liste : ajouté à la fin), ou le retire (null). */
export function reglerLfo(m: Morceau, idPiste: string, indice: 0 | 1, lfo: Lfo | null): Morceau {
  return avecPiste(m, idPiste, (p) => {
    const liste = [...(p.lfo ?? [])];
    if (lfo === null) {
      if (indice >= liste.length) return p;
      liste.splice(indice, 1);
    } else {
      if (!cibleValide(p, lfo.cible)) return p;
      const n = lfoPropre(lfo);
      if (indice < liste.length) {
        if (JSON.stringify(liste[indice]) === JSON.stringify(n)) return p;
        liste[indice] = n;
      } else if (liste.length < PLAFONDS.lfo) liste.push(n);
      else return p;
    }
    const r = { ...p };
    if (liste.length > 0) r.lfo = liste;
    else delete r.lfo;
    return r;
  });
}
