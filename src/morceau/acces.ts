// Accesseurs du format /3 : on ne lit JAMAIS `section.motifs.<piste>` ni `m.motifs[id]` à la main (dictionnaires
// sans prototype, pistes en nombre libre). Pur, sans dépendance au moteur ni à l'interface. Contrat C0.

import { nomReserve } from './normaliser-outils';
import {
  IDS_FIXES,
  SONS_MELODIE,
  type IdFixe,
  type IdPiste,
  type Morceau,
  type Motif,
  type MotifAccords,
  type MotifBasse,
  type MotifBatterie,
  type MotifNotes,
  type Piste,
  type PisteFixe,
  type PisteInstrument,
  type Section,
  type SonMelodie,
} from './types';

/** Id de la piste instrument qui reprend la mélodie d'un morceau /2 (et la piste des 8 pads « Simple »). */
export const ID_MELODIE = 'melodie';

export function estIdFixe(id: string): id is IdFixe {
  return (IDS_FIXES as readonly string[]).includes(id);
}

export function estPisteInstrument(p: Piste | undefined | null): p is PisteInstrument {
  return !!p && p.genre === 'instrument';
}

export function pisteDe(m: Morceau, id: IdPiste): Piste | undefined {
  return m.pistes.find((p) => p.id === id);
}

export function pisteFixe(m: Morceau, id: IdFixe): PisteFixe | undefined {
  const p = pisteDe(m, id);
  return p && !estPisteInstrument(p) ? p : undefined;
}

/** La piste voix (toujours là après le normaliseur ; sinon ses réglages par défaut, non écrits dans le morceau). */
export function pisteVoix(m: Pick<Morceau, 'pistes'>): PisteFixe {
  const p = m.pistes?.find((x) => x.id === 'voix');
  return p && !estPisteInstrument(p) ? p : { id: 'voix', volume: 0.9, pan: 0, muet: false, solo: false, preset: 'naturel' };
}

/** Les pistes instrument, dans l'ordre du morceau. */
export function pistesInstrument(m: Morceau): PisteInstrument[] {
  return m.pistes.filter(estPisteInstrument);
}

export function sectionDe(m: Morceau, id: string): Section | undefined {
  return m.sections.find((s) => s.id === id);
}

const laSection = (m: Morceau, s: Section | string): Section | undefined => (typeof s === 'string' ? sectionDe(m, s) : s);

/** Id du motif joué par une piste dans une section (Object.hasOwn : « __proto__ » n'est jamais une piste). */
export function idMotifDe(section: Section | undefined, idPiste: IdPiste): string | undefined {
  if (!section || !Object.hasOwn(section.motifs, idPiste)) return undefined;
  const id = section.motifs[idPiste];
  return typeof id === 'string' && id !== '' ? id : undefined;
}

/** Le motif d'un id (Object.hasOwn), ou undefined. */
export function motifParId(m: Morceau, id: string | undefined): Motif | undefined {
  return id !== undefined && Object.hasOwn(m.motifs, id) ? m.motifs[id] : undefined;
}

/** Le motif joué par une piste dans une section (section ou son id), quel que soit son type. */
export function motifDe(m: Morceau, section: Section | string, idPiste: IdPiste): Motif | undefined {
  return motifParId(m, idMotifDe(laSection(m, section), idPiste));
}

export function motifBatterieDe(m: Morceau, section: Section | string): MotifBatterie | undefined {
  const x = motifDe(m, section, 'batterie');
  return x?.type === 'batterie' ? x : undefined;
}
export function motifBasseDe(m: Morceau, section: Section | string): MotifBasse | undefined {
  const x = motifDe(m, section, 'basse');
  return x?.type === 'basse' ? x : undefined;
}
export function motifAccordsDe(m: Morceau, section: Section | string): MotifAccords | undefined {
  const x = motifDe(m, section, 'accords');
  return x?.type === 'accords' ? x : undefined;
}

/** Le motif de notes d'une piste instrument dans une section, ou null. */
export function motifNotesDe(m: Morceau, section: Section | string, idPiste: IdPiste): MotifNotes | null {
  const x = motifDe(m, section, idPiste);
  return x?.type === 'notes' ? x : null;
}

/** Ids des sections qui utilisent ce motif (« dans N sections », « Rendre unique »). */
export function sectionsAvecMotif(m: Morceau, idMotif: string): string[] {
  return m.sections.filter((s) => Object.values(s.motifs).includes(idMotif)).map((s) => s.id);
}

/** true si la piste a un motif dans au moins une section de l'arrangement. */
export function pisteAUnMotif(m: Morceau, idPiste: IdPiste): boolean {
  const jouees = new Set(m.ordre);
  return m.sections.some((s) => jouees.has(s.id) && idMotifDe(s, idPiste) !== undefined);
}

