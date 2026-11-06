// La voix d'instrument jouée en direct, PILOTÉE par le worklet (sorties de contrôle branchées sur des AudioParam) :
// - synthé OCKA (« ocka-<son>@1 », et tout « ocka-… » encore inconnu) : 4 oscillateurs CONTINUS réglés sur le MIDI 0,
//   dont le `detune` = la hauteur (cents MIDI) écrite par le worklet ; gain = l'enveloppe du worklet ;
// - instrument échantillonné (banque, SoundFont) : à chaque nouvelle note, la zone de la note part (detune calé,
//   plus la courbure du worklet pour le glissé), et la précédente est relâchée (temps `relache` de l'instrument).

import { sonOcka } from '../morceau/acces';
import type { PisteInstrument, SonMelodie } from '../morceau/types';
import { chargerSource, lireZone } from '../moteur/api-instruments';
import { ErreurOcka } from '../moteur/erreur';
import type { SourceZones, ZoneSource } from '../moteur/types-moteur';
import { TEXTES_DUBLER } from '../textes/dubler';
import { VOIX_MAX } from './detecteur';

const MIDI_0 = 440 * Math.pow(2, -69 / 12);
/** Couche de vélocité préparée (vel × 127) et notes préparées (voix + accords). */
const VEL_PREPAREE = 100;
const BAS = 28;
const HAUT = 100;

export interface InstrumentDirect {
  /** Décroissance des sons frappés (s, pour l'enveloppe du worklet) ; 0 = tenu. */
  decroissance: number;
  /** Branche les sorties de contrôle du worklet. */
  brancher(noeud: AudioWorkletNode, suivreVolume: boolean): void;
  /** Nouvelle note (ou silence) : utile aux instruments échantillonnés. */
  jouer(jouees: number[], vel: number): void;
  /** Nombre de voix entendues (1, 3 ou 4). */
  voix(n: number): void;
  arreter(): void;
}

const TIMBRES: Record<
  SonMelodie,
  { harmoniques: number[] | OscillatorType; coupure: number; decroissance: number }
> = {
  piano: { harmoniques: [1, 0.55, 0.3, 0.16, 0.08, 0.04], coupure: 5000, decroissance: 1.1 },
  epiano: { harmoniques: [1, 0.35, 0.06, 0.03], coupure: 4000, decroissance: 1.4 },
  lead: { harmoniques: 'sawtooth', coupure: 2800, decroissance: 0 },
  pluck: { harmoniques: 'square', coupure: 2200, decroissance: 0.3 },
  cloche: { harmoniques: [1, 0, 0.45, 0, 0.25, 0, 0.12], coupure: 6000, decroissance: 1.8 },
  nappe: { harmoniques: 'sawtooth', coupure: 1300, decroissance: 0 },
};

function sortie(ctx: AudioContext, piste: PisteInstrument): { entree: GainNode; noeuds: AudioNode[] } {
  const volume = ctx.createGain();
  volume.gain.value = Math.max(0, Math.min(1.2, piste.volume ?? 0.8));
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-1, Math.min(1, piste.pan ?? 0));
  volume.connect(pan).connect(ctx.destination);
  return { entree: volume, noeuds: [volume, pan] };
}

/** Synthé OCKA continu. */
function synthe(ctx: AudioContext, piste: PisteInstrument, son: SonMelodie): InstrumentDirect {
  const t = TIMBRES[son];
  const { entree, noeuds } = sortie(ctx, piste);
  const enveloppe = ctx.createGain();
  enveloppe.gain.value = 0;
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.value = t.coupure;
  filtre.connect(enveloppe).connect(entree);
  const onde = Array.isArray(t.harmoniques)
    ? ctx.createPeriodicWave(
        new Float32Array([0, ...t.harmoniques]),
        new Float32Array(t.harmoniques.length + 1),
      )
    : null;
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  for (let v = 0; v < VOIX_MAX; v++) {
    const o = ctx.createOscillator();
    if (onde) o.setPeriodicWave(onde);
    else o.type = t.harmoniques as OscillatorType;
    o.frequency.value = MIDI_0;
    // Nappe : les voix légèrement désaccordées entre elles (chorus).
    o.detune.value = son === 'nappe' ? (v % 2 ? 6 : -6) : 0;
    const g = ctx.createGain();
    g.gain.value = v === 0 ? 0.35 : 0;
    o.connect(g).connect(filtre);
    o.start();
    oscs.push(o);
    gains.push(g);
  }
  return {
    decroissance: t.decroissance,
    brancher(noeud) {
      noeud.connect(enveloppe.gain, 0);
      oscs.forEach((o, v) => noeud.connect(o.detune, v + 1));
    },
    jouer() {},
    voix(n) {
      gains.forEach((g, v) => g.gain.setTargetAtTime(v < n ? 0.35 / Math.sqrt(n) : 0, ctx.currentTime, 0.01));
    },
    arreter() {
      oscs.forEach((o) => o.stop(ctx.currentTime + 0.1));
      setTimeout(() => [...oscs, ...gains, filtre, enveloppe, ...noeuds].forEach((n) => n.disconnect()), 200);
    },
  };
}

