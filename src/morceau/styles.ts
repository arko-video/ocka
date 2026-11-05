// Préréglages de style : un nouveau morceau complet, prêt à enregistrer, et les suites d'accords proposées.

import { ecrireBoucle } from '../aller-vite/boucles';
import { BASSES, BATTERIES, SUITES } from './styles-motifs';
import { FORMAT_MORCEAU, type Master, type Mode, type Morceau, type MotifAccords, type Piste, type Section, type Style, type Tonique } from './types';

export { varier } from './varier';

interface Reglages {
  tempo: number;
  /** Plage de tempo du style (« Au hasard » tire dedans). */
  plage: [number, number];
  swing: number;
  tonique: Tonique;
  mode: Mode;
  son: NonNullable<MotifAccords['son']>;
  /** Couleur du master au départ. */
  preset: Master['preset'];
}

/** Tempo, swing, tonalité, son d'accords et couleur de chaque style. */
export const REGLAGES_STYLE: Record<Style, Reglages> = {
  trap: { tempo: 140, plage: [130, 150], swing: 0, tonique: 'F', mode: 'mineur', son: 'nappe', preset: 'neutre' },
  drill: { tempo: 142, plage: [138, 146], swing: 0, tonique: 'C#', mode: 'mineur', son: 'nappe', preset: 'neutre' },
  lofi: { tempo: 85, plage: [72, 92], swing: 0.25, tonique: 'F', mode: 'majeur', son: 'piano', preset: 'lofi' },
  phonk: { tempo: 135, plage: [125, 145], swing: 0, tonique: 'F#', mode: 'mineur', son: 'nappe', preset: 'neutre' },
  pop: { tempo: 110, plage: [98, 122], swing: 0, tonique: 'C', mode: 'majeur', son: 'piano', preset: 'clair' },
  boombap: { tempo: 90, plage: [84, 96], swing: 0.2, tonique: 'D', mode: 'mineur', son: 'piano', preset: 'chaud' },
};

/** Volumes de départ propres à un style (les autres pistes gardent ceux de pistesParDefaut). */
const VOLUMES_STYLE: Partial<Record<Style, Partial<Record<Piste['id'], number>>>> = {
  // Phonk : 808 très saturée et kick saturé, plus denses : un peu plus bas pour garder le niveau de la trap.
  phonk: { batterie: 0.75, basse: 0.68 },
};

/** Fabrique le motif d'accords d'une suite (1 accord par mesure). */
function motifAccords(degres: string[], son: MotifAccords['son']): MotifAccords {
  return { type: 'accords', pas: degres.length * 16, accords: degres.map((degre, i) => ({ pas: i * 16, duree: 16, degre })), son };
}

/** Les 3 suites d'accords proposées pour un style (pour le choix dans l'étape Beat). */
export function suitesAccords(style: Style): { nom: string; motif: MotifAccords }[] {
  const connu = Object.hasOwn(REGLAGES_STYLE, style);
  const r = connu ? REGLAGES_STYLE[style] : REGLAGES_STYLE.trap;
  return (connu ? SUITES[style] : SUITES.trap).map((s) => ({ nom: s.nom, motif: motifAccords(s.degres, r.son) }));
}

/**
 * Pistes par défaut, dans l'ordre de IDS_PISTES (toutes au centre, voix au réglage « naturel »).
 * `melodie` et `sons` (version 2) : volume 0,8, panoramique 0. Les panoramiques par défaut de la chaîne 2
 * (charley, perc, mélodie, accords) sont appliqués dans le graphe, pas écrits ici.
 */
export function pistesParDefaut(): Piste[] {
  return [
    { id: 'batterie', volume: 0.85, pan: 0, muet: false, solo: false },
    { id: 'basse', volume: 0.8, pan: 0, muet: false, solo: false },
    { id: 'accords', volume: 0.4, pan: 0, muet: false, solo: false },
    { id: 'melodie', volume: 0.8, pan: 0, muet: false, solo: false },
    { id: 'sons', volume: 0.8, pan: 0, muet: false, solo: false },
    { id: 'voix', volume: 0.9, pan: 0, muet: false, solo: false, preset: 'naturel' },
  ];
}

/**
 * Nouveau morceau complet pour un style : Intro 4 / Couplet 8 / Refrain 8 / Couplet 8 / Refrain 8 / Outro 4,
 * avec 4 motifs de batterie (intro, couplet, refrain, pont), la 808, les accords, des fills et des coupures.
 */
export function nouveauMorceau(style: Style, titre = 'Mon morceau'): Morceau {
  const s: Style = Object.hasOwn(REGLAGES_STYLE, style) ? style : 'trap';
  const r = REGLAGES_STYLE[s];
  const bat = BATTERIES[s]();
  const basse = BASSES[s]();
  const volumes = VOLUMES_STYLE[s] ?? {};
  const pistes = pistesParDefaut().map((p) => (volumes[p.id] !== undefined ? { ...p, volume: volumes[p.id]! } : p));
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
    kit: `${s}@1`,
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
    pistes,
    prises: [],
    // Nouveau morceau : chaîne 2 (avec la colle).
    master: { preset: r.preset, niveau: 'standard', chaine: 2 },
  };
  // Phonk : la cloche mélodique (accordée sur la tonalité) joue dans l'intro et le refrain.
  if (s === 'phonk') {
    m.motifs['mel-cloche'] = ecrireBoucle(m, 'cloche', 'cloche', 'refrain');
    for (const x of m.sections) if (x.id === 'intro' || x.id === 'refrain') x.motifs.melodie = 'mel-cloche';
  }
  return m;
}
