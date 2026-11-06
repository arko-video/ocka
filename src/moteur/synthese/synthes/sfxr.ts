// Bruitages façon sfxr (L) : le moteur de sfxr (DrPetter, 2007) récrit en TypeScript, à l'identique dans son
// principe : onde carrée, scie, sinus ou bruit ; enveloppe attaque / tenue (avec « punch ») / chute ; glissé de
// fréquence ; vibrato ; arpège (un saut) ; rapport cyclique qui glisse ; répétition ; filtres passe-bas résonant et
// passe-haut qui balaient ; phaser. Rendu à 44 100 Hz (8 sous-échantillons), puis porté à 48 kHz. Le hasard (bruit)
// vient de la graine de la recette : même recette = même son. Les générateurs suivent ceux de sfxr.
import type { CategorieSfxr } from '../../api-synthes';
import { mulberry32 } from '../briques';
import { milliemes } from './communs';

/** Les réglages de sfxr (noms en camelCase ; −1 à 1 pour les glissés, 0 à 1 sinon). `onde` : 0 carré, 1/3 scie, 2/3 sinus, 1 bruit. */
export const PARAMS_SFXR = [
  'onde', 'attackTime', 'sustainTime', 'sustainPunch', 'decayTime', 'startFrequency', 'minFrequency', 'slide',
  'deltaSlide', 'vibratoDepth', 'vibratoSpeed', 'changeAmount', 'changeSpeed', 'squareDuty', 'dutySweep',
  'repeatSpeed', 'phaserOffset', 'phaserSweep', 'lpFilterCutoff', 'lpFilterCutoffSweep', 'lpFilterResonance',
  'hpFilterCutoff', 'hpFilterCutoffSweep',
] as const; // prettier-ignore
export type ParamSfxr = (typeof PARAMS_SFXR)[number];
/** Réglages qui vont de −1 à 1. */
export const PARAMS_SIGNES: ReadonlySet<string> = new Set([
  'slide',
  'deltaSlide',
  'changeAmount',
  'dutySweep',
  'phaserOffset',
  'phaserSweep',
  'lpFilterCutoffSweep',
  'hpFilterCutoffSweep',
]);

const DEFAUTS: Record<ParamSfxr, number> = {
  onde: 0, attackTime: 0, sustainTime: 0.3, sustainPunch: 0, decayTime: 0.4, startFrequency: 0.3, minFrequency: 0, slide: 0,
  deltaSlide: 0, vibratoDepth: 0, vibratoSpeed: 0, changeAmount: 0, changeSpeed: 0, squareDuty: 0, dutySweep: 0,
  repeatSpeed: 0, phaserOffset: 0, phaserSweep: 0, lpFilterCutoff: 1, lpFilterCutoffSweep: 0, lpFilterResonance: 0,
  hpFilterCutoff: 0, hpFilterCutoffSweep: 0,
}; // prettier-ignore

/** Réglages complets (défauts de sfxr + ceux de la recette, bornés). */
export function paramsComplets(params: Record<string, number>): Record<ParamSfxr, number> {
  const p = { ...DEFAUTS };
  for (const k of PARAMS_SFXR) {
    const v = params[k];
    if (typeof v === 'number' && Number.isFinite(v) && Object.hasOwn(params, k))
      p[k] = Math.min(1, Math.max(PARAMS_SIGNES.has(k) ? -1 : 0, v));
  }
  return p;
}

