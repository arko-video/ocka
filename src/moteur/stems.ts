// « Pistes séparées » (stems) : un WAV 44,1 kHz 32 bits FLOTTANTS par piste qui joue, pris AVANT le master
// (ni pré-gain, ni couleur, ni colle, ni limiteur, ni réglage de sonie), dans un ZIP « Titre (pistes).zip ».
// Promesse : posés ensemble, ils redonnent le mix avant le mastering (Σ pistes = entrée du master, sans décalage).
// Rendu SANS worklet (Chrome ne libère jamais un OfflineAudioContext où un worklet a été chargé) : construireGraphe(…,
// { pistesSeparees }) envoie chaque piste vers 2 entrées d'un ChannelMerger, sortie du contexte hors ligne. Ce rendu
// tient tout en mémoire : on rend donc les pistes qui jouent par PASSES de quelques pistes (≤ 128 Mo de rendu par
// passe ; 2 pistes par passe pour 3 min). Chaque passe est écrite par blocs dans des fichiers de travail (OPFS
// ocka-tmp), puis les fichiers sont recopiés en flux dans le ZIP (creerZip, A2) et effacés.

import { normaliserMorceau } from '../morceau/normaliser';
import { dureeMorceau } from '../morceau/temps';
import { estPisteInstrument } from '../morceau/acces';
import type { IdFixe, IdPiste, Morceau } from '../morceau/types';
import { dossierOpfs, enErreurOcka, verifierPlace } from '../stockage/dossiers';
import { creerZip } from '../zip/ecrire';
import type { OptionsLongues } from './api-fichiers';
import { chargerMedias, rendreParFenetres, type Medias } from './audio/rendu';
import { gainPiste } from './chaines';
import { enTeteWavFlottant, RepartiteurPistes, tailleWavFlottant, type Puits } from './audio/wav-flottant';
import { ErreurOcka } from './erreur';
import { construireGraphe } from './graphe';
import { oublierBanque } from './instruments/banque';
import { detruireBus } from './instruments/bus';
import { preparerTranches } from './effets/preparer';

const FREQ = 44100;
/** Bloc d'écriture (trames, multiple de 128) = aussi la fenêtre de planification (~0,5 s). */
const BLOC = 128 * 172;
/** Taille maximale du rendu d'une passe (octets) : décide du nombre de pistes rendues ensemble. */
export const BUDGET_PASSE = 128 * 1024 * 1024;

/** Noms des fichiers des pistes fixes dans le ZIP (une piste instrument prend son `nom`). */
export const NOMS_PISTES: Record<IdFixe, string> = {
  batterie: 'Batterie',
  basse: 'Basse',
  accords: 'Accords',
  sons: 'Sons',
  voix: 'Voix',
};

/** Nom du fichier de chaque piste (sans caractères interdits ; « Nom (2) » si deux pistes ont le même nom). */
export function nomsFichiers(m: Morceau): Map<IdPiste, string> {
  const noms = new Map<IdPiste, string>();
  const pris = new Set<string>();
  for (const p of m.pistes) {
    const base = nomPropre(estPisteInstrument(p) ? p.nom : NOMS_PISTES[p.id]);
    let nom = base;
    for (let k = 2; pris.has(nom.toLowerCase()); k++) nom = `${base} (${k})`;
    pris.add(nom.toLowerCase());
    noms.set(p.id, nom);
  }
  return noms;
}

/** Outils remplaçables par les tests (graphe et ZIP simulés tant que M1 et A2 ne sont pas branchés). */
export const outilsPistes = { construireGraphe, creerZip, chargerMedias };

/** Pistes qui peuvent jouer (des notes, une boucle, un pad ou une prise, et un volume non nul). */
export function pistesQuiJouent(m: Morceau): IdPiste[] {
  const avecMotif = (id: IdPiste) => m.sections.some((s) => Object.hasOwn(s.motifs, id) && !!s.motifs[id]);
  const joue = (id: IdPiste): boolean => {
    if (id === 'sons') return m.sections.some((s) => s.boucle) || Object.keys(m.pads ?? {}).length > 0;
    if (id === 'voix') return m.prises.some((p) => p.choisie);
    return avecMotif(id);
  };
  return m.pistes.filter((p) => joue(p.id) && gainPiste(p, m.pistes) > 0).map((p) => p.id);
}

