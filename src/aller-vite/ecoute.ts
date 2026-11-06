// Écoute des Boucles OCKA, PRÉPARÉE AVANT le toucher : à l'ouverture de la liste, toutes les boucles sont rendues
// d'un coup (même rendu que l'export : batterie, 808, accords et la boucle, une section par boucle). Un toucher sur
// « Écouter » ne fait que lancer un tampon déjà prêt (en boucle), sans aucun calcul.

import { contexteAudio } from '../enregistrement/contexte';
import { FREQ_EXPORT, rendre } from '../moteur/export-rendu';
import { normaliserMorceau } from '../morceau/normaliser';
import { pasVersSecondes } from '../morceau/temps';
import { estPisteInstrument, instrumentOcka, pisteMelodie } from '../morceau/acces';
import type { Morceau, MotifNotes, PisteInstrument, Section, SonMelodie } from '../morceau/types';

/** Une boucle à écouter : son motif et son son (instrument « ocka-<son>@1 »). */
export interface BoucleEcoute {
  motif: MotifNotes;
  son: SonMelodie;
}

export interface Ecoute {
  /** Lance la boucle n° k (et coupe celle qui jouait). */
  jouer(k: number): void;
  arreter(): void;
  /** N° de la boucle qui joue, ou −1. */
  readonly enCours: number;
  detruire(): void;
}

/**
 * Morceau d'écoute : une section par boucle, avec la batterie, la 808 et les accords de la section choisie,
 * sans voix ni sons importés, sans fondu ni coupure. Chaque boucle a sa piste (« ecoute-k », son instrument, la
 * tranche de la piste mélodie) ; les autres pistes instrument se taisent.
 */
export function morceauEcoute(m: Morceau, idSection: string, boucles: BoucleEcoute[]): Morceau {
  const base = m.sections.find((s) => s.id === idSection) ?? m.sections[0];
  const motifsCopie = Object.assign(Object.create(null) as Morceau['motifs'], m.motifs);
  const mel = pisteMelodie(m);
  const tranche = mel ? { volume: mel.volume, pan: mel.pan } : { volume: 0.8, pan: 0 };
  const pistes: PisteInstrument[] = [];
  const sections: Section[] = boucles.map(({ motif, son }, k) => {
    motifsCopie[`ecoute-${k}`] = motif;
    pistes.push({ id: `ecoute-${k}`, genre: 'instrument', nom: `Écoute ${k + 1}`, instrument: instrumentOcka(son), ...tranche, muet: false, solo: false });
    const refs = Object.create(null) as Section['motifs'];
    for (const id of ['batterie', 'basse', 'accords']) if (base && Object.hasOwn(base.motifs, id)) refs[id] = base.motifs[id]!;
    refs[`ecoute-${k}`] = `ecoute-${k}`;
    return { id: `ecoute-${k}`, nom: `Écoute ${k + 1}`, mesures: motif.pas / 16, motifs: refs, fill: false, coupure: 'aucune' };
  });
  const fixes = m.pistes.filter((p) => !estPisteInstrument(p));
  const brut: Morceau = { ...m, motifs: motifsCopie, sections, ordre: sections.map((s) => s.id), pistes: [...fixes.slice(0, 3), ...pistes, ...fixes.slice(3)], prises: [], fondu: 0 };
  delete brut.sons;
  delete brut.pads;
  return normaliserMorceau(brut).morceau;
}

/** Rend toutes les boucles (≈ 1 à 3 s de calcul), puis renvoie de quoi les écouter tout de suite. */
export async function preparerEcoute(m: Morceau, idSection: string, boucles: BoucleEcoute[], signal?: AbortSignal): Promise<Ecoute> {
  const em = morceauEcoute(m, idSection, boucles);
  const motifs = boucles.map((b) => b.motif);
  const canaux = await rendre(em, { signal });
  const ctx = contexteAudio();
  const tampon = ctx.createBuffer(2, canaux[0]!.length, FREQ_EXPORT);
  tampon.copyToChannel(canaux[0]! as Float32Array<ArrayBuffer>, 0);
  tampon.copyToChannel(canaux[1]! as Float32Array<ArrayBuffer>, 1);
  // Bornes de chaque boucle dans le rendu (en secondes).
  const bornes: [number, number][] = [];
  let pas = 0;
  for (const motif of motifs) {
    bornes.push([pasVersSecondes(em, pas), pasVersSecondes(em, pas + motif.pas)]);
    pas += motif.pas;
  }
  let source: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  let enCours = -1;
  const couper = () => {
    if (source && gain) {
      const t = ctx.currentTime;
      gain.gain.setTargetAtTime(0, t, 0.015);
      source.stop(t + 0.1);
    }
    source = null;
    gain = null;
    enCours = -1;
  };
  return {
    get enCours() {
      return enCours;
    },
    jouer(k) {
      couper();
      const b = bornes[k];
      if (!b) return;
      if (ctx.state !== 'running') void ctx.resume();
      source = ctx.createBufferSource();
      source.buffer = tampon;
      source.loop = true;
      source.loopStart = b[0];
      source.loopEnd = b[1];
      gain = ctx.createGain();
      source.connect(gain).connect(ctx.destination);
      source.start(ctx.currentTime + 0.01, b[0]);
      enCours = k;
    },
    arreter: couper,
    detruire: couper,
  };
}