/** Instrument échantillonné : zones préparées pour la couche de vélocité ≈ 100, de MIDI 28 à 100. */
async function echantillonne(
  ctx: AudioContext,
  piste: PisteInstrument,
  signal?: AbortSignal,
): Promise<InstrumentDirect> {
  let source: SourceZones;
  try {
    source = await chargerSource(piste.instrument, signal);
  } catch (e) {
    if (e instanceof ErreurOcka && e.code !== 'instrument_absent') throw e;
    throw new ErreurOcka(TEXTES_DUBLER.chanter.erreurs.instrumentAbsent, 'instrument_absent');
  }
  const zones = source.zones.filter(
    (z) => z.haut >= BAS && z.bas <= HAUT && z.velBas <= VEL_PREPAREE && VEL_PREPAREE <= z.velHaut,
  );
  const tampons = new Map<ZoneSource, AudioBuffer>();
  await Promise.all(
    zones.map(async (z) => {
      const pcm = await lireZone(piste.instrument, z.fichier, signal);
      const b = ctx.createBuffer(pcm.canaux.length, pcm.canaux[0]!.length, pcm.frequence);
      pcm.canaux.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
      tampons.set(z, b);
    }),
  );
  const { entree, noeuds } = sortie(ctx, piste);
  const bus = ctx.createGain();
  bus.connect(entree);
  const courbure = ctx.createGain(); // la sortie « courbure » du worklet, répartie vers chaque voix
  let actives: { src: AudioBufferSourceNode; g: GainNode }[] = [];
  const relache = Math.max(0.05, source.relache);
  const lacher = () => {
    const t = ctx.currentTime;
    for (const v of actives) {
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setValueAtTime(v.g.gain.value, t);
      v.g.gain.setTargetAtTime(0, t, relache / 4);
      v.src.stop(t + relache + 0.05);
    }
    actives = [];
  };
  return {
    decroissance: 0,
    brancher(noeud, suivreVolume) {
      if (suivreVolume) {
        bus.gain.value = 0;
        noeud.connect(bus.gain, 0);
      }
      noeud.connect(courbure, 5);
    },
    jouer(jouees, vel) {
      lacher();
      const t = ctx.currentTime;
      for (const midi of jouees) {
        const z =
          zones.find((x) => x.bas <= midi && midi <= x.haut) ??
          zones.reduce<ZoneSource | null>(
            (a, x) => (!a || Math.abs(x.racine - midi) < Math.abs(a.racine - midi) ? x : a),
            null,
          );
        const b = z && tampons.get(z);
        if (!z || !b) continue;
        const src = ctx.createBufferSource();
        src.buffer = b;
        const fs = b.sampleRate;
        if (z.boucle) {
          src.loop = true;
          src.loopStart = z.boucle.debut / fs;
          src.loopEnd = z.boucle.fin / fs;
        }
        src.detune.value = (midi - z.racine) * 100 - z.cents;
        courbure.connect(src.detune);
        const g = ctx.createGain();
        g.gain.value =
          (Math.pow(10, (source.gainDb + z.gainDb) / 20) * Math.pow(Math.max(0.1, Math.min(1, vel)), 1.6)) /
          Math.sqrt(jouees.length);
        src.connect(g).connect(bus);
        src.start(t, z.debut / fs, z.boucle ? undefined : Math.max(0.01, (z.fin - z.debut) / fs));
        src.onended = () => g.disconnect();
        actives.push({ src, g });
      }
    },
    voix() {},
    arreter() {
      lacher();
      setTimeout(() => [bus, courbure, ...noeuds].forEach((n) => n.disconnect()), (relache + 0.2) * 1000);
    },
  };
}

/** La voix d'instrument de la piste. Erreur : « instrument_absent » (instrument pas téléchargé). */
export async function creerInstrumentDirect(
  ctx: AudioContext,
  piste: PisteInstrument,
  signal?: AbortSignal,
): Promise<InstrumentDirect> {
  const son = sonOcka(piste.instrument) ?? (piste.instrument.startsWith('ocka-') ? 'lead' : null);
  return son ? synthe(ctx, piste, son) : echantillonne(ctx, piste, signal);
}
