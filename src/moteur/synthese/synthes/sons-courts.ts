// Sons courts fabriqués par le code et enregistrés dans « Tes sons » (L) : fabricant de kick (façon Kicker) et
// bruitages façon sfxr (sfxr.ts, sfxr-rendu.ts). Le son se recalcule à l'identique depuis SonImporte.recette.
// Tout est à 48 kHz, mono, crête à −1 dBFS.
import type { CategorieSfxr } from '../../api-synthes';
import type { Morceau, RecetteKick, RecetteSfxr, RecetteSon, SonImporte } from '../../../morceau/types';
import { importerSon } from '../../../sons/import';
import { ErreurOcka } from '../../erreur';
import type { PcmSon } from '../../types-moteur';
import { enTeteWavFlottant } from '../../wav';
import { avecFrequence, bruit, FREQ } from '../briques';
import { milliemes, passeHaut1 } from './communs';
import { genererSfxr } from './sfxr';
import { CRETE_SON, rendreSfxr } from './sfxr-rendu';

/** Fréquence des sons fabriqués. */
export const FREQ_SONS = 48000;

export function kickParDefaut(): RecetteKick {
  return {
    type: 'kick',
    hauteur: 50,
    depart: 260,
    chute: 0.06,
    duree: 0.7,
    claquement: 0.4,
    saturation: 0.15,
  };
}

export function sfxrAuHasard(categorie: CategorieSfxr, graine: number): RecetteSfxr {
  const g = Math.abs(Math.trunc(Number.isFinite(graine) ? graine : 0)) % 2 ** 31;
  return { type: 'sfxr', graine: g, params: genererSfxr(categorie, g) };
}

const borne = (x: number, min: number, max: number, defaut: number) =>
  Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : defaut;

/** Recette de kick bornée comme le normaliseur (une recette venue de l'interface reste jouable). */
export function kickBorne(r: RecetteKick): RecetteKick {
  const d = kickParDefaut();
  return {
    type: 'kick',
    hauteur: milliemes(borne(r.hauteur, 30, 150, d.hauteur)),
    depart: milliemes(borne(r.depart, 60, 800, d.depart)),
    chute: milliemes(borne(r.chute, 0.005, 1, d.chute)),
    duree: milliemes(borne(r.duree, 0.05, 2, d.duree)),
    claquement: milliemes(borne(r.claquement, 0, 1, d.claquement)),
    saturation: milliemes(borne(r.saturation, 0, 1, d.saturation)),
  };
}

/** Le kick : sinus dont la hauteur tombe de `depart` à `hauteur`, claquement (bruit + tic), saturation, fondu final. */
function rendreKick(recette: RecetteKick): Float32Array {
  const r = kickBorne(recette);
  const n = Math.max(1, Math.round(r.duree * FREQ));
  const c = new Float32Array(n);
  const tauHauteur = r.chute / 4;
  const tauCorps = r.duree * 0.45;
  const fondu = Math.max(1, Math.round(n * 0.15));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / FREQ;
    const f = r.hauteur + (r.depart - r.hauteur) * Math.exp(-t / tauHauteur);
    ph += f / FREQ;
    let a = Math.exp(-t / tauCorps);
    if (i >= n - fondu) a *= 0.5 + 0.5 * Math.cos((Math.PI * (i - (n - fondu))) / fondu);
    c[i] = a * Math.sin(2 * Math.PI * ph);
  }
  if (r.claquement > 0) {
    const b = bruit(0.012, 0x6b1c);
    passeHaut1(b, 2500);
    const nb = Math.min(n, b.length);
    for (let i = 0; i < nb; i++) {
      const t = i / FREQ;
      c[i] +=
        r.claquement *
        (0.7 * b[i]! * Math.exp(-t / 0.0015) +
          0.45 * Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t / 0.002));
    }
  }
  const drive = 1 + r.saturation * 9;
  const norme = Math.tanh(drive);
  let max = 0;
  for (let i = 0; i < n; i++) {
    c[i] = Math.tanh(c[i]! * drive) / norme;
    max = Math.max(max, Math.abs(c[i]!));
  }
  const g = max > 0 ? CRETE_SON / max : 0;
  for (let i = 0; i < n; i++) c[i] = c[i]! * g;
  return c;
}

export function fabriquerSon(recette: RecetteSon): PcmSon {
  const canal =
    recette.type === 'kick'
      ? avecFrequence(FREQ_SONS, () => rendreKick(recette))
      : rendreSfxr(recette.params ?? {}, recette.graine, FREQ_SONS);
  return { frequence: FREQ_SONS, canaux: [canal] };
}

/** Un WAV 32 bits flottants mono d'un PCM. */
export function wavDe(pcm: PcmSon): Uint8Array<ArrayBuffer> {
  const c = pcm.canaux[0]!;
  const tete = enTeteWavFlottant(c.length, 1, pcm.frequence);
  const octets = new Uint8Array(tete.length + c.length * 4);
  octets.set(tete);
  const v = new DataView(octets.buffer, tete.length);
  for (let i = 0; i < c.length; i++) v.setFloat32(i * 4, c[i]!, true);
  return octets;
}

export async function enregistrerSonFabrique(
  recette: RecetteSon,
  nom: string,
  m: Morceau,
): Promise<SonImporte> {
  const pcm = fabriquerSon(recette);
  if (pcm.canaux[0]!.length < 2)
    throw new ErreurOcka('Ce son est vide : change un réglage, puis réessaie.', 'son_illisible');
  const propre =
    nom
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 60) || 'Mon son';
  const fichier = new File([wavDe(pcm)], `${propre}.wav`, { type: 'audio/wav' });
  const son = await importerSon(fichier, m);
  return { ...son, nom: propre, recette: recette.type === 'kick' ? kickBorne(recette) : recette };
}
