// Mutation d'un bruitage façon sfxr (bouton « Muter », L) : la recette change un peu, pas son type d'onde. Pur :
// même recette + même graine = même résultat. Les valeurs restent au millième, dans [−1, 1] pour les glissés de sfxr
// et [0, 1] pour le reste (le normaliseur les relit sans rien changer).
import type { RecetteSfxr } from '../../../morceau/types';

/** Réglages de sfxr qui vont de −1 à 1 (les glissés). */
const SIGNES = new Set([
  'slide',
  'deltaSlide',
  'changeAmount',
  'dutySweep',
  'phaserOffset',
  'phaserSweep',
  'lpFilterCutoffSweep',
  'hpFilterCutoffSweep',
]);

export function hasard(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function muterSfxr(r: RecetteSfxr, graine: number, force = 0.1): RecetteSfxr {
  const h = hasard(graine);
  const params: Record<string, number> = Object.create(null);
  for (const [k, v] of Object.entries(r.params)) {
    if (k === 'onde' || h() < 0.5) {
      params[k] = v;
      continue;
    }
    const min = SIGNES.has(k) ? -1 : 0;
    params[k] = Math.round(Math.min(1, Math.max(min, v + (h() * 2 - 1) * force)) * 1000) / 1000;
  }
  return { type: 'sfxr', graine: Math.floor(h() * 2 ** 31), params };
}

