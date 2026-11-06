// Corpus « /2 » du test nul de la v2 : des morceaux écrits par OCKA v1 (phases 0 à 6), figés dans
// /home/claude/ocka/references-v1 avec leurs rendus (mix WAV 24 bits + pistes séparées en flottant 32 bits),
// faits par la copie figée du code v1 (/home/claude/ocka/snapshot-v1) AVANT tout changement de son.
// Ce fichier fabrique le corpus (à partir des morceaux neufs de chaque style) et compare les rendus.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lireStereo } from './comparer';
import { SORTIES } from './outils';

export const REFERENCES = join(SORTIES, '..', '..', '..', '..', 'references-v1');
export const SNAPSHOT_V1 = join(SORTIES, '..', '..', '..', '..', 'snapshot-v1');

/** Morceau brut (JSON tel que sauvé par OCKA v1). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Brut = Record<string, any>;

/** Un fichier OPFS à poser avant d'ouvrir le morceau (son importé ou prise de voix). */
export interface FichierOpfs {
  dossier: 'ocka-sons' | 'ocka-prises';
  nom: string;
  pcm: Float32Array;
}

export interface ElementCorpus {
  nom: string;
  morceau: Brut;
  fichiers: FichierOpfs[];
}

const SONS = ['piano', 'epiano', 'lead', 'pluck', 'cloche', 'nappe'] as const;
const copie = (x: Brut): Brut => JSON.parse(JSON.stringify(x)) as Brut;

/** Mélodie de 2 mesures (arpège, notes tenues, vélocités variées), dans la gamme de do majeur. */
function notesMelodie(decalage: number): Brut[] {
  const gamme = [60, 62, 64, 65, 67, 69, 71, 72];
  const notes: Brut[] = [];
  for (let i = 0; i < 8; i++) notes.push({ pas: i * 2, duree: 2, midi: gamme[(i + decalage) % 8]! + (i === 7 ? 12 : 0), vel: 0.4 + 0.075 * i });
  notes.push({ pas: 16, duree: 8, midi: 64 }, { pas: 16, duree: 8, midi: 67, vel: 0.7 }, { pas: 24, duree: 6, midi: 57 + decalage });
  return notes;
}

/** Son importé de synthèse : 2 s stéréo à 44,1 kHz (accord qui décroît + souffle filtré), déterministe. */
function sonImporte(): Float32Array {
  const f = 44100;
  const n = 2 * f;
  const x = new Float32Array(2 * n);
  let graine = 12345;
  let bruit = 0;
  for (let i = 0; i < n; i++) {
    graine = (Math.imul(graine, 1103515245) + 12345) >>> 0;
    bruit = 0.97 * bruit + 0.03 * (graine / 2 ** 31 - 1);
    const t = i / f;
    const env = Math.exp(-2.2 * (t % 0.5)) * 0.5;
    const accord = Math.sin(2 * Math.PI * 220 * t) + 0.6 * Math.sin(2 * Math.PI * 277.18 * t) + 0.5 * Math.sin(2 * Math.PI * 329.63 * t);
    x[i] = env * accord * 0.4 + bruit * 0.5; // canal 0 en entier, puis canal 1 (format de sons/import.ts)
    x[n + i] = env * accord * 0.35 - bruit * 0.5;
  }
  return x;
}

/** Prise de « voix » : le faux micro des QA (clic de 10 ms à 1 kHz toutes les 0,5 s) + un chant de synthèse, 8 s à 48 kHz. */
function priseVoix(): Float32Array {
  const f = 48000;
  const x = new Float32Array(8 * f);
  let phase = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / f;
    const clic = t % 0.5 < 0.01 ? 0.7 * Math.sin(2 * Math.PI * 1000 * t) : 0;
    const hz = 220 * 2 ** (Math.floor(t) % 4 / 12) * (1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t));
    phase += (2 * Math.PI * hz) / f;
    const voix = 0.25 * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.3 * Math.sin(3 * phase)) * (0.6 + 0.4 * Math.sin(Math.PI * (t % 1)));
    x[i] = clic + voix;
  }
  return x;
}

