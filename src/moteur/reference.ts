// Écoute de référence (V) : un morceau pro importé (MP3, M4A, WAV, FLAC…), décodé EN FLUX par Mediabunny (paquet par
// paquet : jamais tout le morceau en mémoire), rangé en PCM dans OPFS ocka-references (« ref-<id>.f32 » stéréo
// entrelacé + « ref-<id>.json »), sa sonie BS.1770 mesurée pendant le décodage. L'A/B avec le mix se fait au MÊME
// volume perçu : gain de la référence = sonie du mix − sonie de la référence. Le lecteur d'OCKA n'est pas modifié :
// la référence joue en flux dans le contexte commun (reference-lecture.ts) et l'A/B met l'un ou l'autre en pause,
// au même endroit. Le fichier reste sur l'appareil : rien ne part en ligne.
// creerEcouteReference(lecteur, id, { morceau, passage }) : le mix comparé (défaut : le dernier morceau chargé pour
// l'écoute) et le passage de la référence (s). L'ancienne forme « <id>#t=<secondes> » reste lue.

import type { EcouteReference, InfoReference, OptionsEcouteReference } from '../enregistrement/api-voix-avancee';
import { contexteAudio, nouvelId } from '../enregistrement/contexte';
import type { Morceau } from '../morceau/types';
import { dossierOpfs, enErreurOcka, verifierPlace } from '../stockage/dossiers';
import type { Lecteur } from './api';
import { ErreurOcka } from './erreur';
import { rendre } from './export-rendu';
import { empreinte, morceauEcoute } from './gel';
import { LecteurFlux } from './reference-lecture';
import { MesureSonie, mesurerSonie } from './sonie';

/** 15 minutes et 400 Mo au plus. */
const DUREE_MAX = 15 * 60;
const TAILLE_MAX = 400e6;
const NOM = /^ref-[a-z0-9]{1,40}$/;

const illisible = () => new ErreurOcka('Ce morceau est illisible. Essaie un MP3, un M4A ou un WAV.', 'reference_illisible');

/** Gain (dB) qui amène la référence à la sonie du mix (borné à ±24 dB). */
export function compensation(lufsMix: number, lufsReference: number): number {
  if (!Number.isFinite(lufsMix) || !Number.isFinite(lufsReference)) return 0;
  return Math.round(Math.max(-24, Math.min(24, lufsMix - lufsReference)) * 100) / 100;
}

/** Entrelace deux canaux. */
export function entrelacer(g: Float32Array, d: Float32Array, n = g.length): Float32Array {
  const x = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) (x[2 * i] = g[i]!), (x[2 * i + 1] = d[i]!);
  return x;
}

export async function importerReference(f: File, options?: { surProgression?: (p: number) => void; signal?: AbortSignal }): Promise<InfoReference> {
  if (f.size > TAILLE_MAX) throw new ErreurOcka('Ce fichier est trop gros (plus de 400 Mo).', 'trop_gros');
  const mb = await import('mediabunny');
  const entree = new mb.Input({ source: new mb.BlobSource(f), formats: mb.ALL_FORMATS });
  const id = `ref-${nouvelId()}`;
  const d = await dossierOpfs('references');
  let ecrit = false;
  try {
    const piste = await entree.getPrimaryAudioTrack().catch(() => null);
    if (!piste || !(await piste.canDecode().catch(() => false))) throw illisible();
    const duree = await entree.computeDuration([piste]).catch(() => 0);
    if (!(duree > 0)) throw illisible();
    if (duree > DUREE_MAX) throw new ErreurOcka('Ce morceau dure plus de 15 minutes : choisis un morceau plus court.', 'trop_gros');
    const fs = piste.sampleRate;
    await verifierPlace(duree * fs * 8, 1.1);
    const flux = await (await d.getFileHandle(`${id}.f32`, { create: true })).createWritable();
    ecrit = true;
    const mesure = new MesureSonie(fs, 2);
    let trames = 0;
    try {
      for await (const s of new mb.AudioSampleSink(piste).samples()) {
        const n = s.numberOfFrames;
        const g = new Float32Array(n);
        const dr = new Float32Array(n);
        s.copyTo(g, { planeIndex: 0, format: 'f32-planar' });
        if (s.numberOfChannels > 1) s.copyTo(dr, { planeIndex: 1, format: 'f32-planar' });
        else dr.set(g);
        const t = s.timestamp;
        s.close();
        mesure.ajouter([g, dr]);
        await flux.write(entrelacer(g, dr) as Float32Array<ArrayBuffer>);
        trames += n;
        options?.surProgression?.(Math.min(1, (t + n / fs) / duree));
        if (options?.signal?.aborted) throw new ErreurOcka('Import annulé.', 'annule');
      }
      await flux.close();
    } catch (e) {
      await flux.abort().catch(() => {});
      throw e;
    }
    if (trames === 0) throw illisible();
    const info: InfoReference = { id, nom: nomReference(f.name), duree: trames / fs, lufs: Math.round(mesure.integree() * 100) / 100 };
    const desc = await (await d.getFileHandle(`${id}.json`, { create: true })).createWritable();
    await desc.write(JSON.stringify({ format: 'ocka.reference/1', ...info, frequence: fs, trames }));
    await desc.close();
    return info;
  } catch (e) {
    if (ecrit) {
      await d.removeEntry(`${id}.f32`).catch(() => {});
      await d.removeEntry(`${id}.json`).catch(() => {});
    }
    if (e instanceof ErreurOcka) throw e;
    throw enErreurOcka(e, { message: 'Ce morceau est illisible. Essaie un MP3, un M4A ou un WAV.', code: 'reference_illisible' });
  } finally {
    entree.dispose();
  }
}

