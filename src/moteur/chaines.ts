// Les chaînes d'effets du graphe : pistes (Gain → StereoPanner → master), voix (préréglages), couleur du master.

import type { Master, Morceau, Piste, PisteFixe } from '../morceau/types';
import { creerDoubler, creerEcho, creerRadio, NIVEAU_REVERBE, type Effet } from './audio/effets-voix';
import { creerTranche } from './effets/tranche';
import type { Banque } from './instruments/banque';
import type { ChaineVoix } from './types-moteur';

/** Une piste du mélangeur : on branche les sons sur `entree`. */
export interface ChainePiste {
  entree: GainNode;
  volume: GainNode;
  pan: StereoPannerNode;
  /**
   * Tranche v2 : programme inserts (modulations, worklet ou rendu JS), automation, LFO et sidechain pour ]de, a]
   * (temps du morceau, `origine` = heure du contexte du temps 0). À appeler à CHAQUE planification du graphe.
   */
  planifier?(de: number, a: number, origine: number): void;
  /** Tranche v2 : débranche tout (worklet, sources, envois partagés). */
  detruire?(): void;
}

/** Gain réel d'une piste : 0 si muette, ou si une autre piste est en solo. */
export function gainPiste(p: Piste, toutes: Piste[]): number {
  const solo = toutes.some((x) => x.solo);
  if (p.muet || (solo && !p.solo)) return 0;
  return p.volume;
}

/**
 * La chaîne d'une piste. Avec le morceau `m` (v2) : la TRANCHE complète (effets/tranche.ts : inserts, fader,
 * sidechain, automation, LFO, envois) ; sans changement de son pour une piste qui n'utilise rien de tout ça.
 */
export function creerPiste(ctx: BaseAudioContext, p: Piste, toutes: Piste[], sortie: AudioNode, m?: Morceau): ChainePiste {
  if (m) return creerTranche(ctx, m, p, toutes, sortie);
  const entree = ctx.createGain();
  const volume = ctx.createGain();
  volume.gain.value = gainPiste(p, toutes);
  const pan = ctx.createStereoPanner();
  pan.pan.value = p.pan;
  entree.connect(volume).connect(pan).connect(sortie);
  return { entree, volume, pan };
}

interface ReglageVoix {
  seuil: number;
  ratio: number;
  attaque: number;
  relache: number;
  reverbe: number;
  /** Présence (pic vers 3,5 kHz) et air (plateau vers 10 kHz), en dB. */
  presence: number;
  air: number;
}
const VOIX: Record<NonNullable<PisteFixe['preset']>, ReglageVoix> = {
  naturel: { seuil: -20, ratio: 3, attaque: 0.01, relache: 0.2, reverbe: 0.12, presence: 1, air: 1 },
  rap: { seuil: -26, ratio: 4.5, attaque: 0.004, relache: 0.12, reverbe: 0.06, presence: 3, air: 1.5 },
  chant: { seuil: -22, ratio: 3, attaque: 0.012, relache: 0.25, reverbe: 0.25, presence: 1.5, air: 2.5 },
};

/**
 * Chaîne de la voix : passe-haut 90 Hz → présence/air → compresseur → [radio] → (sec + réverbe) → `sortie`,
 * plus, selon `piste.effets` : écho (croche pointée au `tempo`) et doubler (copies à gauche et à droite).
 * Sans effet (absents, à 0 ou à false), ce sont EXACTEMENT les nœuds et les réglages des phases 0 et 1.
 */
