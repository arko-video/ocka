// Normalisation de la TRANCHE d'une piste (format /3) : inserts, sidechain, LFO, et courbes d'automation (après
// les sections : leurs points sont rangés par section). Corrige au lieu de rejeter ; dictionnaires sans prototype.

import {
  apercu,
  dictionnaire,
  estObjet,
  Ids,
  Journal,
  lireBooleen,
  lireChoix,
  lireNombre,
  lirePas24,
  verifierCles,
  type Objet,
} from './normaliser-outils';
import {
  FORMES_LFO,
  PARAMS_EFFETS,
  PLAFONDS,
  TYPES_EFFETS,
  type Cible,
  type Courbe,
  type Insert,
  type Lfo,
  type PointCourbe,
  type Section,
  type Sidechain,
  type Tranche,
} from './types';

/** Une liste du fichier, coupée au plafond (avec un message). */
export function listeBornee(v: unknown, max: number, chemin: string, journal: Journal): unknown[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    journal.corrige(chemin, 'Ce champ devait être une liste : ignoré.');
    return [];
  }
  if (v.length > max) journal.corrige(chemin, `Trop d'éléments (${v.length}) : seuls les ${max} premiers sont gardés.`);
  return v.slice(0, max);
}

function normaliserInsert(b: unknown, i: number, ids: Ids, c: string, journal: Journal): Insert | null {
  if (!estObjet(b)) return (journal.ignore(c, 'Cet effet n’est pas un objet : ignoré.'), null);
  verifierCles(b, ['id', 'type', 'actif', 'params'], c, journal);
  if (typeof b.type !== 'string' || !(TYPES_EFFETS as readonly string[]).includes(b.type)) {
    journal.ignore(`${c}.type`, `L'effet « ${apercu(b.type)} » est inconnu (${TYPES_EFFETS.join(', ')}) : ignoré.`);
    return null;
  }
  const type = b.type as Insert['type'];
  const reglages = PARAMS_EFFETS[type];
  const params = dictionnaire<number>();
  const bruts = estObjet(b.params) ? b.params : {};
  for (const [k, v] of Object.entries(bruts)) {
    const r = Object.hasOwn(reglages, k) ? reglages[k] : undefined;
    if (!r) {
      journal.ignore(`${c}.params.${apercu(k)}`, `Le réglage « ${apercu(k)} » n'existe pas pour cet effet : ignoré.`);
      continue;
    }
    params[k] = lireNombre(v, `${c}.params.${k}`, journal, { defaut: r.defaut, min: r.min, max: r.max, nom: `le réglage ${k}`, entier: r.entier });
  }
  return { id: ids.donner(b.id, i, `${c}.id`, journal), type, actif: lireBooleen(b.actif, true, `${c}.actif`, journal), params };
}

/** Lit une cible ; null si elle vise un effet ou un réglage qui n'existe pas (ou la hauteur d'une piste fixe). */
export function lireCible(v: unknown, inserts: Insert[], instrument: boolean, c: string, journal: Journal): Cible | null {
  const b = estObjet(v) ? v : {};
  if (b.type === 'volume' || b.type === 'pan') return { type: b.type };
  if (b.type === 'hauteur' && instrument) return { type: 'hauteur' };
  if (b.type === 'insert') {
    const insert = inserts.find((x) => x.id === b.insert);
    if (insert && typeof b.param === 'string' && Object.hasOwn(PARAMS_EFFETS[insert.type], b.param)) return { type: 'insert', insert: insert.id, param: b.param };
  }
  journal.ignore(c, `La cible « ${apercu(v)} » n'existe pas sur cette piste : ignorée.`);
  return null;
}

function normaliserLfo(b: unknown, inserts: Insert[], instrument: boolean, c: string, journal: Journal): Lfo | null {
  if (!estObjet(b)) return (journal.ignore(c, 'Ce LFO n’est pas un objet : ignoré.'), null);
  verifierCles(b, ['cible', 'forme', 'periode', 'profondeur', 'phase'], c, journal);
  const cible = lireCible(b.cible, inserts, instrument, `${c}.cible`, journal);
  if (!cible) return null;
  return {
    cible,
    forme: lireChoix(b.forme, FORMES_LFO, 'sinus', `${c}.forme`, journal, 'la forme'),
    periode: lireNombre(b.periode, `${c}.periode`, journal, { defaut: 16, min: 0.25, max: 256, nom: 'la période' }),
    profondeur: lireNombre(b.profondeur, `${c}.profondeur`, journal, { defaut: 0.5, min: 0, max: 1, nom: 'la profondeur' }),
    phase: lireNombre(b.phase, `${c}.phase`, journal, { defaut: 0, min: 0, max: 1, nom: 'la phase' }),
  };
}

