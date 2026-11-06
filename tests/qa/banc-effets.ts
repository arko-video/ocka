// Banc des effets de M2 (inserts, sidechain, automation, LFO, pistes séparées), chargé dans la page par le serveur
// de dev (import de /ocka/tests/qa/banc-effets.ts) par tests/qa/effets-m2.qa.ts.
// Il joue le rôle du graphe de M1 avec des sources fixes (un signal riche et déterministe par piste) : chaque piste
// est construite par creerPiste(…, morceau) et planifiée par fenêtres, comme le graphe le fera.
//  - « export » : fenêtres de 0,5 s depuis le début, passe A en JS pour les inserts JS (registre), aucun worklet ;
//  - « écoute » : worklet dans le contexte (optionsInserts.workletHorsLigne), saut à `debut`, puis fenêtres
//    irrégulières de 20 à 60 ms avec 200 ms d'avance, comme le lecteur.

import { normaliserMorceau } from '../../src/morceau/normaliser';
import { nouveauMorceau } from '../../src/morceau/styles';
import { dureeMorceau } from '../../src/morceau/temps';
import type { Insert, Morceau, Piste, TypeEffet } from '../../src/morceau/types';
import { creerPiste, type ChainePiste } from '../../src/moteur/chaines';
import { optionsInserts } from '../../src/moteur/effets/chaine-inserts';
import { insertParDefaut, traiterInsertsJs } from '../../src/moteur/effets/inserts';
import { estJs } from '../../src/moteur/effets/dsp';
import { prises, rendus } from '../../src/moteur/effets/registre';
import { chargerInserts } from '../../src/moteur/effets/worklet-inserts';
import { banqueDe } from '../../src/moteur/instruments/banque';
import { hasardFixe } from '../../src/moteur/planning';

export const FS = 44100;
const Q = 128;

export function ins(type: TypeEffet, id: string, p: Record<string, number> = {}, actif = true): Insert {
  const i = insertParDefaut(type, id);
  Object.assign(i.params, p);
  i.actif = actif;
  return i;
}

/**
 * Morceau de test : basse (eq, compresseur, réverbe, sidechain, courbe de volume), accords (filtre automatisé + LFO,
 * chorus, écho, LFO de pan), sons (bitcrusher, saturation, phaser, flanger). 3 sections du trap.
 * Le bitcrusher est EN TÊTE : placé après un effet modulé, un écart de −100 dB suffit à faire changer une marche de
 * quantification (8 bits = −42 dB) de temps en temps (−56 dB mesurés) : c'est la nature d'un quantificateur.
 */
export function morceauTest(): Morceau {
  const m0 = nouveauMorceau('trap', 'Banc M2');
  m0.ordre = m0.ordre.slice(0, 3);
  const sec = Object.create(null);
  sec[m0.ordre[0]!] = [{ pas: 0, valeur: 0.3 }, { pas: 24, valeur: 1 }, { pas: 40, valeur: 0.6, forme: 'palier' }, { pas: 56, valeur: 0.9 }];
  const filtre = Object.create(null);
  for (const s of m0.sections) filtre[s.id] = [{ pas: 0, valeur: 0.4 }, { pas: 32, valeur: 0.8 }];
  const regler = (p: Piste): Piste => {
    if (p.id === 'basse')
      return { ...p, inserts: [ins('eq', 'eq', { grave: 4, passeHaut: 35 }), ins('compresseur', 'comp', { seuil: -24, ratio: 4 }), ins('envoi-reverbe', 'rev', { niveau: 0.3 })], sidechain: { source: 'kick', force: 0.8, relache: 0.2 }, auto: [{ cible: { type: 'volume' }, sections: sec }] };
    if (p.id === 'accords')
      return {
        ...p,
        inserts: [ins('filtre', 'filt', { frequence: 3000, resonance: 2 }), ins('chorus', 'ch'), ins('envoi-echo', 'echo', { niveau: 0.3 })],
        auto: [{ cible: { type: 'insert', insert: 'filt', param: 'frequence' }, sections: filtre }],
        lfo: [
          { cible: { type: 'insert', insert: 'filt', param: 'frequence' }, forme: 'triangle', periode: 8, profondeur: 0.3, phase: 0.1 },
          { cible: { type: 'pan' }, forme: 'sinus', periode: 16, profondeur: 0.8, phase: 0 },
        ],
      };
    if (p.id === 'sons') return { ...p, inserts: [ins('bitcrusher', 'bit', { bits: 8, reduction: 3, mix: 0.5 }), ins('saturation', 'sat', { force: 0.5 }), ins('phaser', 'ph'), ins('flanger', 'fl')] };
    return p;
  };
  const m = { ...m0, pistes: m0.pistes.map(regler) };
  const r = normaliserMorceau(m);
  if (r.problemes.length > 0) throw new Error(JSON.stringify(r.problemes));
  return r.morceau;
}

