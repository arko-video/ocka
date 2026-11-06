// Format `instrument.json` de la banque d'instruments (décisions v2 §2) et sa validation STRICTE.
// Un instrument.json vient du réseau : on ne lui fait pas confiance. Clés inconnues refusées, nombres bornés,
// noms de fichiers simples (pas de « / », pas de « .. »), plafond mémoire de 60 s mono décodées.
// Positions (debut, fin, boucle) en ÉCHANTILLONS du fichier décodé à 48 kHz (Opus, amorce de 312 déjà retirée).

import { ErreurOcka } from '../moteur/erreur';

export const FAMILLES = [
  'Claviers',
  'Guitares',
  'Basses',
  'Cordes',
  'Vents',
  'Percussions mélodiques',
  'Batteries',
  'Percussions',
] as const;
export type Famille = (typeof FAMILLES)[number];

/** Les seules licences acceptées : chaque sortie Spotify doit pouvoir se passer de crédit. */
export const LICENCES_ACCEPTEES = ['CC0-1.0', 'domaine-public'] as const;

/** Fréquence des positions (échantillons) : celle de l'Opus décodé. */
export const FREQUENCE_INSTRUMENTS = 48000;
/** Plafond mémoire d'un instrument (s mono décodées ; stéréo = × 2). */
export const BUDGET_MAX_S = 60;
export const MAX_ZONES = 256;

export interface LicenceInstrument {
  nom: string;
  url: string;
  auteur: string;
  /** SHA-256 des fichiers source utilisés (archives ou échantillons d'origine). */
  sha256: string[];
}

export interface ZoneInstrument {
  fichier: string;
  racine: number;
  cents: number;
  bas: number;
  haut: number;
  velBas: number;
  velHaut: number;
  gainDb: number;
  debut: number;
  fin: number;
  boucle?: { debut: number; fin: number };
}

export interface InstrumentJson {
  /** Référence dans un morceau, avec la version : « vcsl-marimba@1 ». Dossier = avant « @ ». */
  id: string;
  nom: string;
  famille: Famille;
  licence: LicenceInstrument;
  canaux: 1 | 2;
  gainDb: number;
  relache: number;
  budgetS: number;
  zones: ZoneInstrument[];
  exclusif?: number[][];
  mono?: boolean;
}

/** « vcsl-marimba@1 » : minuscules, chiffres et tirets, puis la version. */
export const REGLE_ID_INSTRUMENT = /^[a-z0-9]+(?:-[a-z0-9]+){0,7}@[1-9][0-9]{0,2}$/;
/** Fichier d'une zone : un nom simple en .ogg, dans le dossier de l'instrument. */
export const REGLE_FICHIER_ZONE = /^[a-z0-9][a-z0-9_-]{0,47}\.ogg$/;
const REGLE_SHA = /^[0-9a-f]{64}$/;

/** Dossier d'un instrument d'après sa référence (« vcsl-marimba@1 » → « vcsl-marimba »), ou null si invalide. */
export function dossierInstrument(id: string): string | null {
  return typeof id === 'string' && REGLE_ID_INSTRUMENT.test(id) ? id.slice(0, id.indexOf('@')) : null;
}

class Invalide extends Error {}

function objet(x: unknown, quoi: string, cles: readonly string[], optionnelles: readonly string[] = []): Record<string, unknown> {
  if (typeof x !== 'object' || x === null || Array.isArray(x) || Object.getPrototypeOf(x) !== Object.prototype) {
    throw new Invalide(`${quoi} n'est pas un objet`);
  }
  const o = x as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!cles.includes(k) && !optionnelles.includes(k)) throw new Invalide(`${quoi} : clé inconnue « ${k.slice(0, 30)} »`);
  }
  for (const k of cles) if (!(k in o)) throw new Invalide(`${quoi} : « ${k} » manque`);
  return o;
}

function nombre(x: unknown, quoi: string, min: number, max: number, entier = false): number {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max || (entier && !Number.isInteger(x))) {
    throw new Invalide(`${quoi} hors limites`);
  }
  return x;
}

function texte(x: unknown, quoi: string, max: number): string {
  if (typeof x !== 'string' || x.length === 0 || x.length > max) throw new Invalide(`${quoi} invalide`);
  return x;
}

