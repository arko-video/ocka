// SoundFonts (.sf2) de l'utilisateur, sous sa responsabilité (S) : analyse dans un Worker (RIFF, pdta, presets, zones),
// fichier gardé dans OPFS ocka-sf2 (« sf2-<id>.sf2 »), presets joués par l'échantillonneur via SourceZones
// (instrument « sf2-<id>-<banque>-<preset>@1 »). Plafonds : 32 Mo par fichier, 64 Mio décodés.
// Les zones se lisent par morceaux dans le fichier (File.slice) : la SoundFont n'est jamais chargée en entier.

import { nouvelId } from '../enregistrement/contexte';
import { declarerInstruments } from '../morceau/acces';
import { REGLE_CLE_SF2 } from '../morceau/types-ajouts';
import { PLAFONDS, type Morceau, type SoundFontMorceau } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import type { PcmSon, SourceZones } from '../moteur/types-moteur';
import { dossierOpfs, enErreurOcka, formaterOctets, verifierPlace } from '../stockage/dossiers';
import { analyseEnCache, analyserFichier, lecteurBlob, oublierAnalyse, poserAnalyse, type AnalyseSf2 } from './analyse';
import { MEMOIRE_MAX_SF2, TAILLE_MAX_SF2, type PresetSf2 } from './api-sf2';
import { lirePcmZone } from './pcm-sf2';
import { sourceDuPreset, type PresetAnalyse } from './zones-sf2';

/** « sf2-<idSoundfont>-<banque>-<preset>@1 » → ses parties, ou null. */
export function lireIdPreset(id: string): { sf: string; banque: number; preset: number } | null {
  const m = /^sf2-([A-Za-z0-9_-]{1,40})-(\d{1,3})-(\d{1,3})@1$/.exec(id);
  return m ? { sf: m[1]!, banque: Number(m[2]), preset: Number(m[3]) } : null;
}
export const idPreset = (sf: string, banque: number, preset: number) => `sf2-${sf}-${banque}-${preset}@1`;

const absente = () => new ErreurOcka('Cette SoundFont n’est pas sur ce téléphone : importe de nouveau le fichier .sf2.', 'instrument_absent');
const tropLourd = (o: number) =>
  new ErreurOcka(`Cette SoundFont prend ${formaterOctets(o)} une fois décodée : c’est plus que ${formaterOctets(MEMOIRE_MAX_SF2)}. Choisis une SoundFont plus légère.`, 'sf2_trop_lourd');

async function fichierSf2(cle: string): Promise<File | null> {
  if (!REGLE_CLE_SF2.test(cle)) return null;
  try {
    return await (await (await dossierOpfs('sf2')).getFileHandle(cle)).getFile();
  } catch {
    return null;
  }
}

/** Analyse d'une SoundFont rangée (id seul : son fichier est « sf2-<id>.sf2 »). */
function analyseDe(id: string): Promise<AnalyseSf2> {
  return analyseEnCache(id, async () => {
    const f = await fichierSf2(`sf2-${id}.sf2`);
    if (!f) throw absente();
    return analyserFichier(f);
  });
}

function versPresets(id: string, a: AnalyseSf2): PresetSf2[] {
  const presets = a.presets
    .filter((p) => p.octets <= MEMOIRE_MAX_SF2 && p.banque <= 999 && p.preset <= 999)
    .map((p) => ({ instrument: idPreset(id, p.banque, p.preset), nom: p.nom.slice(0, 40), banque: p.banque, preset: p.preset, batterie: p.banque === 128 }));
  declarerInstruments(presets.map((p) => p.instrument));
  return presets;
}

async function empreinte(f: Blob): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', await f.arrayBuffer()));
  return [...h].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const nomSf = (f: string) => f.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\.sf2$/i, '').trim().slice(0, 60) || 'SoundFont';