/** Nom affiché : le nom du fichier sans extension, 60 caractères au plus. */
export function nomReference(nomFichier: string): string {
  const sans = nomFichier.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\.[A-Za-z0-9]{1,5}$/, '').trim();
  return sans.slice(0, 60) || 'Référence';
}

interface Description extends InfoReference {
  frequence: number;
  trames: number;
}

async function lireDescription(d: FileSystemDirectoryHandle, id: string): Promise<Description | null> {
  if (!NOM.test(id)) return null;
  try {
    const x = JSON.parse(await (await (await d.getFileHandle(`${id}.json`)).getFile()).text()) as Description;
    return x && x.id === id && x.frequence > 0 && x.trames > 0 ? x : null;
  } catch {
    return null;
  }
}

export async function listerReferences(): Promise<InfoReference[]> {
  const d = await dossierOpfs('references');
  const out: InfoReference[] = [];
  for await (const h of (d as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
    if (h.kind !== 'file' || !h.name.endsWith('.json')) continue;
    const x = await lireDescription(d, h.name.slice(0, -5));
    if (x) out.push({ id: x.id, nom: x.nom, duree: x.duree, lufs: x.lufs });
  }
  return out.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export async function supprimerReference(id: string): Promise<void> {
  if (!NOM.test(id)) return;
  const d = await dossierOpfs('references');
  await d.removeEntry(`${id}.f32`).catch(() => {});
  await d.removeEntry(`${id}.json`).catch(() => {});
}

const sonies = new Map<string, Promise<number>>();
/** Sonie intégrée (LUFS) du mix tel qu'on l'entend (même rendu que l'export, avant le gain de sortie). Mise en cache. */
export function sonieMix(m: Morceau): Promise<number> {
  const cle = empreinte(JSON.stringify(m));
  let p = sonies.get(cle);
  if (!p) {
    p = rendre(m, {}).then((c) => mesurerSonie(c, 44100));
    p.catch(() => sonies.delete(cle));
    if (sonies.size > 4) sonies.delete(sonies.keys().next().value!);
    sonies.set(cle, p);
  }
  return p;
}

class Ecoute implements EcouteReference {
  surReference = false;
  private mixJouait = false;

  constructor(private lecteur: Lecteur, private flux: LecteurFlux, readonly compensationDb: number) {}

  basculer(versReference: boolean): void {
    if (versReference === this.surReference) return;
    this.surReference = versReference;
    if (versReference) {
      this.mixJouait = this.lecteur.enLecture;
      this.lecteur.pause();
      void this.flux.lire();
    } else {
      this.flux.pause();
      if (this.mixJouait) this.lecteur.lire();
    }
  }

  detruire(): void {
    this.flux.detruire();
  }
}

export async function creerEcouteReference(lecteur: Lecteur, idReference: string, options: OptionsEcouteReference = {}): Promise<EcouteReference> {
  const [id = '', fragment = ''] = idReference.split('#');
  const demande = options.passage ?? Number(/(?:^|&)t=([\d.]+)/.exec(fragment)?.[1] ?? 0);
  const passage = Number.isFinite(demande) && demande > 0 ? demande : 0;
  const d = await dossierOpfs('references');
  const desc = await lireDescription(d, id);
  const fichier = desc ? await (await d.getFileHandle(`${id}.f32`)).getFile().catch(() => null) : null;
  if (!desc || !fichier) throw new ErreurOcka('Cette référence n’est plus sur l’appareil. Importe-la de nouveau.', 'reference_illisible');
  const m = options.morceau ?? morceauEcoute();
  const lufsMix = m ? await sonieMix(m).catch(() => NaN) : NaN;
  // Sans mix mesurable (rien de chargé) : on vise −14 LUFS, la sonie des plateformes.
  const comp = compensation(Number.isFinite(lufsMix) ? lufsMix : -14, desc.lufs);
  const ctx = lecteur.ctx ?? contexteAudio();
  return new Ecoute(lecteur, new LecteurFlux(ctx, fichier, desc.frequence, desc.trames, comp, passage), comp);
}
