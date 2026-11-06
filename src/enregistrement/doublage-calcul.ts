// Doublage automatique (pur : Worker et tests). Deux copies de la voix, l'une un peu plus haute, l'autre un peu plus
// basse (± désaccord, 8 cents par défaut), chacune RETARDÉE de 15 à 30 ms (retard qui glisse lentement : c'est ce
// glissement qui change la hauteur, sans changer la durée). Glissement en dents de scie, deux lectures décalées
// d'une demi-période et fondues en sin² (somme constante) : pas de saut au retour de la dent.
// La prise reste MONO (format) : les copies sont mélangées à la voix (écart du contrat C3 : la largeur stéréo,
// copies à gauche et à droite, reste l'effet « Doubler » de la piste voix).

import type { ReglagesDoublage } from './api-voix-avancee';

const borne = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/** Réglages par défaut : retard moyen 22,5 ms (15 à 30 ms), ±8 cents, copies à −6 dB. */
export const DOUBLAGE_AUTO: ReglagesDoublage = { ecart: 0.4167, desaccord: 0.5333, niveau: 0.5 };

/** Retard moyen (ms), désaccord (cents) et gain de chaque copie, d'après les réglages (0 à 1). */
export function parametresDoublage(r: ReglagesDoublage): { ecartMs: number; cents: number; gain: number } {
  return { ecartMs: 10 + 30 * borne(r.ecart), cents: 15 * borne(r.desaccord), gain: borne(r.niveau) };
}

/**
 * Une copie désaccordée de `cents` (signe = sens), au retard glissant de `dMin` à `dMax` secondes. Même longueur.
 * Lecture à retard variable d(n) : hauteur × (1 − d'(n)), donc d' = 1 − 2^(cents/1200).
 */
export function copieDecalee(pcm: Float32Array, fs: number, cents: number, dMin: number, dMax: number): Float32Array {
  const out = new Float32Array(pcm.length);
  const pente = 1 - 2 ** (cents / 1200); // variation du retard par échantillon
  const etendue = (dMax - dMin) * fs;
  if (Math.abs(pente) < 1e-9 || etendue <= 0) {
    const d = Math.round(((dMin + dMax) / 2) * fs);
    for (let i = d; i < pcm.length; i++) out[i] = pcm[i - d]!;
    return out;
  }
  const periode = etendue / Math.abs(pente);
  const lire = (x: number) => {
    const i = Math.floor(x);
    if (i < 0 || i + 1 >= pcm.length) return i >= 0 && i < pcm.length ? pcm[i]! : 0;
    const f = x - i;
    return pcm[i]! * (1 - f) + pcm[i + 1]! * f;
  };
  for (let n = 0; n < pcm.length; n++) {
    let v = 0;
    for (let k = 0; k < 2; k++) {
      const ph = (n / periode + k / 2) % 1;
      // Plus haut (pente < 0) : le retard DIMINUE de dMax à dMin ; plus bas : il augmente.
      const d = pente < 0 ? dMax * fs - etendue * ph : dMin * fs + etendue * ph;
      v += Math.sin(Math.PI * ph) ** 2 * lire(n - d);
    }
    out[n] = v;
  }
  return out;
}

/** La voix + ses deux copies (une plus haute, une plus basse), même longueur. */
export function doubler(pcm: Float32Array, fs: number, r: ReglagesDoublage): Float32Array {
  const { ecartMs, cents, gain } = parametresDoublage(r);
  if (gain <= 0) return pcm.slice();
  const dMin = (ecartMs * 2) / 3 / 1000;
  const dMax = (ecartMs * 4) / 3 / 1000;
  const haute = copieDecalee(pcm, fs, cents, dMin, dMax);
  const basse = copieDecalee(pcm, fs, -cents, dMin, dMax);
  // Voix + copies, puis un gain pour garder à peu près la même sonie (copies peu corrélées : ≈ somme des puissances).
  const norme = 1 / Math.sqrt(1 + 2 * gain * gain);
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = (pcm[i]! + gain * (haute[i]! + basse[i]!)) * norme;
  return out;
}
