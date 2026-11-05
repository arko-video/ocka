// Textes de l'aide dans l'appli (bouton « ? »), de « À propos » et du premier lancement. Propriétaire : B3.
// Le contenu des pages du guide est dans src/ui/aide/pages-*.ts (des blocs, testés par aide.test.ts).

export const TEXTES_AIDE = {
  aide: {
    bouton: 'Aide de cet écran',
    titre: 'Aide',
    toutLeGuide: 'Tout le guide',
    fermer: 'Fermer l’aide',
    retour: 'Page d’avant',
    nouvelOnglet: '(s’ouvre dans un nouvel onglet)',
    version: (v: string) => `Version ${v}`,
    code: 'Le code d’OCKA (GitHub)',
    licence: 'Licence MIT',
  },

  bienvenue: {
    titre: 'Bienvenue dans OCKA',
    sousTitre: '3 conseils avant de commencer',
    conseils: [
      { titre: 'Tout reste sur ton téléphone', texte: 'Pas de compte. Garde une copie de tes morceaux avec « Exporter le projet ».' },
      { titre: 'Un casque filaire pour chanter', texte: 'Le Bluetooth met ta voix en retard sur le beat.' },
      { titre: 'Perdu ? Touche « ? »', texte: 'Chaque écran a son aide, et le guide explique comment sortir sur Spotify.' },
    ],
    cestParti: 'C’est parti',
  },
};
