// Préréglages de style : un nouveau morceau complet, prêt à enregistrer, et les suites d'accords proposées.
// Tout vient du registre des styles (styles/index.ts) : un style = un fichier styles/<id>.ts.

import { ecrireBoucle } from '../aller-vite/boucles';
import { motifsAvec } from './acces';
import { DEFINITIONS_STYLES, definitionStyle, type DefinitionStyle, type ReglagesStyle } from './styles/index';
import type { InstrumentDefaut } from './styles/definition';
import { FORMAT_MORCEAU, type Morceau, type MotifAccords, type MotifNotes, type Piste, type PisteInstrument, type Section, type Style } from './types';

export { varier } from './varier';

/** Tempo, plage, swing, tonalité, son d'accords, couleur et kit de chaque style (lus dans le registre). */
export const REGLAGES_STYLE: Readonly<Record<Style, ReglagesStyle>> = Object.fromEntries(
  Object.values(DEFINITIONS_STYLES).map((d) => [d.id, d.reglages]),
) as Record<Style, ReglagesStyle>;

/** Fabrique le motif d'accords d'une suite (1 accord par mesure). */
function motifAccords(degres: string[], son: MotifAccords['son']): MotifAccords {
  return { type: 'accords', pas: degres.length * 16, accords: degres.map((degre, i) => ({ pas: i * 16, duree: 16, degre })), son };
}

/** Les 3 suites d'accords proposées pour un style (pour le choix dans l'étape Beat). Style inconnu : la trap. */
export function suitesAccords(style: Style): { nom: string; motif: MotifAccords }[] {
  const d = definitionStyle(style);
  return d.suites.map((s) => ({ nom: s.nom, motif: motifAccords(s.degres, d.reglages.son) }));
}

/**
 * Pistes par défaut (format /3) : batterie, basse, accords, la piste instrument « melodie » (piano d'OCKA, celle des
 * 8 pads « Simple »), sons, voix — toutes au centre, voix au réglage « naturel ». Les panoramiques par défaut de la
 * chaîne 2 (charley, perc, mélodie, accords) sont appliqués dans le graphe, pas écrits ici.
 */
export function pistesParDefaut(): Piste[] {
  return [
    { id: 'batterie', volume: 0.85, pan: 0, muet: false, solo: false },
    { id: 'basse', volume: 0.8, pan: 0, muet: false, solo: false },
    { id: 'accords', volume: 0.4, pan: 0, muet: false, solo: false },
    { id: 'melodie', genre: 'instrument', nom: 'Mélodie', instrument: 'ocka-piano@1', volume: 0.8, pan: 0, muet: false, solo: false },
    { id: 'sons', volume: 0.8, pan: 0, muet: false, solo: false },
    { id: 'voix', volume: 0.9, pan: 0, muet: false, solo: false, preset: 'naturel' },
  ];
}

/** Les pistes d'un style : fixes, puis ses instruments par défaut (à la place de « melodie »), volumes et muettes. */
function pistesDuStyle(d: DefinitionStyle): Piste[] {
  const fixes = pistesParDefaut().filter((p) => p.genre !== 'instrument');
  const instruments: PisteInstrument[] = d.instrumentsParDefaut.map((i) => ({
    id: i.id,
    genre: 'instrument',
    nom: i.nom,
    instrument: i.instrument,
    volume: i.volume ?? 0.8,
    pan: i.pan ?? 0,
    muet: false,
    solo: false,
    // Effets de départ du style (copie neuve ; réglages en dictionnaire sans prototype, comme le normaliseur).
    ...(i.tranche?.inserts?.length
      ? { inserts: i.tranche.inserts.map((x) => ({ ...x, params: Object.assign(Object.create(null) as Record<string, number>, x.params) })) }
      : {}),
  }));
  const volumes = d.reglages.volumes ?? {};
  const muettes = d.reglages.muettes ?? [];
  return [...fixes.slice(0, 3), ...instruments, ...fixes.slice(3)].map((p) => {
    let q = p;
    if (volumes[p.id] !== undefined) q = { ...q, volume: volumes[p.id]! };
    if (muettes.includes(p.id)) q = { ...q, muet: true };
    return q;
  });
}

