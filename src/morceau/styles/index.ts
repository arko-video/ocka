// Registre des styles (contrat C2) : chaque style vit dans SON fichier `<id>.ts` (export par défaut : DefinitionStyle).
// Ajouter un style = un id dans STYLES (types.ts, figé au contrat), un fichier, une ligne ici. Tout ce qui dépend du
// style lit ce registre (styles.ts, styles-motifs.ts, aller-vite/boucles.ts, textes/accueil.ts, stockage/sorties.ts,
// moteur : batterie.ts, melodiques.ts, notes.ts, planning.ts). Fichier de l'intégrateur : S1 et S2 n'y touchent pas.

import type { Style } from '../types';
import type { DefinitionStyle, FamilleStyle, FrappeFill, Reglages808, ReglagesKit, VarianteSon } from './definition';
import trap from './trap';
import drill from './drill';
import lofi from './lofi';
import phonk from './phonk';
import pop from './pop';
import boombap from './boombap';
import rage from './rage';
import plugg from './plugg';
import cloud from './cloud';
import jerseyclub from './jerseyclub';
import afrotrap from './afrotrap';
import rapmelodique from './rapmelodique';
import jazzrap from './jazzrap';
import ukdrill from './ukdrill';
import memphis from './memphis';
import hyperpop from './hyperpop';
import bossanova from './bossanova';
import rnb from './rnb';
import afrobeats from './afrobeats';
import reggaeton from './reggaeton';
import amapiano from './amapiano';
import house from './house';
import techno from './techno';
import dnb from './dnb';
import ukgarage from './ukgarage';
import synthwave from './synthwave';
import jazz from './jazz';
import rock from './rock';
import poppunk from './poppunk';
import funk from './funk';
import reggae from './reggae';
import gospel from './gospel';
import orchestral from './orchestral';
import ambient from './ambient';
import kpop from './kpop';

export * from './definition';

/** Toutes les définitions, par id (le compilateur refuse un style de STYLES sans fichier). */
export const DEFINITIONS_STYLES: Readonly<Record<Style, DefinitionStyle>> = {
  trap, drill, lofi, phonk, pop, boombap, rage, plugg, cloud, jerseyclub, afrotrap, rapmelodique, jazzrap, ukdrill,
  memphis, hyperpop, bossanova, rnb, afrobeats, reggaeton, amapiano, house, techno, dnb, ukgarage, synthwave, jazz,
  rock, poppunk, funk, reggae, gospel, orchestral, ambient, kpop,
};

/** La définition d'un style (inconnu : la trap). */
export function definitionStyle(style: string): DefinitionStyle {
  return Object.hasOwn(DEFINITIONS_STYLES, style) ? DEFINITIONS_STYLES[style as Style] : DEFINITIONS_STYLES.trap;
}

/** true si `style` est un style connu de cette version. */
export function estStyle(style: unknown): style is Style {
  return typeof style === 'string' && Object.hasOwn(DEFINITIONS_STYLES, style);
}

/** Les styles d'une famille, dans l'ordre de STYLES. */
export function stylesDeFamille(famille: FamilleStyle): DefinitionStyle[] {
  return Object.values(DEFINITIONS_STYLES).filter((d) => d.famille === famille);
}

/* ------------------------------------------------------------ son (lu par le moteur) */

let kits: Map<string, ReglagesKit> | null = null;

/** Réglages d'un kit : le kit demandé, sinon « <style>@1 », sinon trap@1. */
export function reglagesKit(nom: string): ReglagesKit {
  if (!kits) {
    kits = new Map();
    for (const d of Object.values(DEFINITIONS_STYLES)) for (const [k, r] of Object.entries(d.son.kits)) kits.set(k, r);
  }
  return kits.get(nom) ?? kits.get(`${nom.split('@')[0]}@1`) ?? kits.get('trap@1')!;
}

/** La 808 d'un style (celle de la trap s'il n'en a pas). */
export function reglages808(style: string): Reglages808 {
  return definitionStyle(style).son.basse808 ?? DEFINITIONS_STYLES.trap.son.basse808!;
}

/** Le fill de la dernière mesure d'un style (celui de la trap s'il n'en a pas). */
export function fillStyle(style: string): FrappeFill[] {
  return definitionStyle(style).son.fill ?? DEFINITIONS_STYLES.trap.son.fill!;
}

/** Variante d'un son OCKA dans un style (« » = le son normal). */
export function varianteStyle(style: string, son: string): VarianteSon | '' {
  const v = definitionStyle(style).son.variantes;
  return (v && Object.hasOwn(v, son) ? v[son as keyof typeof v] : undefined) ?? '';
}
