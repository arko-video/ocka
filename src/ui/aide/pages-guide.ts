// Les pages du guide : premier morceau, voix propre, tes droits, finir sur PC, installer, à propos.
// « Sortir sur Spotify » et la FAQ sont dans pages-spotify.ts. Propriétaire : B3.

import type { PageAide } from './types';

type PagesGuide = Record<'premier-morceau' | 'voix-propre' | 'droits' | 'finir-pc' | 'installer' | 'a-propos', PageAide>;

export const PAGES_GUIDE: PagesGuide = {
  'premier-morceau': {
    titre: 'Ton premier morceau en 10 minutes',
    resume: 'Du beat à la voix, sans rien savoir de la musique.',
    blocs: [
      { t: 'liste', numerotee: true, items: [
        'Accueil → « Nouveau morceau » → choisis un style. Tout est déjà prêt : écoute avec ▶.',
        'Beat : touche quelques cases pour changer le rythme, ou « Varier ».',
        'Mélodie (bascule en haut de Beat) : joue sur les 8 pads. Aucune fausse note possible.',
        'Structure : écris tes paroles dans le couplet et le refrain.',
        'Voix : branche un casque filaire, « Calibrer », puis « Enregistrer ». Garde ta meilleure prise.',
        'Son : choisis une couleur, et compare avec le bouton A/B.',
        'Exporter : « M4A pour écouter » pour l’envoyer à tes potes, ou « Sortir sur Spotify ».',
      ] },
      { t: 'conseil', texte: 'Pas content d’un changement ? La flèche « Annuler » en haut revient en arrière.' },
      { t: 'voir', texte: 'Enregistrer ta voix proprement', page: 'voix-propre' },
    ],
  },
  'voix-propre': {
    titre: 'Enregistrer ta voix proprement',
    resume: 'Quatre réglages qui changent tout.',
    blocs: [
      { t: 'titre', texte: 'Un casque filaire' },
      { t: 'p', texte: 'Le Bluetooth ajoute beaucoup de retard : ta voix arriverait après le beat. Avec un casque filaire, le beat ne s’entend pas dans ta prise.' },
      { t: 'titre', texte: 'Une pièce calme' },
      { t: 'p', texte: 'Ferme la fenêtre, coupe la télé et le ventilateur. Une pièce avec des rideaux, un lit ou des vêtements sonne mieux qu’une salle de bain qui résonne.' },
      { t: 'titre', texte: 'La bonne distance' },
      { t: 'p', texte: 'Tiens le téléphone à environ 15 à 20 cm de ta bouche (une main ouverte), un peu sur le côté pour éviter les « p » qui claquent. Garde la même distance à chaque prise.' },
      { t: 'conseil', texte: 'Regarde le niveau du micro : s’il touche le rouge, recule un peu ou chante moins fort.' },
      { t: 'titre', texte: 'Le calibrage' },
      { t: 'liste', numerotee: true, items: [
        'Branche le casque, puis touche « Calibrer ».',
        'Colle l’écouteur contre le micro du téléphone et monte le volume.',
        'OCKA mesure le retard de ton téléphone et le corrige à chaque prise.',
        'Nouveau casque ou nouveau micro ? Refais le calibrage.',
      ] },
    ],
  },
  droits: {
    titre: 'Tes droits',
    resume: 'Ce que tu peux publier, et ce qui peut poser problème.',
    blocs: [
      { t: 'titre', texte: 'Les sons d’OCKA sont à toi' },
      { t: 'p', texte: 'Tous les sons d’OCKA (batteries, basse, accords, mélodies) sont fabriqués par son code. Ils sont dans le domaine public (CC0) : pas de licence de beat à acheter. Ton morceau t’appartient, tu peux le publier et le vendre.' },
      { t: 'titre', texte: 'Ce que tu importes est sous ta responsabilité' },
      { t: 'p', texte: 'Tes sons, tes boucles et ta pochette : n’utilise que ce que tu as le droit d’utiliser (ce que tu as fait toi-même, ou ce qui est libre de droits).' },
      { t: 'conseil', texte: 'Un extrait de chanson, même très court, peut faire refuser ton morceau, ou le faire retirer plus tard.' },
      { t: 'titre', texte: 'La pochette' },
      { t: 'p', texte: 'Pas d’image d’anime, pas de visage de quelqu’un d’autre, pas de logo de marque. Le plus sûr : ta propre photo, ou « Fabriquer une pochette ».' },
      { t: 'titre', texte: 'L’IA' },
      { t: 'p', texte: 'Si une IA t’a aidé (paroles, musique ou voix), dis-le chez ton distributeur. Les styles et le hasard d’OCKA sont des règles, pas de l’IA.' },
    ],
  },
  'finir-pc': {
    titre: 'Finir sur PC',
    resume: 'Commence sur ton téléphone, termine sur ton ordinateur.',
    blocs: [
      { t: 'liste', numerotee: true, items: [
        'Sur le téléphone : ouvre le morceau → Exporter → « Exporter le projet ». Tu obtiens un fichier .ocka.',
        'Envoie ce fichier sur ton PC (câble, e-mail, Drive…).',
        'Sur le PC : ouvre OCKA dans Chrome → Accueil → « Importer un projet » → choisis le fichier.',
        'Ton morceau arrive avec tes prises de voix et tes sons.',
      ] },
      { t: 'conseil', texte: 'Ce fichier est aussi ta copie de sécurité : si le téléphone manque de place, il peut effacer les données d’OCKA.' },
    ],
  },
  installer: {
    titre: 'Installer OCKA sur ton téléphone',
    resume: 'Une icône sur ton écran d’accueil, comme une vraie appli.',
    blocs: [
      { t: 'liste', numerotee: true, items: [
        'Ouvre OCKA dans Chrome.',
        'Touche le menu ⋮ en haut à droite.',
        'Touche « Ajouter à l’écran d’accueil » (ou « Installer l’appli »), puis confirme.',
      ] },
      { t: 'p', texte: 'OCKA s’ouvre alors en plein écran, et marche même sans internet.' },
    ],
  },
  'a-propos': {
    titre: 'À propos d’OCKA',
    resume: 'Un studio de musique gratuit et open source.',
    blocs: [
      { t: 'p', texte: 'OCKA est sous licence MIT : tout le monde peut lire, copier et améliorer son code.' },
      { t: 'titre', texte: 'Crédits' },
      { t: 'liste', items: [
        'Les sons fabriqués par OCKA sont dans le domaine public (CC0).',
        'Interface : Preact et @preact/signals (MIT).',
        'Sauvegarde : idb-keyval (Apache-2.0).',
        'M4A : Mediabunny (MPL-2.0). Son encodeur AAC de secours vient de FFmpeg, sous LGPL 2.1 ou plus.',
        'Hors ligne : Workbox (MIT).',
        'Polices : Inter et Space Grotesk (SIL OFL 1.1).',
        'Le FLAC, le ZIP et le dither sont écrits à la main dans OCKA (MIT).',
      ] },
      { t: 'p', texte: 'Tes morceaux et tes prises de voix restent sur ton appareil. Aucun compte, aucun traqueur.' },
    ],
  },
};