/** Générateurs de sfxr (pickupCoin, laserShoot, explosion, powerUp, hitHurt, jump, blipSelect). Pur. */
export function genererSfxr(categorie: CategorieSfxr, graine: number): Record<string, number> {
  const h = mulberry32(graine ^ 0x5f3759df);
  const frnd = (r: number) => h() * r;
  const rnd = (n: number) => Math.floor(h() * (n + 1));
  const p: Record<string, number> = { ...DEFAUTS };
  const onde = (w: number) => (p.onde = w / 3);
  switch (categorie) {
    case 'piece':
      p.startFrequency = 0.4 + frnd(0.5);
      p.sustainTime = frnd(0.1);
      p.decayTime = 0.1 + frnd(0.4);
      p.sustainPunch = 0.3 + frnd(0.3);
      if (rnd(1)) {
        p.changeSpeed = 0.5 + frnd(0.2);
        p.changeAmount = 0.2 + frnd(0.4);
      }
      break;
    case 'laser': {
      let w = rnd(2);
      if (w === 2 && rnd(1)) w = rnd(1);
      onde(w);
      p.startFrequency = 0.5 + frnd(0.5);
      p.minFrequency = Math.max(0.2, p.startFrequency - 0.2 - frnd(0.6));
      p.slide = -0.15 - frnd(0.2);
      if (rnd(2) === 0) {
        p.startFrequency = 0.3 + frnd(0.6);
        p.minFrequency = frnd(0.1);
        p.slide = -0.35 - frnd(0.3);
      }
      if (rnd(1)) {
        p.squareDuty = frnd(0.5);
        p.dutySweep = frnd(0.2);
      } else {
        p.squareDuty = 0.4 + frnd(0.5);
        p.dutySweep = -frnd(0.7);
      }
      p.sustainTime = 0.1 + frnd(0.2);
      p.decayTime = frnd(0.4);
      if (rnd(1)) p.sustainPunch = frnd(0.3);
      if (rnd(2) === 0) {
        p.phaserOffset = frnd(0.2);
        p.phaserSweep = -frnd(0.2);
      }
      if (rnd(1)) p.hpFilterCutoff = frnd(0.3);
      break;
    }
    case 'explosion':
      onde(3);
      if (rnd(1)) {
        p.startFrequency = 0.1 + frnd(0.4);
        p.slide = -0.1 + frnd(0.4);
      } else {
        p.startFrequency = 0.2 + frnd(0.7);
        p.slide = -0.2 - frnd(0.2);
      }
      p.startFrequency *= p.startFrequency;
      if (rnd(4) === 0) p.slide = 0;
      if (rnd(2) === 0) p.repeatSpeed = 0.3 + frnd(0.5);
      p.sustainTime = 0.1 + frnd(0.3);
      p.decayTime = frnd(0.5);
      if (rnd(1) === 0) {
        p.phaserOffset = -0.3 + frnd(0.9);
        p.phaserSweep = -frnd(0.3);
      }
      p.sustainPunch = 0.2 + frnd(0.6);
      if (rnd(1)) {
        p.vibratoDepth = frnd(0.7);
        p.vibratoSpeed = frnd(0.6);
      }
      if (rnd(2) === 0) {
        p.changeSpeed = 0.6 + frnd(0.3);
        p.changeAmount = 0.8 - frnd(1.6);
      }
      break;
    case 'bonus':
      if (rnd(1)) onde(1);
      else p.squareDuty = frnd(0.6);
      p.startFrequency = 0.2 + frnd(0.3);
      if (rnd(1)) {
        p.slide = 0.1 + frnd(0.4);
        p.repeatSpeed = 0.4 + frnd(0.4);
      } else {
        p.slide = 0.05 + frnd(0.2);
        if (rnd(1)) {
          p.vibratoDepth = frnd(0.7);
          p.vibratoSpeed = frnd(0.6);
        }
      }
      p.sustainTime = frnd(0.4);
      p.decayTime = 0.1 + frnd(0.4);
      break;
    case 'coup': {
      let w = rnd(2);
      if (w === 2) w = 3;
      onde(w);
      if (w === 0) p.squareDuty = frnd(0.6);
      p.startFrequency = 0.2 + frnd(0.6);
      p.slide = -0.3 - frnd(0.4);
      p.sustainTime = frnd(0.1);
      p.decayTime = 0.1 + frnd(0.2);
      if (rnd(1)) p.hpFilterCutoff = frnd(0.3);
      break;
    }
    case 'saut':
      p.squareDuty = frnd(0.6);
      p.startFrequency = 0.3 + frnd(0.3);
      p.slide = 0.1 + frnd(0.2);
      p.sustainTime = 0.1 + frnd(0.3);
      p.decayTime = 0.1 + frnd(0.2);
      if (rnd(1)) p.hpFilterCutoff = frnd(0.3);
      if (rnd(1)) p.lpFilterCutoff = 1 - frnd(0.6);
      break;
    case 'bip':
      onde(rnd(1));
      if (p.onde === 0) p.squareDuty = frnd(0.6);
      p.startFrequency = 0.2 + frnd(0.4);
      p.sustainTime = 0.1 + frnd(0.1);
      p.decayTime = frnd(0.2);
      p.hpFilterCutoff = 0.1;
      break;
  }
  // Seulement ce qui diffère des défauts, au millième (comme le normaliseur) : la recette relue donne le même son.
  const out: Record<string, number> = Object.create(null);
  for (const k of PARAMS_SFXR) {
    const v = milliemes(Math.min(1, Math.max(-1, p[k]!)));
    if (v !== DEFAUTS[k]) out[k] = v;
  }
  return out;
}
