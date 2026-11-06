// Catalogue vu par l'interface (« + Piste », cartes des pistes) : la liste de BQ (listerInstruments), complétée par
// les sons fabriqués par OCKA (« ocka-<son>@1 », toujours jouables). Tant que BQ lève « pas_encore » ou qu'il n'y a
// pas de réseau, on garde au moins les sons d'OCKA. Téléchargements à la demande, avec la progression (signals).

import { signal } from '@preact/signals';
import {
  ErreurOcka,
  instrumentsSynthes,
  listerInstruments,
  telechargerInstrument,
  type FamilleInstrument,
  type InfoInstrument,
} from '../../../moteur/api';
import { instrumentOcka } from '../../../morceau/acces';
import type { SonMelodie } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { nomDepuisInstrument } from '../../edition/pistes';

const FAMILLES_OCKA: Record<SonMelodie, FamilleInstrument> = {
  piano: 'Claviers',
  epiano: 'Claviers',
  lead: 'Synthés',
  pluck: 'Synthés',
  nappe: 'Synthés',
  cloche: 'Percussions mélodiques',
};
const MOTS_OCKA: Record<SonMelodie, string[]> = {
  piano: ['piano', 'clavier'],
  epiano: ['piano electrique', 'rhodes', 'fm', 'clavier'],
  lead: ['lead', 'synthe', 'synth'],
  pluck: ['pluck', 'synthe', 'synth', 'pince'],
  nappe: ['nappe', 'pad', 'synthe', 'synth'],
  cloche: ['cloche', 'bell', 'carillon'],
};

/** Les sons d'OCKA v1 puis les synthés prêts de C3 (registre de L), en entrées du catalogue (source « code »). */
export function instrumentsOcka(): InfoInstrument[] {
  return [...instrumentsV1(), ...instrumentsSynthes()];
}

function instrumentsV1(): InfoInstrument[] {
  return (Object.keys(FAMILLES_OCKA) as SonMelodie[]).map((son) => ({
    id: instrumentOcka(son),
    nom: T.melodie.sons[son],
    famille: FAMILLES_OCKA[son],
    source: 'code',
    taille: 0,
    installe: true,
    motsCles: MOTS_OCKA[son],
  }));
}

export const catalogue = signal<InfoInstrument[]>(instrumentsOcka());
/** « chargement » au premier appel ; « partiel » si seule la liste d'OCKA est là (bouchon, hors ligne). */
export const etatCatalogue = signal<'chargement' | 'complet' | 'partiel'>('chargement');
let promesse: Promise<void> | null = null;

/** Charge la liste de BQ une fois (rechargée après une erreur). */
export function chargerCatalogue(): Promise<void> {
  if (promesse) return promesse;
  promesse = listerInstruments()
    .then((liste) => {
      const ids = new Set(liste.map((x) => x.id));
      catalogue.value = [...liste, ...instrumentsOcka().filter((x) => !ids.has(x.id))];
      etatCatalogue.value = 'complet';
    })
    .catch((e: unknown) => {
      if (!(e instanceof ErreurOcka)) console.error(e);
      etatCatalogue.value = 'partiel';
      promesse = null;
    });
  return promesse;
}

export function infoInstrument(id: string): InfoInstrument | undefined {
  return catalogue.value.find((x) => x.id === id);
}

/** Nom affiché d'un instrument (catalogue, sinon tiré de son id). */
export function nomInstrument(id: string): string {
  return infoInstrument(id)?.nom ?? nomDepuisInstrument(id);
}

const sansAccents = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Recherche dans le nom, la famille et les mots-clés (sans accents ni majuscules). */
export function filtrer(
  liste: readonly InfoInstrument[],
  texte: string,
  famille: FamilleInstrument | null,
): InfoInstrument[] {
  const mots = sansAccents(texte).split(/\s+/).filter(Boolean);
  return liste.filter((x) => {
    if (famille && x.famille !== famille) return false;
    const dans = sansAccents([x.nom, x.famille, ...x.motsCles].join(' '));
    return mots.every((m) => dans.includes(m));
  });
}

/** Taille lisible : « 850 ko », « 1,2 Mo ». */
export function taille(octets: number): string {
  if (octets < 1_000_000) return `${Math.max(1, Math.round(octets / 1000))} ko`;
  return `${(octets / 1_000_000).toFixed(1).replace('.', ',')} Mo`;
}

/** Téléchargements en cours : id → part faite (0 à 1). */
export const telechargements = signal<Record<string, number>>({});

function progression(id: string, part: number | null) {
  const t = { ...telechargements.peek() };
  if (part === null) delete t[id];
  else t[id] = part;
  telechargements.value = t;
}

/**
 * Rend l'instrument jouable ici : rien pour « code » ou « installé », sinon téléchargement avec la progression.
 * Lève l'ErreurOcka de BQ (hors_ligne, disque_plein…) : à montrer en toast.
 */
export async function assurerInstrument(id: string): Promise<void> {
  const info = infoInstrument(id);
  if (!info || info.source === 'code' || info.installe) return;
  if (telechargements.peek()[id] !== undefined)
    throw new ErreurOcka(
      T.banque.telechargement(Math.round(telechargements.peek()[id]! * 100)),
      'deja_en_cours',
    );
  progression(id, 0);
  try {
    await telechargerInstrument(id, {
      surProgression: (p) => progression(id, p.total > 0 ? Math.min(1, p.octets / p.total) : 0),
    });
    catalogue.value = catalogue.peek().map((x) => (x.id === id ? { ...x, installe: true } : x));
  } finally {
    progression(id, null);
  }
}
