// M4A « pour écouter » : AAC 256 kb/s dans un MP4 (Mediabunny), encodé PENDANT la dernière passe de l'export
// (aucun second rendu du morceau). L'AAC peut dépasser un peu la crête du signal d'origine : on décode le résultat
// pour mesurer la sonie et la crête vraie RÉELLES (ce qu'on entendra).
// Encodeur : celui du navigateur (WebCodecs AudioEncoder) s'il sait faire l'AAC (Android, Windows, macOS) ;
// sinon l'encodeur @mediabunny/aac-encoder (libavcodec en WebAssembly, dans un Worker), chargé seulement alors.
// Mediabunny est chargé à la demande (import dynamique) : il ne pèse rien tant qu'on n'exporte pas de M4A.

import { CreteVraieFlux, enDb } from './crete';
import { ErreurOcka } from './erreur';
import type { Recepteur } from './export-rendu';
import { MesureSonie } from './sonie';

export const DEBIT_AAC = 256_000;
const FREQUENCE = 44100;

type Mediabunny = typeof import('mediabunny');
let chargement: Promise<Mediabunny> | null = null;

/** Mediabunny, avec un encodeur AAC prêt (celui du navigateur, sinon celui en WebAssembly). */
function charger(): Promise<Mediabunny> {
  chargement ??= (async () => {
    const mb = await import('mediabunny');
    const options = { numberOfChannels: 2, sampleRate: FREQUENCE, quality: new mb.Quality({ bitrate: DEBIT_AAC }) };
    if (!(await mb.canEncodeAudio('aac', options).catch(() => false))) {
      const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
      registerAacEncoder();
    }
    return mb;
  })().catch((e: unknown) => {
    chargement = null;
    throw e;
  });
  return chargement;
}

/**
 * Au plus 30 s pour une étape de l'encodeur (le 1er bloc charge et compile le WebAssembly du secours). Si son Worker
 * ne démarre pas (CSP sans 'wasm-unsafe-eval' ou sans worker-src blob:, mémoire), l'export ne doit pas attendre
 * sans fin : « format_impossible », et l'interface conseille le WAV.
 */
const DELAI_ETAPE_MS = 30_000;
function avecDelai<T>(p: Promise<T>, fois = 1): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error('encodeur AAC muet')), DELAI_ETAPE_MS * fois);
  });
  return Promise.race([p, delai]).finally(() => clearTimeout(minuteur));
}

function impossible(e: unknown): ErreurOcka {
  if (e instanceof ErreurOcka) return e;
  const r = new ErreurOcka('Ce téléphone ne sait pas fabriquer de M4A. Exporte en WAV à la place.', 'format_impossible');
  r.cause = e;
  return r;
}

/**
 * Encode en M4A ce que `jouer` envoie au récepteur (la passe finale de l'export). Renvoie le fichier entier
 * (en mémoire : 32 Ko par seconde, 6 Mo pour 3 min).
 */
export async function encoderM4a(jouer: (r: Recepteur) => Promise<unknown>, tags: { titre: string; artiste?: string }): Promise<Uint8Array> {
  let mb: Mediabunny;
  try {
    mb = await charger();
  } catch (e) {
    throw impossible(e);
  }
  const sortie = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
  const source = new mb.AudioSampleSource({ codec: 'aac', quality: new mb.Quality({ bitrate: DEBIT_AAC }) });
  sortie.addAudioTrack(source);
  sortie.setMetadataTags({ title: tags.titre, ...(tags.artiste ? { artist: tags.artiste } : {}) });
  let trames = 0;
  try {
    await sortie.start();
    await jouer(async (canaux, n) => {
      const plan = new Float32Array(2 * n);
      plan.set(canaux[0]!.subarray(0, n));
      plan.set(canaux[1]!.subarray(0, n), n);
      const echantillon = new mb.AudioSample({ data: plan, format: 'f32-planar', numberOfChannels: 2, sampleRate: FREQUENCE, timestamp: trames / FREQUENCE });
      trames += n;
      try {
        await avecDelai(source.add(echantillon));
      } finally {
        echantillon.close();
      }
    });
    await avecDelai(sortie.finalize());
  } catch (e) {
    await sortie.cancel().catch(() => {});
    if (e instanceof ErreurOcka) throw e;
    throw impossible(e);
  }
  const b = sortie.target.buffer;
  if (!b) throw impossible(new Error('M4A vide'));
  return new Uint8Array(b);
}

/** Décode un M4A (en flux) et mesure sa sonie intégrée (LUFS) et sa crête vraie (dBTP). */
export function mesurerM4a(m4a: Uint8Array): Promise<{ lufs: number; crete: number; duree: number }> {
  // Le décodage aussi a un délai (4 × une étape) : jamais d'export qui attend sans fin.
  return avecDelai(mesurer(m4a), 4).catch((e: unknown) => Promise.reject(impossible(e)));
}

async function mesurer(m4a: Uint8Array): Promise<{ lufs: number; crete: number; duree: number }> {
  const mb = await charger();
  const entree = new mb.Input({ source: new mb.BufferSource(m4a), formats: mb.ALL_FORMATS });
  try {
    const piste = await entree.getPrimaryAudioTrack();
    if (!piste) throw new Error('pas de piste audio');
    const nc = piste.numberOfChannels;
    const sonie = new MesureSonie(piste.sampleRate, nc);
    const crete = new CreteVraieFlux(nc);
    let trames = 0;
    for await (const s of new mb.AudioSampleSink(piste).samples()) {
      const canaux = Array.from({ length: nc }, (_, c) => {
        const x = new Float32Array(s.numberOfFrames);
        s.copyTo(x, { planeIndex: c, format: 'f32-planar' });
        return x;
      });
      s.close();
      sonie.ajouter(canaux);
      crete.ajouter(canaux);
      trames += canaux[0]!.length;
    }
    return { lufs: sonie.integree(), crete: enDb(crete.fin()), duree: trames / piste.sampleRate };
  } catch (e) {
    throw impossible(e);
  } finally {
    entree.dispose();
  }
}
