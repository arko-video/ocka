// Édition pure du mélangeur (tranches : fader, M/S, inserts, sidechain) — propriétaire : U2, vague C1.
// Signatures figées dans api-edition.ts. Règles : toutes les pistes (fixes et instrument) ; 6 inserts au plus ;
// réglages bornés par PARAMS_EFFETS ; un insert retiré emporte ses courbes et LFO ; jamais de mutation ;
// même objet si rien ne change ; résultat accepté tel quel par le normaliseur.

import { pisteDe } from '../../morceau/acces';
import { insertParDefaut } from '../../moteur/api-effets';
import { ErreurOcka } from '../../moteur/erreur';
import { PARAMS_EFFETS, PLAFONDS, TYPES_EFFETS, type Insert, type Morceau, type Piste, type Sidechain, type Tranche, type TypeEffet } from '../../morceau/types';
import { idLibre } from './ids';

const borner = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const arrondir = (x: number) => Math.round(x * 1000) / 1000;
const dico = <T>() => Object.create(null) as Record<string, T>;

/** Remplace la piste `id` par `op(piste)` (même morceau si la piste manque ou si `op` la rend telle quelle). */
export function avecPiste(m: Morceau, id: string, op: (p: Piste) => Piste): Morceau {
  const p = pisteDe(m, id);
  if (!p) return m;
  const n = op(p);
  return n === p ? m : { ...m, pistes: m.pistes.map((x) => (x === p ? n : x)) };
}

/** Une valeur de réglage d'effet dans ses bornes (entier si besoin, 3 décimales comme le normaliseur). */
export function bornerParam(type: TypeEffet, cle: string, v: number): number | null {
  const r = Object.hasOwn(PARAMS_EFFETS[type], cle) ? PARAMS_EFFETS[type][cle] : undefined;
  if (!r || !Number.isFinite(v)) return null;
  const b = arrondir(borner(v, r.min, r.max));
  return r.entier ? Math.round(b) : b;
}

/** Un insert propre : type connu, params connus et bornés (dictionnaire sans prototype). null si le type est inconnu. */
export function insertPropre(x: Insert, id: string): Insert | null {
  if (!(TYPES_EFFETS as readonly string[]).includes(x.type)) return null;
  const params = dico<number>();
  for (const [k, v] of Object.entries(x.params ?? {})) {
    const b = bornerParam(x.type, k, v);
    if (b !== null) params[k] = b;
  }
  return { id, type: x.type, actif: x.actif !== false, params };
}

/** Insert neuf : celui de M2 (insertParDefaut) ; tant qu'il n'existe pas, les défauts de PARAMS_EFFETS. */
export function insertNeuf(type: TypeEffet, id: string): Insert {
  try {
    const x = insertParDefaut(type, id);
    const propre = insertPropre(x, id);
    if (propre) return propre;
  } catch (e) {
    if (!(e instanceof ErreurOcka && e.code === 'pas_encore')) throw e;
  }
  const params = dico<number>();
  for (const [k, r] of Object.entries(PARAMS_EFFETS[type])) params[k] = r.defaut;
  return { id, type, actif: true, params };
}

/** Valeur d'un réglage d'un insert (sa valeur, sinon le défaut). */
export function valeurParam(x: Insert, cle: string): number {
  if (Object.hasOwn(x.params, cle)) return x.params[cle]!;
  return PARAMS_EFFETS[x.type][cle]?.defaut ?? 0;
}

/** Retire de la tranche les courbes et LFO qui visent un insert absent de `inserts`. */
function sansCiblesOrphelines<P extends Tranche>(p: P, inserts: readonly Insert[]): P {
  const ids = new Set(inserts.map((x) => x.id));
  const vivante = (c: { cible: { type: string; insert?: string } }) => c.cible.type !== 'insert' || ids.has(c.cible.insert ?? '');
  const n = { ...p };
  if (p.auto) {
    const auto = p.auto.filter(vivante);
    if (auto.length > 0) n.auto = auto;
    else delete n.auto;
  }
  if (p.lfo) {
    const lfo = p.lfo.filter(vivante);
    if (lfo.length > 0) n.lfo = lfo;
    else delete n.lfo;
  }
  return n;
}

/** La tranche avec ces inserts (liste vide → champ retiré), courbes et LFO orphelins retirés. */
function avecInserts(p: Piste, inserts: Insert[]): Piste {
  const n = sansCiblesOrphelines({ ...p }, inserts);
  if (inserts.length > 0) n.inserts = inserts;
  else delete n.inserts;
  return n;
}

/* ------------------------------------------------------------ fader, M/S */

export function reglerTranche(m: Morceau, idPiste: string, c: Partial<Pick<Tranche, 'volume' | 'pan' | 'muet' | 'solo'>>): Morceau {
  return avecPiste(m, idPiste, (p) => {
    const n = { ...p };
    if (c.volume !== undefined && Number.isFinite(c.volume)) n.volume = Math.round(borner(c.volume, 0, 1.5) * 100) / 100;
    if (c.pan !== undefined && Number.isFinite(c.pan)) n.pan = Math.round(borner(c.pan, -1, 1) * 100) / 100;
    if (c.muet !== undefined) n.muet = !!c.muet;
    if (c.solo !== undefined) n.solo = !!c.solo;
    return n.volume === p.volume && n.pan === p.pan && n.muet === p.muet && n.solo === p.solo ? p : n;
  });
}

