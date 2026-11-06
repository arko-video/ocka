// Sons avancés (S) : découpe (sample chop) et envoi vers les pads, éditeur (couper, fondu, normaliser, inverser),
// étirement WSOLA, BPM et tonalité d'un son importé. Calculs lourds (éditeur, étirement) dans un Worker.
// Un son modifié est un NOUVEAU son importé (WAV flottant 32 bits, sans perte, par importerSon) : l'original reste.

import type { Morceau, SonImporte } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import type { PcmSon } from '../moteur/types-moteur';
import type { OperationSon } from './api-sons-avances';
import { calculer } from './calcul-sons';
import { pcmVersWav } from './edition-pcm';
import { importerSon, lireSon } from './import';

export { decouperAttaques, decouperEgal, poserDecoupes, tranchesVersPads } from './decoupe';
export { etirerPcm } from './wsola';
export { detecterBpm, detecterTonaliteSon } from './tempo-tonalite';

/** Suffixe du nom d'un son modifié, selon l'opération. */
const SUFFIXES: Record<OperationSon['type'] | 'etirer', string> = {
  couper: 'coupé',
  fondu: 'fondu',
  normaliser: 'normalisé',
  inverser: 'inversé',
  etirer: 'étiré',
};

/** Le PCM d'un son du morceau (erreur claire s'il manque). */
export async function pcmDuSon(m: Morceau, idSon: string): Promise<{ son: SonImporte; pcm: PcmSon }> {
  const son = m.sons?.find((s) => s.id === idSon);
  if (!son) throw new ErreurOcka('Ce son n’est plus dans le morceau.', 'son_introuvable');
  const pcm = await lireSon(son);
  if (!pcm) throw new ErreurOcka('Le fichier de ce son est introuvable sur le téléphone.', 'son_introuvable');
  return { son, pcm };
}

/** Nom d'un son modifié : « Nom (coupé) », 60 caractères au plus. */
export function nomModifie(nom: string, suffixe: string): string {
  const base = nom.replace(/ \((coupé|fondu|normalisé|inversé|étiré)\)$/u, '');
  const fin = ` (${suffixe})`;
  return base.slice(0, 60 - fin.length) + fin;
}

/** Range un PCM comme un nouveau son importé (plafonds du morceau vérifiés par importerSon). */
async function enNouveauSon(pcm: PcmSon, nom: string, m: Morceau): Promise<SonImporte> {
  const f = new File([pcmVersWav(pcm)], `${nom}.wav`, { type: 'audio/wav' });
  const son = await importerSon(f, m);
  return { ...son, nom };
}

/** Voir api-sons-avances.ts. */
export async function editerSon(m: Morceau, idSon: string, op: OperationSon): Promise<SonImporte> {
  const { son, pcm } = await pcmDuSon(m, idSon);
  const res = await calculer(pcm, { type: 'editer', op });
  return enNouveauSon(res, nomModifie(son.nom, SUFFIXES[op.type] ?? 'modifié'), m);
}

/** Voir api-sons-avances.ts. Beat : découpé aux attaques puis repositionné ; sinon WSOLA d'un seul tenant. */
export async function etirerSon(m: Morceau, idSon: string, rapport: number): Promise<SonImporte> {
  const { son, pcm } = await pcmDuSon(m, idSon);
  const res = await calculer(pcm, { type: 'etirer', rapport });
  return enNouveauSon(res, nomModifie(son.nom, SUFFIXES.etirer), m);
}