/** Voir api-sf2.ts. */
export async function importerSoundfont(f: File, m: Morceau): Promise<{ soundfont: SoundFontMorceau; presets: PresetSf2[] }> {
  if (f.size > TAILLE_MAX_SF2) {
    throw new ErreurOcka(`Cette SoundFont pèse ${formaterOctets(f.size)} : OCKA accepte ${formaterOctets(TAILLE_MAX_SF2)} au plus.`, 'trop_gros');
  }
  if (/\.sf3$/i.test(f.name)) throw new ErreurOcka('Les .sf3 (échantillons compressés) ne sont pas pris en charge : choisis un .sf2.', 'sf2_illisible');
  const sha256 = await empreinte(f);
  const deja = m.soundfonts?.find((s) => s.sha256 === sha256);
  if (deja && (await fichierSf2(deja.fichier))) return { soundfont: deja, presets: await presetsSoundfont(deja) };
  if ((m.soundfonts?.length ?? 0) >= PLAFONDS.soundfonts) {
    throw new ErreurOcka(`Un morceau a ${PLAFONDS.soundfonts} SoundFonts au plus. Retires-en une avant d’en ajouter.`, 'trop_de_soundfonts');
  }
  const analyse = await analyserFichier(f);
  if (analyse.echantillons * 4 > MEMOIRE_MAX_SF2) throw tropLourd(analyse.echantillons * 4);
  const id = nouvelId();
  const presets = versPresets(id, analyse);
  if (!presets.length) throw new ErreurOcka('Cette SoundFont n’a aucun preset jouable.', 'sf2_illisible');
  const fichier = `sf2-${id}.sf2`;
  await verifierPlace(f.size, 1.1);
  const d = await dossierOpfs('sf2');
  try {
    await f.stream().pipeTo(await (await d.getFileHandle(fichier, { create: true })).createWritable());
  } catch (e) {
    await d.removeEntry(fichier).catch(() => {});
    throw enErreurOcka(e, { message: 'La SoundFont n’a pas pu être rangée sur le téléphone.', code: 'disque_plein' });
  }
  poserAnalyse(id, analyse);
  return { soundfont: { id, nom: nomSf(analyse.nom || f.name), fichier, taille: f.size, sha256 }, presets };
}

/** Voir api-sf2.ts. */
export async function presetsSoundfont(s: SoundFontMorceau): Promise<PresetSf2[]> {
  return versPresets(s.id, await analyseDe(s.id));
}

/** Voir api-sf2.ts. */
export function ajouterSoundfont(m: Morceau, s: SoundFontMorceau): Morceau {
  const liste = m.soundfonts ?? [];
  if (liste.some((x) => x.id === s.id) || liste.length >= PLAFONDS.soundfonts || !REGLE_CLE_SF2.test(s.fichier)) return m;
  return { ...m, soundfonts: [...liste, { ...s }] };
}

/** Voir api-sf2.ts. */
export async function supprimerSoundfont(m: Morceau, id: string): Promise<Morceau> {
  const liste = m.soundfonts ?? [];
  if (!liste.some((s) => s.id === id)) return m;
  oublierAnalyse(id);
  const reste = liste.filter((s) => s.id !== id);
  const res: Morceau = { ...m, soundfonts: reste };
  if (!reste.length) delete res.soundfonts;
  return res;
}

async function presetDe(id: string): Promise<{ a: AnalyseSf2; p: PresetAnalyse }> {
  const x = lireIdPreset(id);
  if (!x) throw absente();
  const a = await analyseDe(x.sf);
  const p = a.presets.find((q) => q.banque === x.banque && q.preset === x.preset);
  if (!p) throw new ErreurOcka('Ce preset n’existe pas dans la SoundFont.', 'instrument_absent');
  if (p.octets > MEMOIRE_MAX_SF2) throw tropLourd(p.octets);
  return { a, p };
}

/** Fournisseur de l'échantillonneur (moteur/instruments/fournisseur.ts) pour les ids « sf2-… ». */
export async function chargerSourceSf2(id: string, signal?: AbortSignal): Promise<SourceZones> {
  if (signal?.aborted) throw new ErreurOcka('Calcul annulé.', 'annule');
  return sourceDuPreset(id, (await presetDe(id)).p);
}

export async function lireZoneSf2(id: string, fichier: string, signal?: AbortSignal): Promise<PcmSon> {
  if (signal?.aborted) throw new ErreurOcka('Calcul annulé.', 'annule');
  const { a, p } = await presetDe(id);
  const z = p.zones.find((x) => x.cle === fichier);
  const f = await fichierSf2(`sf2-${lireIdPreset(id)!.sf}.sf2`);
  if (!z || !f) throw absente();
  return lirePcmZone(lecteurBlob(f), a.smpl, z);
}