function normaliserSidechain(b: unknown, c: string, journal: Journal): Sidechain | null {
  if (!estObjet(b)) return (journal.ignore(c, 'Le sidechain devait être un objet : ignoré.'), null);
  verifierCles(b, ['source', 'force', 'relache'], c, journal);
  return {
    source: lireChoix(b.source, ['kick'] as const, 'kick', `${c}.source`, journal, 'la source'),
    force: lireNombre(b.force, `${c}.force`, journal, { defaut: 0.5, min: 0, max: 1, nom: 'la force' }),
    relache: lireNombre(b.relache, `${c}.relache`, journal, { defaut: 0.15, min: 0.02, max: 0.6, nom: 'le relâchement' }),
  };
}

/**
 * Volume, pan, muet, solo, inserts, sidechain et LFO (les courbes viennent après les sections : normaliserCourbes).
 * Les champs facultatifs absents restent absents ; une liste vide est retirée.
 */
export function normaliserTranche(b: Objet, volumeDefaut: number, instrument: boolean, c: string, journal: Journal): Tranche {
  const t: Tranche = {
    volume: lireNombre(b.volume, `${c}.volume`, journal, { defaut: volumeDefaut, min: 0, max: 1.5, nom: 'le volume' }),
    pan: lireNombre(b.pan, `${c}.pan`, journal, { defaut: 0, min: -1, max: 1, nom: 'le panoramique' }),
    muet: lireBooleen(b.muet, false, `${c}.muet`, journal),
    solo: lireBooleen(b.solo, false, `${c}.solo`, journal),
  };
  const ids = new Ids('fx');
  const inserts = listeBornee(b.inserts, PLAFONDS.inserts, `${c}.inserts`, journal)
    .map((x, i) => normaliserInsert(x, i, ids, `${c}.inserts[${i}]`, journal))
    .filter((x): x is Insert => x !== null);
  if (inserts.length > 0) t.inserts = inserts;
  if (b.sidechain !== undefined && b.sidechain !== null) {
    const s = normaliserSidechain(b.sidechain, `${c}.sidechain`, journal);
    if (s) t.sidechain = s;
  }
  const lfo = listeBornee(b.lfo, PLAFONDS.lfo, `${c}.lfo`, journal)
    .map((x, i) => normaliserLfo(x, inserts, instrument, `${c}.lfo[${i}]`, journal))
    .filter((x): x is Lfo => x !== null);
  if (lfo.length > 0) t.lfo = lfo;
  return t;
}

function normaliserPoints(v: unknown, section: Section, c: string, journal: Journal): PointCourbe[] {
  const fin = section.mesures * 16;
  const points: PointCourbe[] = [];
  const vus = new Set<number>();
  listeBornee(v, PLAFONDS.pointsParCourbe, c, journal).forEach((b, i) => {
    const ci = `${c}[${i}]`;
    if (!estObjet(b)) return journal.ignore(ci, 'Ce point n’est pas un objet : ignoré.');
    verifierCles(b, ['pas', 'valeur', 'forme'], ci, journal);
    const pas = lirePas24(b.pas, `${ci}.pas`, journal, { defaut: 0, min: 0, max: fin, nom: 'le pas du point' });
    if (vus.has(pas)) return journal.corrige(ci, 'Deux points au même pas : le second est retiré.');
    vus.add(pas);
    const p: PointCourbe = { pas, valeur: lireNombre(b.valeur, `${ci}.valeur`, journal, { defaut: 1, min: 0, max: 1, nom: 'la valeur' }) };
    if (b.forme !== undefined && b.forme !== null) p.forme = lireChoix(b.forme, ['ligne', 'palier'] as const, 'ligne', `${ci}.forme`, journal, 'la forme');
    points.push(p);
  });
  return points.sort((a, b) => a.pas - b.pas);
}

/** Courbes d'automation d'une piste (8 au plus), points rangés par section (ids déjà normalisés). */
export function normaliserCourbes(v: unknown, t: Tranche, instrument: boolean, sections: Section[], idsSections: Ids, c: string, journal: Journal): Courbe[] {
  const courbes: Courbe[] = [];
  listeBornee(v, PLAFONDS.courbes, c, journal).forEach((b, i) => {
    const ci = `${c}[${i}]`;
    if (!estObjet(b)) return journal.ignore(ci, 'Cette courbe n’est pas un objet : ignorée.');
    verifierCles(b, ['cible', 'sections'], ci, journal);
    const cible = lireCible(b.cible, t.inserts ?? [], instrument, `${ci}.cible`, journal);
    if (!cible) return;
    const parSection = dictionnaire<PointCourbe[]>();
    for (const [ref, points] of Object.entries(estObjet(b.sections) ? b.sections : {})) {
      const id = idsSections.trouver(ref);
      const section = sections.find((s) => s.id === id);
      if (!section) {
        journal.ignore(`${ci}.sections.${apercu(ref)}`, `La section « ${apercu(ref)} » n'existe pas : points ignorés.`);
        continue;
      }
      const p = normaliserPoints(points, section, `${ci}.sections.${section.id}`, journal);
      if (p.length > 0) parSection[section.id] = p;
    }
    courbes.push({ cible, sections: parSection });
  });
  return courbes;
}
