// « Importer un projet » : lit un .ocka ou un .ocka-sortie, TOUT OU RIEN. Propriétaire : A2.
// 1. Lecture sûre du ZIP (src/zip/lire.ts) : d'abord ocka.json (type, version), puis les règles exactes du type.
// 2. JSON passé au normaliseur ; chaque prise et chaque son dont le WAV existe et est lisible reçoit une clé OPFS
//    NEUVE (« prise-<nouvel id>.f32 ») : un nom venu du ZIP ne devient jamais un chemin, une clé d'origine n'est
//    jamais réutilisée. Une prise ou un son sans fichier est retiré (le normaliseur nettoie les références).
// 3. Place vérifiée (somme × 1,1), fichiers recopiés en flux (CRC vérifié), puis le morceau (ou les morceaux et
//    la sortie) enregistré EN DERNIER, avec un id neuf. Au moindre échec, tout ce qui a été créé est effacé.

import { nouvelId } from '../enregistrement/contexte';
import { nomDescription } from '../enregistrement/fichiers-opfs';
import type { OptionsLongues, ResultatImport } from '../moteur/api-fichiers';
import { ErreurOcka } from '../moteur/erreur';
import { CODE_FLOTTANT, lireWav, type InfosWav } from '../moteur/wav';
import { normaliserMorceau } from '../morceau/normaliser';
import { normaliserSortie } from '../morceau/normaliser-sortie';
import type { Morceau, Prise, SonImporte } from '../morceau/types';
import { stockerPochette } from '../sortie/pochette';
import { dossierOpfs, enErreurOcka, verifierPlace } from '../stockage/dossiers';
import { migrer } from '../stockage/migration';
import { sauverMorceau, supprimerMorceau } from '../stockage/morceaux';
import { sauverSortie } from '../stockage/sorties';
import { lireZip } from '../zip/lire';
import type { LecteurZip } from '../zip/types';
import { illisible, lireJson, lireType, nomZipMorceau, nomZipPrise, nomZipSon, REGLES_MORCEAU, REGLES_SORTIE, REGLES_TOUT } from './commun';
import { copierVersOpfs, type Copie, type Cree } from './copie';

interface Plan {
  morceau: Morceau;
  copies: Copie[];
  octets: number;
}

/** Bloquant du normaliseur → « format_recent » (version plus récente) ou « projet_illisible ». */
function bloquer(problemes: { niveau: string; chemin: string; message: string }[], quoi: string): never {
  const b = problemes.find((p) => p.niveau === 'bloquant');
  if (b?.chemin === 'format') throw new ErreurOcka(b.message, 'format_recent');
  throw illisible(`${quoi} : ${b?.message ?? 'invalide'}`);
}

/** En-tête du WAV d'une entrée : WAV 32 bits flottants, 1 ou `maxCanaux` canaux, 8 à 192 kHz ; sinon null. */
async function wavValable(z: LecteurZip, nom: string, maxCanaux: number): Promise<InfosWav | null> {
  const b = z.blob(nom);
  const w = lireWav(new Uint8Array(await b.slice(0, 64 * 1024).arrayBuffer()), b.size);
  if (!w || w.format !== CODE_FLOTTANT || w.bits !== 32 || w.canaux < 1 || w.canaux > maxCanaux) return null;
  if (w.frequence < 8000 || w.frequence > 192000 || w.trames === 0) return null;
  return w;
}

/** Prépare un morceau : JSON normalisé, clés neuves, liste des fichiers à recopier (rien n'est encore écrit). */
async function preparer(z: LecteurZip): Promise<Plan> {
  const lu = normaliserMorceau(await lireJson(z, 'morceau.json'));
  if (lu.bloquant) bloquer(lu.problemes, 'le morceau');
  const present = new Set(z.entrees.map((e) => e.nom));
  const copies: Copie[] = [];
  const parCle = new Map<string, { cle: string; wav: InfosWav }>();
  const prises: Prise[] = [];
  for (const p of lu.morceau.prises) {
    const nom = nomZipPrise(p.fichier);
    let c = parCle.get(p.fichier);
    if (!c && present.has(nom)) {
      const wav = await wavValable(z, nom, 1);
      if (wav) {
        c = { cle: `prise-${nouvelId()}.f32`, wav };
        parCle.set(p.fichier, c);
        copies.push({ dossier: 'prises', cle: c.cle, blob: z.blob(nom), wav, crc: z.entrees.find((e) => e.nom === nom)!.crc32 });
      }
    }
    if (c) prises.push({ ...p, fichier: c.cle, frequence: c.wav.frequence }); // sinon : prise sans fichier, retirée
  }
  const sons: SonImporte[] = [];
  for (const s of lu.morceau.sons ?? []) {
    const nom = nomZipSon(s.fichier);
    const wav = present.has(nom) ? await wavValable(z, nom, 2) : null;
    if (!wav || parCle.has(s.fichier)) continue;
    const cle = `son-${nouvelId()}.f32`;
    parCle.set(s.fichier, { cle, wav });
    copies.push({ dossier: 'sons', cle, blob: z.blob(nom), wav, crc: z.entrees.find((e) => e.nom === nom)!.crc32 });
    sons.push({ ...s, fichier: cle, frequence: wav.frequence, canaux: wav.canaux === 2 ? 2 : 1, duree: wav.trames / wav.frequence });
  }
  const brut: Morceau = { ...lu.morceau, prises };
  if (lu.morceau.sons) brut.sons = sons;
  // Seconde normalisation : pads et boucles qui visaient un son retiré, plafonds des sons.
  const morceau = normaliserMorceau(brut).morceau;
  const gardees = new Set([...morceau.prises.map((p) => p.fichier), ...(morceau.sons ?? []).map((s) => s.fichier)]);
  const utiles = copies.filter((c) => gardees.has(c.cle));
  return { morceau, copies: utiles, octets: utiles.reduce((s, c) => s + c.wav.taille, 0) };
}

