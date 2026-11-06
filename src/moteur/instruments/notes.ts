// Notes mélodiques SANS durée (accords, mélodie, synthés de C3) : chaque son a une longueur fixe, indépendante du
// tempo. Le graphe joue le tampon puis, à la fin de la note, baisse le gain en ligne droite (relâchement) et arrête la
// source. Les sons tenus ont une boucle sans clic. Contrat C3 : le rendu vient du REGISTRE des synthés
// (synthese/registre-synthes.ts ; un fichier par synthé dans synthese/synthes/). Les 6 sons v1 y sont, au son figé.
// Synthèse JS pure, dans le Worker de synthèse (ou le fil principal en secours).

import { varianteStyle } from '../../morceau/styles/index';
import { SONS_MELODIE, type ReglagesSynthe, type SonMelodie } from '../../morceau/types';
import type { NoteMotifSynthe, NoteSynthe } from '../api-synthes';
import { bientot } from '../erreur';
import { reglagesLus, relacheSynthe, synthe, syntheTenu } from '../synthese/registre-synthes';
import { RELACHE_ACCORD } from './melodiques';

export type { NoteSynthe } from '../api-synthes';
export { preparerBoucle, sonieCourte } from '../synthese/outils-notes';

/** Relâchement (s) de chaque son v1 à la fin de la note. Les sons des accords gardent celui de la phase 1. */
export const RELACHES: Record<SonMelodie, number> = {
  piano: 0.15,
  epiano: RELACHE_ACCORD,
  cloche: RELACHE_ACCORD,
  nappe: RELACHE_ACCORD,
  lead: 0.08,
  pluck: 0.06,
};

/** Sons v1 tenus (avec boucle) : ils ne s'éteignent pas seuls. */
export const SONS_TENUS: ReadonlySet<SonMelodie> = new Set<SonMelodie>(['nappe', 'lead']);

/** Relâchement (s) d'un son (v1 ou synthé de C3, id court). */
export function relacheSon(son: string): number {
  return Object.hasOwn(RELACHES, son) ? RELACHES[son as SonMelodie] : relacheSynthe(son);
}

/** true si le son (id court) tient ses notes. */
export function sonTenu(son: string): boolean {
  return SONS_TENUS.has(son as SonMelodie) || syntheTenu(son);
}

/** Son de synthèse d'un motif d'accords : le « piano » des accords est le piano électrique FM (`epiano`). */
export function sonAccord(son: 'piano' | 'nappe' | 'cloche'): SonMelodie {
  return son === 'piano' ? 'epiano' : son;
}

/**
 * Variante d'un son v1 selon le style. Fait partie de la clé du cache. Le piano électrique a une version lo-fi ;
 * la cloche du phonk est la cloche 808 accordée (« cowbell »). Les synthés de C3 n'ont pas de variante ('').
 */
export function varianteNote(son: string, style: string): string {
  // Dans le fichier du style (SonStyle.variantes) : lo-fi { epiano: 'lofi' }, phonk { cloche: 'cowbell' }.
  return (SONS_MELODIE as readonly string[]).includes(son) ? varianteStyle(style, son) : '';
}

/**
 * Synthétise une note sans durée d'un son (v1 ou synthé PRÊT de C3, id court). `variante` : voir varianteNote.
 * `reglages` : PisteInstrument.synthe (absent = défauts). Synthé inconnu, pas prêt ou « motif » : ErreurOcka « pas_encore ».
 */
export function synthetiserNote(son: string, variante: string, midi: number, reglages?: ReglagesSynthe): NoteSynthe {
  const def = synthe(son);
  if (!def?.rendreNote) throw bientot();
  return def.rendreNote(midi, reglagesLus(def, reglages), variante);
}

/** Rend un passage de motif d'un synthé « motif » (303). Même erreur que synthetiserNote s'il n'est pas prêt. */
export function synthetiserMotif(son: string, notes: readonly NoteMotifSynthe[], duree: number, reglages?: ReglagesSynthe): Float32Array[] {
  const def = synthe(son);
  if (!def?.rendreMotif) throw bientot();
  return def.rendreMotif(notes, duree, reglages ? reglagesLus(def, reglages) : reglagesLus(def, undefined));
}