/** Nombre de pistes qui peuvent jouer (pour estimer la place avant le rendu ; au moins 1). */
export function pistesAttendues(m: Morceau): number {
  return Math.max(1, pistesQuiJouent(m).length);
}

/** Pistes rendues ensemble : `parPasse` = pistes par passe, selon la durée (n trames stéréo) et BUDGET_PASSE. */
export function passes(ids: IdPiste[], n: number): IdPiste[][] {
  const parPasse = Math.max(1, Math.min(16, Math.floor(BUDGET_PASSE / (Math.max(1, n) * 8))));
  const out: IdPiste[][] = [];
  for (let i = 0; i < ids.length; i += parPasse) out.push(ids.slice(i, i + parPasse));
  return out;
}

/** Titre sans caractères interdits dans un nom de fichier. */
export function nomPropre(titre: string): string {
  return titre.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 80) || 'morceau';
}

/** Fichiers de travail (un par piste) : dans OPFS ocka-tmp, sinon en petits Blobs. */
interface Travail {
  puits: Puits[];
  fichier(i: number): Promise<Blob>;
  effacer(): Promise<void>;
}

async function ouvrirTravail(nombre: number): Promise<Travail> {
  let dossier: FileSystemDirectoryHandle | null = null;
  try {
    dossier = await dossierOpfs('tmp');
  } catch {
    dossier = null;
  }
  if (!dossier) {
    const parties: Blob[][] = Array.from({ length: nombre }, () => []);
    return {
      puits: parties.map((p) => ({ ecrire: async (o: Uint8Array) => void p.push(new Blob([o.slice()])) })),
      fichier: async (i) => new Blob(parties[i]!),
      effacer: async () => parties.forEach((p) => (p.length = 0)),
    };
  }
  const d = dossier;
  const marque = `pistes-${Date.now().toString(36)}`;
  const poignees: FileSystemFileHandle[] = [];
  const flux: FileSystemWritableFileStream[] = [];
  for (let i = 0; i < nombre; i++) {
    const p = await d.getFileHandle(`${marque}-${i}.f32`, { create: true });
    poignees.push(p);
    flux.push(await p.createWritable());
  }
  const fermes = new Set<number>();
  return {
    puits: flux.map((f) => ({ ecrire: (o: Uint8Array) => f.write(o as Uint8Array<ArrayBuffer>) })),
    async fichier(i) {
      if (!fermes.has(i)) {
        fermes.add(i);
        await flux[i]!.close();
      }
      return poignees[i]!.getFile();
    },
    async effacer() {
      for (let i = 0; i < nombre; i++) {
        if (!fermes.has(i)) await flux[i]!.abort().catch(() => {});
        await d.removeEntry(poignees[i]!.name).catch(() => {});
      }
    },
  };
}

/**
 * Rend les pistes `ids` en une passe (chacune sur 2 canaux d'un ChannelMerger, sortie du contexte), puis les envoie
 * par blocs de BLOC trames à `repartiteur` (une piste par puits). Progression de p0 à p1.
 */
