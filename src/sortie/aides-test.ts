// Exemples pour les tests des sorties (utilisés seulement par les fichiers *.test.ts). Propriétaire : A1.

import { nouveauMorceau } from '../morceau/styles';
import type { InfosTitre, Morceau } from '../morceau/types';
import { FORMAT_SORTIE, type Sortie } from './types';

/** Un morceau trap d'environ 62 s, avec des paroles et des infos complètes : prêt pour Spotify. */
export function morceauPret(titre = 'Nuit blanche', infos: InfosTitre = {}): Morceau {
  const m = nouveauMorceau('trap', titre);
  m.sections = m.sections.map((s) =>
    s.id === 'couplet' ? { ...s, paroles: 'Je pars de rien\nJ’avance au pouce' } : s.id === 'refrain' ? { ...s, paroles: 'Oh oh\nNuit blanche' } : s,
  );
  m.infos = {
    explicite: false,
    langue: 'fr',
    credits: [
      { nom: 'Romain Dupont', role: 'auteur' },
      { nom: 'Romain Dupont', role: 'compositeur' },
    ],
    ia: { paroles: 'aucune', musique: 'aucune', voix: 'aucune' },
    ...infos,
  };
  return m;
}

/** Une sortie prête (date lointaine, pochette, lien), avec les ids donnés. */
export function sortiePrete(titres: string[], plus: Partial<Sortie> = {}): Sortie {
  return {
    format: FORMAT_SORTIE,
    id: 'sortie1',
    titre: 'Nuit blanche',
    artiste: 'Kalo',
    lienProfil: 'https://open.spotify.com/artist/abc',
    dateSortie: '2027-03-01',
    genre: 'Hip-Hop/Rap',
    langue: 'fr',
    titres,
    pochette: 'pochette-abc123-xyz',
    distributeur: 'routenote',
    niveau: 'standard',
    modifieLe: 0,
    ...plus,
  };
}
