// Préparation des inserts JS (compresseur, bitcrusher) d'un contexte, AVANT construireGraphe (propriétaire : M2).
//  - Écoute : charge le worklet « ocka-inserts » (une fois par contexte) si une piste en a besoin.
//  - Hors ligne (export, pistes séparées, A/B) : AUCUN worklet. « Passe A » : un rendu où chaque piste concernée
//    s'arrête juste avant ses inserts JS (registre.prises), sur 2 canaux à elle ; on y applique le JS
//    (traiterInsertsJs, le MÊME calcul que le worklet), et le résultat est rejoué dans le vrai rendu à la place du
//    worklet (registre.rendus, chaine-inserts.ts). Pistes groupées par passes (≤ BUDGET_PASSE de rendu chacune).
// Idempotent : appelé par le graphe (M1) et, avant lui, par ab.ts (qui ne rend pas depuis 0) et stems.ts.

import type { Morceau } from '../../morceau/types';
import { rendreParFenetres } from '../audio/rendu';
import { gainPiste } from '../chaines';
import { construireGraphe, type PcmPrise } from '../graphe';
import { oublierBanque } from '../instruments/banque';
import { detruireBus } from '../instruments/bus';
import type { PcmSon } from '../types-moteur';
import { estJs } from './dsp';
import { optionsInserts } from './chaine-inserts';
import { traiterInsertsJs } from './inserts';
import { prises as prisesA, rendus, type RenduJs } from './registre';
import { chargerInserts } from './worklet-inserts';

const PAS = 128 * 172;
/** Rendu d'une passe A (octets) au plus. */
const BUDGET = 128 * 1024 * 1024;

/** Pistes qui ont des inserts JS actifs et qui s'entendent. */
export function pistesJs(m: Morceau): string[] {
  return m.pistes.filter((p) => (p.inserts ?? []).some(estJs) && gainPiste(p, m.pistes) > 0).map((p) => p.id);
}

/**
 * Prépare les inserts JS du contexte `ctx` pour `morceau`. Hors ligne, `debut` = temps du morceau rendu à la trame 0
 * de `ctx` (0 pour l'export ; A/B : début de sa fenêtre).
 */
export async function preparerTranches(ctx: BaseAudioContext, morceau: Morceau, prises: Map<string, PcmPrise>, sons: Map<string, PcmSon>, debut = 0): Promise<void> {
  const ids = pistesJs(morceau);
  if (ids.length === 0) return;
  if (!('startRendering' in ctx) || optionsInserts.workletHorsLigne) return void (await chargerInserts(ctx));
  if (prisesA.has(ctx) || rendus.has(ctx)) return;
  const hl = ctx as OfflineAudioContext;
  const fs = hl.sampleRate;
  const n = Math.ceil(hl.length / PAS) * PAS;
  const parPasse = Math.max(1, Math.min(8, Math.floor(BUDGET / (n * 8))));
  const resultat = new Map<string, RenduJs>();
  for (let k = 0; k < ids.length; k += parPasse) {
    const groupe = ids.slice(k, k + parPasse);
    const ctxA = new OfflineAudioContext(2 * groupe.length, n, fs);
    prisesA.set(ctxA, new Set(groupe));
    const fusion = ctxA.createChannelMerger(2 * groupe.length);
    fusion.connect(ctxA.destination);
    const nulle = ctxA.createGain();
    const separees = Object.create(null) as Record<string, AudioNode>;
    for (const p of morceau.pistes) separees[p.id] = nulle;
    groupe.forEach((id, i) => {
      const g = ctxA.createGain();
      g.channelCount = 2;
      g.channelCountMode = 'explicit';
      const s = ctxA.createChannelSplitter(2);
      g.connect(s);
      s.connect(fusion, 0, 2 * i);
      s.connect(fusion, 1, 2 * i + 1);
      separees[id] = g;
    });
    const graphe = await construireGraphe(ctxA, morceau, prises, nulle, { pistesSeparees: separees, sons });
    let tampon: AudioBuffer;
    try {
      tampon = await rendreParFenetres(ctxA, graphe, debut, { pas: PAS });
    } finally {
      graphe.detruire();
      detruireBus(ctxA);
      oublierBanque(ctxA);
    }
    groupe.forEach((id, i) => {
      const p = morceau.pistes.find((x) => x.id === id)!;
      traiterInsertsJs([tampon.getChannelData(2 * i), tampon.getChannelData(2 * i + 1)], fs, p.inserts ?? [], Math.round(debut * fs));
      resultat.set(id, { tampon, canal: 2 * i, debut });
    });
  }
  rendus.set(ctx, resultat);
}
