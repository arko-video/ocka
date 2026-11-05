// L'aide de chaque écran (ouverte par le « ? » de l'en-tête). Mots simples, tutoiement, une idée par ligne.
// Les noms des boutons sont ceux de l'interface. Propriétaire : B3.

import type { IdPage, PageAide } from './types';

type PagesEcrans = Record<'accueil' | 'beat' | 'melodie' | 'structure' | 'voix' | 'son' | 'exporter' | 'assistant', PageAide>;

export const PAGES_ECRANS: PagesEcrans = {
  accueil: {
    titre: 'L’accueil',
    resume: 'Tes morceaux et tes sorties, rangés sur ton téléphone.',
    blocs: [
      { t: 'liste', items: [
        '« Nouveau morceau » : choisis un style, tout est prêt (batterie, basse, accords, sections).',
        'Touche un morceau pour l’ouvrir. Le bouton ⋮ sert à le renommer, le dupliquer ou le supprimer.',
        'Onglet « Sorties » : tes singles, EP et albums prêts pour Spotify.',
        '« Importer un projet » : ouvre un fichier .ocka (un morceau) ou .ocka-sortie (une sortie entière).',
      ] },
      { t: 'conseil', texte: 'Tout reste dans ton téléphone. Garde une copie avec « Exporter le projet » (étape Exporter).' },
      { t: 'voir', texte: 'Faire ton premier morceau en 10 minutes', page: 'premier-morceau' },
    ],
  },
  beat: {
    titre: 'Beat : la batterie',
    resume: 'Le rythme de ton morceau, case par case.',
    blocs: [
      { t: 'liste', items: [
        'En haut, la bascule « Batterie | Mélodie ».',
        'Choisis le motif (couplet, refrain…) puis l’instrument : kick, caisse claire, charley…',
        'Touche une case : fort, puis doux, puis vide.',
        'Appui long sur une case : un roulement (plusieurs frappes rapides, typique du charley trap).',
        '« Varier » propose une autre version du motif. Annule si elle ne te plaît pas.',
        '« + Ton son » : mets un de tes sons sur un pad perso (WAV, MP3, M4A ou OGG).',
      ] },
      { t: 'titre', texte: 'Réglages du beat' },
      { t: 'liste', items: [
        'Tempo (en BPM) : la vitesse du morceau.',
        'Swing : décale une double-croche sur deux, pour plus de groove.',
        'Accords et basse 808 : la basse suit les accords.',
      ] },
      { t: 'conseil', texte: 'N’importe que des sons que tu as le droit d’utiliser. Un extrait de chanson peut faire refuser ton morceau.' },
    ],
  },
  melodie: {
    titre: 'Beat : la mélodie',
    resume: 'Joue une mélodie sans jamais faire de fausse note.',
    blocs: [
      { t: 'liste', items: [
        'Les 8 pads sont les notes de la gamme du morceau : elles vont toutes ensemble.',
        'La note en rose est la tonique, la note « maison ».',
        'Octave : grave, milieu ou aigu.',
        'Les pastilles changent le son : piano, piano électrique, lead, pluck, cloche, nappe.',
      ] },
      { t: 'titre', texte: 'Enregistrer au clavier' },
      { t: 'liste', numerotee: true, items: [
        'Touche « Enregistrer au clavier ».',
        'Une mesure de décompte, puis la section tourne en boucle.',
        'Joue sur les pads : tes notes se calent toutes seules sur le rythme.',
        'Touche « Arrêter ». Annule si ça ne te plaît pas.',
      ] },
      { t: 'titre', texte: 'La grille' },
      { t: 'liste', items: [
        'Choisis la durée des notes (1/16, 1/8, 1/4, 1/2).',
        'Touche une case vide pour poser une note, touche une note pour l’effacer.',
        'Glisse la grille de côté pour voir la suite.',
      ] },
    ],
  },
  structure: {
    titre: 'Structure',
    resume: 'L’ordre des parties de ton morceau, et tes paroles.',
    blocs: [
      { t: 'liste', items: [
        'Chaque carte est une section : intro, couplet, refrain, outro…',
        '« Ajouter » : une nouvelle section, ou la répétition d’une section.',
        'Monte, descends, duplique ou supprime une section avec ses boutons.',
        'Change le nombre de mesures avec − et +.',
        'Fill : un roulement de batterie annonce la section suivante.',
        'Coupure : Break (dernière mesure sans batterie) ou Drop (première mesure sans batterie ni basse).',
        'Paroles : écris-les ici, elles défilent pendant que tu enregistres.',
        '« Boucle » : un de tes sons tourne en boucle pendant la section, calé au tempo.',
      ] },
      { t: 'conseil', texte: 'Un titre doit durer au moins 30 secondes pour sortir sur Spotify.' },
    ],
  },
  voix: {
    titre: 'Voix',
    resume: 'Enregistre ta voix sur le beat, section par section.',
    blocs: [
      { t: 'liste', numerotee: true, items: [
        'Branche un casque filaire.',
        'Touche « Calibrer » une fois, écouteur collé contre le micro du téléphone.',
        'Choisis la section, puis « Enregistrer ».',
        'Chante après le décompte : tes paroles défilent.',
        'Écoute tes prises et garde la meilleure.',
      ] },
      { t: 'liste', items: [
        'Son de la voix : Naturel, Rap ou Chant.',
        'Effets : touche Réverbe, Écho, Radio ou Doubler pour l’allumer ou l’éteindre.',
        'Réglage fin : si ta voix arrive en retard ou en avance sur le beat.',
      ] },
      { t: 'voir', texte: 'Enregistrer ta voix proprement', page: 'voix-propre' },
    ],
  },
  son: {
    titre: 'Son',
    resume: 'Le mélange des instruments et le son final.',
    blocs: [
      { t: 'liste', items: [
        'Pistes : volume, panoramique (gauche, droite), Muet et Solo.',
        'Couleur du son : Neutre, Chaud, Clair ou Lo-fi.',
        'Niveau : Standard (−14 LUFS, le niveau de Spotify) ou Fort (−11 LUFS).',
        'Colle : soude les instruments ensemble, comme sur les morceaux pros.',
        'A/B : maintiens le bouton pour écouter sans le mastering, au même volume.',
        'Fondu de fin : le son baisse doucement à la fin.',
      ] },
      { t: 'voir', texte: 'Pourquoi −14 LUFS ?', page: 'faq' },
    ],
  },
  exporter: {
    titre: 'Exporter',
    resume: 'Sors ton morceau du studio.',
    blocs: [
      { t: 'liste', items: [
        '« Sortir sur Spotify » : prépare le dossier complet pour ton distributeur (son, pochette, paroles, fiche).',
        'WAV : le fichier de qualité studio.',
        'M4A pour écouter : léger, pour ton téléphone ou tes potes.',
        'Pistes séparées : un WAV par instrument, pour mixer ailleurs.',
        'Envoyer vers Arko : pour faire la vidéo TikTok.',
        'Exporter le projet : pour finir sur PC ou garder une copie.',
      ] },
      { t: 'voir', texte: 'Sortir sur Spotify, pas à pas', page: 'spotify' },
      { t: 'voir', texte: 'Finir sur PC', page: 'finir-pc' },
    ],
  },
  assistant: {
    titre: 'Sortir sur Spotify',
    resume: 'Trois écrans : Infos, Pochette, Vérifier. Puis « Préparer le dossier ».',
    blocs: [
      { t: 'titre', texte: '1. Infos' },
      { t: 'liste', items: [
        'Ton vrai nom (prénom et nom) : Spotify l’exige dans les crédits. On te le demande une seule fois.',
        'Le nom de la sortie, ton nom d’artiste, la date, le genre et le distributeur.',
        'Les titres : range-les avec les flèches. Touche un titre pour remplir ses infos (gros mots, langue, crédits, IA).',
      ] },
      { t: 'titre', texte: '2. Pochette' },
      { t: 'liste', items: [
        'Importe une image d’au moins 1425 px de côté, ou fabrique une pochette (4 modèles).',
        'Interdit : liens, @pseudos, prix, code-barres, « Out now », logos, images sans droits.',
      ] },
      { t: 'titre', texte: '3. Vérifier' },
      { t: 'liste', items: [
        'Chaque problème a un bouton « Corriger » qui te ramène au bon endroit.',
        'Choisis le format (FLAC pour RouteNote, WAV 24 bits pour DistroKid), puis « Préparer le dossier ».',
      ] },
      { t: 'voir', texte: 'La suite : envoyer le dossier', page: 'spotify' },
    ],
  },
};

/** Les pages d'écran, dans l'ordre du studio (pour la liste du guide). */
export const ORDRE_ECRANS: IdPage[] = ['accueil', 'beat', 'melodie', 'structure', 'voix', 'son', 'exporter', 'assistant'];
