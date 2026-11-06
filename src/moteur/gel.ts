// Gel (« freeze ») d'une piste (V) : la piste est rendue UNE fois (rendrePistesSeparees, gels.ts), gardée en mémoire
// pour cette séance, puis jouée telle quelle : ni notes, ni zones, ni synthèse (soulage le téléphone). L'état
// « gelée » n'est PAS dans le format (il ne change pas le son) : il vit dans cette séance. Un rendu dont la clé ne
// correspond plus à la piste (notes, instrument, tranche, tempo changés…) n'est jamais joué : le gel s'annule seul.
// Écoute = export : le même rendu (à la fréquence de chacun : l'export à 44,1 kHz est rendu à sa fréquence).

import { dureeMorceau } from '../morceau/temps';
import type { Morceau, Piste } from '../morceau/types';
import { contexteAudio } from '../enregistrement/contexte';
import { ErreurOcka } from './erreur';
import { morceauPourRendu, prevenirGels, rendrePistesSeparees, type Gel, type OptionsGels } from './gels';
import * as performance from './performance';
import type { PcmSon } from './types-moteur';

/** Fin du rendu gelé après la fin du morceau (s) : queues des inserts de la piste. */
const QUEUE = 2;

interface Etat {
  cle: string;
  /** Rendus par fréquence (au plus 2 : l'écoute et l'export). */
  rendus: Map<number, PcmSon>;
}
const geles = new Map<string, Etat>();
const enCours = new Map<string, Promise<PcmSon>>();
let dernierEcoute: Morceau | null = null;

/** Le dernier morceau construit pour l'ÉCOUTE (le lecteur demande ses gels à chaque chargement) : référence A/B. */
export function morceauEcoute(): Morceau | null {
  return dernierEcoute;
}

