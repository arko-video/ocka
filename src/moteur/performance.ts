// Effets de performance façon Gross Beat (R) : stutter, demi-tempo, tape stop, gate, reverse, sur un passage d'une
// section (Section.perf). Calculés HORS LIGNE : le passage des pistes touchées est rendu (rendrePistesSeparees,
// gels.ts), l'effet est appliqué dans le Worker de synthèse (travail « perf » → effets-perf.ts), puis le résultat
// remplace le passage (Gel). Les rendus sont gardés en mémoire (même clé = même PCM) : l'écoute et l'export jouent
// les MÊMES échantillons. Écoute : ce qui manque est calculé en tâche de fond (un passage à la fois), puis
// prevenirGels() fait recharger le lecteur.

import {
  GRILLE_PAS,
  DIVISIONS_PERF,
  PLAFONDS,
  TYPES_PERF,
  type EffetPerf,
  type Morceau,
  type Section,
} from '../morceau/types';
import { ErreurOcka } from './erreur';
import { prevenirGels, rendrePistesSeparees, type Gel, type OptionsGels } from './gels';
import { passagesPerf, type Passage } from './perf/passages';
import { commander } from './synthese/atelier';
import type { PcmSon } from './types-moteur';

/* ------------------------------------------------------------ cache des passages rendus */

type Rendu = Map<string, PcmSon>;
const prets = new Map<string, Rendu>();
const enCours = new Map<string, Promise<Rendu>>();
const echecs = new Set<string>();
const file: Passage[] = [];
let fondOccupe = false;
/** Échantillons gardés au plus (tous canaux) : ~32 Mo. Les plus anciens partent d'abord. */
const ECHANTILLONS_MAX = 8_000_000;

/** Statistiques (tests). */
export const statsPerf = { rendus: 0, depuisCache: 0 };

function taille(r: Rendu): number {
  let n = 0;
  for (const p of r.values()) for (const c of p.canaux) n += c.length;
  return n;
}

function garder(cle: string, r: Rendu) {
  prets.set(cle, r);
  let total = 0;
  for (const x of prets.values()) total += taille(x);
  for (const [k, x] of prets) {
    if (total <= ECHANTILLONS_MAX || k === cle) break;
    total -= taille(x);
    prets.delete(k);
  }
}

/** Oublie tous les rendus (tests, mémoire). */
export function viderCachePerf() {
  prets.clear();
  echecs.clear();
}

async function calculer(m: Morceau, p: Passage, frequence: number, signal?: AbortSignal): Promise<Rendu> {
  // rendrePistesSeparees rend depuis p.de (0,5 s de marge avant) : le PCM commence pile à p.de.
  const bruts = await rendrePistesSeparees(m, p.pistes, p.de, p.a, frequence, signal);
  const n = Math.max(1, Math.round((p.a - p.de) * frequence));
  const rendu: Rendu = new Map();
  await Promise.all(
    [...bruts].map(async ([id, pcm]) => {
      const canaux = pcm.canaux.map((c) => {
        const x = new Float32Array(n);
        x.set(c.subarray(0, n));
        return x;
      });
      const r = await commander(
        { type: 'perf', canaux, effet: p.effet, secondesParPas: p.secondesParPas },
        frequence,
        Math.max(0, p.de),
      ).promesse;
      rendu.set(id, { frequence, canaux: r.canaux });
    }),
  );
  statsPerf.rendus++;
  return rendu;
}

function obtenir(m: Morceau, p: Passage, frequence: number, signal?: AbortSignal): Promise<Rendu> {
  const pret = prets.get(p.cle);
  if (pret) return (statsPerf.depuisCache++, Promise.resolve(pret));
  let e = enCours.get(p.cle);
  if (!e) {
    e = calculer(m, p, frequence, signal).then(
      (r) => (enCours.delete(p.cle), garder(p.cle, r), r),
      (err: unknown) => {
        enCours.delete(p.cle);
        if (!(err instanceof ErreurOcka && err.code === 'annule')) echecs.add(p.cle);
        throw err;
      },
    );
    enCours.set(p.cle, e);
  }
  return e;
}

/** Tâche de fond de l'écoute : un passage à la fois, puis prevenirGels(). */
function enFond(m: Morceau, frequence: number) {
  if (fondOccupe) return;
  const p = file.shift();
  if (!p) return;
  fondOccupe = true;
  obtenir(m, p, frequence)
    .then(() => prevenirGels())
    .catch((e: unknown) => console.warn('Effet de performance non calculé :', e))
    .finally(() => {
      fondOccupe = false;
      enFond(m, frequence);
    });
}

