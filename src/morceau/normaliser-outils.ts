// Petits outils du normaliseur (repris d'Arko) : journal des problèmes, bornes, lecture de nombres et de choix,
// identifiants sûrs et dictionnaires sans prototype (un id « __proto__ » ne doit jamais toucher Object.prototype).

import { REGLE_ID, type Probleme } from './types';

/** Au-delà, les problèmes non bloquants ne sont plus notés (un fichier hostile peut en produire des millions). */
export const MAX_PROBLEMES = 200;

/** Collecte les problèmes trouvés pendant la normalisation. */
export class Journal {
  readonly problemes: Probleme[] = [];
  private tus = 0;
  ajouter(niveau: Probleme['niveau'], chemin: string, message: string) {
    if (niveau !== 'bloquant' && this.problemes.length >= MAX_PROBLEMES) {
      if (this.tus++ === 0) this.problemes.push({ chemin: '', niveau: 'ignore', message: "Trop de problèmes : les suivants ne sont pas listés." });
      return;
    }
    this.problemes.push({ chemin: apercu(chemin, 120), niveau, message });
  }
  corrige(chemin: string, message: string) {
    this.ajouter('corrige', chemin, message);
  }
  ignore(chemin: string, message: string) {
    this.ajouter('ignore', chemin, message);
  }
  conseil(chemin: string, message: string) {
    this.ajouter('conseil', chemin, message);
  }
  bloquant(chemin: string, message: string) {
    this.ajouter('bloquant', chemin, message);
  }
}

export type Objet = Record<string, unknown>;

