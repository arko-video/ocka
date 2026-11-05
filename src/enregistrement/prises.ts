// Les prises de voix sur le téléphone : lecture du PCM (pour l'écoute et l'export), écoute seule,
// suppression, copie (pour dupliquer un morceau) et nettoyage des fichiers que plus aucun morceau n'utilise.
import { ErreurOcka } from '../moteur/api';
import type { Prise } from '../morceau/types';
import { placerPrise } from './alignement';
import { contexteAudio, nouvelId } from './contexte';
import { copierFichier, lireFichier, listerFichiers, nomDescription, supprimerFichier } from './fichiers-opfs';

/** Lit le PCM d'une prise (mono, à sa fréquence d'enregistrement) pour l'écoute et l'export. */
export async function lirePrise(prise: Prise): Promise<{ frequence: number; pcm: Float32Array } | null> {
  const octets = await lireFichier(prise.fichier);
  if (!octets) return null;
  return { frequence: prise.frequence, pcm: new Float32Array(octets, 0, Math.floor(octets.byteLength / 4)) };
}

/** Joue une prise seule (partie gardée, recalée, avec son gain) ; renvoie une fonction pour l'arrêter. */
export async function ecouterPrise(prise: Prise): Promise<() => void> {
  const donnees = await lirePrise(prise);
  if (!donnees || donnees.pcm.length === 0) throw new ErreurOcka('Le fichier de cette prise est introuvable sur le téléphone.', 'prise_introuvable');
  const ctx = contexteAudio();
  await ctx.resume();
  const tampon = ctx.createBuffer(1, donnees.pcm.length, donnees.frequence);
  tampon.copyToChannel(donnees.pcm as Float32Array<ArrayBuffer>, 0);
  const volume = ctx.createGain();
  volume.gain.value = prise.gain;
  const source = ctx.createBufferSource();
  source.buffer = tampon;
  source.connect(volume).connect(ctx.destination);
  const { depuis, jusqua } = placerPrise(prise, 0);
  source.start(ctx.currentTime + 0.02, depuis, Math.max(0, jusqua - depuis));
  let arretee = false;
  return () => {
    if (arretee) return;
    arretee = true;
    try {
      source.stop();
    } catch {
      // déjà finie
    }
    source.disconnect();
    volume.disconnect();
  };
}

/**
 * Supprimer une prise n'efface RIEN tout de suite (QA n° 2) : le fichier reste, pour qu'« Annuler » puisse
 * ramener la prise avec sa voix. Le ramasse-miettes (nettoyerPrisesOrphelines, lancé par listerMorceaux)
 * l'effacera quand plus AUCUN morceau sauvé ne l'utilise : au prochain démarrage, ou après 1 h.
 * Gardée pour le contrat : l'interface peut l'appeler sans risque.
 */
export async function supprimerPrise(prise: Prise): Promise<void> {
  void prise;
}

/**
 * Copie le fichier d'une prise ; renvoie la prise avec son NOUVEAU fichier (mêmes réglages).
 * Si la copie échoue, lève une ErreurOcka : jamais de copie qui pointe sur le même fichier (QA n° 5).
 */
export async function copierPrise(prise: Prise): Promise<Prise> {
  const fichier = `prise-${nouvelId()}.f32`;
  let ok: boolean;
  try {
    ok = await copierFichier(prise.fichier, fichier);
  } catch {
    await supprimerFichier(fichier);
    throw new ErreurOcka('La copie des prises de voix a échoué (stockage du téléphone plein ?). Le morceau n’a pas été dupliqué.', 'duplication_impossible');
  }
  if (!ok) {
    throw new ErreurOcka('Le fichier d’une prise de voix est introuvable sur le téléphone : le morceau n’a pas été dupliqué.', 'duplication_impossible');
  }
  // La description (.json) n'est qu'un complément : son échec ne bloque pas.
  await copierFichier(nomDescription(prise.fichier), nomDescription(fichier)).catch(() => false);
  return { ...prise, ancre: { ...prise.ancre }, fichier };
}

/** Une heure : un fichier plus récent peut appartenir à une prise pas encore sauvée, ou qu'« Annuler » peut ramener. */
export const AGE_MIN_NETTOYAGE = 60 * 60 * 1000;
/** Début de cette séance (chargement de la page) : les fichiers plus anciens ne peuvent plus revenir par « Annuler ». */
export const DEBUT_SEANCE = Date.now();

/**
 * Choisit (pur) les fichiers à effacer : à nous (`aNous`), utilisés par aucun morceau sauvé, et soit d'avant cette
 * séance (nettoyage au démarrage ; `debutSeance` = −Infinity si un autre onglet est ouvert), soit vieux d'au moins
 * `ageMin` (1 h). Un fichier de l'autotune (« auto-….f32 » et sa description « auto-….json ») n'est gardé que s'il
 * est lui-même dans `utilises` (src/autotune : fichiersAutotune) : une ancienne force ou tonalité part.
 */
export function choisirOrphelins(
  fichiers: { nom: string; modifie: number }[],
  utilises: Set<string>,
  maintenant: number,
  ageMin = AGE_MIN_NETTOYAGE,
  debutSeance = DEBUT_SEANCE,
  aNous: RegExp = /^(prise-[\w-]+\.(f32|json)|auto-[\w.~-]+)$/,
): string[] {
  const gardes = new Set<string>();
  for (const f of utilises) {
    gardes.add(f);
    gardes.add(nomDescription(f));
  }
  // Seulement nos fichiers (pas les fichiers temporaires de Chrome, « .crswap », pendant une écriture).
  const garde = (nom: string) => gardes.has(nom);
  const assezVieux = (modifie: number) => modifie < debutSeance || maintenant - modifie >= ageMin;
  return fichiers.filter((f) => aNous.test(f.nom) && !f.nom.endsWith('.crswap') && !garde(f.nom) && assezVieux(f.modifie)).map((f) => f.nom);
}

/** Efface les fichiers de prises non utilisés ; renvoie leur nombre. `debutSeance` : voir choisirOrphelins. */
export async function nettoyerFichiersPrises(utilises: Set<string>, ageMin = AGE_MIN_NETTOYAGE, debutSeance = DEBUT_SEANCE): Promise<number> {
  const orphelins = choisirOrphelins(await listerFichiers(), utilises, Date.now(), ageMin, debutSeance);
  for (const nom of orphelins) await supprimerFichier(nom);
  return orphelins.length;
}
