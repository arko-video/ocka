// Inserts en nœuds natifs (propriétaire : M2, vague C1) : égaliseur, filtre, saturation (WaveShaper 4x),
// chorus, flanger, phaser, et les prises d'envoi (réverbe, écho partagés). Tous gardent le nombre de canaux.
// Les modulations du chorus, du flanger et du phaser ne sont PAS des oscillateurs : ce sont des fonctions du temps
// du morceau (phase calée), programmées en rampes (programme.ts) sur un ConstantSourceNode.
// `params` : réglages automatisables (clé « <idInsert>.<param> » → AudioParam, convertisseur éventuel).

import type { Insert } from '../../morceau/types';
import { Q_BUTTERWORTH } from '../audio/effets-voix';
import { reglage } from './dsp';

export interface BlocInsert {
  entree: AudioNode;
  sortie: AudioNode;
  params: { cle: string; param: AudioParam; conv?: (reel: number) => number }[];
  /** Modulations internes : `f(t, profondeur)` (t = temps du morceau) programmée sur `param`. */
  modulations: { param: AudioParam; f: (t: number, profondeur: number) => number; profondeur: string }[];
  /** Prise d'envoi (son pris ici, au niveau de l'envoi) vers la réverbe ou l'écho partagés. */
  envoi?: { vers: 'reverbe' | 'echo'; gain: GainNode };
  noeuds: AudioNode[];
  sources: AudioScheduledSourceNode[];
}

/** Domaine d'entrée de la courbe de saturation : ±4 (un son jusqu'à +12 dBFS n'est pas écrêté par le WaveShaper). */
export const AMPLITUDE_SAT = 4;
const POINTS_SAT = 8193;

/**
 * Écrêtage doux tanh (dérivable à l'infini : ses harmoniques décroissent très vite, d'où peu de repliement avec le
 * suréchantillonnage 4x). Attaque 0,5 (force 0) à 8 (force 1) : au-delà, un sinus de 1 kHz replierait au-dessus de
 * −60 dB (harmoniques au-dessus de 22 kHz que le filtre du 4x de Chrome ne coupe pas assez).
 */
const doux = Math.tanh;
export const attaqueSat = (force: number) => 0.5 * Math.pow(16, force);

/**
 * Courbe du WaveShaper de la saturation (entrée ±AMPLITUDE_SAT, d'où un gain de 1/AMPLITUDE_SAT avant) : mélange
 * `mix` de l'écrêtage compensé et du son sec. Compensation : un sinus à −12 dBFS ressort au même niveau efficace.
 */
export function courbeSaturation(force: number, mix: number): Float32Array<ArrayBuffer> {
  const d = attaqueSat(force);
  let ein = 0;
  let eout = 0;
  for (let i = 0; i < 1024; i++) {
    const x = 0.25 * Math.sin((2 * Math.PI * i) / 1024);
    ein += x * x;
    eout += doux(d * x) ** 2;
  }
  const c = Math.sqrt(ein / eout);
  const courbe = new Float32Array(POINTS_SAT);
  for (let i = 0; i < POINTS_SAT; i++) {
    const x = AMPLITUDE_SAT * ((2 * i) / (POINTS_SAT - 1) - 1);
    courbe[i] = mix * c * doux(d * x) + (1 - mix) * x;
  }
  return courbe;
}

function biquad(ctx: BaseAudioContext, type: BiquadFilterType, f: number, gain = 0, q = Q_BUTTERWORTH): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.gain.value = gain;
  b.Q.value = q;
  return b;
}

/** Q du Web Audio pour une résonance (Q « vrai ») : en dB pour passe-bas et passe-haut, tel quel pour passe-bande. */
export const qFiltre = (mode: number, resonance: number) => (mode === 2 ? resonance : 20 * Math.log10(resonance));

const MODES: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass'];

