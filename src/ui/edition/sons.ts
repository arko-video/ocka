// Édition pure de « Tes sons » : sons importés, pads perso de la batterie, boucle d'une section.

import { MESURES_BOUCLE, PADS_PERSO, PLAFONDS, type InstrumentBatterie, type Morceau, type PadPerso, type Section, type SonImporte } from '../../morceau/types';
import { INSTRUMENTS } from './batterie';

export type Boucle = NonNullable<Section['boucle']>;
/** Au-delà d'un demi-ton de changement de hauteur, on prévient. */
export const SEUIL_DEMI_TON = 1;

export function estPadPerso(i: string): i is PadPerso {
  return (PADS_PERSO as readonly string[]).includes(i);
}

export function sonParId(m: Morceau, id: string | undefined): SonImporte | undefined {
  return id ? m.sons?.find((s) => s.id === id) : undefined;
}

/** Le son posé sur un pad perso (undefined si le pad est vide ou si son son a disparu). */
export function sonDuPad(m: Morceau, pad: PadPerso): SonImporte | undefined {
  return sonParId(m, m.pads?.[pad]);
}

/** Instruments de la grille : les 8 de base, puis les pads perso qui ont un son. */
export function instrumentsDuMorceau(m: Morceau): InstrumentBatterie[] {
  return [...INSTRUMENTS, ...PADS_PERSO.filter((p) => sonDuPad(m, p))];
}

/** Premier pad perso vide (pour le proposer), sinon null. */
export function padLibre(m: Morceau): PadPerso | null {
  return PADS_PERSO.find((p) => !sonDuPad(m, p)) ?? null;
}

/** Ajoute un son importé (rendu par importerSon) au morceau. 16 sons et 120 s au plus. */
export function ajouterSon(m: Morceau, son: SonImporte): Morceau {
  const sons = m.sons ?? [];
  if (sons.some((s) => s.id === son.id) || sons.length >= PLAFONDS.sons) return m;
  const total = sons.reduce((t, s) => t + s.duree, 0);
  if (total + son.duree > PLAFONDS.dureeSons + 1e-6) return m;
  return { ...m, sons: [...sons, son] };
}

/** Pose un son sur un pad perso (null : vide le pad). */
export function affecterPad(m: Morceau, pad: PadPerso, idSon: string | null): Morceau {
  if (!estPadPerso(pad)) return m;
  if (idSon !== null && !sonParId(m, idSon)) return m;
  if ((m.pads?.[pad] ?? null) === idSon) return m;
  const pads = { ...m.pads };
  if (idSon === null) delete pads[pad];
  else pads[pad] = idSon;
  return { ...m, pads };
}

/** Durée (s) de `mesures` mesures de 4 temps. */
export function dureeMesures(tempo: number, mesures: number): number {
  return (mesures * 4 * 60) / tempo;
}

/**
 * Changement de hauteur (demi-tons) quand un son de `dureeSon` s est calé pour durer `dureeCible` s :
 * étiré, il descend (négatif) ; resserré, il monte. |12·log2(cible / son)|, avec le sens.
 */
export function ecartDemiTons(dureeSon: number, dureeCible: number): number {
  if (!(dureeSon > 0) || !(dureeCible > 0)) return 0;
  return 12 * Math.log2(dureeSon / dureeCible);
}

/** Longueur de boucle (1, 2, 4 ou 8 mesures) la plus proche de la durée du son. */
export function mesuresProches(dureeSon: number, tempo: number): Boucle['mesures'] {
  const enMesures = dureeSon / dureeMesures(tempo, 1);
  let mieux: Boucle['mesures'] = MESURES_BOUCLE[0];
  for (const n of MESURES_BOUCLE) if (Math.abs(Math.log2(n / enMesures)) < Math.abs(Math.log2(mieux / enMesures))) mieux = n;
  return mieux;
}

/** Boucle proposée pour un son : la longueur la plus proche, calée si la hauteur bouge d'un demi-ton au plus. */
export function boucleProposee(m: Morceau, son: SonImporte, mesures?: Boucle['mesures']): Boucle {
  const n = mesures ?? mesuresProches(son.duree, m.tempo);
  const ecart = ecartDemiTons(son.duree, dureeMesures(m.tempo, n));
  return { son: son.id, mesures: n, caler: Math.abs(ecart) <= SEUIL_DEMI_TON };
}

/** Règle la boucle d'une section (null : sans boucle). Son inconnu ou longueur impossible : rien ne change. */
export function reglerBoucle(m: Morceau, idSection: string, boucle: Boucle | null): Morceau {
  const s = m.sections.find((x) => x.id === idSection);
  if (!s) return m;
  if (boucle && (!sonParId(m, boucle.son) || !(MESURES_BOUCLE as readonly number[]).includes(boucle.mesures))) return m;
  if (JSON.stringify(s.boucle ?? null) === JSON.stringify(boucle)) return m;
  const nouvelle: Section = { ...s };
  if (boucle) nouvelle.boucle = { son: boucle.son, mesures: boucle.mesures, caler: !!boucle.caler };
  else delete nouvelle.boucle;
  return { ...m, sections: m.sections.map((x) => (x.id === idSection ? nouvelle : x)) };
}
