// Découpe d'un son (sample chop, façon Slicex) : aux attaques (flux spectral) ou en parts égales, puis envoi des
// découpes sur les pads perso. Les découpes sont des passages du MÊME tampon (SonImporte.tranches) : rien n'est copié.
// Fonctions PURES ; sur le morceau, le même objet si rien ne change (un Annuler).

import { PADS_PERSO, PLAFONDS, type DecoupeSon, type Morceau, type PadPerso, type SonImporte } from '../morceau/types';
import type { PcmSon } from '../moteur/types-moteur';
import { fluxSpectral, longueur, mono, puissance2 } from './spectre';

/** Une découpe plus courte est retirée (comme le normaliseur). */
export const DECOUPE_MIN = 0.005;
/** Deux attaques sont séparées d'au moins 50 ms. */
const ECART_MIN = 0.05;

const arrondi = (s: number) => Math.round(s * 1e6) / 1e6;

/** Instants des attaques (s), triés : pics du flux spectral au-dessus d'un seuil local qui dépend de la sensibilité. */
export function attaques(pcm: PcmSon, sensibilite: number): number[] {
  const n = longueur(pcm);
  const sr = pcm.frequence;
  if (n === 0 || !(sr > 0)) return [];
  const x = mono(pcm);
  const taille = puissance2(Math.round(sr * 0.023)); // ~23 ms
  const pas = taille / 4;
  const flux = fluxSpectral(x, taille, pas);
  const s = Math.min(1, Math.max(0, Number.isFinite(sensibilite) ? sensibilite : 0.5));
  const delta = 0.02 + 0.35 * (1 - s) ** 2;
  const voisins = Math.max(1, Math.round((0.1 * sr) / pas));
  const ecart = Math.round((ECART_MIN * sr) / pas);
  let plusFort = 0;
  for (let i = 0; i < flux.length; i++) plusFort = Math.max(plusFort, rms(x, i * pas, taille));
  const porte = plusFort * Math.pow(10, -(24 + 30 * s) / 20); // −24 dB (peu sensible) à −54 dB (tout)
  const pics: { t: number; force: number }[] = [];
  let dernier = -Infinity;
  for (let i = 1; i < flux.length - 1; i++) {
    const v = flux[i]!;
    if (v < flux[i - 1]! || v < flux[i + 1]!) continue;
    let somme = 0;
    let nb = 0;
    for (let j = Math.max(0, i - voisins); j <= Math.min(flux.length - 1, i + voisins); j++) (somme += flux[j]!), nb++;
    if (v < somme / nb + delta) continue;
    if (rms(x, i * pas, taille) < porte) continue; // trop faible (bruit de fond, fin de son)
    if (i - dernier < ecart) {
      if (pics.length && v > pics[pics.length - 1]!.force) pics[pics.length - 1] = { t: i, force: v };
      continue;
    }
    pics.push({ t: i, force: v });
    dernier = i;
  }
  // Instant précis : dans la trame, le bloc de 2 ms où l'énergie monte le plus.
  const bloc = Math.max(16, Math.round(sr * 0.002));
  const precis = pics.map(({ t, force }) => {
    const centre = t * pas;
    const debut = Math.max(0, centre - taille / 2);
    const fin = Math.min(n, centre + taille / 2);
    let meilleur = centre;
    let hausse = -Infinity;
    let avant = energie(x, debut - bloc, debut);
    for (let i = debut; i + bloc <= fin; i += bloc) {
      const e = energie(x, i, i + bloc);
      if (e - avant > hausse) (hausse = e - avant), (meilleur = i);
      avant = e;
    }
    return { t: Math.max(0, meilleur - bloc / 2) / sr, force };
  });
  // 64 découpes au plus : on garde les attaques les plus fortes.
  const gardees = precis.length > PLAFONDS.decoupesParSon ? [...precis].sort((a, b) => b.force - a.force).slice(0, PLAFONDS.decoupesParSon) : precis;
  return gardees.map((p) => arrondi(p.t)).sort((a, b) => a - b);
}

/** Niveau RMS de la trame centrée sur `centre`. */
function rms(x: Float32Array, centre: number, taille: number): number {
  return Math.sqrt(energie(x, centre - taille / 2, centre + taille / 2) / taille);
}

function energie(x: Float32Array, de: number, a: number): number {
  let e = 0;
  for (let i = Math.max(0, de); i < Math.min(x.length, a); i++) e += x[i]! * x[i]!;
  return e;
}

