// Chaînes de voix prêtes (pur) : des inserts de C1 (PARAMS_EFFETS) pour la piste voix. Appliquer une chaîne
// REMPLACE les inserts de la piste voix (les courbes d'automation et LFO qui visaient les anciens inserts partent
// avec eux), en une seule étape d'Annuler. « Hyperpop » met aussi l'autotune simple au bout « Robot » (1).
// Les réverbes et échos passent par les envois partagés (pas de réverbe par piste, décisions v2 §3).

import type { Insert, Morceau, PisteFixe, TypeEffet } from '../morceau/types';
import type { IdChaineVoix } from './api-voix-avancee';

const ins = (id: string, type: TypeEffet, params: Record<string, number>): Insert => ({ id, type, actif: true, params: Object.assign(Object.create(null) as Record<string, number>, params) });

interface Chaine {
  id: IdChaineVoix;
  nom: string;
  inserts: () => Insert[];
  autotune?: number;
}

const CHAINES: Chaine[] = [
  {
    id: 'rap-clair',
    nom: 'Rap clair',
    inserts: () => [
      ins('vx-eq', 'eq', { passeHaut: 100, medium: -2, freqMedium: 350, qMedium: 1, aigu: 4, freqAigu: 9000 }),
      ins('vx-comp', 'compresseur', { seuil: -20, ratio: 4, attaque: 5, relache: 120, genou: 6, mix: 1 }),
      ins('vx-sat', 'saturation', { force: 0.15, ton: 0.6, mix: 0.3 }),
      ins('vx-rev', 'envoi-reverbe', { niveau: 0.12 }),
    ],
  },
  {
    id: 'drill-sombre',
    nom: 'Drill sombre',
    inserts: () => [
      ins('vx-eq', 'eq', { passeHaut: 70, grave: 3, freqGrave: 150, medium: -3, freqMedium: 500, qMedium: 1, aigu: 1, freqAigu: 7000 }),
      ins('vx-comp', 'compresseur', { seuil: -26, ratio: 6, attaque: 3, relache: 100, genou: 6, mix: 1 }),
      ins('vx-sat', 'saturation', { force: 0.45, ton: 0.35, mix: 0.5 }),
      ins('vx-echo', 'envoi-echo', { niveau: 0.18 }),
    ],
  },
  {
    id: 'chant-pop',
    nom: 'Chant pop',
    inserts: () => [
      ins('vx-eq', 'eq', { passeHaut: 90, medium: -2, freqMedium: 400, qMedium: 1, aigu: 5, freqAigu: 10000 }),
      ins('vx-comp', 'compresseur', { seuil: -22, ratio: 3, attaque: 10, relache: 180, genou: 8, mix: 1 }),
      ins('vx-chorus', 'chorus', { vitesse: 0.6, profondeur: 0.3, mix: 0.15 }),
      ins('vx-rev', 'envoi-reverbe', { niveau: 0.3 }),
      ins('vx-echo', 'envoi-echo', { niveau: 0.15 }),
    ],
  },
  {
    id: 'hyperpop',
    nom: 'Hyperpop',
    autotune: 1,
    inserts: () => [
      ins('vx-eq', 'eq', { passeHaut: 150, aigu: 6, freqAigu: 8000 }),
      ins('vx-comp', 'compresseur', { seuil: -26, ratio: 8, attaque: 2, relache: 80, genou: 4, mix: 1 }),
      ins('vx-sat', 'saturation', { force: 0.5, ton: 0.7, mix: 0.5 }),
      ins('vx-chorus', 'chorus', { vitesse: 1.2, profondeur: 0.4, mix: 0.25 }),
      ins('vx-rev', 'envoi-reverbe', { niveau: 0.25 }),
    ],
  },
  {
    id: 'lofi-telephone',
    nom: 'Lo-fi téléphone',
    inserts: () => [
      ins('vx-eq', 'eq', { passeHaut: 400, passeBas: 3400, medium: 6, freqMedium: 1500, qMedium: 0.8 }),
      ins('vx-sat', 'saturation', { force: 0.6, ton: 0.6, mix: 0.7 }),
      ins('vx-crush', 'bitcrusher', { bits: 10, reduction: 2, mix: 0.4 }),
      ins('vx-comp', 'compresseur', { seuil: -20, ratio: 4, attaque: 5, relache: 120, genou: 6, mix: 1 }),
    ],
  },
  {
    // Voix lointaine, façon cloud rap / ambiance : beaucoup d'envoi vers la réverbe partagée, un écho discret, peu de
    // compression (la réverbe garde la respiration) ; l'égaliseur retire le grave qui brouillerait la queue.
    id: 'grosse-reverbe',
    nom: 'Grosse réverbe',
    inserts: () => [
      ins('vx-eq', 'eq', { passeHaut: 160, medium: -2, freqMedium: 350, qMedium: 1, aigu: 3, freqAigu: 9000 }),
      ins('vx-comp', 'compresseur', { seuil: -20, ratio: 3, attaque: 10, relache: 200, genou: 8, mix: 1 }),
      ins('vx-rev', 'envoi-reverbe', { niveau: 0.75 }),
      ins('vx-echo', 'envoi-echo', { niveau: 0.2 }),
    ],
  },
];

export function chainesVoix(): { id: IdChaineVoix; nom: string; inserts: Insert[] }[] {
  return CHAINES.map((c) => ({ id: c.id, nom: c.nom, inserts: c.inserts() }));
}

/** Remplace les inserts de la piste voix par ceux de la chaîne (pur ; même objet si la piste voix n'existe pas). */
export function appliquerChaineVoix(m: Morceau, id: IdChaineVoix): Morceau {
  const c = CHAINES.find((x) => x.id === id);
  const i = m.pistes.findIndex((p) => p.id === 'voix');
  if (!c || i < 0) return m;
  const voix = m.pistes[i] as PisteFixe;
  const visaitInsert = (x: { cible: { type: string } }) => x.cible.type === 'insert';
  const piste: PisteFixe = { ...voix, inserts: c.inserts() };
  if (voix.auto) piste.auto = voix.auto.filter((x) => !visaitInsert(x));
  if (voix.lfo) piste.lfo = voix.lfo.filter((x) => !visaitInsert(x));
  if (piste.auto?.length === 0) delete piste.auto;
  if (piste.lfo?.length === 0) delete piste.lfo;
  if (c.autotune !== undefined) piste.effets = { ...voix.effets, autotune: c.autotune };
  const pistes = m.pistes.slice();
  pistes[i] = piste;
  return { ...m, pistes };
}
