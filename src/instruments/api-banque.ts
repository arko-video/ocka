// Implémentation du contrat de la banque (src/moteur/api-instruments.ts) pour l'interface : catalogue, téléchargement,
// « Gérer les instruments », préparation d'un export. Le moteur (chargerSource, lireZone, instrumentsManquants) passe
// par moteur/instruments/fournisseur.ts. Les sons fabriqués par le code (« ocka-<son>@1 ») n'ont rien à télécharger.

import { declarerInstruments, syntheOcka } from '../morceau/acces';
import type { Morceau } from '../morceau/types';
import { FAMILLES_INSTRUMENTS, type InfoInstrument, type OptionsTelechargement } from '../moteur/api-instruments';
import { instrumentsEchantillonnes, oublierInstrument } from '../moteur/instruments/fournisseur';
import { chargerCatalogue, type EntreeCatalogue } from './catalogue';
import { IDS_BANQUE } from './ids-banque';
import * as gestion from './gestion';
import { assurerInstruments, ouvrirInstrument } from './telechargement';

/** Provenance affichée, par banque (préfixe de l'id) : voir CREDITS.md. */
const AUTEURS: Record<string, { auteur: string; url: string }> = {
  vcsl: { auteur: 'Versilian Studios (VCSL)', url: 'https://github.com/sgossner/VCSL' },
  vsco: { auteur: 'Versilian Studios (VSCO-2-CE)', url: 'https://github.com/sgossner/VSCO-2-CE' },
  freepats: { auteur: 'FreePats', url: 'https://freepats.zenvoid.org/' },
  karoryfer: { auteur: 'Karoryfer Samples', url: 'https://shop.karoryfer.com/' },
  virtuosity: { auteur: 'Versilian Studios et Karoryfer (Virtuosity Drums)', url: 'https://versilian-studios.com/virtuosity-drums/' },
};

// Le normaliseur connaît les instruments de cette version sans réseau (sinon : conseil « pas encore disponible »).
declarerInstruments(IDS_BANQUE);

const simplifier = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function info(e: EntreeCatalogue, installes: ReadonlySet<string>): InfoInstrument {
  const banque = e.id.split('-')[0] ?? '';
  const a = AUTEURS[banque];
  const mots = new Set(simplifier(`${e.nom} ${e.famille} ${banque}`).split(/[\s'’-]+/).filter((m) => m.length > 1));
  return {
    id: e.id,
    nom: e.nom,
    famille: e.famille,
    source: 'banque',
    taille: e.taille,
    installe: installes.has(e.id),
    motsCles: [...mots],
    ...(a ? { licence: { nom: e.licence, ...a } } : {}),
  };
}

async function installes(): Promise<Set<string>> {
  return new Set((await gestion.listerTelecharges()).filter((x) => x.complet).map((x) => x.id));
}

/** Le catalogue, trié par famille puis par nom. Hors ligne : la copie gardée, sinon ErreurOcka « hors_ligne ». */
export async function listerInstruments(): Promise<InfoInstrument[]> {
  const [liste, ici] = await Promise.all([chargerCatalogue(), installes()]);
  const rang = (x: InfoInstrument) => FAMILLES_INSTRUMENTS.indexOf(x.famille);
  return liste.map((e) => info(e, ici)).sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr'));
}

export async function telechargerInstrument(id: string, o: OptionsTelechargement = {}): Promise<void> {
  if (syntheOcka(id) !== null) return;
  oublierInstrument(id);
  await ouvrirInstrument(id, {
    signal: o.signal,
    progression: o.surProgression ? (p) => o.surProgression?.({ octets: p.faits, total: p.total }) : undefined,
  });
}

export async function instrumentsInstalles(): Promise<{ id: string; octets: number }[]> {
  return (await gestion.listerTelecharges()).filter((x) => x.complet).map((x) => ({ id: x.id, octets: x.taille }));
}

export async function supprimerInstrument(id: string): Promise<void> {
  await gestion.supprimerInstrument(id);
  oublierInstrument(id);
}

export const tailleInstruments = gestion.placeInstruments;

/** Avant un export : télécharge ce qui manque (progression globale). Hors ligne : « hors_ligne », rien n'est exporté. */
export async function preparerInstrumentsExport(m: Morceau, o: OptionsTelechargement = {}): Promise<void> {
  await assurerInstruments(instrumentsEchantillonnes(m), {
    signal: o.signal,
    progression: o.surProgression ? (p) => o.surProgression?.({ octets: p.faits, total: p.total }) : undefined,
  });
}
