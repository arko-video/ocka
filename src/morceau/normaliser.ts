// Le normaliseur : prend un morceau écrit par l'interface, un fichier importé ou une IA (même mal écrit)
// et renvoie un morceau propre en version 3, avec la liste des problèmes trouvés (messages en français).
// Il lit les versions 1 à 3 (les versions 1 et 2 passent d'abord par migration-v3.ts, sans changer le son).
// Il CORRIGE au lieu de rejeter ; seuls deux cas sont bloquants : aucune section, ou un format plus récent.
// Idempotent : normaliser deux fois donne le même morceau, et la 2e fois aucun problème (hors conseils).

import { aMelodieV2, migrerVersV3 } from './migration-v3';
import { normaliserInfos, normaliserPads, normaliserSons } from './normaliser-ajouts';
import { normaliserMotifs } from './normaliser-motifs';
import { apercu, estObjet, Journal, lireChoix, lireNombre, lireTexte, verifierCles, type Objet } from './normaliser-outils';
import { finirPistes, normaliserPistes } from './normaliser-pistes';
import { normaliserMaster, normaliserOrdre, normaliserPrises, normaliserSections } from './normaliser-sections';
import { normaliserMarqueurs, normaliserSoundfonts, normaliserTranchesPads } from './normaliser-v3';
import { lireTonique } from './theorie';
import { FORMAT_MORCEAU, STYLES, VERSION_MORCEAU, type Morceau, type Probleme, type Tonique } from './types';

export interface ResultatNormalisation {
  morceau: Morceau;
  problemes: Probleme[];
  /** true si au moins un problème est bloquant (le morceau ne peut pas être joué tel quel). */
  bloquant: boolean;
}

/** Clés connues. « album » (version 1) est abandonné : lu sans message, jamais réécrit. */
const CLES = [
  'format', 'titre', 'artiste', 'style', 'tempo', 'swing', 'tonalite', 'kit', 'fondu',
  'motifs', 'sections', 'ordre', 'pistes', 'prises', 'master', 'album', 'sons', 'pads', 'infos',
  'tranchesPads', 'marqueurs', 'soundfonts',
] as const;
const REGLE_KIT = new RegExp(`^(${STYLES.join('|')})@\\d{1,3}$`);

/** Lit l'entrée : un objet, ou du texte JSON (même entouré de ```json). */
export function lireEntree(brut: unknown, journal: Journal, quoi: string): Objet {
  let v = brut;
  if (typeof v === 'string') {
    const t = v.trim().replace(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/, '$1');
    try {
      v = JSON.parse(t);
    } catch {
      journal.bloquant('', "Le texte n'est pas du JSON lisible.");
      return {};
    }
  }
  if (!estObjet(v)) {
    journal.bloquant('', `${quoi} doit être un objet JSON.`);
    return {};
  }
  return v;
}

/**
 * Lit la version du champ `format` (« ocka.morceau/2 » → 2). Un format absent ou inconnu est supposé
 * être la version courante ; une version plus récente est BLOQUANTE (on ne perd jamais des champs inconnus).
 */
export function lireVersion(format: unknown, prefixe: string, courante: number, journal: Journal): number {
  const attendu = `${prefixe}/${courante}`;
  if (format === undefined) {
    journal.conseil('format', `Le champ « format » manquait : je suppose « ${attendu} ».`);
    return courante;
  }
  const m = typeof format === 'string' ? new RegExp(`^${prefixe.replace('.', '\\.')}/(\\d{1,4})$`).exec(format) : null;
  if (!m) {
    journal.corrige('format', `Le format « ${apercu(format)} » est inconnu : je suppose « ${attendu} ».`);
    return courante;
  }
  const version = Number(m[1]);
  if (version > courante) {
    journal.bloquant('format', `Ce fichier utilise la version ${version} du format, plus récente que cette version d'OCKA. Mets OCKA à jour.`);
  }
  return Math.max(1, Math.min(version, courante));
}