async function rendrePasse(morceau: Morceau, medias: Medias, ids: IdPiste[], n: number, repartiteur: RepartiteurPistes, options: OptionsLongues, p0: number, p1: number): Promise<void> {
  const ctx = new OfflineAudioContext(2 * ids.length, Math.ceil(n / BLOC) * BLOC, FREQ);
  const fusion = ctx.createChannelMerger(2 * ids.length);
  fusion.connect(ctx.destination);
  const nulle = ctx.createGain(); // ne va nulle part : le master et les pistes d'autres passes ne sont pas calculés
  const pistesSeparees = Object.create(null) as Record<IdPiste, AudioNode>;
  for (const p of morceau.pistes) pistesSeparees[p.id] = nulle;
  ids.forEach((id, i) => {
    const g = ctx.createGain();
    g.channelCount = 2;
    g.channelCountMode = 'explicit';
    const separe = ctx.createChannelSplitter(2);
    g.connect(separe);
    separe.connect(fusion, 0, 2 * i);
    separe.connect(fusion, 1, 2 * i + 1);
    pistesSeparees[id] = g;
  });
  // Inserts JS (compresseur, bitcrusher) : passe A en JS, sans worklet (effets/preparer.ts).
  await preparerTranches(ctx, morceau, medias.prises, medias.sons);
  const graphe = await outilsPistes.construireGraphe(ctx, morceau, medias.prises, nulle, { pistesSeparees, sons: medias.sons });
  let rendu: AudioBuffer;
  try {
    rendu = await rendreParFenetres(ctx, graphe, 0, {
      pas: BLOC,
      surProgression: (p) => options.surProgression?.(p0 + (p1 - p0) * 0.8 * p),
      signal: options.signal,
    });
  } finally {
    graphe.detruire();
    detruireBus(ctx);
    oublierBanque(ctx);
  }
  // Blocs au format du répartiteur : pour chaque piste à la suite, BLOC trames entrelacées G, D.
  const canaux = Array.from({ length: 2 * ids.length }, (_, c) => rendu.getChannelData(c));
  const donnees = new Float32Array(ids.length * BLOC * 2);
  for (let debut = 0; debut < n; debut += BLOC) {
    if (options.signal?.aborted) throw new ErreurOcka('Export annulé.', 'annule');
    donnees.fill(0);
    const m = Math.min(BLOC, rendu.length - debut);
    for (let p = 0; p < ids.length; p++) {
      const g = canaux[2 * p]!;
      const d = canaux[2 * p + 1]!;
      const base = p * BLOC * 2;
      for (let i = 0; i < m; i++) {
        donnees[base + 2 * i] = g[debut + i]!;
        donnees[base + 2 * i + 1] = d[debut + i]!;
      }
    }
    await repartiteur.ajouter(debut, donnees);
    options.surProgression?.(p0 + (p1 - p0) * (0.8 + (0.2 * debut) / n));
  }
}

export async function exporterPistes(entree: Morceau, options: OptionsLongues = {}): Promise<File> {
  const { morceau, bloquant, problemes } = normaliserMorceau(entree);
  if (bloquant) throw new ErreurOcka(problemes.find((p) => p.niveau === 'bloquant')!.message, 'morceau_invalide');
  const n = Math.round(dureeMorceau(morceau) * FREQ);
  if (n < FREQ) throw new ErreurOcka('Le morceau est trop court pour être exporté (moins d’une seconde).', 'trop_court');
  options.surProgression?.(0);
  // Fichiers de travail + ZIP : 2 fois les pistes qui jouent (une piste muette n'écrit rien), plus une marge.
  await verifierPlace(pistesAttendues(morceau) * tailleWavFlottant(n, 2), 2.2);
  const tous = morceau.pistes.map((p) => p.id);
  const noms = nomsFichiers(morceau);
  const travail = await ouvrirTravail(tous.length);
  try {
    const medias = await outilsPistes.chargerMedias(morceau);
    const cretes = new Array<number>(tous.length).fill(0);
    const groupes = passes(pistesQuiJouent(morceau), n);
    for (const [k, ids] of groupes.entries()) {
      const index = ids.map((id) => tous.indexOf(id));
      const repartiteur = new RepartiteurPistes(ids.length, BLOC, n, index.map((i) => travail.puits[i]!));
      await rendrePasse(morceau, medias, ids, n, repartiteur, options, (0.85 * k) / groupes.length, (0.85 * (k + 1)) / groupes.length);
      index.forEach((i, j) => (cretes[i] = repartiteur.cretes[j]!));
    }
    const jouees = tous.map((id, i) => ({ id, i })).filter(({ i }) => cretes[i]! > 0);
    if (jouees.length === 0) throw new ErreurOcka('Le morceau est silencieux : aucune piste à exporter.', 'morceau_invalide');
    const base = nomPropre(morceau.titre);
    const zip = await outilsPistes.creerZip('exports', `${base} (pistes).zip`);
    try {
      for (const [k, { id, i }] of jouees.entries()) {
        if (options.signal?.aborted) throw new ErreurOcka('Export annulé.', 'annule');
        await zip.ajouter(`${base} - ${noms.get(id)}.wav`, new Blob([enTeteWavFlottant(n, 2, FREQ), await travail.fichier(i)]));
        options.surProgression?.(0.85 + (0.15 * (k + 1)) / jouees.length);
      }
      return await zip.terminer();
    } catch (e) {
      await zip.annuler();
      throw e;
    }
  } catch (e) {
    throw enErreurOcka(e);
  } finally {
    await travail.effacer();
  }
}