/** Les notes de départ d'un instrument du style, écrites sur la tonalité et les accords ACTUELS du morceau. */
function notesDeDepart(m: Morceau, notes: NonNullable<InstrumentDefaut['notes']>): MotifNotes {
  const depuis = notes.depuis ?? 'refrain';
  return typeof notes.ecrire === 'function' ? notes.ecrire(m, depuis) : ecrireBoucle(m, notes.ecrire, depuis);
}

/** Pose les notes de départ des pistes instrument (motif partagé par les sections choisies). */
function poserNotesDeDepart(m: Morceau, d: DefinitionStyle): Morceau {
  for (const i of d.instrumentsParDefaut) {
    if (!i.notes) continue;
    const { sections, idMotif } = i.notes;
    m.motifs[idMotif] = notesDeDepart(m, i.notes);
    m.sections = m.sections.map((x) => (sections.includes(x.id) ? { ...x, motifs: motifsAvec(x, i.id, idMotif) } : x));
  }
  return m;
}

/**
 * Nouveau morceau complet pour un style : Intro 4 / Couplet 8 / Refrain 8 / Couplet 8 / Refrain 8 / Outro 4,
 * avec 4 motifs de batterie (intro, couplet, refrain, pont), la 808, les accords, des fills et des coupures.
 */
export function nouveauMorceau(style: Style, titre = 'Mon morceau'): Morceau {
  const d = definitionStyle(style);
  const s = d.id;
  const r = d.reglages;
  const bat = d.batterie();
  const basse = d.basse();
  const sections: Section[] = [
    // Intro : accords et charley seuls ; un fill annonce le couplet.
    { id: 'intro', nom: 'Intro', mesures: 4, motifs: { batterie: 'bat-intro', accords: 'accords' }, fill: true, coupure: 'aucune', paroles: '' },
    // Couplet : la dernière mesure coupe la batterie (break) pour faire monter le refrain.
    { id: 'couplet', nom: 'Couplet', mesures: 8, motifs: { batterie: 'bat-couplet', basse: 'basse-couplet', accords: 'accords' }, fill: false, coupure: 'break', paroles: '' },
    // Refrain : plein ; un fill à la fin relance la suite.
    { id: 'refrain', nom: 'Refrain', mesures: 8, motifs: { batterie: 'bat-refrain', basse: 'basse-refrain', accords: 'accords' }, fill: true, coupure: 'aucune', paroles: '' },
    // Outro : le motif « pont », plus léger, sans 808.
    { id: 'outro', nom: 'Outro', mesures: 4, motifs: { batterie: 'bat-pont', accords: 'accords' }, fill: false, coupure: 'aucune', paroles: '' },
  ];
  const m: Morceau = {
    format: FORMAT_MORCEAU,
    titre,
    style: s,
    tempo: r.tempo,
    swing: r.swing,
    tonalite: { tonique: r.tonique, mode: r.mode },
    kit: r.kit,
    fondu: 3,
    motifs: {
      'bat-intro': bat.intro,
      'bat-couplet': bat.couplet,
      'bat-refrain': bat.refrain,
      'bat-pont': bat.pont,
      'basse-couplet': basse.couplet,
      'basse-refrain': basse.refrain,
      accords: suitesAccords(s)[0]!.motif,
    },
    sections,
    ordre: ['intro', 'couplet', 'refrain', 'couplet', 'refrain', 'outro'],
    pistes: pistesDuStyle(d),
    prises: [],
    // Nouveau morceau : chaîne 2 (avec la colle).
    master: { preset: r.preset, niveau: 'standard', chaine: 2 },
  };
  return poserNotesDeDepart(m, d);
}

/**
 * Réécrit les notes de départ des pistes instrument du style (mêmes motifs `idMotif`) avec la tonalité et les
 * accords ACTUELS du morceau : à appeler après avoir changé la tonalité ou la suite d'un morceau neuf
 * (« Au hasard »), sinon la guitare ou le piano jouent dans l'ancienne tonalité. Pure.
 */
export function reecrireNotesDeDepart(m: Morceau): Morceau {
  const motifs = Object.assign(Object.create(null) as Morceau['motifs'], m.motifs);
  for (const i of definitionStyle(m.style).instrumentsParDefaut) {
    if (i.notes && motifs[i.notes.idMotif]?.type === 'notes') motifs[i.notes.idMotif] = notesDeDepart(m, i.notes);
  }
  return { ...m, motifs };
}
