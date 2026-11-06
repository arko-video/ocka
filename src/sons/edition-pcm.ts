// Éditeur de son (façon Edison) sur le PCM : couper, fondu, normaliser, inverser. Fonctions PURES qui rendent une
// COPIE (le son d'origine n'est jamais touché), et l'écriture d'un PCM en WAV flottant (pour importerSon).

import { ErreurOcka } from '../moteur/erreur';
import type { PcmSon } from '../moteur/types-moteur';
import { enTeteWavFlottant } from '../moteur/wav';
import type { OperationSon } from './api-sons-avances';
import { crete, longueur } from './spectre';

/** Crête visée par « Normaliser » : −1 dBFS. */
export const CRETE_NORMALE = Math.pow(10, -1 / 20);
/** Fondu enchaîné aux points de coupe (anti-clic). */
const FONDU_COUPE = 0.003;

const invalide = () => new ErreurOcka('Choisis un passage du son (au moins 5 ms).', 'passage_invalide');

/** Bornes [de, a[ en échantillons, dans le son. */
function bornes(pcm: PcmSon, de: number | undefined, a: number | undefined): [number, number] {
  const n = longueur(pcm);
  const sr = pcm.frequence;
  const i = Math.max(0, Math.min(n, Math.round((Number.isFinite(de) ? de! : 0) * sr)));
  const j = Math.max(0, Math.min(n, Math.round((Number.isFinite(a) ? a! : n / sr) * sr)));
  return i <= j ? [i, j] : [j, i];
}

const copie = (pcm: PcmSon): PcmSon => ({ frequence: pcm.frequence, canaux: pcm.canaux.map((c) => c.slice(0, longueur(pcm))) });

/** Retire le passage [de, a[ (fondu enchaîné de 3 ms à la jointure). */
export function couper(pcm: PcmSon, de: number, a: number): PcmSon {
  const n = longueur(pcm);
  const [i, j] = bornes(pcm, de, a);
  if (j - i < pcm.frequence * 0.005) throw invalide();
  if (n - (j - i) < pcm.frequence * 0.005) throw new ErreurOcka('Il ne resterait rien du son : choisis un passage plus court.', 'passage_invalide');
  const f = Math.min(Math.round(FONDU_COUPE * pcm.frequence), i, n - j);
  const canaux = pcm.canaux.map((c) => {
    const out = new Float32Array(n - (j - i));
    out.set(c.subarray(0, i - f), 0);
    for (let k = 0; k < f; k++) {
      const g = (k + 0.5) / f;
      out[i - f + k] = c[i - f + k]! * (1 - g) + c[j - f + k]! * g;
    }
    out.set(c.subarray(j, n), i);
    return out;
  });
  return { frequence: pcm.frequence, canaux };
}

/** Fondu d'entrée (0 → 1) ou de sortie (1 → 0) sur [de, a[ ; avant un fondu d'entrée et après un fondu de sortie : silence. */
export function fondu(pcm: PcmSon, de: number, a: number, sens: 'entree' | 'sortie'): PcmSon {
  const [i, j] = bornes(pcm, de, a);
  if (j - i < pcm.frequence * 0.005) throw invalide();
  const out = copie(pcm);
  const n = longueur(out);
  for (const c of out.canaux) {
    for (let k = i; k < j; k++) {
      const x = (k - i + 0.5) / (j - i);
      const g = sens === 'entree' ? x : 1 - x;
      c[k] = c[k]! * g * g; // courbe douce (puissance perçue)
    }
    if (sens === 'entree') c.fill(0, 0, i);
    else c.fill(0, j, n);
  }
  return out;
}

/** Normalise la crête du son à `creteVisee` (−1 dBFS par défaut). */
export function normaliser(pcm: PcmSon, creteVisee = CRETE_NORMALE): PcmSon {
  const c = crete(pcm);
  if (c < 1e-6) throw new ErreurOcka('Ce son est silencieux : il n’y a rien à normaliser.', 'son_silencieux');
  const cible = Math.min(1, Math.max(0.01, Number.isFinite(creteVisee) ? creteVisee : CRETE_NORMALE));
  const g = cible / c;
  const out = copie(pcm);
  for (const x of out.canaux) for (let k = 0; k < x.length; k++) x[k] = x[k]! * g;
  return out;
}

/** Inverse le passage [de, a[ (tout le son par défaut). */
export function inverser(pcm: PcmSon, de?: number, a?: number): PcmSon {
  const [i, j] = bornes(pcm, de, a);
  if (j - i < 2) throw invalide();
  const out = copie(pcm);
  for (const c of out.canaux) c.subarray(i, j).reverse();
  return out;
}

/** Applique une opération de l'éditeur (copie). */
export function appliquerOperation(pcm: PcmSon, op: OperationSon): PcmSon {
  switch (op?.type) {
    case 'couper':
      return couper(pcm, op.de, op.a);
    case 'fondu':
      return fondu(pcm, op.de, op.a, op.sens === 'sortie' ? 'sortie' : 'entree');
    case 'normaliser':
      return normaliser(pcm, op.crete);
    case 'inverser':
      return inverser(pcm, op.de, op.a);
    default:
      throw new ErreurOcka('Cette opération n’existe pas.', 'operation_inconnue');
  }
}

/** Le PCM en WAV flottant 32 bits (entrelacé), sans perte : importerSon le décode tel quel. */
export function pcmVersWav(pcm: PcmSon): Uint8Array<ArrayBuffer> {
  const n = longueur(pcm);
  const nc = pcm.canaux.length;
  const tete = enTeteWavFlottant(n, nc, pcm.frequence);
  const out = new Uint8Array(tete.length + n * nc * 4);
  out.set(tete, 0);
  const v = new DataView(out.buffer, tete.length);
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) v.setFloat32((i * nc + c) * 4, pcm.canaux[c]![i]!, true);
  return out;
}
