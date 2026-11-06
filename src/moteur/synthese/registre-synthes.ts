// Lecture du registre des synthés (contrat C3, intégrateur) : le moteur (notes.ts, Worker, planning, préparation,
// graphe) et le catalogue ne passent QUE par ici. Les synthés prêts sont déclarés au normaliseur au chargement
// (declarerSynthes) : « ocka-<id>@1 » devient connu. Pur, sans Web Audio (aussi chargé dans le Worker de synthèse).

import { declarerSynthes, syntheOcka } from '../../morceau/acces';
import { SONS_MELODIE, type ReglagesSynthe } from '../../morceau/types';
import type { InfoInstrument } from '../api-instruments';
import type { DefinitionSynthe, ReglagesLus } from '../api-synthes';
import { SYNTHES } from './synthes/index';

const parId = new Map<string, DefinitionSynthe>(SYNTHES.map((s) => [s.id, s]));
declarerSynthes(SYNTHES.filter((s) => s.pret).map((s) => s.id));

const estV1 = (id: string) => (SONS_MELODIE as readonly string[]).includes(id);

/** La définition PRÊTE d'un id court (« piano », « 303 »), ou null. */
export function synthe(id: string): DefinitionSynthe | null {
  const d = parId.get(id);
  return d && d.pret ? d : null;
}

/** La définition du synthé que joue un instrument (« ocka-303@1 »), ou null (banque, SoundFont, synthé pas prêt). */
export function definitionDe(instrument: string): DefinitionSynthe | null {
  const id = syntheOcka(instrument);
  return id === null ? null : synthe(id);
}

/** Relâchement (s) d'un synthé (id court) ; 0,1 s pour un id inconnu. */
export function relacheSynthe(id: string): number {
  return parId.get(id)?.relache ?? 0.1;
}

/** true si le synthé tient ses notes (boucle). */
export function syntheTenu(id: string): boolean {
  return parId.get(id)?.tenu === true;
}

/** true si le synthé rend un tampon par passage de motif (303). */
export function syntheParMotif(id: string): boolean {
  return parId.get(id)?.mode === 'motif';
}

const borner01 = (x: unknown, defaut: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : defaut);

/** Onde par défaut d'un synthé à onde dessinée : un sinus de `points` valeurs. */
export function ondeParDefaut(points: number): number[] {
  return Array.from({ length: points }, (_, i) => Math.round(Math.sin((2 * Math.PI * i) / points) * 1e4) / 1e4);
}

/** Réglages complétés par les défauts, arrondis au cran ; l'onde est rééchantillonnée à `points` valeurs. */
export function reglagesLus(def: DefinitionSynthe, s: ReglagesSynthe | undefined): ReglagesLus {
  const params: Record<string, number> = Object.create(null);
  for (const [cle, p] of Object.entries(def.params)) {
    const brut = s?.params && Object.hasOwn(s.params, cle) ? s.params[cle] : undefined;
    let v = borner01(brut, p.defaut);
    if (p.crans && p.crans > 1) v = Math.round(v * (p.crans - 1)) / (p.crans - 1);
    params[cle] = v;
  }
  const points = def.points;
  if (!points) return { params };
  const o = s?.onde && s.onde.length >= 2 ? s.onde : null;
  if (!o) return { params, onde: ondeParDefaut(points) };
  const onde = Array.from({ length: points }, (_, i) => {
    const x = (i * o.length) / points;
    const k = Math.floor(x);
    const a = o[k % o.length]!;
    const b = o[(k + 1) % o.length]!;
    return Math.min(1, Math.max(-1, a + (b - a) * (x - k)));
  });
  return { params, onde };
}

/**
 * Partie de la clé du cache propre aux réglages : '' quand ils valent les défauts (les sons v1 et une piste sans
 * `synthe` gardent EXACTEMENT leurs clés d'avant), sinon une empreinte courte et stable.
 */
const empreintes = new WeakMap<ReglagesSynthe, Map<string, string>>();
export function empreinteReglages(def: DefinitionSynthe, s: ReglagesSynthe | undefined): string {
  if (!s) return '';
  let parDef = empreintes.get(s);
  if (!parDef) empreintes.set(s, (parDef = new Map()));
  let e = parDef.get(def.id);
  if (e === undefined) parDef.set(def.id, (e = calculerEmpreinte(def, s)));
  return e;
}

function calculerEmpreinte(def: DefinitionSynthe, s: ReglagesSynthe): string {
  const lus = reglagesLus(def, s);
  const neutre = reglagesLus(def, undefined);
  const texte = JSON.stringify(lus);
  if (texte === JSON.stringify(neutre)) return '';
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

/** Les synthés de C3 PRÊTS, en entrées du catalogue (« + Piste », source « code ») ; sans les 6 sons v1. */
export function instrumentsSynthes(): InfoInstrument[] {
  return SYNTHES.filter((s) => s.pret && !estV1(s.id)).map((s) => ({
    id: `ocka-${s.id}@1`,
    nom: s.nom,
    famille: s.famille,
    source: 'code' as const,
    taille: 0,
    installe: true,
    motsCles: s.motsCles,
  }));
}
