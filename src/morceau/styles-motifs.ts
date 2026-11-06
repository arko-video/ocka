// Les motifs de départ de chaque style (batterie, ligne de 808, suites d'accords), lus dans le registre des styles
// (styles/<id>.ts : chaque style y écrit ses grilles, voir styles-grilles.ts). Gardé pour les anciens imports.

import type { QuatreMotifs } from './styles-grilles';
import { DEFINITIONS_STYLES, type SuiteStyle } from './styles/index';
import type { MotifBasse, Style } from './types';

export { frappes, motifBatterie, roulements, type QuatreMotifs } from './styles-grilles';

const parStyle = <T>(lire: (d: (typeof DEFINITIONS_STYLES)[Style]) => T): Record<Style, T> =>
  Object.fromEntries(Object.values(DEFINITIONS_STYLES).map((d) => [d.id, lire(d)])) as Record<Style, T>;

export const BATTERIES: Record<Style, () => QuatreMotifs> = parStyle((d) => d.batterie);

/** La ligne de 808 de chaque style (couplet et refrain). */
export const BASSES: Record<Style, () => { couplet: MotifBasse; refrain: MotifBasse }> = parStyle((d) => d.basse);

/** Les 3 suites d'accords de chaque style (degrés romains, 1 accord par mesure). */
export const SUITES: Record<Style, SuiteStyle[]> = parStyle((d) => d.suites);