/** Empreinte (FNV-1a, 2 × 32 bits) d'un texte. */
export function empreinte(texte: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ texte.length;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/**
 * Clé du rendu d'une piste : tout ce qui change son son APRÈS sa tranche — la piste elle-même, ses motifs, le temps
 * du morceau (tempo, swing, tonalité, sections, ordre), le muet/solo des autres pistes, la batterie (sidechain),
 * les prises (voix), les sons importés et les SoundFonts. Les autres pistes et le master n'y sont pas.
 */
export function cleGel(m: Morceau, id: string): string | null {
  const piste = m.pistes.find((p) => p.id === id);
  if (!piste) return null;
  const motifs = new Set<string>();
  for (const s of m.sections) for (const pid of [id, 'batterie']) if (s.motifs[pid]) motifs.add(s.motifs[pid]);
  const autres = m.pistes.map((p: Piste) => (p.id === id || p.id === 'batterie' ? p : { id: p.id, muet: p.muet, solo: p.solo }));
  const utile = {
    piste,
    autres,
    tempo: m.tempo,
    swing: m.swing,
    tonalite: m.tonalite,
    kit: m.kit,
    fondu: m.fondu,
    sections: m.sections,
    ordre: m.ordre,
    motifs: [...motifs].sort().map((k) => [k, m.motifs[k]]),
    prises: id === 'voix' ? m.prises : undefined,
    sons: m.sons,
    pads: m.pads,
    tranchesPads: m.tranchesPads,
    soundfonts: m.soundfonts,
  };
  return empreinte(JSON.stringify(utile));
}

/** Le gel de la piste s'il est encore à jour ; sinon il est annulé (oublié) et null. */
function aJour(m: Morceau, id: string): Etat | null {
  const e = geles.get(id);
  if (!e) return null;
  if (cleGel(m, id) === e.cle) return e;
  geles.delete(id);
  return null;
}

/** Le morceau à rendre pour geler la piste `id` (les autres pistes allégées) : morceauPourRendu (gels.ts). */
export function morceauPourGel(m: Morceau, id: string): Morceau {
  return morceauPourRendu(m, [id]);
}

/**
 * Les effets de performance (R, Section.perf) de la piste, posés dans son rendu gelé : le graphe ne joue plus les
 * passages d'une piste gelée en entier (gelsDuMorceau garde le premier gel), ils sont donc DANS le rendu (même PCM).
 */
async function avecPerf(m: Morceau, id: string, pcm: PcmSon, signal?: AbortSignal): Promise<PcmSon> {
  const passages = (await performance.gelsPerformance(m, { frequence: pcm.frequence, attendre: true, signal })).filter((g) => g.piste === id);
  if (passages.length === 0) return pcm;
  const canaux = pcm.canaux.map((c) => c.slice());
  for (const g of passages) {
    const de = Math.round(g.de * pcm.frequence);
    const n = Math.min(Math.round((g.a - g.de) * pcm.frequence), canaux[0]!.length - de);
    if (n <= 0) continue;
    canaux.forEach((c, k) => c.set((g.pcm.canaux[k] ?? g.pcm.canaux[0]!).subarray(0, n), de));
  }
  return { frequence: pcm.frequence, canaux };
}

/** Rend la piste à cette fréquence (un seul calcul à la fois par clé et fréquence). */
function rendre(m: Morceau, id: string, cle: string, frequence: number, signal?: AbortSignal): Promise<PcmSon> {
  const k = `${cle}@${frequence}`;
  let p = enCours.get(k);
  if (!p) {
    p = rendrePistesSeparees(m, [id], 0, dureeMorceau(m) + QUEUE, frequence, signal)
      .then((r) => {
        const brut = r.get(id);
        if (!brut) throw new ErreurOcka('Cette piste n’a pas pu être gelée.', 'inconnu');
        return avecPerf(m, id, brut, signal);
      })
      .then((pcm) => {
        const e = geles.get(id);
        if (e?.cle === cle) {
          // Au plus 2 fréquences gardées (l'écoute et l'export).
          if (e.rendus.size >= 2 && !e.rendus.has(frequence)) e.rendus.delete(e.rendus.keys().next().value!);
          e.rendus.set(frequence, pcm);
        }
        return pcm;
      })
      .finally(() => enCours.delete(k));
    enCours.set(k, p);
  }
  return p;
}

/** Fournisseur de gels (gels.ts) : un Gel « entier » (de 0 à la fin) par piste gelée dont le rendu est à jour. */
export async function gelsPistes(m: Morceau, o: OptionsGels): Promise<Gel[]> {
  if (!o.attendre) dernierEcoute = m;
  const out: Gel[] = [];
  for (const id of [...geles.keys()]) {
    const e = aJour(m, id);
    if (!e) continue;
    let pcm = e.rendus.get(o.frequence);
    if (!pcm && o.attendre) pcm = await rendre(m, id, e.cle, o.frequence, o.signal);
    // Écoute à une autre fréquence : le rendu existant (gels.ts le rééchantillonne) ; le bon part en tâche de fond.
    if (!pcm && !o.attendre) {
      pcm = e.rendus.values().next().value;
      void rendre(m, id, e.cle, o.frequence).then(prevenirGels, () => {});
    }
    if (pcm) out.push({ piste: id, de: 0, a: dureeMorceau(m) + QUEUE, pcm, cle: `gel-${id}-${e.cle}-${pcm.frequence}` });
  }
  return out;
}

export async function gelerPiste(m: Morceau, idPiste: string, options?: { surProgression?: (p: number) => void; signal?: AbortSignal }): Promise<void> {
  const cle = cleGel(m, idPiste);
  if (!cle) throw new ErreurOcka('Cette piste n’existe plus dans le morceau.', 'piste_introuvable');
  if (aJour(m, idPiste)?.rendus.size) return;
  geles.set(idPiste, { cle, rendus: new Map() });
  options?.surProgression?.(0);
  let frequence = 44100;
  try {
    frequence = contexteAudio().sampleRate;
  } catch {
    // pas de contexte (tests) : la fréquence de l'export
  }
  try {
    await rendre(m, idPiste, cle, frequence, options?.signal);
  } catch (e) {
    if (geles.get(idPiste)?.cle === cle) geles.delete(idPiste);
    throw e;
  }
  options?.surProgression?.(1);
  prevenirGels();
}

export function degelerPiste(idPiste: string): void {
  if (geles.delete(idPiste)) prevenirGels();
}

export function pistesGelees(m: Morceau): string[] {
  return m.pistes.filter((p) => (aJour(m, p.id)?.rendus.size ?? 0) > 0).map((p) => p.id);
}