/** Construit le bloc natif d'un insert (type non JS). `auto` : clés « <id>.<param> » automatisées. */
export function creerBloc(ctx: BaseAudioContext, ins: Insert, auto: Set<string>): BlocInsert {
  const v = (c: string) => reglage(ins.type, ins.params, c);
  const vise = (c: string) => auto.has(`${ins.id}.${c}`);
  const bloc: BlocInsert = { entree: null!, sortie: null!, params: [], modulations: [], noeuds: [], sources: [] };
  const param = (c: string, p: AudioParam, conv?: (r: number) => number) => bloc.params.push({ cle: `${ins.id}.${c}`, param: p, conv });
  const chaine = (noeuds: AudioNode[]) => {
    if (noeuds.length === 0) noeuds.push(ctx.createGain());
    for (let i = 0; i + 1 < noeuds.length; i++) noeuds[i]!.connect(noeuds[i + 1]!);
    bloc.entree = noeuds[0]!;
    bloc.sortie = noeuds[noeuds.length - 1]!;
    bloc.noeuds.push(...noeuds);
  };

  if (ins.type === 'eq') {
    const n: AudioNode[] = [];
    const ajouter = (b: BiquadFilterNode, cles: [string, AudioParam][]) => {
      n.push(b);
      for (const [c, p] of cles) param(c, p);
    };
    if (v('passeHaut') > 20 || vise('passeHaut')) {
      const b = biquad(ctx, 'highpass', v('passeHaut'));
      ajouter(b, [['passeHaut', b.frequency]]);
    }
    if (v('grave') !== 0 || vise('grave') || vise('freqGrave')) {
      const b = biquad(ctx, 'lowshelf', v('freqGrave'), v('grave'));
      ajouter(b, [['grave', b.gain], ['freqGrave', b.frequency]]);
    }
    if (v('medium') !== 0 || vise('medium') || vise('freqMedium') || vise('qMedium')) {
      const b = biquad(ctx, 'peaking', v('freqMedium'), v('medium'), v('qMedium'));
      ajouter(b, [['medium', b.gain], ['freqMedium', b.frequency], ['qMedium', b.Q]]);
    }
    if (v('aigu') !== 0 || vise('aigu') || vise('freqAigu')) {
      const b = biquad(ctx, 'highshelf', v('freqAigu'), v('aigu'));
      ajouter(b, [['aigu', b.gain], ['freqAigu', b.frequency]]);
    }
    if (v('passeBas') < 20000 || vise('passeBas')) {
      const b = biquad(ctx, 'lowpass', v('passeBas'));
      ajouter(b, [['passeBas', b.frequency]]);
    }
    chaine(n);
  } else if (ins.type === 'filtre') {
    const mode = Math.round(v('mode'));
    const b = biquad(ctx, MODES[mode] ?? 'lowpass', v('frequence'), 0, qFiltre(mode, v('resonance')));
    param('frequence', b.frequency);
    param('resonance', b.Q, (r) => qFiltre(mode, r));
    chaine([b]);
  } else if (ins.type === 'saturation') {
    const pre = ctx.createGain();
    pre.gain.value = 1 / AMPLITUDE_SAT;
    const ws = ctx.createWaveShaper();
    ws.curve = courbeSaturation(v('force'), v('mix'));
    ws.oversample = '4x';
    const n: AudioNode[] = [pre, ws];
    if (v('ton') !== 0.5 || vise('ton')) {
      const ton = biquad(ctx, 'highshelf', 3000, (v('ton') - 0.5) * 12);
      param('ton', ton.gain, (r) => (r - 0.5) * 12);
      n.push(ton);
    }
    chaine(n);
  } else if (ins.type === 'chorus' || ins.type === 'flanger' || ins.type === 'phaser') {
    modulation(ctx, ins, bloc, v, param);
  } else {
    // Envoi : le son continue tel quel ; une copie part, au niveau de l'envoi, vers le bus partagé.
    const passe = ctx.createGain();
    const gain = ctx.createGain();
    gain.gain.value = v('niveau');
    passe.connect(gain);
    param('niveau', gain.gain);
    bloc.entree = bloc.sortie = passe;
    bloc.noeuds.push(passe, gain);
    bloc.envoi = { vers: ins.type === 'envoi-reverbe' ? 'reverbe' : 'echo', gain };
  }
  return bloc;
}

