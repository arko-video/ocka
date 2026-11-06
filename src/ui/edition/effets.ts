// Édition pure des effets de la voix (Réverbe, Écho, Radio, Doubler) et de la chaîne du master (colle).

import type { EffetsVoix, Morceau, PisteFixe } from '../../morceau/types';

export const EFFETS = ['reverbe', 'echo', 'radio', 'doubler'] as const;
export type Effet = (typeof EFFETS)[number];
/** Effets qui ont un curseur de niveau (0 à 1). */
export type EffetNiveau = 'reverbe' | 'echo';
export const NIVEAU_DEFAUT: Record<EffetNiveau, number> = { reverbe: 0.35, echo: 0.3 };
/** Niveau le plus bas du curseur : à 0, l'effet serait allumé sans rien faire. */
export const NIVEAU_MIN = 0.05;

const pisteVoix = (m: Morceau): PisteFixe | undefined => {
  const p = m.pistes.find((x) => x.id === 'voix');
  return p && p.genre !== 'instrument' ? p : undefined;
};

export function effetsVoix(m: Morceau): EffetsVoix {
  return pisteVoix(m)?.effets ?? {};
}

export function effetActif(e: EffetsVoix, effet: Effet): boolean {
  const v = e[effet];
  return typeof v === 'number' ? v > 0 : v === true;
}

/** Écrit les effets sur la piste voix (créée si elle manque) ; `effets` vide = clé retirée. */
function ecrire(m: Morceau, effets: EffetsVoix): Morceau {
  const p = pisteVoix(m);
  const base: PisteFixe = p ?? { id: 'voix', volume: 1, pan: 0, muet: false, solo: false, preset: 'naturel' };
  const n: PisteFixe = { ...base, effets };
  if (Object.keys(effets).length === 0) delete n.effets;
  if (p && JSON.stringify(n) === JSON.stringify(p)) return m;
  return { ...m, pistes: p ? m.pistes.map((x) => (x.id === 'voix' ? n : x)) : [...m.pistes, n] };
}

/** Allume ou éteint un effet (Réverbe et Écho s'allument à leur niveau par défaut). */
export function basculerEffet(m: Morceau, effet: Effet): Morceau {
  const e: EffetsVoix = { ...effetsVoix(m) };
  if (effetActif(e, effet)) delete e[effet];
  else if (effet === 'reverbe' || effet === 'echo') e[effet] = NIVEAU_DEFAUT[effet];
  else e[effet] = true;
  return ecrire(m, e);
}

/** Niveau de Réverbe ou d'Écho (0,05 à 1, au centième) ; l'effet s'allume s'il était éteint. */
export function reglerNiveauEffet(m: Morceau, effet: EffetNiveau, niveau: number): Morceau {
  if (!Number.isFinite(niveau)) return m;
  const v = Math.round(Math.min(1, Math.max(NIVEAU_MIN, niveau)) * 100) / 100;
  return ecrire(m, { ...effetsVoix(m), [effet]: v });
}

/** Chaîne du master : 1 = son des phases 0 et 1 (sans colle), 2 = nouveau son (colle, panoramiques). */
export function reglerChaine(m: Morceau, chaine: 1 | 2): Morceau {
  if (m.master.chaine === chaine || (chaine !== 1 && chaine !== 2)) return m;
  return { ...m, master: { ...m.master, chaine } };
}
