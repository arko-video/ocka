// Export d'un titre au niveau Spotify : WAV 24 ou 16 bits, FLAC 16 bits, ou M4A (AAC 256 kb/s).
//  1. Rendu du morceau avec le MÊME graphe que l'écoute, dans un OfflineAudioContext(2, n, 44100) (export-rendu.ts).
//  2. Sonie BS.1770 du rendu → gain vers −14 LUFS (standard) ou −11 LUFS (fort).
//  3. Passe d'essai sans écrire : corrige le gain si le limiteur a fait baisser la sonie.
//  4. Passe finale en flux : gain + limiteur à crête VRAIE (≤ −1 dBTP ou −2 dBTP), mesure de contrôle, et chaque
//     seconde part tout de suite vers la destination : WAV (en-tête connu d'avance), FLAC (encodeur fait main,
//     STREAMINFO complété à la fin) ou AAC (Mediabunny ; crête vérifiée après décodage, refait plus bas si besoin).
// Destination : un fichier de ocka-exports, ou `options.ecrivain` (une entrée du ZIP de sortie, sans fichier
// temporaire). Mémoire : un seul tampon complet (le rendu).

import { normaliserMorceau } from '../morceau/normaliser';
import type { Morceau } from '../morceau/types';
import { enErreurOcka } from '../stockage/dossiers';
import type { EcrivainFlux } from '../zip/types';
import type { OptionsExport, ResultatExport } from './api';
import type { FormatAudio, OptionsAudio, ResultatAudio } from './api-fichiers';
import { ErreurOcka } from './erreur';
import { etape, FREQ_EXPORT, passe, pause, profil, rendre, type Bilan, type Recepteur } from './export-rendu';
import { BLOC_FLAC, EncodeurFlac, POSITION_STREAMINFO } from './flac/encodeur';
import { encoderM4a, mesurerM4a, DEBIT_AAC } from './m4a';
import { mesurerSonie } from './sonie';
import { ouvrirEcriture, TYPES, type Ecrivain } from './sortie-wav';
import { creerDither, enTeteWav, nomFichier, quantifier, versPcm } from './wav';

export { FREQ_EXPORT, profil } from './export-rendu';
/** Cibles de chaque niveau : sonie intégrée (LUFS) et crête vraie maximale (dBTP). */
export const NIVEAUX = { standard: { lufs: -14, crete: -1 }, fort: { lufs: -11, crete: -2 } } as const;
/** Taille d'un FLAC par rapport au WAV 16 bits (mesurée sur des exports réels ; on garde de la marge). */
export const RAPPORT_FLAC = 0.8;

const EXTENSIONS: Record<FormatAudio, keyof typeof TYPES> = { wav24: 'wav', wav16: 'wav', flac16: 'flac', m4a: 'm4a' };

/** Taille estimée (octets) d'un titre de `duree` s dans ce format (pour verifierPlace avant un export). */
export function tailleEstimee(duree: number, format: FormatAudio): number {
  const n = Math.max(0, Math.round((Number.isFinite(duree) ? duree : 0) * FREQ_EXPORT));
  switch (format) {
    case 'wav24':
      return 44 + n * 6;
    case 'wav16':
      return 44 + n * 4;
    case 'flac16':
      return 42 + Math.ceil(n * 4 * RAPPORT_FLAC) + Math.ceil(n / BLOC_FLAC) * 20;
    case 'm4a':
      return Math.ceil((n / FREQ_EXPORT) * (DEBIT_AAC / 8) * 1.03) + 64 * 1024;
  }
}

/** Ce qu'il faut pour écrire : un fichier d'export, ou l'entrée de ZIP donnée par l'appelant. */
interface Flux {
  ecrire(o: Uint8Array): Promise<void>;
  corriger?(position: number, o: Uint8Array): Promise<void>;
}

function versFlux(e: EcrivainFlux): Flux {
  const c = (e as Partial<{ corriger(p: number, o: Uint8Array): Promise<void> }>).corriger;
  return { ecrire: (o) => e.ecrire(o), ...(c ? { corriger: (p: number, o: Uint8Array) => c.call(e, p, o) } : {}) };
}

/** Écrit l'en-tête, puis renvoie le récepteur des blocs et la fonction de fin (WAV ou FLAC). */
async function ouvrirPcm(format: 'wav24' | 'wav16' | 'flac16', n: number, flux: Flux): Promise<{ recepteur: Recepteur; finir(): Promise<void> }> {
  if (format === 'flac16') {
    const enc = new EncodeurFlac(n);
    const dither = creerDither(); // le MÊME dither TPDF que le WAV 16 bits
    await flux.ecrire(enc.entete());
    return {
      recepteur: async (canaux, m) => {
        const o = enc.ajouter(quantifier(canaux, m, 16, dither), m);
        if (o.length > 0) await flux.ecrire(o);
      },
      async finir() {
        const o = enc.terminer();
        if (o.length > 0) await flux.ecrire(o);
        // Sans correction possible, l'en-tête garde le bon nombre d'échantillons et des tailles de trame « inconnues ».
        if (flux.corriger) await flux.corriger(POSITION_STREAMINFO, enc.streamInfoFinal());
      },
    };
  }
  const bits = format === 'wav16' ? 16 : 24;
  const dither = bits === 16 ? creerDither() : undefined;
  await flux.ecrire(enTeteWav(n, 2, FREQ_EXPORT, bits));
  return { recepteur: (canaux, m) => flux.ecrire(versPcm(canaux, m, bits, dither)), finir: async () => {} };
}