/** Copie de `section.motifs` SANS prototype, avec `idPiste` → `idMotif` (null : la piste se tait dans la section). */
export function motifsAvec(section: Section, idPiste: IdPiste, idMotif: string | null): Record<IdPiste, string> {
  const d = Object.create(null) as Record<IdPiste, string>;
  for (const [k, v] of Object.entries(section.motifs)) if (k !== idPiste) d[k] = v;
  if (idMotif !== null) d[idPiste] = idMotif;
  return d;
}

/** Nouveau morceau où la piste joue `idMotif` dans la section (null = silence). Pur ; même objet si rien ne change. */
export function avecMotifSection(m: Morceau, idSection: string, idPiste: IdPiste, idMotif: string | null): Morceau {
  const s = sectionDe(m, idSection);
  if (!s || (idMotifDe(s, idPiste) ?? null) === idMotif) return m;
  return { ...m, sections: m.sections.map((x) => (x === s ? { ...x, motifs: motifsAvec(x, idPiste, idMotif) } : x)) };
}

/* ------------------------------------------------------------ instruments */

/** « ocka-<son>@1 » : un son fabriqué par OCKA v1. */
export function instrumentOcka(son: SonMelodie): string {
  return `ocka-${son}@1`;
}

/** Le son v1 joué par un instrument « ocka-<son>@1 », ou null (instrument échantillonné, SoundFont, synthé C3…). */
export function sonOcka(instrument: string): SonMelodie | null {
  const r = /^ocka-([a-z]+)@1$/.exec(instrument);
  return r && (SONS_MELODIE as readonly string[]).includes(r[1]!) ? (r[1] as SonMelodie) : null;
}

/** Instruments de la banque déclarés par BQ (src/instruments) au démarrage : ils ne donnent pas de conseil. */
const catalogue = new Set<string>();
export function declarerInstruments(ids: Iterable<string>): void {
  for (const id of ids) catalogue.add(id);
}

/** Synthés d'OCKA prêts (contrat C3) : ids courts déclarés par le registre (moteur/synthese/registre-synthes.ts). */
const synthes = new Set<string>();
export function declarerSynthes(ids: Iterable<string>): void {
  for (const id of ids) synthes.add(id);
}

/**
 * C3 — L'id court du son fabriqué par le code que joue « ocka-<id>@1 » : un son v1 (SonMelodie) ou un synthé déclaré
 * (« 303 », « nes-carre »…) ; null sinon (banque, SoundFont, synthé pas encore prêt). Le moteur ne lit plus sonOcka.
 */
export function syntheOcka(instrument: string): string | null {
  const r = /^ocka-([a-z0-9-]{1,40})@1$/.exec(instrument);
  if (!r) return null;
  return (SONS_MELODIE as readonly string[]).includes(r[1]!) || synthes.has(r[1]!) ? r[1]! : null;
}

/** true si cette version d'OCKA sait jouer cet instrument (sinon il est muet, avec un conseil du normaliseur). */
export function instrumentConnu(instrument: string): boolean {
  return syntheOcka(instrument) !== null || catalogue.has(instrument);
}

/** La piste « melodie » (mode Simple, Boucles OCKA, IA), ou la 1re piste instrument, ou null. */
export function pisteMelodie(m: Morceau): PisteInstrument | null {
  const p = pisteDe(m, ID_MELODIE);
  return estPisteInstrument(p) ? p : (pistesInstrument(m)[0] ?? null);
}

/**
 * La piste de la mélodie (« melodie », ou la 1re piste instrument) ; créée (piano d'OCKA) s'il n'y en a pas.
 * `son` : son conseillé (Boucles OCKA) → l'instrument de la piste devient « ocka-<son>@1 ».
 */
export function avecPisteMelodie(m: Morceau, son?: SonMelodie): { m: Morceau; id: string } {
  const p = pisteMelodie(m);
  if (p) {
    if (!son || p.instrument === instrumentOcka(son)) return { m, id: p.id };
    return { m: { ...m, pistes: m.pistes.map((x) => (x === p ? { ...p, instrument: instrumentOcka(son) } : x)) }, id: p.id };
  }
  const neuve: PisteInstrument = { id: ID_MELODIE, genre: 'instrument', nom: 'Mélodie', instrument: instrumentOcka(son ?? 'piano'), volume: 0.8, pan: 0, muet: false, solo: false };
  const i = m.pistes.findIndex((x) => x.id === 'sons');
  const pistes = [...m.pistes];
  pistes.splice(i < 0 ? pistes.length : i, 0, neuve);
  return { m: { ...m, pistes }, id: ID_MELODIE };
}

/** Un id de piste libre (jamais un id fixe ni un id pris) : « base », « base-2 »… */
export function idPisteLibre(m: Morceau, base = 'piste'): string {
  const propre = base.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 34) || 'piste';
  const pris = (id: string) => estIdFixe(id) || nomReserve(id) || m.pistes.some((p) => p.id === id);
  if (!pris(propre)) return propre;
  for (let n = 2; ; n++) if (!pris(`${propre}-${n}`)) return `${propre}-${n}`;
}