/** Ouvre un .ocka (fichier, ou entrée d'un .ocka-sortie) avec les règles d'un morceau. */
async function ouvrirMorceauZip(f: File): Promise<LecteurZip> {
  const z = await lireZip(f, REGLES_MORCEAU);
  if ((await lireType(z)) !== 'morceau') throw illisible('un titre n’est pas un morceau');
  return z;
}

/** Voir api-fichiers.ts. */
export async function importerProjet(f: File, options: OptionsLongues = {}): Promise<ResultatImport> {
  const crees: Cree[] = [];
  const sauves: string[] = [];
  try {
    await migrer();
    options.surProgression?.(0);
    const type = await lireType(await lireZip(f, REGLES_TOUT));
    const prises = await dossierOpfs('prises');
    const sons = await dossierOpfs('sons');
    const dossiers = { prises, sons };

    if (type === 'morceau') {
      const plan = await preparer(await ouvrirMorceauZip(f));
      await verifierPlace(plan.octets, 1.1);
      await copierVersOpfs(plan.copies, dossiers, crees, options, plan.octets, 0);
      await ecrireDescriptions(plan, prises, crees);
      const id = await sauverMorceau(plan.morceau); // EN DERNIER
      options.surProgression?.(1);
      return { type, id };
    }

    const z = await lireZip(f, REGLES_SORTIE);
    const lue = normaliserSortie(await lireJson(z, 'sortie.json'));
    if (lue.bloquant) bloquer(lue.problemes, 'la sortie');
    const present = new Set(z.entrees.map((e) => e.nom));
    const titres: { id: string; plan: Plan }[] = [];
    for (const id of lue.sortie.titres) {
      const nom = nomZipMorceau(id);
      if (present.has(nom)) titres.push({ id, plan: await preparer(await ouvrirMorceauZip(new File([z.blob(nom)], `${id}.ocka`))) });
    }
    const pochette = present.has('pochette.jpg') ? z.blob('pochette.jpg') : null;
    const total = titres.reduce((s, t) => s + t.plan.octets, 0);
    await verifierPlace(total + (pochette?.size ?? 0), 1.1);
    let fait = 0;
    for (const t of titres) {
      await copierVersOpfs(t.plan.copies, dossiers, crees, options, Math.max(1, total), fait);
      await ecrireDescriptions(t.plan, prises, crees);
      fait += t.plan.octets;
    }
    let clePochette: string | undefined;
    if (pochette && pochette.size <= 20e6) {
      const tete = new Uint8Array(await pochette.slice(0, 3).arrayBuffer());
      if (tete[0] === 0xff && tete[1] === 0xd8 && tete[2] === 0xff) clePochette = (await stockerPochette(pochette)).cle;
    }
    // EN DERNIER : les morceaux (ids neufs), puis la sortie qui les cite.
    const ids = new Map<string, string>();
    for (const t of titres) {
      const id = await sauverMorceau(t.plan.morceau);
      sauves.push(id);
      ids.set(t.id, id);
    }
    const sortie = { ...lue.sortie, id: nouvelId(), titres: lue.sortie.titres.filter((x) => ids.has(x)).map((x) => ids.get(x)!) };
    if (clePochette) sortie.pochette = clePochette;
    else delete sortie.pochette;
    const sauvee = await sauverSortie(sortie);
    options.surProgression?.(1);
    return { type, id: sauvee.id };
  } catch (e) {
    for (const id of sauves) await supprimerMorceau(id).catch(() => {});
    for (const c of crees) await c.dossier.removeEntry(c.nom).catch(() => {});
    throw enErreurOcka(e, { message: 'Ce projet n’a pas pu être importé. Réessaie.', code: 'projet_illisible' });
  }
}

/** Description « .json » à côté de chaque prise (comme à l'enregistrement ; simple complément). */
async function ecrireDescriptions(plan: Plan, d: FileSystemDirectoryHandle, crees: Cree[]): Promise<void> {
  for (const c of plan.copies) {
    if (c.dossier !== 'prises') continue;
    crees.push({ dossier: d, nom: nomDescription(c.cle) });
    const description = { format: 'ocka.prise/1', encodage: 'f32le', canaux: 1, frequence: c.wav.frequence, echantillons: c.wav.trames };
    try {
      const flux = await (await d.getFileHandle(nomDescription(c.cle), { create: true })).createWritable();
      await flux.write(JSON.stringify(description));
      await flux.close();
    } catch {
      // complément seulement
    }
  }
}