export const PISTES_TEST = ['basse', 'accords', 'sons'];

/** Signal déterministe d'une piste (stéréo) : 3 harmoniques en notes de double-croche + un peu de bruit. */
export function signal(id: string, n: number, k = PISTES_TEST.indexOf(id)): AudioBuffer {
  const b = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: FS });
  const f0 = [55, 220, 330][k] ?? 110;
  for (let c = 0; c < 2; c++) {
    const x = b.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / FS;
      const note = Math.floor(t * 9);
      const env = Math.exp(-((t * 9) % 1) * 3);
      const f = f0 * (1 + (note % 4) * 0.125);
      const s = Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t + c) + 0.2 * Math.sin(6 * Math.PI * f * t);
      x[i] = 0.35 * env * s + 0.02 * (2 * hasardFixe(i, k, c) - 1);
    }
  }
  return b;
}

interface Options {
  /** Temps du morceau à la trame 0 du rendu (s, trames entières). */
  debut: number;
  n: number;
  ecoute: boolean;
  /** Une sortie par piste (stems) au lieu du mélange. */
  separees?: boolean;
  pistes?: string[];
}

/** Rendu d'un contexte déjà branché : planifie `chaines` par fenêtres (export ou écoute) en suspendant le rendu. */
async function planifierRendu(ctx: OfflineAudioContext, chaines: ChainePiste[], o: Options): Promise<AudioBuffer> {
  const origine = -o.debut;
  const planifier = (de: number, a: number) => chaines.forEach((c) => c.planifier?.(de, a, origine));
  let prochain = o.debut;
  planifier(prochain, prochain);
  const etapes: number[] = [];
  if (!o.ecoute) {
    for (let t = 0; t < o.n / FS; t += (172 * Q) / FS) etapes.push(t);
  } else {
    let t = 0;
    let k = 0;
    while (t < o.n / FS) {
      etapes.push(t);
      t += Math.round((0.02 + 0.04 * hasardFixe(k++, 3, 5)) * (FS / Q)) * (Q / FS);
    }
  }
  const avance = o.ecoute ? 0.2 : 2 * (172 * Q) / FS;
  for (const t of etapes) {
    void ctx.suspend(t).then(() => {
      const a = o.debut + t + avance;
      if (a > prochain) planifier(prochain, a);
      prochain = Math.max(prochain, a);
      void ctx.resume();
    });
  }
  return ctx.startRendering();
}

