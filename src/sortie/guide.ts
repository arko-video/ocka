// Guide pas à pas de chaque distributeur et conseils, pour la fiche de sortie (pur). Propriétaire : A1.
// On ne recopie pas les règles des distributeurs (elles changent) : on renvoie vers LEURS pages d'aide officielles,
// en particulier pour l'âge minimum. Amuse n'est plus cité comme gratuit.

import { LIENS_AIDE } from '../ui/aide/liens';
import type { Distributeur } from './types';

/**
 * Les seuls liens de la fiche (tout autre texte est échappé, jamais transformé en lien). Une seule liste d'adresses
 * vérifiées pour toute l'appli : celle de l'aide (src/ui/aide/liens.ts, données pures).
 */
export const LIENS = {
  routenoteAide: LIENS_AIDE.routenoteAide,
  routenoteAge: LIENS_AIDE.routenoteAge,
  distrokidAide: LIENS_AIDE.distrokidAide,
  distrokidConditions: LIENS_AIDE.distrokidConditions,
  spotifyArtistes: LIENS_AIDE.spotifyArtistes,
  musixmatch: LIENS_AIDE.musixmatchParoles,
} as const;

export interface Guide {
  nom: string;
  /** Format des fichiers audio conseillé pour ce distributeur. */
  format: string;
  etapes: string[];
}

export function guideDistributeur(d: Distributeur, date: string, extension: string): Guide {
  const fichiers = `les fichiers « .${extension} » du dossier`;
  if (d === 'routenote') {
    return {
      nom: 'RouteNote',
      format: 'FLAC (RouteNote accepte le FLAC ou le MP3 320, pas le WAV)',
      etapes: [
        `Avant tout : vérifie l’âge minimum sur la page d’aide de RouteNote : ${LIENS.routenoteAge}`,
        'Crée ton compte sur routenote.com (ou connecte-toi), puis crée une nouvelle sortie.',
        'Recopie la partie « La sortie » de cette fiche : titre, artiste, genre, label, langue. Laisse l’UPC vide : RouteNote en donne un.',
        'Envoie « pochette.jpg ».',
        `Pour chaque titre, dans l’ordre : envoie ${fichiers}, puis recopie ses infos (explicite, langue, crédits avec les vrais noms, ISRC s’il y en a un, déclaration de l’IA).`,
        `Choisis les plateformes (au moins Spotify) et la date de sortie : ${date}.`,
        'Envoie la sortie. RouteNote la vérifie puis la livre aux plateformes : environ 3 à 5 semaines (21 à 23 jours ouvrés de vérification, puis la livraison). Surveille tes e-mails : s’il faut corriger quelque chose, on te le dira.',
        `Pages d’aide de RouteNote : ${LIENS.routenoteAide}`,
      ],
    };
  }
  if (d === 'distrokid') {
    return {
      nom: 'DistroKid',
      format: 'WAV ou FLAC',
      etapes: [
        `Avant tout : lis les conditions de DistroKid (âge minimum, abonnement payant) : ${LIENS.distrokidConditions}`,
        'Crée ton compte sur distrokid.com (ou connecte-toi), puis clique sur « Upload ».',
        'Recopie la partie « La sortie » de cette fiche : artiste, nombre de titres, date, genre, langue, label. Laisse l’UPC vide.',
        'Envoie « pochette.jpg ».',
        `Pour chaque titre, dans l’ordre : envoie ${fichiers}, puis recopie son titre, l’invité (featuring), explicite, les auteurs et compositeurs avec leurs vrais noms, l’ISRC s’il y en a un et la déclaration de l’IA.`,
        `Vérifie la date de sortie : ${date}. Coche les cases demandées et envoie.`,
        `Pages d’aide de DistroKid : ${LIENS.distrokidAide}`,
      ],
    };
  }
  return {
    nom: 'ton distributeur',
    format: `${extension.toUpperCase()} (vérifie les formats acceptés par ton distributeur)`,
    etapes: [
      'Avant tout : lis la page d’aide de ton distributeur (âge minimum, prix, formats acceptés, délai de vérification).',
      'Crée une nouvelle sortie sur son site.',
      'Recopie la partie « La sortie » de cette fiche. Laisse l’UPC vide si tu n’en as pas : le distributeur en donne un.',
      'Envoie « pochette.jpg ».',
      `Pour chaque titre, dans l’ordre : envoie ${fichiers}, puis recopie ses infos (explicite, langue, crédits avec les vrais noms, ISRC, IA).`,
      `Choisis Spotify et la date de sortie : ${date}. Envoie la sortie.`,
    ],
  };
}

export function conseils(): string[] {
  return [
    'Cherche ton nom d’artiste sur Spotify AVANT d’envoyer : si un autre artiste porte le même nom, ta musique pourrait arriver sur son profil. Si tu as déjà un profil, donne son lien au distributeur.',
    `Quand la sortie est livrée, propose ton titre aux playlists dans Spotify for Artists, au moins 7 jours avant la date de sortie : ${LIENS.spotifyArtistes}`,
    `Les paroles : quand le titre est en ligne, envoie le fichier du dossier « paroles » sur Musixmatch (Spotify affiche leurs paroles) : ${LIENS.musixmatch}`,
    'Garde ce dossier : il te servira si le distributeur demande une correction.',
  ];
}
