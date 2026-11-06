// Réglages d'une piste synthé (PisteInstrument.synthe) : édition PURE, et tables d'onde de l'onde dessinée (L).
// Règles : params de 0 à 1 (arrondis au cran, puis au millième comme le normaliseur), seulement les clés de la
// DefinitionSynthe ; onde de `points` valeurs de −1 à 1 ; même objet si rien ne change ; le normaliseur l'accepte.
import { pisteDe } from '../../../morceau/acces';
import type { Morceau, PisteInstrument, ReglagesSynthe } from '../../../morceau/types';
import { definitionDe } from '../registre-synthes';
import { milliemes } from './communs';
import { tablesDeOnde } from './tables';

function pisteSynthe(m: Morceau, idPiste: string): PisteInstrument | null {
  const p = pisteDe(m, idPiste);
  return p && p.genre === 'instrument' ? p : null;
}

function remplacer(m: Morceau, p: PisteInstrument, synthe: ReglagesSynthe): Morceau {
  return { ...m, pistes: m.pistes.map((x) => (x === p ? { ...p, synthe } : x)) };
}

export function reglerParamSynthe(m: Morceau, idPiste: string, cle: string, valeur: number): Morceau {
  const p = pisteSynthe(m, idPiste);
  const def = p ? definitionDe(p.instrument) : null;
  if (!p || !def || !Object.hasOwn(def.params, cle) || !Number.isFinite(valeur)) return m;
  const crans = def.params[cle]!.crans;
  let v = Math.min(1, Math.max(0, valeur));
  if (crans && crans > 1) v = Math.round(v * (crans - 1)) / (crans - 1);
  v = milliemes(v);
  const avant = p.synthe?.params;
  if (avant && Object.hasOwn(avant, cle) && avant[cle] === v) return m;
  const params: Record<string, number> = Object.create(null);
  if (avant) for (const [k, x] of Object.entries(avant)) if (Object.hasOwn(def.params, k)) params[k] = x;
  params[cle] = v;
  return remplacer(m, p, { ...p.synthe, params });
}

/** Rééchantillonne une onde (boucle) à `points` valeurs, bornées à [−1, 1] et arrondies au millième. */
function aPoints(onde: readonly number[], points: number): number[] {
  return Array.from({ length: points }, (_, i) => {
    const x = (i * onde.length) / points;
    const k = Math.floor(x);
    const a = onde[k % onde.length] ?? 0;
    const b = onde[(k + 1) % onde.length] ?? 0;
    const v = a + (b - a) * (x - k);
    return milliemes(Math.min(1, Math.max(-1, Number.isFinite(v) ? v : 0)));
  });
}

export function dessinerOnde(m: Morceau, idPiste: string, onde: readonly number[]): Morceau {
  const p = pisteSynthe(m, idPiste);
  const def = p ? definitionDe(p.instrument) : null;
  if (!p || !def?.points || onde.length < 2) return m;
  const o = aPoints(onde, def.points);
  const avant = p.synthe?.onde;
  if (avant && avant.length === o.length && avant.every((x, i) => x === o[i])) return m;
  return remplacer(m, p, { ...p.synthe, onde: o });
}

/** Une table par octave d'une onde dessinée (voir tablesDeOnde, tables.ts). */
export function tablesOnde(onde: readonly number[]): Float32Array[] {
  return tablesDeOnde(onde);
}