/** Construit les pistes du morceau vers `sortie(id)` (ou nulle part) et rend. */
async function rendreUne(m: Morceau, o: Options, nombreCanaux: number, sortie: (ctx: OfflineAudioContext, fusion: ChannelMergerNode) => (id: string) => AudioNode | null, prepare?: (ctx: OfflineAudioContext) => void): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(nombreCanaux, o.n, FS);
  prepare?.(ctx);
  await banqueDe(ctx).prechargerReverbe(0.75, 2.2);
  if (o.ecoute) await chargerInserts(ctx);
  const fusion = ctx.createChannelMerger(nombreCanaux);
  fusion.connect(ctx.destination);
  const vers = sortie(ctx, fusion);
  const chaines: ChainePiste[] = [];
  const total = Math.ceil(dureeMorceau(m) * FS) + FS;
  for (const id of o.pistes ?? PISTES_TEST) {
    const p = m.pistes.find((x) => x.id === id)!;
    const s = vers(id);
    if (!s) continue;
    const c = creerPiste(ctx, p, m.pistes, s, m);
    const src = new AudioBufferSourceNode(ctx, { buffer: signal(id, total) });
    src.connect(c.entree);
    src.start(0, o.debut);
    chaines.push(c);
  }
  const r = await planifierRendu(ctx, chaines, o);
  chaines.forEach((c) => c.detruire?.());
  return r;
}

const stereo = (ctx: OfflineAudioContext, fusion: ChannelMergerNode, i: number) => {
  const g = ctx.createGain();
  g.channelCount = 2;
  g.channelCountMode = 'explicit';
  const s = ctx.createChannelSplitter(2);
  g.connect(s);
  s.connect(fusion, 0, 2 * i);
  s.connect(fusion, 1, 2 * i + 1);
  return g;
};

/** Rendu du mélange (avant master) ou des pistes séparées (2 canaux chacune), en export ou en écoute. */
export async function rendre(m: Morceau, o: Options): Promise<Float32Array[]> {
  optionsInserts.workletHorsLigne = o.ecoute;
  const ids = o.pistes ?? PISTES_TEST;
  const canaux = o.separees ? 2 * ids.length : 2;
  let passeA: AudioBuffer | null = null;
  const js = ids.filter((id) => (m.pistes.find((p) => p.id === id)!.inserts ?? []).some(estJs));
  if (!o.ecoute && js.length > 0) {
    // Passe A : le son à l'entrée des inserts JS, puis le JS (comme effets/preparer.ts, sans le graphe de M1).
    passeA = await rendreUne(m, o, 2 * js.length, (ctx, fusion) => {
      const nulle = ctx.createGain();
      return (id) => (js.includes(id) ? stereo(ctx, fusion, js.indexOf(id)) : nulle);
    }, (ctx) => prises.set(ctx, new Set(js)));
    js.forEach((id, i) => {
      const p = m.pistes.find((x) => x.id === id)!;
      traiterInsertsJs([passeA!.getChannelData(2 * i), passeA!.getChannelData(2 * i + 1)], FS, p.inserts ?? [], Math.round(o.debut * FS));
    });
  }
  const r = await rendreUne(m, o, canaux, (ctx, fusion) => {
    const mix = o.separees ? null : stereo(ctx, fusion, 0);
    return (id) => mix ?? stereo(ctx, fusion, ids.indexOf(id));
  }, (ctx) => {
    if (passeA) rendus.set(ctx, new Map(js.map((id, i) => [id, { tampon: passeA!, canal: 2 * i, debut: o.debut }])));
  });
  optionsInserts.workletHorsLigne = false;
  return Array.from({ length: canaux }, (_, c) => r.getChannelData(c).slice());
}

/** Écart maximal (dBFS) entre a[i] et b[decalage + i] sur [de, a[. */
export function ecartDb(a: Float32Array[], b: Float32Array[], decalage: number, de: number, jusqua: number): number {
  let e = 0;
  for (let c = 0; c < a.length; c++) for (let i = de; i < jusqua; i++) e = Math.max(e, Math.abs(a[c]![i]! - b[c]![decalage + i]!));
  return e > 0 ? 20 * Math.log10(e) : -Infinity;
}

export const crete = (x: Float32Array[]) => x.reduce((m, c) => c.reduce((n, v) => Math.max(n, Math.abs(v)), m), 0);

/* ------------------------------------------------------------ réponses des effets, un insert ou une chaîne seule */

/**
 * Fait passer `x` (stéréo) dans une chaîne d'inserts seule (creerChaineInserts), hors ligne. `worklet` : avec le
 * worklet (écoute) ; sinon le JS (traiterInsertsJs) est appliqué après le rendu, comme l'export (chaîne JS seule).
 */