/** Chorus, flanger, phaser : son sec + son modulé (mélange `mix`, automatisable), modulation calée sur le morceau. */
function modulation(ctx: BaseAudioContext, ins: Insert, bloc: BlocInsert, v: (c: string) => number, param: (c: string, p: AudioParam) => void) {
  const entree = ctx.createGain();
  const sortie = ctx.createGain();
  const sec = ctx.createGain();
  const mouille = ctx.createGain();
  sec.gain.value = 1 - v('mix');
  mouille.gain.value = v('mix');
  entree.connect(sec).connect(sortie);
  mouille.connect(sortie);
  // Le mélange automatisé : une seule valeur (mix) pilote les deux gains (sec = 1 − mix, mouillé = mix).
  const mix = new ConstantSourceNode(ctx, { offset: v('mix') });
  const inverse = ctx.createGain();
  inverse.gain.value = -1;
  sec.gain.value = 1;
  mouille.gain.value = 0;
  mix.connect(mouille.gain);
  mix.connect(inverse).connect(sec.gain);
  param('mix', mix.offset);
  const mod = new ConstantSourceNode(ctx, { offset: 0 });
  bloc.sources.push(mix, mod);
  bloc.noeuds.push(entree, sortie, sec, mouille, inverse, mix, mod);
  const w = 2 * Math.PI * v('vitesse');
  const sinus = (t: number) => Math.sin(w * t);
  if (ins.type === 'chorus' || ins.type === 'flanger') {
    const chorus = ins.type === 'chorus';
    const base = chorus ? 0.015 : 0.0055;
    const ampleur = chorus ? 0.004 : 0.0025;
    const retard = ctx.createDelay(0.05);
    retard.delayTime.value = base;
    mod.connect(retard.delayTime);
    entree.connect(retard).connect(mouille);
    bloc.noeuds.push(retard);
    bloc.modulations.push({ param: mod.offset, profondeur: `${ins.id}.profondeur`, f: (t, p) => p * ampleur * sinus(t) });
    if (!chorus) {
      const retour = ctx.createGain();
      retour.gain.value = v('retour');
      retard.connect(retour).connect(retard);
      param('retour', retour.gain);
      bloc.noeuds.push(retour);
    }
  } else {
    // Phaser : passe-tout en série, fréquence 300 Hz × 2^(±3 octaves × profondeur), retour par un petit retard.
    const etages: BiquadFilterNode[] = [];
    for (let i = 0; i < Math.round(v('etages')); i++) {
      const b = biquad(ctx, 'allpass', 0, 0, 0.7);
      mod.connect(b.frequency);
      etages.push(b);
    }
    for (let i = 0; i + 1 < etages.length; i++) etages[i]!.connect(etages[i + 1]!);
    const somme = ctx.createGain();
    entree.connect(somme).connect(etages[0]!);
    etages[etages.length - 1]!.connect(mouille);
    const retour = ctx.createGain();
    retour.gain.value = v('retour');
    const boucle = ctx.createDelay(0.01);
    boucle.delayTime.value = 0;
    etages[etages.length - 1]!.connect(retour).connect(boucle).connect(somme);
    param('retour', retour.gain);
    bloc.noeuds.push(...etages, somme, retour, boucle);
    bloc.modulations.push({ param: mod.offset, profondeur: `${ins.id}.profondeur`, f: (t, p) => 300 * Math.pow(2, 3 * p * sinus(t)) });
  }
  bloc.entree = entree;
  bloc.sortie = sortie;
}