/** Fabrique le corpus à partir des morceaux neufs des 6 styles (lus dans la base d'OCKA v1). */
export function construireCorpus(bases: Record<string, Brut>): ElementCorpus[] {
  const corpus: ElementCorpus[] = [];
  for (const style of ['trap', 'drill', 'lofi', 'phonk', 'pop', 'boombap']) {
    const m = copie(bases[style]!);
    m.titre = `Corpus ${style}`;
    corpus.push({ nom: style, morceau: m, fichiers: [] });
  }

  // Mélodie : une section de 2 mesures par son (le même beat), donc 6 sons dans un seul morceau.
  const mel = copie(bases.pop!);
  mel.titre = 'Corpus melodie';
  const ref = mel.sections.find((s: Brut) => s.id === 'refrain');
  mel.sections = SONS.map((son) => ({ ...copie(ref), id: `s-${son}`, nom: son, mesures: 2, fill: false, coupure: 'aucune', motifs: { ...ref.motifs, melodie: `mel-${son}` } }));
  for (const [k, son] of SONS.entries()) mel.motifs[`mel-${son}`] = { type: 'melodie', pas: 32, son, notes: notesMelodie(k) };
  mel.ordre = mel.sections.map((s: Brut) => s.id);
  // Le motif du piano revient à la fin (un motif dans deux sections).
  mel.sections.push({ ...copie(mel.sections[0]), id: 's-fin', nom: 'Fin' });
  mel.ordre.push('s-fin');
  corpus.push({ nom: 'melodie', morceau: mel, fichiers: [] });

  // Son importé : un pad perso dans la batterie et une boucle calée sur le refrain, une non calée sur l'outro.
  const imp = copie(bases.lofi!);
  imp.titre = 'Corpus son importe';
  imp.sons = [{ id: 'qa1', nom: 'Boucle QA', fichier: 'son-qa1.f32', frequence: 44100, duree: 2, canaux: 2 }];
  imp.pads = { perso1: 'qa1' };
  const bat = imp.motifs['bat-couplet'];
  bat.pistes.perso1 = Array.from({ length: bat.pas }, (_, i) => (i % 16 === 6 ? 0.8 : 0));
  for (const s of imp.sections) {
    if (s.id === 'refrain') s.boucle = { son: 'qa1', mesures: 2, caler: true };
    if (s.id === 'outro') s.boucle = { son: 'qa1', mesures: 1, caler: false };
  }
  corpus.push({ nom: 'son-importe', morceau: imp, fichiers: [{ dossier: 'ocka-sons', nom: 'son-qa1.f32', pcm: sonImporte() }] });

  // Prise de voix sur le couplet, réglage « rap » avec réverbe, écho et doubleur.
  const voix = copie(bases.boombap!);
  voix.titre = 'Corpus voix';
  voix.prises = [
    { id: 'qa1', ancre: { section: 'couplet', occurrence: 0, mesure: 1 }, tempo: voix.tempo, fichier: 'prise-qa1.f32', frequence: 48000, duree: 8, debutCoupe: 0.2, finCoupe: 7.5, decalage: 0.031, gain: 0.9, choisie: true, nom: 'Prise QA' },
  ];
  const pv = voix.pistes.find((p: Brut) => p.id === 'voix');
  pv.preset = 'rap';
  pv.effets = { reverbe: 0.4, echo: 0.3, doubler: true };
  corpus.push({ nom: 'voix', morceau: voix, fichiers: [{ dossier: 'ocka-prises', nom: 'prise-qa1.f32', pcm: priseVoix() }] });

  // Chaîne 1 : un vrai fichier des phases 0 et 1 (version 1, sans master.chaine, sans pistes melodie et sons).
  const v1 = copie(bases.drill!);
  v1.titre = 'Corpus chaine 1';
  v1.format = 'ocka.morceau/1';
  delete v1.master.chaine;
  v1.pistes = v1.pistes.filter((p: Brut) => p.id !== 'melodie' && p.id !== 'sons');
  corpus.push({ nom: 'chaine1', morceau: v1, fichiers: [] });
  return corpus;
}

/** Lit un WAV stéréo PCM 16/24 bits ou flottant 32 bits (pistes séparées). */
export function lireWavStereo(chemin: string): { g: Float32Array; d: Float32Array } {
  const b = readFileSync(chemin);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (v.getUint16(20, true) !== 3) return lireStereo(chemin);
  const txt = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  let o = 12;
  while (txt(o) !== 'data') o += 8 + v.getUint32(o + 4, true);
  const n = Math.floor(v.getUint32(o + 4, true) / 8);
  const g = new Float32Array(n);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    g[i] = v.getFloat32(o + 8 + 8 * i, true);
    d[i] = v.getFloat32(o + 12 + 8 * i, true);
  }
  return { g, d };
}

/** Somme de plusieurs WAV (la mélodie /2 devient « melodie », « melodie-2 »… en /3). */
export function somme(chemins: string[]): { g: Float32Array; d: Float32Array } {
  const lus = chemins.map(lireWavStereo);
  const n = Math.max(0, ...lus.map((x) => x.g.length));
  const g = new Float32Array(n);
  const d = new Float32Array(n);
  for (const x of lus) for (let i = 0; i < x.g.length; i++) (g[i]! += x.g[i]!), (d[i]! += x.d[i]!);
  return { g, d };
}

export interface EcartNul {
  ecartDb: number;
  creteDbfs: number;
  decalage: number;
  trames: [number, number];
}

/** Énergie de la différence sous celle de la référence (dB), crête de la différence, meilleur décalage (±64). */
export function ecart(a: { g: Float32Array; d: Float32Array }, b: { g: Float32Array; d: Float32Array }): EcartNul {
  const n = Math.min(a.g.length, b.g.length);
  const energie = (lag: number) => {
    let e = 0;
    for (let i = Math.max(0, -lag); i < n - Math.max(0, lag); i += 7) {
      const x = a.g[i]! - b.g[i + lag]!;
      const y = a.d[i]! - b.d[i + lag]!;
      e += x * x + y * y;
    }
    return e;
  };
  let decalage = 0;
  let mieux = energie(0);
  for (let lag = -64; lag <= 64; lag++) {
    const e = energie(lag);
    if (e < mieux) [mieux, decalage] = [e, lag];
  }
  let ref = 0;
  let diff = 0;
  let crete = 0;
  for (let i = 0; i < n; i++) {
    for (const [x, y] of [[a.g[i]!, b.g[i]!], [a.d[i]!, b.d[i]!]] as const) {
      ref += x * x;
      diff += (x - y) ** 2;
      crete = Math.max(crete, Math.abs(x - y));
    }
  }
  const r = (x: number) => Math.round(x * 100) / 100;
  return {
    ecartDb: diff === 0 ? -Infinity : ref === 0 ? Infinity : r(10 * Math.log10(diff / ref)),
    creteDbfs: crete === 0 ? -Infinity : r(20 * Math.log10(crete)),
    decalage,
    trames: [a.g.length, b.g.length],
  };
}