function licence(x: unknown): LicenceInstrument {
  const o = objet(x, 'licence', ['nom', 'url', 'auteur', 'sha256']);
  const nom = texte(o.nom, 'licence.nom', 40);
  if (!(LICENCES_ACCEPTEES as readonly string[]).includes(nom)) throw new Invalide(`licence refusée : ${nom}`);
  const url = texte(o.url, 'licence.url', 300);
  if (!/^https:\/\/[^\s"<>]+$/.test(url)) throw new Invalide('licence.url invalide');
  if (!Array.isArray(o.sha256) || o.sha256.length === 0 || o.sha256.length > 1024) throw new Invalide('licence.sha256 invalide');
  const sha256 = o.sha256.map((s) => {
    if (typeof s !== 'string' || !REGLE_SHA.test(s)) throw new Invalide('licence.sha256 : empreinte invalide');
    return s;
  });
  return { nom, url, auteur: texte(o.auteur, 'licence.auteur', 200), sha256 };
}

function zone(x: unknown, i: number): ZoneInstrument {
  const q = `zone ${i}`;
  const o = objet(x, q, ['fichier', 'racine', 'cents', 'bas', 'haut', 'velBas', 'velHaut', 'gainDb', 'debut', 'fin'], ['boucle']);
  const fichier = texte(o.fichier, `${q}.fichier`, 52);
  if (!REGLE_FICHIER_ZONE.test(fichier)) throw new Invalide(`${q} : nom de fichier refusé`);
  const z: ZoneInstrument = {
    fichier,
    racine: nombre(o.racine, `${q}.racine`, 0, 127, true),
    cents: nombre(o.cents, `${q}.cents`, -100, 100),
    bas: nombre(o.bas, `${q}.bas`, 0, 127, true),
    haut: nombre(o.haut, `${q}.haut`, 0, 127, true),
    velBas: nombre(o.velBas, `${q}.velBas`, 1, 127, true),
    velHaut: nombre(o.velHaut, `${q}.velHaut`, 1, 127, true),
    gainDb: nombre(o.gainDb, `${q}.gainDb`, -60, 40),
    debut: nombre(o.debut, `${q}.debut`, 0, FREQUENCE_INSTRUMENTS * BUDGET_MAX_S, true),
    fin: nombre(o.fin, `${q}.fin`, 1, FREQUENCE_INSTRUMENTS * BUDGET_MAX_S, true),
  };
  if (z.bas > z.haut || z.velBas > z.velHaut || z.debut >= z.fin) throw new Invalide(`${q} : bornes inversées`);
  if (Math.abs(z.racine - z.bas) > 12 || Math.abs(z.haut - z.racine) > 12) throw new Invalide(`${q} : zone trop large`);
  if (o.boucle !== undefined) {
    const b = objet(o.boucle, `${q}.boucle`, ['debut', 'fin']);
    const debut = nombre(b.debut, `${q}.boucle.debut`, 0, z.fin, true);
    const fin = nombre(b.fin, `${q}.boucle.fin`, 1, z.fin, true);
    if (debut < z.debut || fin - debut < 64) throw new Invalide(`${q} : boucle invalide`);
    z.boucle = { debut, fin };
  }
  return z;
}

function exclusif(x: unknown): number[][] {
  if (!Array.isArray(x) || x.length > 16) throw new Invalide('exclusif invalide');
  return x.map((g, i) => {
    if (!Array.isArray(g) || g.length === 0 || g.length > 32) throw new Invalide(`exclusif ${i} invalide`);
    return g.map((n) => nombre(n, `exclusif ${i}`, 0, 127, true));
  });
}

/** Valide un instrument.json lu sur le réseau. Lève ErreurOcka « instrument_invalide » au moindre écart. */
export function validerInstrument(x: unknown, idAttendu?: string): InstrumentJson {
  try {
    const o = objet(
      x,
      'instrument',
      ['id', 'nom', 'famille', 'licence', 'canaux', 'gainDb', 'relache', 'budgetS', 'zones'],
      ['exclusif', 'mono'],
    );
    const id = texte(o.id, 'id', 60);
    if (!REGLE_ID_INSTRUMENT.test(id) || (idAttendu !== undefined && id !== idAttendu)) throw new Invalide('id invalide');
    const famille = texte(o.famille, 'famille', 40);
    if (!(FAMILLES as readonly string[]).includes(famille)) throw new Invalide('famille inconnue');
    if (o.canaux !== 1 && o.canaux !== 2) throw new Invalide('canaux invalide');
    if (!Array.isArray(o.zones) || o.zones.length === 0 || o.zones.length > MAX_ZONES) throw new Invalide('zones invalides');
    const inst: InstrumentJson = {
      id,
      nom: texte(o.nom, 'nom', 60),
      famille: famille as Famille,
      licence: licence(o.licence),
      canaux: o.canaux,
      gainDb: nombre(o.gainDb, 'gainDb', -60, 40),
      relache: nombre(o.relache, 'relache', 0, 10),
      budgetS: nombre(o.budgetS, 'budgetS', 0, BUDGET_MAX_S),
      zones: o.zones.map(zone),
    };
    const noms = new Set(inst.zones.map((z) => z.fichier));
    if (noms.size !== inst.zones.length) throw new Invalide('deux zones partagent un fichier');
    const decode = inst.zones.reduce((s, z) => s + (z.fin / FREQUENCE_INSTRUMENTS) * inst.canaux, 0);
    if (decode > inst.budgetS + 0.01) throw new Invalide('les zones dépassent budgetS');
    if (o.exclusif !== undefined) inst.exclusif = exclusif(o.exclusif);
    if (o.mono !== undefined) {
      if (typeof o.mono !== 'boolean') throw new Invalide('mono invalide');
      inst.mono = o.mono;
    }
    return inst;
  } catch (e) {
    if (!(e instanceof Invalide)) throw e;
    throw new ErreurOcka('Cet instrument est abîmé ou d’une version inconnue : il ne peut pas être utilisé.', 'instrument_invalide');
  }
}

/** Les zones qui jouent cette note à cette vélocité (1 à 127). */
export function zonesPour(inst: InstrumentJson, midi: number, vel: number): ZoneInstrument[] {
  return inst.zones.filter((z) => z.bas <= midi && midi <= z.haut && z.velBas <= vel && vel <= z.velHaut);
}

/** Les fichiers utiles pour ces notes (on ne décode que ce que le morceau joue). */
export function fichiersUtiles(inst: InstrumentJson, notes: Iterable<{ midi: number; vel: number }>): Set<string> {
  const res = new Set<string>();
  for (const n of notes) {
    const v = Math.min(127, Math.max(1, Math.round(n.vel)));
    for (const z of zonesPour(inst, Math.round(n.midi), v)) res.add(z.fichier);
  }
  return res;
}