export async function traverser(inserts: Insert[], x: Float32Array[], worklet: boolean): Promise<Float32Array[]> {
  const { creerChaineInserts } = await import('../../src/moteur/effets/chaine-inserts');
  const n = x[0]!.length;
  const ctx = new OfflineAudioContext(2, n, FS);
  optionsInserts.workletHorsLigne = worklet;
  if (worklet) await chargerInserts(ctx);
  const m = nouveauMorceau('trap', 'Banc');
  const piste = { id: 'accords', volume: 1, pan: 0, muet: false, solo: false, inserts } as Piste;
  const chaine = creerChaineInserts(ctx, piste, true, m);
  const b = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: FS });
  x.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  const src = new AudioBufferSourceNode(ctx, { buffer: b });
  src.connect(chaine.entree);
  chaine.sortie.connect(ctx.destination);
  src.start(0);
  chaine.planifier(m, 0, n / FS, 0);
  const r = await ctx.startRendering();
  optionsInserts.workletHorsLigne = false;
  chaine.detruire();
  const out = [r.getChannelData(0).slice(), r.getChannelData(1).slice()];
  if (!worklet) traiterInsertsJs(out, FS, inserts, 0);
  return out;
}

export const impulsion = (n: number) => [0, 1].map(() => Float32Array.from({ length: n }, (_, i) => (i === 0 ? 1 : 0)));
export const sinus = (n: number, a: number, f: number) => [0, 1].map(() => Float32Array.from({ length: n }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / FS)));

/** |H(f)| en dB d'une réponse impulsionnelle (DFT en un point). */
export function gainDb(h: Float32Array, f: number): number {
  let re = 0;
  let im = 0;
  const w = (2 * Math.PI * f) / FS;
  for (let i = 0; i < h.length; i++) {
    re += h[i]! * Math.cos(w * i);
    im -= h[i]! * Math.sin(w * i);
  }
  return 10 * Math.log10(re * re + im * im);
}

/** Spectre (dB) d'un bloc de 2^k échantillons, fenêtre de Blackman-Harris (FFT radix 2). */
export function spectre(x: Float32Array): Float64Array {
  const n = x.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const u = (2 * Math.PI * i) / (n - 1);
    re[i] = x[i]! * (0.35875 - 0.48829 * Math.cos(u) + 0.14128 * Math.cos(2 * u) - 0.01168 * Math.cos(3 * u));
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j], im[i], im[j]] = [re[j]!, re[i]!, im[j]!, im[i]!];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(a * k);
        const s = Math.sin(a * k);
        const p = i + k;
        const q = p + len / 2;
        const tr = re[q]! * c - im[q]! * s;
        const ti = re[q]! * s + im[q]! * c;
        re[q] = re[p]! - tr;
        im[q] = im[p]! - ti;
        re[p] = re[p]! + tr;
        im[p] = im[p]! + ti;
      }
  }
  const out = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) out[i] = 10 * Math.log10(re[i]! ** 2 + im[i]! ** 2 + 1e-30);
  return out;
}

/** Piste seule avec sa tranche (sidechain…), sinus `f` d'amplitude `a` en entrée ; renvoie la sortie gauche. */
export async function tranche(m: Morceau, id: string, n: number, a: number, f: number): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(2, n, FS);
  const p = m.pistes.find((x) => x.id === id)!;
  const c = creerPiste(ctx, p, m.pistes, ctx.destination, m);
  const b = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: FS });
  sinus(n, a, f).forEach((x, i) => b.copyToChannel(x as Float32Array<ArrayBuffer>, i));
  const src = new AudioBufferSourceNode(ctx, { buffer: b });
  src.connect(c.entree);
  src.start(0);
  c.planifier?.(0, n / FS, 0);
  const r = await ctx.startRendering();
  c.detruire?.();
  return r.getChannelData(0).slice();
}
