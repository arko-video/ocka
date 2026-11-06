// Préréglages des synthés et du fabricant de kick (L) : des valeurs de réglages (0 à 1, comme le format) sous un nom
// français (textes/synthes.ts : T.synthe.presets, T.sonsCourts.kickPresets). Appliqués en UNE étape d'Annuler.
import type { RecetteKick } from '../../../morceau/types';

export const PREREGLAGES: Record<string, Record<string, Record<string, number>>> = {
  '303': {
    'acide-classique': {
      onde: 0,
      coupure: 0.3,
      resonance: 0.72,
      enveloppe: 0.6,
      decroissance: 0.35,
      accent: 0.65,
      saturation: 0.25,
    },
    squelch: {
      onde: 1,
      coupure: 0.12,
      resonance: 0.95,
      enveloppe: 0.85,
      decroissance: 0.2,
      accent: 0.9,
      saturation: 0.55,
    },
  },
  nes: {
    heros: { forme: 0.2, arpege: 0, decroissance: 0.15, tenue: 0.7, vibrato: 0.3 },
    boss: { forme: 0, arpege: 0.5, decroissance: 0.05, tenue: 0.9, vibrato: 0.1 },
    piece: { forme: 0.4, arpege: 1, decroissance: 0.35, tenue: 0, vibrato: 0 },
  },
  onde: {
    doux: { attaque: 0.35, decroissance: 0.5, tenue: 0.8, filtre: 0.55 },
    pique: { attaque: 0, decroissance: 0.3, tenue: 0.3, filtre: 1 },
  },
  supersaw: {
    rage: { desaccord: 0.55, melange: 0.8, largeur: 1, attaque: 0.02, brillance: 0.9 },
    hyperpop: { desaccord: 0.3, melange: 0.6, largeur: 0.7, attaque: 0, brillance: 1 },
    trance: { desaccord: 0.45, melange: 0.7, largeur: 0.9, attaque: 0.6, brillance: 0.6 },
  },
  choeurs: {
    gospel: { voyelle: 0, vibrato: 0.5, largeur: 0.8, attaque: 0.4, souffle: 0.4 },
    oh: { voyelle: 1, vibrato: 0.35, largeur: 0.6, attaque: 0.6, souffle: 0.6 },
  },
  logdrum: {
    amapiano: { chute: 0.4, longueur: 0.45, toc: 0.5, saturation: 0.35 },
    grave: { chute: 0.25, longueur: 0.8, toc: 0.3, saturation: 0.5 },
  },
  cuivres: {
    funk: { brillance: 0.8, attaque: 0.05, eclat: 0.8, vibrato: 0.1, largeur: 0.7 },
    fanfare: { brillance: 0.6, attaque: 0.3, eclat: 0.5, vibrato: 0.5, largeur: 0.9 },
  },
  rhodes: {
    soul: { grogne: 0.35, cloche: 0.4, longueur: 0.5, tremolo: 0.3, vitesse: 0.4 },
    lofi: { grogne: 0.15, cloche: 0.2, longueur: 0.4, tremolo: 0.5, vitesse: 0.25 },
    brillant: { grogne: 0.7, cloche: 0.8, longueur: 0.6, tremolo: 0, vitesse: 0.4 },
  },
  wurlitzer: {
    soul: { mordant: 0.4, saturation: 0.3, longueur: 0.5, tremolo: 0.25, vitesse: 0.5 },
    sale: { mordant: 0.8, saturation: 0.85, longueur: 0.4, tremolo: 0.2, vitesse: 0.6 },
  },
  pianojouet: {
    musique: { metal: 0.7, faux: 0.2, clonc: 0.2, longueur: 0.8 },
    casse: { metal: 0.4, faux: 1, clonc: 0.9, longueur: 0.4 },
  },
  celesta: {
    feerique: { eclat: 0.6, longueur: 0.8 },
    doux: { eclat: 0.2, longueur: 0.5 },
  },
  steeldrum: {
    tropical: { brillance: 0.6, longueur: 0.5 },
    sombre: { brillance: 0.2, longueur: 0.7 },
  },
};

export const KICKS: Record<string, RecetteKick> = {
  '808': {
    type: 'kick',
    hauteur: 45,
    depart: 180,
    chute: 0.08,
    duree: 1.6,
    claquement: 0.2,
    saturation: 0.1,
  },
  trap: {
    type: 'kick',
    hauteur: 55,
    depart: 320,
    chute: 0.04,
    duree: 0.45,
    claquement: 0.6,
    saturation: 0.2,
  },
  phonk: {
    type: 'kick',
    hauteur: 48,
    depart: 260,
    chute: 0.06,
    duree: 0.9,
    claquement: 0.5,
    saturation: 0.85,
  },
  lofi: { type: 'kick', hauteur: 60, depart: 150, chute: 0.05, duree: 0.4, claquement: 0.1, saturation: 0 },
};

/** Bornes des réglages du kick (format : RecetteKick) et échelle du curseur. */
export const BORNES_KICK: Record<
  'depart' | 'hauteur' | 'chute' | 'duree' | 'claquement' | 'saturation',
  { min: number; max: number; log?: boolean; unite: string }
> = {
  depart: { min: 60, max: 800, log: true, unite: 'Hz' },
  hauteur: { min: 30, max: 150, log: true, unite: 'Hz' },
  chute: { min: 0.005, max: 1, log: true, unite: 's' },
  duree: { min: 0.05, max: 2, log: true, unite: 's' },
  claquement: { min: 0, max: 1, unite: '%' },
  saturation: { min: 0, max: 1, unite: '%' },
};