/** Texte court pour un message : une valeur venue du fichier n'y entre jamais en entier. */
export function apercu(v: unknown, max = 40): string {
  let s: string;
  try {
    s = typeof v === 'string' ? v : JSON.stringify(v) ?? String(v);
  } catch {
    s = String(v);
  }
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Dictionnaire sans prototype : `d['__proto__'] = x` crée une vraie clé au lieu de changer le prototype. */
export function dictionnaire<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

/** Nom réservé d'Object.prototype (« __proto__ », « constructor », « toString »…) : jamais un id. */
export function nomReserve(id: string): boolean {
  return id === '__proto__' || id === 'prototype' || Object.hasOwn(Object.prototype, id);
}

/** Id valable : REGLE_ID et pas un nom réservé. */
export function idValide(v: unknown): v is string {
  return typeof v === 'string' && REGLE_ID.test(v) && !nomReserve(v);
}

/**
 * Distributeur d'ids d'une famille (motifs, sections, prises, sons) : corrige les ids illisibles,
 * renomme les doublons, et garde la correspondance « id écrit dans le fichier → id donné »
 * pour réparer les références (ordre, ancres, boucles, pads).
 */
export class Ids {
  private pris = new Set<string>();
  private carte = new Map<string, string>();
  constructor(private prefixe: string) {}

  donner(brut: unknown, i: number, chemin: string, journal: Journal): string {
    const texte = typeof brut === 'string' ? brut.trim() : typeof brut === 'number' && Number.isFinite(brut) ? String(brut) : '';
    let id = texte;
    if (!idValide(id)) {
      id = texte
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
      if (!idValide(id)) id = `${this.prefixe}-${i + 1}`;
      if (brut !== undefined) journal.corrige(chemin, `L'identifiant « ${apercu(brut)} » n'est pas valable : remplacé par « ${id} ».`);
    }
    if (this.pris.has(id)) {
      let n = 2;
      let essai = `${id.slice(0, 36)}-${n}`;
      while (this.pris.has(essai)) essai = `${id.slice(0, 36)}-${++n}`;
      journal.corrige(chemin, `L'identifiant « ${id} » est déjà pris : renommé « ${essai} ».`);
      id = essai;
    }
    this.pris.add(id);
    // Les références peuvent être écrites telles quelles, sans espaces autour, ou en nombre (« 42 » ou 42).
    if (typeof brut === 'string' && !this.carte.has(brut)) this.carte.set(brut, id);
    if (texte && !this.carte.has(texte)) this.carte.set(texte, id);
    return id;
  }

  /** L'id donné pour une référence écrite dans le fichier (première apparition), ou undefined. */
  trouver(ref: unknown): string | undefined {
    if (typeof ref === 'number' && Number.isFinite(ref)) return this.carte.get(String(ref));
    return typeof ref === 'string' ? (this.carte.get(ref) ?? this.carte.get(ref.trim())) : undefined;
  }
}

export function estObjet(v: unknown): v is Objet {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function borner(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** Arrondi à 3 décimales (évite les 0,30000000000000004 dans les fichiers). */
export function arrondir(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Nombre écrit à la française : 0,25. */
export function formaterNombre(x: number): string {
  return String(arrondir(x)).replace('.', ',');
}

/** Lit un nombre, ou une chaîne « 0,8 » / « 0.8 ». null si ce n'est pas un nombre. */
export function lireNombreBrut(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const x = Number(v.trim().replace(',', '.'));
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

export function majuscule(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface RegleNombre {
  defaut: number;
  min: number;
  max: number;
  /** Nom affiché dans les messages (« le tempo »). */
  nom: string;
  entier?: boolean;
}

/** Lit un nombre, applique défaut et bornes, et note les corrections. */
export function lireNombre(v: unknown, chemin: string, journal: Journal, r: RegleNombre): number {
  if (v === undefined || v === null) return r.defaut;
  const x = lireNombreBrut(v);
  if (x === null) {
    journal.corrige(chemin, `${majuscule(r.nom)} (${apercu(v)}) n'est pas un nombre : remplacé par ${formaterNombre(r.defaut)}.`);
    return r.defaut;
  }
  let b = arrondir(borner(x, r.min, r.max));
  if (r.entier) b = Math.round(b);
  if (b !== arrondir(x)) {
    journal.corrige(chemin, `${majuscule(r.nom)} (${formaterNombre(x)}) était hors limites : ramené à ${formaterNombre(b)}.`);
  }
  return b;
}

/** Lit une valeur parmi une liste de choix ; sinon défaut (avec message). */
export function lireChoix<T extends string>(v: unknown, choix: readonly T[], defaut: T, chemin: string, journal: Journal, nom: string): T {
  if (v === undefined || v === null) return defaut;
  if (typeof v === 'string') {
    const trouve = choix.find((c) => c.toLowerCase() === v.trim().toLowerCase().replace('-', ''));
    if (trouve) return trouve;
  }
  journal.corrige(chemin, `${majuscule(nom)} « ${apercu(v)} » est inconnu(e) : remplacé(e) par « ${defaut} » (choix : ${choix.join(', ')}).`);
  return defaut;
}

/** Lit un booléen (true/false, "oui"/"non", 1/0). */
export function lireBooleen(v: unknown, defaut: boolean, chemin: string, journal: Journal): boolean {
  if (v === undefined || v === null) return defaut;
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === 'oui' || v === 'true') return true;
  if (v === 0 || v === 'non' || v === 'false') return false;
  journal.corrige(chemin, `« ${apercu(v)} » n'est ni vrai ni faux : remplacé par ${defaut ? 'vrai' : 'faux'}.`);
  return defaut;
}

/** Lit un texte (les nombres sont convertis), coupé à `max` caractères. */
export function lireTexte(v: unknown, defaut: string, chemin: string, journal: Journal, max = 200): string {
  if (v === undefined || v === null) return defaut;
  if (typeof v !== 'string' && typeof v !== 'number') {
    journal.corrige(chemin, `Ce champ devait être un texte : remplacé par « ${defaut} ».`);
    return defaut;
  }
  let s = String(v);
  // Caractères de contrôle (sauf tabulation et retours à la ligne) : jamais utiles, parfois piégés.
  const propre = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  if (propre !== s) {
    journal.corrige(chemin, 'Des caractères invisibles ont été retirés du texte.');
    s = propre;
  }
  if (s.length > max) {
    journal.corrige(chemin, `Texte trop long (${s.length} caractères) : coupé à ${max}.`);
    return s.slice(0, max);
  }
  return s;
}

/** Signale (et ignore) les clés inconnues d'un objet. */
export function verifierCles(obj: Objet, connues: readonly string[], chemin: string, journal: Journal) {
  for (const cle of Object.keys(obj)) {
    if (connues.includes(cle)) continue;
    journal.ignore(chemin ? `${chemin}.${apercu(cle)}` : apercu(cle), `La clé « ${apercu(cle)} » est inconnue : ignorée.`);
  }
}