const versGels = (p: Passage, r: Rendu): Gel[] =>
  p.pistes.flatMap((piste) => {
    const pcm = r.get(piste);
    return pcm ? [{ piste, de: p.de, a: p.a, pcm, cle: `${p.cle}|${piste}` }] : [];
  });

/**
 * Fournisseur de gels (gels.ts) : un Gel par (apparition de section avec `perf`, piste touchée). Rendu mis en cache
 * (même passage, mêmes réglages → même clé) ; écoute (`attendre` false) : seulement ce qui est prêt, le reste part
 * en tâche de fond puis prevenirGels(). Pistes touchées : EffetPerf.pistes, sinon toutes sauf la voix.
 */
export async function gelsPerformance(m: Morceau, o: OptionsGels): Promise<Gel[]> {
  const passages = passagesPerf(m, o.frequence);
  const gels: Gel[] = [];
  if (o.attendre) {
    for (const p of passages) gels.push(...versGels(p, await obtenir(m, p, o.frequence, o.signal)));
    return gels;
  }
  file.length = 0;
  for (const p of passages) {
    const r = prets.get(p.cle);
    if (r) gels.push(...versGels(p, r));
    else if (!echecs.has(p.cle) && !enCours.has(p.cle)) file.push(p);
  }
  enFond(m, o.frequence);
  return gels;
}

/* ------------------------------------------------------------ édition (pure) */

const auPas = (x: number) => Math.round(x * GRILLE_PAS) / GRILLE_PAS;

/** Un effet remis dans les règles du format pour cette section (null s'il ne peut pas y tenir). */
function effetValide(m: Morceau, s: Section, e: EffetPerf): EffetPerf | null {
  if (!(TYPES_PERF as readonly string[]).includes(e.type)) return null;
  const longueur = s.mesures * 16;
  const pas = Math.min(Math.max(0, auPas(Number.isFinite(e.pas) ? e.pas : 0)), longueur - 1);
  const duree = Math.min(Math.max(1, auPas(Number.isFinite(e.duree) ? e.duree : 4)), longueur - pas);
  const out: EffetPerf = { type: e.type, pas, duree };
  if (e.type === 'stutter' || e.type === 'gate') {
    const x = e.division ?? 4;
    out.division = DIVISIONS_PERF.reduce((a, d) => (Math.abs(d - x) < Math.abs(a - x) ? d : a));
  }
  const pistes = [...new Set((e.pistes ?? []).filter((id) => m.pistes.some((p) => p.id === id)))];
  if (pistes.length > 0) out.pistes = pistes;
  return out;
}

function avecPerf(
  m: Morceau,
  idSection: string,
  fn: (perf: EffetPerf[], s: Section) => EffetPerf[] | null,
): Morceau {
  const i = m.sections.findIndex((s) => s.id === idSection);
  if (i < 0) return m;
  const s = m.sections[i]!;
  const perf = fn(s.perf ?? [], s);
  if (!perf || JSON.stringify(perf) === JSON.stringify(s.perf ?? [])) return m;
  const { perf: _avant, ...reste } = s;
  const neuve: Section = perf.length > 0 ? { ...reste, perf } : reste;
  const sections = [...m.sections];
  sections[i] = neuve;
  return { ...m, sections };
}

/** Ajoute un effet à une section (8 au plus ; pas et durée au 1/24, dans la section). Même objet si impossible. */
export function ajouterEffetPerf(m: Morceau, idSection: string, effet: EffetPerf): Morceau {
  return avecPerf(m, idSection, (perf, s) => {
    const e = effetValide(m, s, effet);
    return e && perf.length < PLAFONDS.perfParSection ? [...perf, e] : null;
  });
}

export function reglerEffetPerf(m: Morceau, idSection: string, index: number, effet: EffetPerf): Morceau {
  return avecPerf(m, idSection, (perf, s) => {
    const e = effetValide(m, s, effet);
    if (!e || index < 0 || index >= perf.length) return null;
    return perf.map((x, i) => (i === index ? e : x));
  });
}

export function retirerEffetPerf(m: Morceau, idSection: string, index: number): Morceau {
  return avecPerf(m, idSection, (perf) =>
    index < 0 || index >= perf.length ? null : perf.filter((_, i) => i !== index),
  );
}
