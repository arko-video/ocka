// Déclaration de l'IA pour le distributeur (`infos.ia`), mise à jour par OCKA (jamais par l'IA elle-même) :
// - « Lance-moi un beat » : le morceau est ENTIÈREMENT écrit par l'IA → musique « ia » (et paroles « ia » s'il y en a) ;
// - « Continue mon idée » (l'IA a écrit des notes dans ton morceau) → musique « aide » ;
// - « Aide aux paroles » → paroles « aide » ;
// - l'autotune réglé par l'IA (conseil appliqué) → voix « aide ».
// On ne baisse jamais un niveau déjà déclaré (« ia » reste « ia »). Fonctions pures.

import type { InfosTitre, Morceau, NiveauIa } from '../morceau/types';

const RANG: Record<NiveauIa, number> = { aucune: 0, aide: 1, ia: 2 };
const plusHaut = (a: NiveauIa, b: NiveauIa): NiveauIa => (RANG[b] > RANG[a] ? b : a);

/** `true` = « aide » ; `false` ou absent = rien ne change. */
type Usage = boolean | Exclude<NiveauIa, 'aucune'>;
const relever = (avant: NiveauIa, u: Usage | undefined): NiveauIa => (u ? plusHaut(avant, u === true ? 'aide' : u) : avant);

/** Renvoie le morceau avec `infos.ia` relevé pour ce qui a servi (le même objet si rien ne change). */
export function marquerIa(m: Morceau, quoi: { musique?: Usage; paroles?: Usage; voix?: Usage }): Morceau {
  const avant = m.infos?.ia ?? { paroles: 'aucune', musique: 'aucune', voix: 'aucune' };
  const ia: NonNullable<InfosTitre['ia']> = {
    paroles: relever(avant.paroles, quoi.paroles),
    musique: relever(avant.musique, quoi.musique),
    voix: relever(avant.voix, quoi.voix),
  };
  if (m.infos?.ia && ia.paroles === avant.paroles && ia.musique === avant.musique && ia.voix === avant.voix) return m;
  return { ...m, infos: { ...m.infos, ia } };
}

/**
 * Met les lignes choisies dans `section.paroles` (après ce qui est déjà écrit), et note l'aide aux paroles.
 * 4 000 caractères au plus par section (règle du format). Renvoie le même morceau si la section n'existe plus.
 */
export function appliquerParoles(m: Morceau, sectionId: string, lignes: readonly string[]): Morceau {
  const s = m.sections.find((x) => x.id === sectionId);
  const ajout = lignes.map((l) => l.trim()).filter(Boolean).join('\n');
  if (!s || !ajout) return m;
  const avant = (s.paroles ?? '').replace(/\s+$/, '');
  const paroles = (avant ? `${avant}\n${ajout}` : ajout).slice(0, 4000);
  const sections = m.sections.map((x) => (x.id === sectionId ? { ...x, paroles } : x));
  return marquerIa({ ...m, sections }, { paroles: true });
}
