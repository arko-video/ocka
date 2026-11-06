// Textes de la banque d'instruments (« + Piste », « Gérer les instruments », téléchargement). Propriétaire : BQ.

export const TEXTES_BQ = {
  banque: {
    gerer: 'Gérer les instruments',
    gererAide: 'Les instruments téléchargés restent sur ton téléphone pour marcher sans réseau.',
    telecharger: 'Télécharger',
    telechargement: (pc: number) => `Téléchargement… ${pc} %`,
    installe: 'Sur ton téléphone',
    aTelecharger: (taille: string) => `À télécharger (${taille})`,
    place: (taille: string) => `Place prise : ${taille}`,
    supprimer: 'Supprimer',
    horsLigne: 'Pas de réseau : branche-toi à Internet pour télécharger cet instrument.',
    manquants: (n: number) => `${n > 1 ? `${n} instruments ne sont` : 'Un instrument n’est'} pas encore sur ton téléphone.`,
    familles: {
      Claviers: 'Claviers',
      Guitares: 'Guitares',
      Basses: 'Basses',
      Cordes: 'Cordes',
      Vents: 'Vents',
      'Percussions mélodiques': 'Percussions mélodiques',
      'Chœurs': 'Chœurs',
      'Synthés': 'Synthés',
      Batteries: 'Batteries',
      Percussions: 'Percussions',
    } as Record<string, string>,
  },
};
