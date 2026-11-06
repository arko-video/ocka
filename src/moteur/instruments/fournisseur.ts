// D'où viennent les instruments échantillonnés : la banque de BQ (Cache Storage « ocka-instruments »,
// src/instruments/telechargement.ts), décodée ici à 48 kHz (decodeAudioData). `banque` est l'implémentation que
// le contrat (chargerSource, lireZone, instrumentsManquants de api-instruments.ts) relie ; le moteur passe par
// fournisseur(), que les tests remplacent (remplacerFournisseur : faux instrument.json et faux Opus, sans réseau).
// Écoute : seulement ce qui est déjà sur le téléphone (un instrument absent est muet et compté). Export : on le
// télécharge s'il manque ; impossible → ErreurOcka « instrument_absent » au message clair (jamais de piste muette).

import { pistesInstrument, syntheOcka } from '../../morceau/acces';
import type { Morceau } from '../../morceau/types';
import { entreeCatalogue } from '../../instruments/catalogue';
import { depuisCache, ouvrirInstrument, type InstrumentPret } from '../../instruments/telechargement';
import { ErreurOcka } from '../erreur';
import { chargerSourceSf2, lireZoneSf2 } from '../../sf2/sf2';
import type { PcmSon, SourceZones } from '../types-moteur';
import { FREQ_ZONES } from './zones';

export interface Fournisseur {
  /** Les zones d'un instrument présent sur le téléphone (rejette sinon). */
  chargerSource(id: string, signal?: AbortSignal): Promise<SourceZones>;
  /** Une zone décodée (48 kHz). */
  lireZone(id: string, fichier: string, signal?: AbortSignal): Promise<PcmSon | AudioBuffer>;
  /** Export : télécharge l'instrument s'il manque (rejette hors ligne). */
  telecharger(id: string, signal?: AbortSignal): Promise<void>;
}

/* ------------------------------------------------------------ la banque de BQ, décodée ici */

let decodeur: BaseAudioContext | null = null;
/** Contexte de décodage à 48 kHz (jamais rendu, sans worklet) : les positions de instrument.json restent justes. */
function contexteDecodage(): BaseAudioContext {
  decodeur ??= new OfflineAudioContext(1, 1, FREQ_ZONES);
  return decodeur;
}

const ouverts = new Map<string, Promise<InstrumentPret | null>>();
function ouvert(id: string): Promise<InstrumentPret | null> {
  let p = ouverts.get(id);
  if (!p) {
    p = depuisCache(id);
    ouverts.set(id, p);
    void p.then((x) => x ?? ouverts.delete(id), () => ouverts.delete(id)); // absent : on réessaiera
  }
  return p;
}

function absent(id: string): ErreurOcka {
  return new ErreurOcka(`L’instrument « ${id} » n’est pas sur ce téléphone : télécharge-le pour l’entendre.`, 'instrument_absent');
}

/** C3 : un preset de SoundFont de l'utilisateur (« sf2-<id>-<banque>-<preset>@1 ») est lu par src/sf2 (S). */
const estSf2 = (id: string) => id.startsWith('sf2-');

/** Implémentation de chargerSource et lireZone du contrat (api-instruments.ts). */
export const banque: Fournisseur = {
  async chargerSource(id, signal) {
    if (estSf2(id)) return chargerSourceSf2(id, signal);
    const i = await ouvert(id);
    if (!i) throw absent(id);
    const { nom: _n, famille: _f, licence: _l, ...source } = i.instrument;
    return source;
  },
  async lireZone(id, fichier, signal) {
    if (estSf2(id)) return lireZoneSf2(id, fichier, signal);
    const i = await ouvert(id);
    if (!i) throw absent(id);
    return contexteDecodage().decodeAudioData(await i.lire(fichier));
  },
  async telecharger(id, signal) {
    if (estSf2(id)) throw new ErreurOcka('Cette SoundFont n’est pas sur ce téléphone : importe de nouveau le fichier .sf2.', 'instrument_absent');
    ouverts.delete(id);
    await ouvrirInstrument(id, { signal });
  },
};

let actuel: Fournisseur = banque;

/** Le fournisseur en service. */
export function fournisseur(): Fournisseur {
  return actuel;
}

/** Tests : remplace le fournisseur (null = la banque). */
export function remplacerFournisseur(f: Fournisseur | null): void {
  actuel = f ?? banque;
  ouverts.clear();
}

/** Oublie ce qu'on sait d'un instrument (supprimé ou retéléchargé). */
export function oublierInstrument(id: string): void {
  ouverts.delete(id);
}

/** PCM (contrat lireZone) d'une zone décodée. */
export async function zonePcm(id: string, fichier: string, signal?: AbortSignal): Promise<PcmSon> {
  const z = await banque.lireZone(id, fichier, signal);
  if (!('getChannelData' in z)) return z;
  return { frequence: z.sampleRate, canaux: Array.from({ length: z.numberOfChannels }, (_, c) => z.getChannelData(c)) };
}

/** Les instruments échantillonnés d'un morceau (pistes instrument qui ne sont pas des sons v1 « ocka-<son>@1 »). */
export function instrumentsEchantillonnes(m: Morceau): string[] {
  return [...new Set(pistesInstrument(m).map((p) => p.instrument).filter((id) => syntheOcka(id) === null))];
}

/**
 * Charge la source d'un instrument. `exporter` : s'il manque, on le télécharge, et s'il reste introuvable, on lève
 * « instrument_absent » (message clair). À l'écoute : null (muet et compté), sans planter.
 */
export async function sourcePour(id: string, exporter: boolean, signal?: AbortSignal): Promise<SourceZones | null> {
  const f = fournisseur();
  try {
    return await f.chargerSource(id, signal);
  } catch (e) {
    if (!exporter) return null;
    if (e instanceof ErreurOcka && e.code === 'annule') throw e;
  }
  try {
    await f.telecharger(id, signal);
    return await f.chargerSource(id, signal);
  } catch (e) {
    if (e instanceof ErreurOcka && e.code === 'annule') throw e;
    const nom = await entreeCatalogue(id).then((x) => x.nom, () => id);
    throw new ErreurOcka(
      `L’instrument « ${nom} » n’est pas sur ce téléphone et n’a pas pu être téléchargé : reconnecte-toi à Internet, puis relance l’export (rien n’a été exporté).`,
      'instrument_absent',
    );
  }
}

/** Les instruments échantillonnés du morceau qui ne sont PAS jouables ici (absents du téléphone ou inconnus). */
export async function instrumentsManquants(m: Morceau): Promise<string[]> {
  const res: string[] = [];
  for (const id of instrumentsEchantillonnes(m)) if ((await sourcePour(id, false)) === null) res.push(id);
  return res;
}
