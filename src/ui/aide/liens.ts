// Les SEULS liens externes de l'aide : des pages d'aide officielles, vérifiées en ligne le 4 novembre 2026.
// Ils s'ouvrent dans un nouvel onglet (target="_blank" rel="noopener noreferrer"). L'appli ne fait aucun appel réseau.
// Propriétaire : B3. Les mêmes adresses que la fiche de sortie (src/sortie/guide.ts) quand elles existent.

export const LIENS_AIDE = {
  /** RouteNote : accueil de l'aide. */
  routenoteAide: 'https://support.routenote.com/',
  /** RouteNote : « How old do you have to be to use RouteNote? » */
  routenoteAge: 'https://support.routenote.com/kb-article/how-old-do-you-have-to-be-to-use-routenote/',
  /** RouteNote : formats acceptés (FLAC ou MP3, pas de WAV). */
  routenoteFormats: 'https://support.routenote.com/kb-article/which-audio-file-formats-does-routenote-not-accept/',
  /** RouteNote : Free ou Premium. */
  routenoteFormules: 'https://support.routenote.com/kb-article/which-pricing-model-should-i-choose/',
  /** RouteNote : délai avant la mise en ligne. */
  routenoteDelais: 'https://support.routenote.com/kb-article/how-long-will-i-be-waiting-for-my-release-to-go-live/',
  /** DistroKid : accueil de l'aide. */
  distrokidAide: 'https://support.distrokid.com/hc/en-us',
  /** DistroKid : conditions d'utilisation (âge minimum). */
  distrokidConditions: 'https://distrokid.com/terms/',
  /** DistroKid : formats acceptés (WAV, FLAC…). */
  distrokidFormats: 'https://support.distrokid.com/hc/en-us/articles/360013647753-',
  /** Spotify for Artists : accueil. */
  spotifyArtistes: 'https://artists.spotify.com/',
  /** Spotify for Artists : avoir accès à son profil. */
  spotifyAcces: 'https://support.spotify.com/artists/article/getting-access-to-spotify-for-artists/',
  /** Spotify for Artists : proposer un titre aux playlists (au moins 7 jours avant). */
  spotifyPitch: 'https://support.spotify.com/artists/article/pitching-music-to-playlist-editors/',
  /** Spotify for Artists : déclarer l'IA dans les crédits. */
  spotifyIa: 'https://support.spotify.com/artists/article/ai-credits/',
  /** Spotify for Artists : sonie (−14 LUFS). */
  spotifySonie: 'https://support.spotify.com/artists/article/loudness-normalization/',
  /** Spotify for Artists : les paroles passent par Musixmatch. */
  spotifyParoles: 'https://support.spotify.com/artists/article/managing-your-lyrics-on-spotify/',
  /** Musixmatch : ajouter et synchroniser ses paroles (Musixmatch Pro). */
  musixmatchParoles: 'https://musixmatch.helpscoutdocs.com/article/190-how-can-artists-add-and-synchronize-lyrics-on-musixmatch-pro',
} as const;

export type CleLien = keyof typeof LIENS_AIDE;

/** Les sites permis pour un lien de l'aide (vérifié par le test). */
export const SITES_PERMIS = [
  'support.routenote.com',
  'support.distrokid.com',
  'distrokid.com',
  'artists.spotify.com',
  'support.spotify.com',
  'musixmatch.helpscoutdocs.com',
];

/** Adresse du code d'OCKA (page « À propos »). */
export const ADRESSE_CODE = 'https://github.com/arko-video/ocka';
