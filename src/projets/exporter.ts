// « Exporter le projet » : .ocka (un morceau) et .ocka-sortie (une sortie), en flux dans OPFS. Propriétaire : A2.
// Format : voir commun.ts. Les prises et les sons sont recopiés en WAV 32 bits flottants (lisibles par n'importe
// quel logiciel de musique), par morceaux de 1 Mio : jamais tout un fichier en mémoire.

import { nouvelId } from '../enregistrement/contexte';
import { fichierPrise } from '../enregistrement/fichiers-opfs';
import type { OptionsLongues } from '../moteur/api-fichiers';
import { ErreurOcka } from '../moteur/erreur';
import { enTeteWavFlottant, TAILLE_ENTETE_FLOTTANT } from '../moteur/wav';
import type { Morceau, SonImporte } from '../morceau/types';
import { lirePochette } from '../sortie/pochette';
import { fichierSon } from '../sons/import';
import { dossierOpfs, enErreurOcka, verifierPlace, type NomDossier } from '../stockage/dossiers';
import { ouvrirMorceau } from '../stockage/morceaux';
import { ouvrirSortie } from '../stockage/sorties';
import { creerZip } from '../zip/ecrire';
import type { EcrivainFlux } from '../zip/types';
import { json, nomProjet, nomZipMorceau, nomZipPrise, nomZipSon, verifierAnnulation, VERSION_PROJET } from './commun';

const MORCEAU_LU = 1 << 20; // 1 Mio

interface Contenu {
  prises: { cle: string; f: File; frequence: number }[];
  sons: { son: SonImporte; f: File }[];
  octets: number;
}

/** Les fichiers d'un morceau qui existent encore (une prise sans fichier est simplement laissée de côté). */
async function contenu(m: Morceau): Promise<Contenu> {
  const c: Contenu = { prises: [], sons: [], octets: 4096 };
  const vues = new Set<string>();
  for (const p of m.prises) {
    if (vues.has(p.fichier)) continue;
    vues.add(p.fichier);
    const f = await fichierPrise(p.fichier);
    if (f) c.prises.push({ cle: p.fichier, f, frequence: p.frequence });
  }
  for (const son of m.sons ?? []) {
    const f = await fichierSon(son.fichier);
    if (f) c.sons.push({ son, f });
  }
  for (const x of [...c.prises, ...c.sons]) c.octets += x.f.size + TAILLE_ENTETE_FLOTTANT + 200;
  return c;
}

/** Recopie `b` dans `e` par morceaux (progression en octets, annulation). Stéréo planaire → entrelacé. */
async function verser(e: EcrivainFlux, f: File, canaux: number, options: OptionsLongues, avancer: (n: number) => void): Promise<void> {
  const trames = Math.floor(f.size / 4 / canaux);
  if (canaux === 1) {
    for (let p = 0; p < trames * 4; p += MORCEAU_LU) {
      verifierAnnulation(options.signal);
      const o = new Uint8Array(await f.slice(p, Math.min(trames * 4, p + MORCEAU_LU)).arrayBuffer());
      await e.ecrire(o);
      avancer(o.length);
    }
    return;
  }
  const pas = MORCEAU_LU / 8;
  for (let t = 0; t < trames; t += pas) {
    verifierAnnulation(options.signal);
    const n = Math.min(pas, trames - t);
    const g = new Float32Array(await f.slice(t * 4, (t + n) * 4).arrayBuffer());
    const d = new Float32Array(await f.slice((trames + t) * 4, (trames + t + n) * 4).arrayBuffer());
    const x = new Float32Array(2 * n);
    for (let i = 0; i < n; i++) {
      x[2 * i] = g[i]!;
      x[2 * i + 1] = d[i]!;
    }
    await e.ecrire(new Uint8Array(x.buffer));
    avancer(8 * n);
  }
}

