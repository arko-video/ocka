// Bruitage « au hasard » (L) : une catégorie au hasard, bien mutée (muterSfxr : moteur/api-synthes.ts). Pur.
import { CATEGORIES_SFXR, muterSfxr, sfxrAuHasard } from '../../../moteur/api';
import type { RecetteSfxr } from '../../../morceau/types';

export { muterSfxr };

function hasard(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un bruitage au hasard : une catégorie au hasard, bien mutée. */
export function sfxrAleatoire(graine: number): RecetteSfxr {
  const h = hasard(graine ^ 0x2545f491);
  const cat = CATEGORIES_SFXR[Math.floor(h() * CATEGORIES_SFXR.length)]!;
  return muterSfxr(muterSfxr(sfxrAuHasard(cat, graine), graine + 1, 0.25), graine + 2, 0.25);
}

export const nouvelleGraineSfxr = (): number => Math.floor(Math.random() * 2 ** 31);