/** Découpes entre des bornes (s) : [b0, b1], [b1, b2]… jusqu'à la durée ; vides retirées, 64 au plus. */
export function decoupesEntre(bornes: readonly number[], duree: number): DecoupeSon[] {
  const b = [...new Set(bornes.filter((t) => Number.isFinite(t) && t > 0 && t < duree).map(arrondi))].sort((x, y) => x - y);
  const points = [0, ...b, duree];
  const out: DecoupeSon[] = [];
  for (let i = 0; i + 1 < points.length; i++) if (points[i + 1]! - points[i]! >= DECOUPE_MIN) out.push({ debut: points[i]!, fin: points[i + 1]! });
  return out.slice(0, PLAFONDS.decoupesParSon);
}

/** Voir api-sons-avances.ts. Un début de son sans attaque (plus de 20 ms) devient la première découpe. */
export function decouperAttaques(pcm: PcmSon, sensibilite: number): DecoupeSon[] {
  const duree = longueur(pcm) / pcm.frequence;
  if (!(duree > 0)) return [];
  const t = attaques(pcm, sensibilite).filter((x) => x > 0.02);
  return decoupesEntre(t.slice(0, PLAFONDS.decoupesParSon - 1), duree);
}

/** Voir api-sons-avances.ts. */
export function decouperEgal(duree: number, parts: number): DecoupeSon[] {
  if (!(duree > 0) || !Number.isFinite(duree)) return [];
  const p = Math.min(PLAFONDS.decoupesParSon, Math.max(2, Math.round(Number.isFinite(parts) ? parts : 2)));
  if (duree / p < DECOUPE_MIN) return [];
  return Array.from({ length: p }, (_, i) => ({ debut: arrondi((i * duree) / p), fin: i === p - 1 ? duree : arrondi(((i + 1) * duree) / p) }));
}

/** Découpes propres pour un son : dans [0, durée], 5 ms au moins, triées, 64 au plus. */
export function nettoyerDecoupes(tranches: readonly DecoupeSon[], duree: number): DecoupeSon[] {
  const out: DecoupeSon[] = [];
  for (const t of tranches) {
    if (!t || !Number.isFinite(t.debut) || !Number.isFinite(t.fin)) continue;
    const debut = Math.min(duree, Math.max(0, t.debut));
    const fin = Math.min(duree, Math.max(0, t.fin));
    if (fin - debut >= DECOUPE_MIN) out.push({ debut, fin });
  }
  return out.sort((a, b) => a.debut - b.debut).slice(0, PLAFONDS.decoupesParSon);
}

const memes = (a: readonly DecoupeSon[] | undefined, b: readonly DecoupeSon[]) =>
  (a?.length ?? 0) === b.length && b.every((t, i) => a![i]!.debut === t.debut && a![i]!.fin === t.fin);

/** Les pads qui jouent un son. */
function padsDuSon(m: Morceau, idSon: string): PadPerso[] {
  return PADS_PERSO.filter((p) => m.pads?.[p] === idSon);
}

/** Voir api-sons-avances.ts. Les pads qui jouaient une découpe disparue jouent le son entier. */
export function poserDecoupes(m: Morceau, idSon: string, tranches: readonly DecoupeSon[]): Morceau {
  const son = m.sons?.find((s) => s.id === idSon);
  if (!son) return m;
  const propres = nettoyerDecoupes(tranches, son.duree);
  if (memes(son.tranches, propres)) return m;
  const nouveau: SonImporte = { ...son };
  if (propres.length) nouveau.tranches = propres;
  else delete nouveau.tranches;
  const res: Morceau = { ...m, sons: m.sons!.map((s) => (s.id === idSon ? nouveau : s)) };
  const tp = { ...m.tranchesPads };
  let change = false;
  for (const p of padsDuSon(m, idSon)) {
    if (tp[p] !== undefined && tp[p]! >= propres.length) (delete tp[p], (change = true));
  }
  if (change) {
    if (Object.keys(tp).length) res.tranchesPads = tp;
    else delete res.tranchesPads;
  }
  return res;
}

/** Voir api-sons-avances.ts. */
export function tranchesVersPads(m: Morceau, idSon: string, premiere: number, pads?: readonly PadPerso[]): Morceau {
  const son = m.sons?.find((s) => s.id === idSon);
  const n = son?.tranches?.length ?? 0;
  if (!son || n === 0 || !Number.isInteger(premiere) || premiere < 0 || premiere >= n) return m;
  const cibles = (pads ?? PADS_PERSO).filter((p, i, t) => (PADS_PERSO as readonly string[]).includes(p) && t.indexOf(p) === i);
  const padsM = { ...m.pads };
  const tp = { ...m.tranchesPads };
  let change = false;
  cibles.forEach((p, i) => {
    const k = premiere + i;
    if (k >= n) return;
    if (padsM[p] !== idSon || tp[p] !== k) change = true;
    padsM[p] = idSon;
    tp[p] = k;
  });
  return change ? { ...m, pads: padsM, tranchesPads: tp } : m;
}
