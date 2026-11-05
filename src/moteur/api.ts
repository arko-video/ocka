// CONTRAT entre l'interface (src/ui) et le moteur (src/morceau, src/moteur, src/enregistrement, src/stockage…).
// L'interface n'importe QUE depuis ce fichier et src/morceau. Erreurs pour l'utilisateur : ErreurOcka
// (message déjà en français, `code` stable). Les développeurs implémentent ces fonctions sans changer leurs signatures.
// Vague A : les nouvelles fonctions sont dans api-sorties.ts (A1), api-fichiers.ts (A2) et api-effets.ts (M2),
// ré-exportées ici. Leur type y est FIGÉ : une implémentation qui s'en écarte ne compile plus.
// Entre modules du moteur, importer directement le fichier du propriétaire (pas ce fichier) : moins de boucles.

import type { Morceau, Prise, SonMelodie, Style } from '../morceau/types';

export { ErreurOcka, bientot, type CodeErreur } from './erreur';
export * from './api-sorties';
export * from './api-fichiers';
export * from './api-effets';

/* ------------------------------------------------------------ morceau */

/** Nouveau morceau complet pour un style : tempo, tonalité, motifs, 3 sections (Intro, Couplet, Refrain), pistes. */
export { nouveauMorceau } from '../morceau/styles';
/** Les 3 suites d'accords proposées pour un style (pour le choix dans l'étape Beat). */
export { suitesAccords } from '../morceau/styles';
/** Durée du morceau en secondes (arrangement complet). */
export { dureeMorceau } from '../morceau/temps';

/* ------------------------------------------------------------ écoute */

export interface Lecteur {
  /** Charge (ou recharge après une modification) le morceau, sans couper la lecture si possible. */
  charger(morceau: Morceau): Promise<void>;
  lire(): void;
  pause(): void;
  /** Va à un temps en secondes. */
  aller(t: number): void;
  /** Boucle sur une section (id) ou sur tout le morceau (null). */
  boucler(section: string | null): void;
  /**
   * Joue un son de batterie seul (quand on touche une case de la grille). `instrument` : un InstrumentBatterie,
   * perso1 à perso4 compris (vague A, M1 : joue le son importé du pad ; rien si le pad est vide).
   */
  entendre(instrument: string): void;
  /**
   * VAGUE A (M1) — Joue une note de mélodie seule, tout de suite (pads de la gamme, clavier), sur la piste mélodie.
   * `midi` : 24 à 108. Ne lève pas si la note n'est pas encore prête (elle est sautée). Bouchon : ErreurOcka « pas_encore ».
   */
  entendreNote(son: SonMelodie, midi: number): void;
  /**
   * VAGUE A (M1) — Latence de sortie du contexte (s) : `outputLatency` (ou `baseLatency`). L'enregistrement au clavier
   * retire latenceSortie + ~25 ms (délai du toucher) avant de caler à la double-croche. Bouchon : 0.
   */
  readonly latenceSortie: number;
  /**
   * VAGUE A (M1, branché sur ChaineMaster.contourner de M2) — A/B du bouton Son : `sans` = true fait entendre le master
   * sans couleur ni colle, au même volume perçu grâce à `compensationDb` (le `ecartLu` de mesurerEcartAB ; 0 par défaut).
   * Sans effet hors lecture. Bouchon : ErreurOcka « pas_encore ».
   */
  comparer(sans: boolean, compensationDb?: number): void;
  metronome(actif: boolean): void;
  readonly temps: number;
  readonly duree: number;
  readonly enLecture: boolean;
  /** Pas courant (0 à 15) dans la mesure en cours, pour allumer la grille. */
  readonly pasCourant: number;
  surChangement(cb: () => void): () => void;
  detruire(): void;
  /**
   * AJOUT (dev enregistrement) — L'AudioContext du lecteur. L'enregistreur capture DANS ce contexte
   * (même horloge). Le lecteur le crée avec contexteAudio() (ci-dessous), comme le calibrage.
   */
  readonly ctx?: AudioContext;
  /**
   * AJOUT (dev enregistrement) — Heure du contexte (comme ctx.currentTime) à laquelle le temps `t` du morceau
   * part vers la sortie, pendant la lecture en cours (avant la latence de sortie). Ex. : `debut + (t − position)`.
   * Sans elle, l'enregistreur déduit l'heure de `temps`, ce qui n'est exact que si `temps` vient de ctx.currentTime.
   */
  heureDe?(t: number): number;
}
export { creerLecteur } from './lecteur';
/** AJOUT (dev enregistrement) — Le contexte audio commun (lecteur, capture, calibrage, écoute des prises). */
export { contexteAudio } from '../enregistrement/contexte';

