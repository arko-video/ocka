// A/B du master : écart de sonie BS.1770 entre le master « avec » et « sans » couleur et colle. Propriétaire : M2.
// Hors temps réel, sur 8 mesures du 1er refrain (sinon du début) :
//  1. le mélange des pistes (entrée du master) est rendu UNE fois par construireGraphe(…, { pistesSeparees }),
//     avec 1 mesure d'avance (queues de réverbe, état des compresseurs) ;
//  2. ce mélange passe dans deux chaînes master (avec, et sans), rendues ensemble (le master lui-même en JS,
//     après le rendu : aucun worklet hors ligne, voir audio/master-hors-ligne.ts) ;
//  3. une 2e passe (une seule chaîne) vérifie « sans + compensation » et corrige le reste (juste à ~0,1 LU).

import { normaliserMorceau } from '../morceau/normaliser';
import { arrangement, dureeMorceau, dureePas, PAS_PAR_MESURE } from '../morceau/temps';
import { IDS_PISTES, type IdPiste, type Morceau } from '../morceau/types';
import { appliquerMaster } from './audio/master-hors-ligne';
import { chargerMedias, rendreParFenetres } from './audio/rendu';
import { retardMaster } from './audio/worklet';
import { ErreurOcka } from './erreur';
import { construireGraphe } from './graphe';
import { oublierBanque } from './instruments/banque';
import { detruireBus } from './instruments/bus';
import { PRE_MASTER } from './instruments/bus';
import { creerChaineMaster } from './master';
import { mesurerSonie } from './sonie';
import type { ChaineMaster } from './types-moteur';

const FREQ = 44100;
const MESURES = 8;
const PAS_RENDU = 128 * 172;

/** Outils remplaçables par les tests (graphe simulé). */
export const outilsAB = { construireGraphe, chargerMedias };

/** Fenêtre mesurée (s) : `debut` et `duree` (8 mesures au plus), `avant` = rendu en plus avant le début. */
export function fenetreAB(morceau: Morceau): { debut: number; duree: number; avant: number } {
  const mesure = PAS_PAR_MESURE * dureePas(morceau.tempo);
  const total = dureeMorceau(morceau);
  const refrain = arrangement(morceau).find((o) => /refrain/i.test(o.section.nom));
  let debut = refrain ? refrain.debutPas * dureePas(morceau.tempo) : 0;
  const fin = Math.min(total, debut + MESURES * mesure);
  if (fin - debut < MESURES * mesure) debut = Math.max(0, fin - MESURES * mesure);
  return { debut, duree: fin - debut, avant: Math.min(mesure, debut) };
}

/** Sonie de [a, b[ des canaux 2c et 2c+1 d'un rendu. */
function sonie(r: AudioBuffer, c: number, a: number, b: number): number {
  return mesurerSonie([r.getChannelData(2 * c).subarray(a, b), r.getChannelData(2 * c + 1).subarray(a, b)], FREQ);
}

/** Passe le mélange dans une ou plusieurs chaînes master, rendues ensemble ; renvoie leurs sonies sur la fenêtre. */
async function chaines(melange: AudioBuffer, morceau: Morceau, liste: { sans: boolean; comp: number }[], debut: number, n: number): Promise<number[]> {
  const retard = retardMaster(FREQ);
  const ctx = new OfflineAudioContext(2 * liste.length, melange.length + retard, FREQ);
  const source = ctx.createBufferSource();
  source.buffer = melange;
  const pre = ctx.createGain();
  pre.gain.value = PRE_MASTER;
  source.connect(pre);
  const fusion = ctx.createChannelMerger(2 * liste.length);
  const creees: ChaineMaster[] = [];
  for (const [i, r] of liste.entries()) {
    const chaine = await creerChaineMaster(ctx, morceau.master, { sans: r.sans, compensationDb: r.comp });
    creees.push(chaine);
    pre.connect(chaine.entree);
    const separe = ctx.createChannelSplitter(2);
    chaine.sortie.connect(separe);
    separe.connect(fusion, 0, 2 * i);
    separe.connect(fusion, 1, 2 * i + 1);
  }
  fusion.connect(ctx.destination);
  source.start(0);
  const r = await ctx.startRendering();
  const reglages = creees.map((c) => c.masterJs());
  for (const c of creees) c.detruire();
  // Hors ligne, pas de worklet : le master de chaque chaîne est appliqué ici en JS (le même calcul).
  for (const [i, m] of reglages.entries()) {
    if (m) await appliquerMaster([r.getChannelData(2 * i), r.getChannelData(2 * i + 1)], m, FREQ, null);
  }
  return liste.map((_, i) => sonie(r, i, retard + debut, retard + debut + n));
}

export async function mesurerEcartAB(entree: Morceau): Promise<{ ecartLu: number }> {
  const { morceau, bloquant, problemes } = normaliserMorceau(entree);
  if (bloquant) throw new ErreurOcka(problemes.find((p) => p.niveau === 'bloquant')!.message, 'morceau_invalide');
  const f = fenetreAB(morceau);
  if (f.duree < 1) throw new ErreurOcka('Le morceau est trop court pour comparer (moins d’une seconde).', 'trop_court');

  // 1. Le mélange des pistes, avant le master.
  const medias = await outilsAB.chargerMedias(morceau);
  const debut = Math.round(f.avant * FREQ);
  const n = Math.round(f.duree * FREQ);
  const ctx = new OfflineAudioContext(2, Math.ceil((debut + n) / PAS_RENDU) * PAS_RENDU, FREQ);
  const melange = ctx.createGain();
  melange.connect(ctx.destination);
  const pistesSeparees: Partial<Record<IdPiste, AudioNode>> = {};
  for (const id of IDS_PISTES) pistesSeparees[id] = melange;
  const nulle = ctx.createGain(); // la sortie du master (rien n'y arrive) ne va nulle part
  const graphe = await outilsAB.construireGraphe(ctx, morceau, medias.prises, nulle, { pistesSeparees, sons: medias.sons });
  let rendu: AudioBuffer;
  try {
    rendu = await rendreParFenetres(ctx, graphe, f.debut - f.avant, { pas: PAS_RENDU });
  } finally {
    graphe.detruire();
    detruireBus(ctx);
    oublierBanque(ctx);
  }

  // 2. Avec / sans, puis 3. vérification de la compensation.
  const [avec, sans] = await chaines(rendu, morceau, [{ sans: false, comp: 0 }, { sans: true, comp: 0 }], debut, n);
  if (!Number.isFinite(avec!) || !Number.isFinite(sans!)) return { ecartLu: 0 };
  let ecart = avec! - sans!;
  // Le limiteur reste après la compensation : on vérifie « sans + compensation » et on corrige le petit reste.
  const [compense] = await chaines(rendu, morceau, [{ sans: true, comp: ecart }], debut, n);
  if (Number.isFinite(compense!)) ecart += avec! - compense!;
  return { ecartLu: Math.round(Math.max(-12, Math.min(12, ecart)) * 10) / 10 };
}
