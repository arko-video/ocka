// Chaîne du master (M2) derrière l'interface ChaineMaster (types-moteur.ts) :
//   entrée ─┬─ couleur (filtres du preset) ─ gain « avec » ─┬─ worklet : colle (chaîne 2) → limiteur → sortie
//           └─ gain « sans » (0, A/B : compensé) ───────────┘
// Chaîne 1 = EXACTEMENT le son des phases 0 et 1 (couleur → limiteur des phases 0 et 1 ; les gains valent 1 et 0,
// ce qui ne change aucun bit). Chaîne 2 = couleur → colle (JS, dans le worklet) → limiteur à crête vraie.
// Le retard est LE MÊME dans les deux chaînes (`latence`), et l'export le retire.
// HORS LIGNE (export, A/B) : AUCUN worklet. Chrome ne libère jamais un OfflineAudioContext où un AudioWorklet a été
// chargé (~64 Mo par titre de 3 min). La sortie est alors l'entrée du worklet (même mélange, en stéréo) et le
// master est appliqué en JS après le rendu (audio/master-hors-ligne.ts) : le MÊME code (MasterFlux), au bit près.

import type { Master } from '../morceau/types';
import { SEUILS_COLLE } from './audio/colle';
import { chargerLimiteur, creerLimiteur, retardMaster, SEUIL_MASTER } from './audio/worklet';
import { creerCouleur } from './chaines';
import type { ChaineMaster } from './types-moteur';

/** Durée des rampes (A/B, changement de couleur) : pas de clic. */
const RAMPE_S = 0.03;

/** Options internes (A/B hors temps réel) : partir directement « sans » couleur ni colle. */
export interface DepartChaine {
  sans?: boolean;
  compensationDb?: number;
}

/** Tests (QA) seulement : true remet le worklet dans les contextes hors ligne (comparaison worklet / JS). */
export const optionsMaster = { workletHorsLigne: false };

/** Vrai si le contexte joue en ce moment (sinon on règle tout de suite, sans rampe). */
function enDirect(ctx: BaseAudioContext): boolean {
  return typeof AudioContext !== 'undefined' && ctx instanceof AudioContext && ctx.state === 'running';
}

/** Va vers `v` en RAMPE_S (sans clic) si le contexte joue, sinon tout de suite. */
function viser(ctx: BaseAudioContext, p: AudioParam, v: number): void {
  const t = ctx.currentTime;
  p.cancelScheduledValues(t);
  if (enDirect(ctx)) {
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(v, t + RAMPE_S);
  } else p.setValueAtTime(v, t);
}

/** Crée la chaîne du master d'un contexte (le worklet est chargé si besoin). */
export async function creerChaineMaster(ctx: BaseAudioContext, master: Master, depart: DepartChaine = {}): Promise<ChaineMaster> {
  const horsLigne = 'startRendering' in ctx && !optionsMaster.workletHorsLigne;
  if (!horsLigne) await chargerLimiteur(ctx);
  const sansDepart = depart.sans === true;
  const entree = ctx.createGain();
  const avec = ctx.createGain();
  const sans = ctx.createGain();
  avec.gain.value = sansDepart ? 0 : 1;
  sans.gain.value = sansDepart ? Math.pow(10, (depart.compensationDb ?? 0) / 20) : 0;
  // Réglages du master (ceux du worklet ; hors ligne, ceux que appliquerMaster utilisera).
  const reglages = { chaine: master.chaine, seuilColle: SEUILS_COLLE[master.preset], colle: sansDepart ? 0 : 1 };
  let noeud: AudioNode;
  if (horsLigne) {
    // Même mélange que l'entrée du worklet : stéréo explicite (une source mono passe en G = D, comme dans le worklet).
    const g = ctx.createGain();
    g.channelCount = 2;
    g.channelCountMode = 'explicit';
    g.channelInterpretation = 'speakers';
    noeud = g;
  } else noeud = creerLimiteur(ctx, SEUIL_MASTER, reglages);
  const p = (nom: string, v: number) => {
    if (horsLigne) return; // hors ligne : appliqué en JS après le rendu
    (noeud as AudioWorkletNode).parameters.get(nom)!.setValueAtTime(v, ctx.currentTime);
  };
  avec.connect(noeud);
  entree.connect(sans).connect(noeud);

  // Couleur actuelle : [premier filtre, dernier filtre] puis un gain (pour le fondu quand elle change).
  let preset = master.preset;
  let chaine = master.chaine;
  let couleur = brancher(preset);
  function brancher(pr: Master['preset']) {
    const [debut, fin] = creerCouleur(ctx, pr);
    const gain = ctx.createGain();
    entree.connect(debut);
    fin.connect(gain).connect(avec);
    return { debut, gain };
  }
  function debrancher(c: { debut: AudioNode; gain: GainNode }) {
    try {
      entree.disconnect(c.debut);
    } catch {
      /* déjà débranché */
    }
    c.gain.disconnect();
  }

  return {
    entree,
    sortie: noeud,
    latence: retardMaster(ctx.sampleRate) / ctx.sampleRate,

    regler(m) {
      if (m.preset !== preset) {
        preset = m.preset;
        const ancienne = couleur;
        couleur = brancher(preset);
        if (enDirect(ctx)) {
          // Fondu enchaîné entre l'ancienne et la nouvelle couleur, puis l'ancienne est débranchée.
          couleur.gain.gain.value = 0;
          viser(ctx, couleur.gain.gain, 1);
          viser(ctx, ancienne.gain.gain, 0);
          setTimeout(() => debrancher(ancienne), 4 * RAMPE_S * 1000);
        } else debrancher(ancienne);
        reglages.seuilColle = SEUILS_COLLE[preset];
        p('seuilColle', reglages.seuilColle);
      }
      if (m.chaine !== chaine) {
        chaine = m.chaine;
        reglages.chaine = chaine;
        p('chaine', chaine); // le worklet fait le fondu lui-même
      }
      // m.niveau ne change rien ici : il ne sert qu'à l'export (sonie et crête visées).
    },

    contourner(sansCouleur, compensationDb) {
      const comp = Number.isFinite(compensationDb) ? Math.max(-12, Math.min(12, compensationDb)) : 0;
      viser(ctx, avec.gain, sansCouleur ? 0 : 1);
      viser(ctx, sans.gain, sansCouleur ? Math.pow(10, comp / 20) : 0);
      reglages.colle = sansCouleur ? 0 : 1;
      p('colle', reglages.colle); // rampe de 30 ms dans le worklet
    },

    masterJs: () => (horsLigne ? { ...reglages } : null),

    detruire() {
      if (!horsLigne) (noeud as AudioWorkletNode).port.postMessage('fin');
      debrancher(couleur);
      for (const n of [entree, avec, sans, noeud]) n.disconnect();
    },
  };
}