/* ------------------------------------------------------------ export */

export interface ResultatExport {
  fichier: File;
  /** Sonie mesurée après réglage (LUFS intégré) et crête vraie (dBTP). */
  lufs: number;
  creteVraie: number;
  duree: number;
}
export interface OptionsExport {
  /** 24 bits (défaut, recommandé par Spotify pour un master calculé en flottant) ou 16 bits avec dither TPDF. */
  bits?: 24 | 16;
  surProgression?: (p: number) => void;
  signal?: AbortSignal;
}
/**
 * Exporte en WAV 44,1 kHz stéréo PCM (code de format 0x0001, jamais 0xFFFE), au niveau master.niveau :
 * sonie BS.1770 complète, puis limiteur à crête vraie. Gardée pour l'interface actuelle ; la vague A ajoute
 * exporterAudio (WAV 24/16, FLAC, M4A, écriture dans un ZIP) dans api-fichiers.ts.
 */
export { exporterWav } from './export';

/* ------------------------------------------------------------ enregistrement */

export interface Enregistreur {
  /** Démarre : décompte d'une mesure (le lecteur joue), puis capture depuis le début de la section (occurrence donnée). */
  demarrer(lecteur: Lecteur, morceau: Morceau, ancre: Prise['ancre']): Promise<void>;
  /** Arrête et renvoie la prise (fichier déjà écrit dans OPFS, décalage de latence appliqué). */
  arreter(): Promise<Prise>;
  /** Niveau du micro de 0 à 1 (pour le vumètre). */
  readonly niveau: number;
  readonly enCours: boolean;
  detruire(): void;
  /** AJOUT (dev enregistrement) — Réglages du micro que le téléphone n'a pas respectés (écho, bruit, volume auto), en français. */
  readonly avertissements?: string[];
}
/** Demande le micro (geste de l'utilisateur requis). Lève ErreurOcka "micro_refuse" | "micro_absent". */
export { creerEnregistreur } from '../enregistrement/enregistreur';
/**
 * Mesure la latence aller-retour : chirp joué et capturé dans le même AudioContext, intercorrélation,
 * 7 essais (écart > 3 ms → refait), médiane, mémorisée. Réglage manuel ±100 ms possible.
 * Lève ErreurOcka "bluetooth" (casque Bluetooth détecté : trop de retard), "signal_faible" (micro n'entend pas).
 */
export { calibrerLatence, latenceMemorisee, reglerLatence } from '../enregistrement/calibrage';
/** Lit une prise (PCM) pour l'écouter seule. */
export { ecouterPrise, supprimerPrise } from '../enregistrement/prises';
/**
 * AJOUTS (dev enregistrement) :
 * - ajustementLatence() : valeur actuelle du curseur manuel (s), pour l'afficher ;
 * - surChangementAppareil(cb) : casque branché/débranché → cb(aCalibrer) pour proposer un nouveau calibrage ;
 * - lirePrise(prise) : PCM mono d'une prise (pour l'écoute avec le beat et l'export, côté moteur) ;
 * - placerPrise(prise, debutAncre) : où jouer le fichier (convention : x ↦ debutAncre + (x − debutCoupe) − decalage),
 *   avec debutAncre = positionAncre(morceau, prise.ancre) de src/morceau/temps.ts.
 */
export { ajustementLatence } from '../enregistrement/latence';
/**
 * AJOUTS après la QA (dev enregistrement) :
 * - Bluetooth : calibrerLatence(surProgression, options?) NE BLOQUE PLUS par défaut (options.ignorerBluetooth = true).
 *   Elle renvoie la mesure ; le conseil arrive par options.surAvertissement(message, 'bluetooth') et par
 *   avertissementCalibrage() (null s'il n'y a rien à dire). ignorerBluetooth: false → ErreurOcka « bluetooth » comme avant.
 *   enregistreur.avertissements contient aussi ce conseil.
 * - supprimerPrise() n'efface plus rien tout de suite (Annuler doit pouvoir ramener la voix) : le fichier est effacé
 *   par le ramasse-miettes quand aucun morceau sauvé ne l'utilise (au démarrage, ou après 1 h). Idem pour supprimerMorceau.
 * - dupliquerMorceau : tout ou rien, ErreurOcka « duplication_impossible » si un fichier ne se copie pas.
 * - Enregistreur : arreter() et detruire() coupent le micro (voyant éteint) ; demarrer() le rouvre tout seul.
 */
