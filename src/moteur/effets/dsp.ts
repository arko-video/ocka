// Inserts « en JS » (compresseur, bitcrusher) côté fil principal (propriétaire : M2, vague C1) : quels inserts sont
// en JS, et leurs réglages COMPLETS pour le calcul (dsp.worklet.ts, partagé par le worklet et l'export).

import { PARAMS_EFFETS, type Insert } from '../../morceau/types';
import type { ReglageJs, TypeJs } from './dsp.worklet';

export { BitFlux, ChaineJs, CompFlux, NOM_INSERTS, rattrapageDb, reductionDb, type ReglageJs, type TypeJs } from './dsp.worklet';

/** Types d'inserts calculés en JS (les autres sont des nœuds natifs). */
export const TYPES_JS: readonly TypeJs[] = ['compresseur', 'bitcrusher'];

export const estJs = (i: Insert): boolean => i.actif && (TYPES_JS as readonly string[]).includes(i.type);

/** Réglage d'un insert : sa valeur, sinon le défaut de PARAMS_EFFETS. */
export function reglage(type: Insert['type'], params: Record<string, number>, cle: string): number {
  const v = Object.hasOwn(params, cle) ? params[cle] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : PARAMS_EFFETS[type][cle]!.defaut;
}

/** Les réglages JS complets (défauts posés, copie transmissible au worklet) des inserts JS ACTIFS, dans l'ordre. */
export function reglagesJs(inserts: readonly Insert[]): ReglageJs[] {
  return inserts.filter(estJs).map((i) => {
    const params: Record<string, number> = {};
    for (const cle of Object.keys(PARAMS_EFFETS[i.type])) params[cle] = reglage(i.type, i.params, cle);
    return { type: i.type as TypeJs, params };
  });
}
