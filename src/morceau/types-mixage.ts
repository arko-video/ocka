// Format /3 — la TRANCHE d'une piste (mélangeur) : inserts, sidechain, automation, LFO. Ré-exporté par types.ts.
// Gelé au contrat C0 (décisions v2 §1 et §3). Les réglages des effets sont des nombres bornés : leurs bornes
// sont ICI (PARAMS_EFFETS), lues par le normaliseur, l'interface (curseurs) et le moteur (M2).

/** Effets d'insert d'une piste (6 au plus, dans l'ordre de la chaîne). Pas de réverbe par piste : 2 envois partagés. */
export const TYPES_EFFETS = [
  'eq',
  'filtre',
  'compresseur',
  'saturation',
  'bitcrusher',
  'chorus',
  'flanger',
  'phaser',
  /** Envoi vers la réverbe partagée, pris à cet endroit de la chaîne. */
  'envoi-reverbe',
  /** Envoi vers l'écho partagé (croche pointée au tempo), pris à cet endroit de la chaîne. */
  'envoi-echo',
] as const;
export type TypeEffet = (typeof TYPES_EFFETS)[number];

export interface ReglageParam {
  min: number;
  max: number;
  defaut: number;
  unite: 'dB' | 'Hz' | 's' | 'ms' | 'x' | '';
  /** Valeur entière (bits, étages, mode du filtre). */
  entier?: boolean;
  /** Curseur et automation en échelle logarithmique (fréquences). */
  log?: boolean;
}

const p = (min: number, max: number, defaut: number, unite: ReglageParam['unite'], plus: Partial<ReglageParam> = {}): ReglageParam => ({ min, max, defaut, unite, ...plus });
const MIX = (defaut: number) => p(0, 1, defaut, '');

/**
 * Réglages de chaque effet. `params` d'un Insert ne contient QUE ces clés (les absentes prennent `defaut`).
 * filtre.mode : 0 = passe-bas, 1 = passe-haut, 2 = passe-bande. Le gain de rattrapage du compresseur est
 * compensé automatiquement (pas de réglage). La saturation est suréchantillonnée 4x (M2).
 */
export const PARAMS_EFFETS: Record<TypeEffet, Record<string, ReglageParam>> = {
  eq: {
    grave: p(-15, 15, 0, 'dB'),
    freqGrave: p(40, 500, 120, 'Hz', { log: true }),
    medium: p(-15, 15, 0, 'dB'),
    freqMedium: p(200, 8000, 1000, 'Hz', { log: true }),
    qMedium: p(0.3, 8, 1, ''),
    aigu: p(-15, 15, 0, 'dB'),
    freqAigu: p(2000, 16000, 8000, 'Hz', { log: true }),
    passeHaut: p(20, 1000, 20, 'Hz', { log: true }),
    passeBas: p(1000, 20000, 20000, 'Hz', { log: true }),
  },
  filtre: {
    mode: p(0, 2, 0, '', { entier: true }),
    frequence: p(20, 20000, 2000, 'Hz', { log: true }),
    resonance: p(0.1, 20, 0.707, ''),
  },
  compresseur: {
    seuil: p(-60, 0, -18, 'dB'),
    ratio: p(1, 20, 4, 'x'),
    attaque: p(0.1, 100, 10, 'ms'),
    relache: p(10, 1000, 150, 'ms'),
    genou: p(0, 24, 6, 'dB'),
    mix: MIX(1),
  },
  saturation: { force: p(0, 1, 0.3, ''), ton: p(0, 1, 0.5, ''), mix: MIX(1) },
  bitcrusher: { bits: p(2, 16, 8, '', { entier: true }), reduction: p(1, 32, 4, 'x', { entier: true }), mix: MIX(1) },
  chorus: { vitesse: p(0.05, 5, 0.8, 'Hz'), profondeur: p(0, 1, 0.4, ''), mix: MIX(0.5) },
  flanger: { vitesse: p(0.05, 5, 0.3, 'Hz'), profondeur: p(0, 1, 0.5, ''), retour: p(-0.95, 0.95, 0.5, ''), mix: MIX(0.5) },
  phaser: { vitesse: p(0.05, 5, 0.5, 'Hz'), profondeur: p(0, 1, 0.6, ''), etages: p(2, 12, 4, '', { entier: true }), retour: p(-0.95, 0.95, 0.3, ''), mix: MIX(0.5) },
  'envoi-reverbe': { niveau: p(0, 1, 0.25, '') },
  'envoi-echo': { niveau: p(0, 1, 0.25, '') },
};

