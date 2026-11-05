// Textes communs (contrat / intégrateur) : boutons partout, étapes du studio, barre de lecture.

export const TEXTES_COMMUN = {
  appli: 'OCKA',
  retour: 'Retour',
  annuler: 'Annuler',
  retablir: 'Rétablir',
  fermer: 'Fermer',
  valider: 'Valider',
  enregistre: 'Enregistré',
  pasEnregistre: 'Pas enregistré',
  lecture: 'Lecture',
  pause: 'Pause',
  bientot: 'Bientôt disponible',

  etapes: { beat: 'Beat', structure: 'Structure', voix: 'Voix', son: 'Son', exporter: 'Exporter' },
  navigationEtapes: 'Étapes du morceau',

  barre: {
    position: 'Position',
    boucleMorceau: 'Tout',
    boucleSection: 'Section',
    boucleAide: (quoi: string) => `Boucle : ${quoi}`,
    metronome: 'Métronome',
    pasPret: 'Le son n’est pas encore prêt.',
  },
};