export { avertissementCalibrage } from '../enregistrement/calibrage';
export type { OptionsCalibrage } from '../enregistrement/calibrage';
export { surChangementAppareil } from '../enregistrement/appareil';
export { lirePrise } from '../enregistrement/prises';
export { placerPrise } from '../enregistrement/alignement';

/* ------------------------------------------------------------ mes morceaux */

export interface ResumeMorceau {
  id: string;
  titre: string;
  style: Style;
  duree: number;
  modifieLe: number;
}
export { listerMorceaux, ouvrirMorceau, sauverMorceau, dupliquerMorceau, supprimerMorceau } from '../stockage/morceaux';
/** AJOUT (dev enregistrement) — Efface les fichiers de prises qu'aucun morceau n'utilise (appelé aussi par listerMorceaux). */
export { nettoyerPrisesOrphelines } from '../stockage/morceaux';

/* ------------------------------------------------------------ aller vite (B1, vague B) */

/**
 * Boucles OCKA (motifs de mélodie prêts, calés sur les accords), « Au hasard » (une idée complète par graine),
 * « Une autre idée » (variations gardées par une graine) et l'écoute des boucles avant de les poser. Pures,
 * sauf preparerEcoute (rendu hors ligne). Ce sont des règles, pas de l'IA générative.
 */
export { boucles, sonConseille, TYPES_BOUCLES, type Boucle, type TypeBoucle } from '../aller-vite/boucles';
export {
  autreIdeeBatterie,
  autreIdeeMelodie,
  boucleAuHasard,
  ideeAuHasard,
  nouvelleGraine,
  poserBatterie,
  poserMelodie,
  varierMelodie,
  type Idee,
} from '../aller-vite/hasard';
export { preparerEcoute, type Ecoute } from '../aller-vite/ecoute';

/* ------------------------------------------------------------ IA compositrice (B2, vague B) */

/**
 * Facultative, avec la clé de l'utilisateur (ocka-cles). Appels depuis la page, jamais sans geste. Réponse ≤ 1 Mo →
 * liste blanche → normaliseur. « Lance-moi un beat » (lireBeat) déclare musique « ia » ; « Continue mon idée »
 * (lireSuite) et « Aide aux paroles » (appliquerParoles) déclarent « aide ». Voir src/ia/index.ts.
 */
export {
  FOURNISSEURS,
  estFournisseur,
  testerCle,
  trouverFournisseur,
  type IdFournisseur,
  lireCle,
  lireFournisseur,
  masquer,
  oublierCle,
  sauverCle,
  sauverFournisseur,
  demander,
  gesteRecent,
  type Reglages as ReglagesIa,
  estimerCout,
  GENRES_SUITE,
  LANGUES_PAROLES,
  MAX_PHRASE,
  requeteBeat,
  requeteParoles,
  requeteSuite,
  texteEnvoye,
  type Cout,
  type GenreSuite,
  type LangueParoles,
  type Requete,
  lireBeat,
  lireParoles,
  lireSuite,
  type LigneProposee,
  type Proposition,
  appliquerParoles,
  marquerIa,
} from '../ia';

/* ------------------------------------------------------------ sons importés (M1) */

/**
 * Écart de hauteur (demi-tons) quand une boucle de `duree` s est calée sur `mesures` mesures au tempo :
 * positif = accélérée (plus aiguë). L'interface prévient au-delà d'un demi-ton. Pure.
 */
export { ecartCalage } from './instruments/importes';
/**
 * AJOUT (B4, vague B) — Autotune doux (src/autotune) : réglé par Piste.effets.autotune de la voix (0 à 1, au dixième).
 * L'écoute joue la prise corrigée quand elle est prête (surAutotune prévient), l'export l'attend toujours.
 */
export { forceAutotune, preparerAutotuneMorceau, resumeAutotune, surAutotune, type EtatAutotune } from '../autotune/autotune';