/* ------------------------------------------------------------ inserts */

/** Ajoute un effet en fin de chaîne (id libre dans la piste : « saturation », « saturation-2 »…). Rien au-delà de 6. */
export function ajouterInsert(m: Morceau, idPiste: string, type: TypeEffet): Morceau {
  if (!(TYPES_EFFETS as readonly string[]).includes(type)) return m;
  return avecPiste(m, idPiste, (p) => {
    const actuels = p.inserts ?? [];
    if (actuels.length >= PLAFONDS.inserts) return p;
    const id = idLibre(type, actuels.map((x) => x.id), 'fx');
    return { ...p, inserts: [...actuels, insertNeuf(type, id)] };
  });
}

/** Retire un effet, avec ses courbes d'automation et ses LFO. */
export function retirerInsert(m: Morceau, idPiste: string, idInsert: string): Morceau {
  return avecPiste(m, idPiste, (p) => {
    const actuels = p.inserts ?? [];
    if (!actuels.some((x) => x.id === idInsert)) return p;
    return avecInserts(p, actuels.filter((x) => x.id !== idInsert));
  });
}

/** Monte (−1) ou descend (+1) un effet dans la chaîne. */
export function deplacerInsert(m: Morceau, idPiste: string, idInsert: string, sens: -1 | 1): Morceau {
  return avecPiste(m, idPiste, (p) => {
    const inserts = [...(p.inserts ?? [])];
    const i = inserts.findIndex((x) => x.id === idInsert);
    const j = i + sens;
    if (i < 0 || j < 0 || j >= inserts.length) return p;
    [inserts[i], inserts[j]] = [inserts[j]!, inserts[i]!];
    return { ...p, inserts };
  });
}

/** Active/contourne un effet, ou change ses réglages (clés inconnues ignorées, valeurs bornées). */
export function reglerInsert(m: Morceau, idPiste: string, idInsert: string, c: { actif?: boolean; params?: Record<string, number> }): Morceau {
  return avecPiste(m, idPiste, (p) => {
    const x = p.inserts?.find((i) => i.id === idInsert);
    if (!x) return p;
    let change = false;
    const params = dico<number>();
    Object.assign(params, x.params);
    for (const [k, v] of Object.entries(c.params ?? {})) {
      const b = bornerParam(x.type, k, v);
      if (b === null || (Object.hasOwn(x.params, k) && x.params[k] === b)) continue;
      params[k] = b;
      change = true;
    }
    const actif = c.actif === undefined ? x.actif : !!c.actif;
    if (!change && actif === x.actif) return p;
    const n: Insert = { ...x, actif, params };
    return { ...p, inserts: p.inserts!.map((i) => (i === x ? n : i)) };
  });
}

/** Remplace toute la chaîne par un préréglage (6 effets au plus, ids rendus uniques, réglages bornés). */
export function appliquerPresetInserts(m: Morceau, idPiste: string, inserts: readonly Insert[]): Morceau {
  return avecPiste(m, idPiste, (p) => {
    const pris: string[] = [];
    const propres: Insert[] = [];
    for (const x of inserts) {
      if (propres.length >= PLAFONDS.inserts) break;
      const id = idLibre(x.id || x.type, pris, 'fx');
      const propre = insertPropre(x, id);
      if (!propre) continue;
      pris.push(id);
      propres.push(propre);
    }
    if (JSON.stringify(propres) === JSON.stringify(p.inserts ?? [])) return p;
    return avecInserts(p, propres);
  });
}

/* ------------------------------------------------------------ sidechain (« Pompe ») */

export const SIDECHAIN_DEFAUT: Sidechain = { source: 'kick', force: 0.5, relache: 0.15 };

/** « Pompe » sur le kick (null = retirée). Force 0 à 1, relâchement 0,02 à 0,6 s. */
export function reglerSidechain(m: Morceau, idPiste: string, sidechain: Sidechain | null): Morceau {
  return avecPiste(m, idPiste, (p) => {
    if (sidechain === null) {
      if (!p.sidechain) return p;
      const n = { ...p };
      delete n.sidechain;
      return n;
    }
    const s: Sidechain = {
      source: 'kick',
      force: arrondir(borner(Number.isFinite(sidechain.force) ? sidechain.force : SIDECHAIN_DEFAUT.force, 0, 1)),
      relache: arrondir(borner(Number.isFinite(sidechain.relache) ? sidechain.relache : SIDECHAIN_DEFAUT.relache, 0.02, 0.6)),
    };
    const a = p.sidechain;
    if (a && a.force === s.force && a.relache === s.relache) return p;
    return { ...p, sidechain: s };
  });
}

/** Nombre d'effets de la piste (pour « Effets (n) »). */
export function nombreEffets(p: Piste): number {
  return p.inserts?.length ?? 0;
}