export function creerChaineVoix(ctx: BaseAudioContext, piste: PisteFixe, banque: Banque, sortie: AudioNode, tempo: number): ChaineVoix {
  const r = VOIX[piste.preset ?? 'naturel'] ?? VOIX.naturel;
  const fx = piste.effets ?? {};
  const niveau = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  const passeHaut = ctx.createBiquadFilter();
  passeHaut.type = 'highpass';
  passeHaut.frequency.value = 90;
  passeHaut.Q.value = 0.707;
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3500;
  presence.Q.value = 0.9;
  presence.gain.value = r.presence;
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf';
  air.frequency.value = 10000;
  air.gain.value = r.air;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = r.seuil;
  comp.ratio.value = r.ratio;
  comp.attack.value = r.attaque;
  comp.release.value = r.relache;
  comp.knee.value = 6;
  passeHaut.connect(presence).connect(air).connect(comp);
  const effets: Effet[] = [];
  // Radio : remplace le son traité (le sec, la réverbe et l'écho partent après elle).
  let traite: AudioNode = comp;
  if (fx.radio === true) {
    const radio = creerRadio(ctx);
    comp.connect(radio.entree);
    traite = radio.sortie;
    effets.push(radio);
  }
  traite.connect(sortie);
  const envoi = ctx.createGain();
  envoi.gain.value = niveau(fx.reverbe) > 0 ? r.reverbe + NIVEAU_REVERBE * niveau(fx.reverbe) : r.reverbe;
  const reverbe = ctx.createConvolver();
  reverbe.buffer = banque.reverbe(0.75, 2.2);
  traite.connect(envoi).connect(reverbe).connect(sortie);
  if (niveau(fx.echo) > 0) {
    const echo = creerEcho(ctx, niveau(fx.echo), tempo > 0 ? tempo : 120);
    traite.connect(echo.entree);
    echo.sortie.connect(sortie);
    effets.push(echo);
  }
  if (fx.doubler === true) {
    const doubler = creerDoubler(ctx);
    traite.connect(doubler.entree);
    doubler.sortie.connect(sortie);
    effets.push(doubler);
  }
  return {
    entree: passeHaut,
    detruire() {
      for (const n of [passeHaut, presence, air, comp, envoi, reverbe]) n.disconnect();
      // Les effets aussi, boucle de l'écho comprise (sinon elle se garde en vie toute seule).
      for (const e of effets) {
        e.arreter?.();
        for (const n of e.noeuds) n.disconnect();
      }
    },
  };
}

/** Réverbe légère pour la caisse claire et le clap (envoi depuis ces sons). Renvoie l'entrée de l'envoi. */
export function creerReverbeCaisse(ctx: BaseAudioContext, banque: Banque, sortie: AudioNode, niveau: number): AudioNode {
  const envoi = ctx.createGain();
  envoi.gain.value = niveau;
  const coupeBas = ctx.createBiquadFilter();
  coupeBas.type = 'highpass';
  coupeBas.frequency.value = 400;
  const reverbe = ctx.createConvolver();
  reverbe.buffer = banque.reverbe(0.55, 1.2);
  envoi.connect(coupeBas).connect(reverbe).connect(sortie);
  return envoi;
}

/** Couleur du master : quelques filtres doux. Renvoie [entrée, sortie]. */
export function creerCouleur(ctx: BaseAudioContext, preset: Master['preset']): [AudioNode, AudioNode] {
  const filtres: BiquadFilterNode[] = [];
  const ajouter = (type: BiquadFilterType, frequence: number, gain = 0, q = 0.707) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequence;
    f.gain.value = gain;
    f.Q.value = q;
    filtres.push(f);
  };
  // Toujours : on retire l'infra-grave inutile (sous 25 Hz), qui mange de la marge sans s'entendre.
  ajouter('highpass', 25);
  if (preset === 'chaud') {
    ajouter('lowshelf', 180, 2);
    ajouter('highshelf', 9000, -1.5);
  } else if (preset === 'clair') {
    ajouter('lowshelf', 120, -1);
    ajouter('highshelf', 8000, 2.5);
  } else if (preset === 'lofi') {
    ajouter('lowpass', 6500, 0, 0.6);
    ajouter('lowshelf', 200, 1.5);
  }
  for (let i = 0; i + 1 < filtres.length; i++) filtres[i]!.connect(filtres[i + 1]!);
  return [filtres[0]!, filtres[filtres.length - 1]!];
}