/** Voir api-fichiers.ts. Erreurs : « morceau_invalide », « trop_court », « annule », « disque_plein », « format_impossible » (M4A). */
export async function exporterAudio(entree: Morceau, options: OptionsAudio): Promise<ResultatAudio> {
  const { morceau, bloquant, problemes } = normaliserMorceau(entree);
  if (bloquant) throw new ErreurOcka(problemes.find((p) => p.niveau === 'bloquant')!.message, 'morceau_invalide');
  const cible = NIVEAUX[options.niveau ?? morceau.master.niveau];
  const { format } = options;
  options.surProgression?.(0);
  etape('debut');
  try {
    const canaux = await rendre(morceau, options);
    const n = canaux[0]!.length;
    await pause(options.signal);
    etape('pause');

    // Sonie du rendu → gain de départ ; passe d'essai : le limiteur baisse un peu la sonie (correction ≤ +6 dB).
    const mesuree = mesurerSonie(canaux, FREQ_EXPORT);
    etape('sonie');
    let gain = Number.isFinite(mesuree) ? Math.pow(10, (cible.lufs - mesuree) / 20) : 1;
    options.surProgression?.(0.55);
    const essai = await passe(canaux, gain, cible.crete, null, options, 0.55, 0.75);
    etape('passe-essai');
    if (Number.isFinite(essai.lufs) && Math.abs(essai.lufs - cible.lufs) > 0.05) {
      gain *= Math.min(2, Math.pow(10, (cible.lufs - essai.lufs) / 20));
    }

    if (format === 'm4a') return await finirM4a(morceau, canaux, gain, cible.crete, options);

    // Passe finale : écrit le fichier en flux (en-tête, puis 1 s à la fois).
    const fichier: Ecrivain | null = options.ecrivain ? null : await ouvrirEcriture(EXTENSIONS[format]);
    const flux: Flux = options.ecrivain ? versFlux(options.ecrivain) : fichier!;
    const depart = options.ecrivain?.position ?? 0;
    let fin: Bilan;
    try {
      const pcm = await ouvrirPcm(format, n, flux);
      fin = await passe(canaux, gain, cible.crete, pcm.recepteur, options, 0.75, 1);
      await pcm.finir();
    } catch (e) {
      await fichier?.abandonner();
      throw e;
    }
    etape('passe-finale');
    const octets = options.ecrivain ? options.ecrivain.position - depart : fichier!.octets;
    const f = fichier ? await fichier.fermer(nomFichier(morceau.titre, EXTENSIONS[format]), TYPES[EXTENSIONS[format]]) : null;
    options.surProgression?.(1);
    return { fichier: f, octets, lufs: arrondi(fin.lufs), creteVraie: arrondi(fin.crete), duree: n / FREQ_EXPORT };
  } catch (e) {
    throw enErreurOcka(e, { message: 'L’export a échoué. Réessaie.', code: 'inconnu' });
  }
}

const arrondi = (x: number) => Math.round(x * 10) / 10;

/**
 * M4A : la passe finale alimente l'encodeur AAC ; le résultat est décodé et mesuré. Si sa crête vraie dépasse
 * la cible (l'AAC ajoute des dépassements), on baisse gain ET plafond de la différence (+ 0,1 dB) et on refait
 * la passe et l'encodage (au plus 2 fois ; temps noté dans profil['m4a-reprise']).
 */
async function finirM4a(morceau: Morceau, canaux: Float32Array[], gain: number, plafond: number, options: OptionsAudio): Promise<ResultatAudio> {
  const tags = { titre: morceau.titre, ...(morceau.artiste ? { artiste: morceau.artiste } : {}) };
  const cible = plafond;
  let m4a = await encoderM4a((r) => passe(canaux, gain, plafond, r, options, 0.75, 0.95), tags);
  etape('passe-finale');
  let mesure = await mesurerM4a(m4a);
  etape('m4a-verification');
  const debutReprise = performance.now();
  for (let essai = 0; essai < 2 && mesure.crete > cible; essai++) {
    const ecart = mesure.crete - cible + 0.1;
    gain *= Math.pow(10, -ecart / 20);
    plafond -= ecart;
    m4a = await encoderM4a((r) => passe(canaux, gain, plafond, r, options, 0.95, 0.99), tags);
    mesure = await mesurerM4a(m4a);
    profil['m4a-reprise'] = Math.round(performance.now() - debutReprise);
  }
  let f: File | null = null;
  if (options.ecrivain) await options.ecrivain.ecrire(m4a);
  else {
    const fichier = await ouvrirEcriture('m4a');
    try {
      await fichier.ecrire(m4a);
    } catch (e) {
      await fichier.abandonner();
      throw e;
    }
    f = await fichier.fermer(nomFichier(morceau.titre, 'm4a'), TYPES.m4a);
  }
  options.surProgression?.(1);
  return { fichier: f, octets: m4a.length, lufs: arrondi(mesure.lufs), creteVraie: arrondi(mesure.crete), duree: canaux[0]!.length / FREQ_EXPORT };
}

/** Export WAV de l'interface actuelle (bits : 24 par défaut, ou 16 avec dither TPDF). Passe par exporterAudio. */
export async function exporterWav(entree: Morceau, options: OptionsExport = {}): Promise<ResultatExport> {
  const r = await exporterAudio(entree, {
    format: options.bits === 16 ? 'wav16' : 'wav24',
    ...(options.surProgression ? { surProgression: options.surProgression } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return { fichier: r.fichier!, lufs: r.lufs, creteVraie: r.creteVraie, duree: r.duree };
}