/** Normalise un morceau. `brut` peut être un objet ou du texte JSON. */
export function normaliserMorceau(brut: unknown): ResultatNormalisation {
  const journal = new Journal();
  const lu = lireEntree(brut, journal, 'Le morceau');
  const version = lireVersion(lu.format, 'ocka.morceau', VERSION_MORCEAU, journal);
  verifierCles(lu, CLES, '', journal);
  // Un morceau des phases 0 et 1 garde la chaîne 1 : son son ne change pas.
  const chaineDefaut: 1 | 2 = version < 2 ? 1 : 2;
  const masterBrut = estObjet(lu.master) ? lu.master : {};
  const chaine: 1 | 2 = masterBrut.chaine === 1 || masterBrut.chaine === 2 ? masterBrut.chaine : chaineDefaut;
  // Sans « format » (fichier écrit à la main ou par une IA) mais avec une mélodie /2 et sans piste instrument : migré aussi.
  const sansInstrument = !Array.isArray(lu.pistes) || !lu.pistes.some((p) => estObjet(p) && p.genre === 'instrument');
  const obj = version < 3 || (lu.format === undefined && aMelodieV2(lu) && sansInstrument) ? migrerVersV3(lu, chaine) : lu;

  const style = lireChoix(obj.style, STYLES, 'trap', 'style', journal, 'le style');
  const ton = estObjet(obj.tonalite) ? obj.tonalite : {};
  let tonique: Tonique = 'C';
  if (ton.tonique !== undefined) {
    const lue = typeof ton.tonique === 'string' ? lireTonique(ton.tonique) : null;
    if (lue) {
      if (lue !== ton.tonique) journal.corrige('tonalite.tonique', `La tonique « ${apercu(ton.tonique)} » est écrite « ${lue} ».`);
      tonique = lue;
    } else journal.corrige('tonalite.tonique', `La tonique « ${apercu(ton.tonique)} » est illisible : remplacée par C.`);
  } else journal.corrige('tonalite', 'La tonalité manquait : do mineur.');
  const mode = lireChoix(ton.mode, ['majeur', 'mineur'] as const, 'mineur', 'tonalite.mode', journal, 'le mode');

  // Ordre important : les sections pointent vers les motifs et les sons ; l'ordre et les prises vers les sections.
  const { motifs, ids: idsMotifs } = normaliserMotifs(obj.motifs, journal, mode === 'mineur');
  const { sons, ids: idsSons } = normaliserSons(obj.sons, journal);
  // C3 : les SoundFonts du morceau d'abord (leurs presets « sf2-<id>-… » sont alors connus, sans conseil).
  const soundfonts = obj.soundfonts !== undefined && obj.soundfonts !== null ? normaliserSoundfonts(obj.soundfonts, journal) : [];
  const pistes = normaliserPistes(obj.pistes, journal, new Set(soundfonts.map((s) => s.id)));
  const { sections, ids: idsSections } = normaliserSections(obj.sections, motifs, idsMotifs, idsSons, pistes.pistes, pistes.ids, journal);
  finirPistes(pistes, sections, idsSections, journal);
  if (sections.length === 0) journal.bloquant('sections', "Le morceau n'a aucune section : ajoute au moins une section (ex. Couplet).");

  let kit = typeof obj.kit === 'string' ? obj.kit : '';
  if (!REGLE_KIT.test(kit)) {
    if (obj.kit !== undefined) journal.corrige('kit', `Le kit « ${apercu(obj.kit)} » est inconnu : remplacé par « ${style}@1 ».`);
    kit = `${style}@1`;
  }

  const morceau: Morceau = {
    format: FORMAT_MORCEAU,
    titre: lireTexte(obj.titre, 'Mon morceau', 'titre', journal, 100).trim() || 'Mon morceau',
    style,
    tempo: lireNombre(obj.tempo, 'tempo', journal, { defaut: 120, min: 60, max: 200, nom: 'le tempo' }),
    swing: lireNombre(obj.swing, 'swing', journal, { defaut: 0, min: 0, max: 0.6, nom: 'le swing' }),
    tonalite: { tonique, mode },
    kit,
    fondu: lireNombre(obj.fondu, 'fondu', journal, { defaut: 0, min: 0, max: 8, nom: 'le fondu de fin' }),
    motifs,
    sections,
    ordre: normaliserOrdre(obj.ordre, sections, idsSections, journal),
    pistes: pistes.pistes,
    prises: normaliserPrises(obj.prises, sections, idsSections, journal),
    master: normaliserMaster(obj.master, chaineDefaut, journal),
  };
  if (obj.artiste !== undefined) morceau.artiste = lireTexte(obj.artiste, '', 'artiste', journal, 100);
  if (sons !== undefined) morceau.sons = sons;
  const pads = normaliserPads(obj.pads, idsSons, journal);
  if (pads !== undefined) morceau.pads = pads;
  if (obj.tranchesPads !== undefined && obj.tranchesPads !== null) {
    const t = normaliserTranchesPads(obj.tranchesPads, pads, sons, journal);
    if (t && Object.keys(t).length > 0) morceau.tranchesPads = t;
  }
  const infos = normaliserInfos(obj.infos, journal);
  if (infos !== undefined) morceau.infos = infos;
  if (obj.marqueurs !== undefined && obj.marqueurs !== null) {
    const mq = normaliserMarqueurs(obj.marqueurs, sections, idsSections, journal);
    if (mq.length > 0) morceau.marqueurs = mq;
  }
  if (soundfonts.length > 0) morceau.soundfonts = soundfonts;
  return { morceau, problemes: journal.problemes, bloquant: journal.problemes.some((p) => p.niveau === 'bloquant') };
}