/** Écrit le projet d'un morceau dans `dossier`/`nom` ; renvoie le fichier. Progression de p0 à p1. */
async function ecrireProjet(m: Morceau, dossier: NomDossier, nom: string, c: Contenu, options: OptionsLongues, p0: number, p1: number): Promise<File> {
  const zip = await creerZip(dossier, nom);
  let fait = 0;
  const avancer = (n: number) => {
    fait += n;
    options.surProgression?.(p0 + ((p1 - p0) * Math.min(fait, c.octets)) / c.octets);
  };
  try {
    await zip.ajouter('ocka.json', json({ type: 'morceau', version: VERSION_PROJET }));
    await zip.ajouter('morceau.json', json(m));
    for (const p of c.prises) {
      const e = await zip.entree(nomZipPrise(p.cle));
      await e.ecrire(enTeteWavFlottant(Math.floor(p.f.size / 4), 1, p.frequence));
      await verser(e, p.f, 1, options, avancer);
      await e.fermer();
    }
    for (const { son, f } of c.sons) {
      const e = await zip.entree(nomZipSon(son.fichier));
      await e.ecrire(enTeteWavFlottant(Math.floor(f.size / 4 / son.canaux), son.canaux, son.frequence));
      await verser(e, f, son.canaux, options, avancer);
      await e.fermer();
    }
    return await zip.terminer();
  } catch (e) {
    await zip.annuler();
    throw enErreurOcka(e, { message: 'L’export du projet a échoué. Réessaie.', code: 'stockage' });
  }
}

/** Voir api-fichiers.ts. « Titre.ocka » dans ocka-exports. */
export async function exporterProjet(idMorceau: string, options: OptionsLongues = {}): Promise<File> {
  const m = await ouvrirMorceau(idMorceau);
  if (!m) throw new ErreurOcka("Ce morceau n'existe plus.", 'morceau_introuvable');
  options.surProgression?.(0);
  const c = await contenu(m);
  await verifierPlace(c.octets, 2.2); // le téléchargement recopie le fichier
  const f = await ecrireProjet(m, 'exports', nomProjet(m.titre, 'ocka'), c, options, 0, 1);
  options.surProgression?.(1);
  return f;
}

/** Voir api-fichiers.ts. « Titre.ocka-sortie » dans ocka-exports (chaque titre : un .ocka imbriqué). */
export async function exporterSortieProjet(idSortie: string, options: OptionsLongues = {}): Promise<File> {
  const sortie = await ouvrirSortie(idSortie);
  if (!sortie) throw new ErreurOcka("Cette sortie n'existe plus.", 'sortie_introuvable');
  options.surProgression?.(0);
  const titres: { id: string; m: Morceau; c: Contenu }[] = [];
  for (const id of sortie.titres) {
    const m = await ouvrirMorceau(id);
    if (m) titres.push({ id, m, c: await contenu(m) });
  }
  const total = titres.reduce((s, t) => s + t.c.octets, 0);
  await verifierPlace(total, 3.3); // projet de travail + sortie + copie du téléchargement

  const zip = await creerZip('exports', nomProjet(sortie.titre, 'ocka-sortie'));
  const tmp = await dossierOpfs('tmp');
  try {
    await zip.ajouter('ocka.json', json({ type: 'sortie', version: VERSION_PROJET }));
    await zip.ajouter('sortie.json', json(sortie));
    const pochette = sortie.pochette ? await lirePochette(sortie.pochette) : null;
    if (pochette) await zip.ajouter('pochette.jpg', pochette);
    let fait = 0;
    for (const t of titres) {
      verifierAnnulation(options.signal);
      const nomTmp = `projet-${nouvelId()}.ocka`;
      const p0 = fait / Math.max(1, total);
      fait += t.c.octets;
      try {
        const f = await ecrireProjet(t.m, 'tmp', nomTmp, t.c, options, p0, (p0 + fait / Math.max(1, total)) / 2);
        await zip.ajouter(nomZipMorceau(t.id), f);
      } finally {
        await tmp.removeEntry(nomTmp).catch(() => {});
      }
      options.surProgression?.(fait / Math.max(1, total));
    }
    const f = await zip.terminer();
    options.surProgression?.(1);
    return f;
  } catch (e) {
    await zip.annuler();
    throw enErreurOcka(e, { message: 'L’export de la sortie a échoué. Réessaie.', code: 'stockage' });
  }
}