/** Un effet de la chaîne d'une piste. */
export interface Insert {
  /** Unique dans la piste (REGLE_ID) : visé par l'automation et les LFO. */
  id: string;
  type: TypeEffet;
  /** false = contourné (gardé dans la chaîne, sans effet). */
  actif: boolean;
  /** Clés de PARAMS_EFFETS[type] seulement, dans leurs bornes. Dictionnaire sans prototype. */
  params: Record<string, number>;
}

/**
 * Ce que vise une courbe d'automation ou un LFO. Valeurs NORMALISÉES de 0 à 1 :
 * - volume : gain d'automation 0 à 1 (1 = le fader seul ; fader, sidechain et automation sont des gains séparés) ;
 * - pan : 0 = gauche, 0,5 = centre, 1 = droite (ajouté au panoramique de la tranche, borné) ;
 * - hauteur (piste instrument seulement) : 0 = −12, 0,5 = 0, 1 = +12 demi-tons (`detune`) ;
 * - insert : de `min` à `max` du réglage (en log si `log`).
 */
export type Cible =
  | { type: 'volume' }
  | { type: 'pan' }
  | { type: 'hauteur' }
  | { type: 'insert'; insert: string; param: string };

export interface PointCourbe {
  /** Pas dans la section (0 à sa longueur), arrondi au 1/24 de pas. */
  pas: number;
  /** 0 à 1 (voir Cible). */
  valeur: number;
  /** Vers le point suivant : « ligne » (défaut) ou « palier » (garde la valeur jusqu'au point suivant). */
  forme?: 'ligne' | 'palier';
}

/** Une courbe d'automation : des points PAR SECTION (ils suivent la section quand elle revient). */
export interface Courbe {
  cible: Cible;
  /** id de section → points triés par pas (64 au plus). Section absente = pas d'automation (valeur neutre). */
  sections: Record<string, PointCourbe[]>;
}

export const FORMES_LFO = ['sinus', 'triangle', 'carre', 'scie', 'hasard'] as const;
export type FormeLfo = (typeof FORMES_LFO)[number];

/** Modulation automatique. La phase est calée sur le TEMPS DU MORCEAU (écoute après un saut = export). */
export interface Lfo {
  cible: Cible;
  forme: FormeLfo;
  /** Période en pas (0,25 à 256) : 16 = une mesure. */
  periode: number;
  /** 0 à 1 (part de la plage normalisée de la cible, autour de sa valeur). */
  profondeur: number;
  /** Phase de départ, 0 à 1 (au pas 0 du morceau). */
  phase: number;
}

/** Sidechain (« pompe ») : une automation de gain calculée d'après le planning du kick. Aucun CPU en plus. */
export interface Sidechain {
  source: 'kick';
  /** 0 à 1 : 1 = le gain tombe à 0 sur chaque kick. */
  force: number;
  /** Retour au gain plein (s), 0,02 à 0,6. */
  relache: number;
}

/** Réglages communs à TOUTES les pistes (fixes et instrument). */
export interface Tranche {
  /** Volume linéaire 0 à 1,5 (défaut 0,8). */
  volume: number;
  /** Panoramique −1 (gauche) à 1 (droite). */
  pan: number;
  muet: boolean;
  solo: boolean;
  /** 6 au plus. Absent = aucun. */
  inserts?: Insert[];
  sidechain?: Sidechain;
  /** 8 courbes au plus. */
  auto?: Courbe[];
  /** 2 au plus. */
  lfo?: Lfo[];
}
