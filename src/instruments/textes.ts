// Textes de la banque d'instruments (BQ), en français simple, tutoiement. Groupe à brancher dans src/textes/index.ts
// (ou à déplacer dans src/textes/bq.ts) par l'intégrateur. Les messages d'erreur sont dans le code (ErreurOcka).

export const TEXTES_BQ = {
  banqueInstruments: {
    gerer: 'Gérer les instruments',
    gererAide: 'Les instruments enregistrés se téléchargent quand tu les choisis, puis restent sur le téléphone (même sans réseau).',
    placePrise: (taille: string) => `Place prise : ${taille}`,
    aucun: 'Aucun instrument téléchargé pour l’instant.',
    supprimer: 'Supprimer',
    supprimerTout: 'Tout supprimer',
    confirmerSuppression: (nom: string) =>
      `Supprimer « ${nom} » du téléphone ? Tes morceaux le gardent : il sera retéléchargé à la prochaine écoute.`,
    incomplet: 'Téléchargement interrompu',
    telecharger: 'Télécharger',
    telechargement: (nom: string, pourcent: number) => `Téléchargement de « ${nom} »… ${pourcent} %`,
    annuler: 'Annuler',
    pret: 'Prêt',
    rechercher: 'Chercher un instrument',
    aucunResultat: 'Aucun instrument ne correspond.',
    avantExport: (n: number) =>
      n === 1 ? 'Un instrument doit d’abord être téléchargé.' : `${n} instruments doivent d’abord être téléchargés.`,
    licence: 'Sons enregistrés libres de droits (CC0) : tu n’as rien à créditer.',
  },
} as const;
