// Textes de l'IA compositrice (facultative, clé de l'utilisateur). Vague B, propriétaire : B2.

export const TEXTES_IA = {
  ia: {
    // Réglages
    reglages: 'Réglages de l’IA',
    reglagesCourt: 'Régler l’IA',
    intro: 'L’IA est facultative. Elle marche avec TA clé, chez le fournisseur que tu choisis (c’est lui qui te fait payer).',
    fournisseur: 'Fournisseur',
    cle: 'Ta clé API',
    clePlaceholder: 'Colle ta clé ici',
    cleGardee: (masque: string) => `Clé gardée : ${masque}`,
    rappel: 'Ta clé reste sur ton téléphone ; OCKA ne l’envoie qu’au fournisseur choisi.',
    cleMemoire: 'Ce téléphone refuse de garder ta clé : elle sera oubliée en fermant OCKA.',
    tester: 'Tester ma clé',
    test: 'Je vérifie ta clé…',
    cleOk: 'Clé acceptée et gardée sur ton téléphone.',
    oublier: 'Oublier ma clé',
    cleOubliee: 'Clé oubliée sur ce téléphone.',
    modele: (m: string) => `Modèle conseillé : ${m}`,
    sansCle: 'Pour utiliser l’IA, choisis un fournisseur et colle ta clé.',
    avecIa: (f: string) => `IA : ${f}`,

    // Envoi (commun aux 3 actions)
    cout: (phrase: string) => `Coût estimé : ${phrase}.`,
    prix: 'Les prix changent : vérifie-les chez ton fournisseur.',
    voirEnvoi: 'Voir ce qui est envoyé',
    cacherEnvoi: 'Cacher ce qui est envoyé',
    envoiAide: 'Voici le texte exact envoyé à l’IA. Ta clé part à part, seulement chez le fournisseur. Rien d’autre ne part : ni ta voix, ni tes sons.',
    envoyer: 'Envoyer',
    envoi: (f: string) => `J’envoie ta demande à ${f}…`,
    annuler: 'Annuler',
    annule: 'Demande annulée. Rien n’a été changé.',
    erreur: 'L’IA n’a pas pu répondre. Rien n’a été changé.',

    // « Lance-moi un beat »
    beat: 'Lance-moi un beat',
    beatTitre: 'Lance-moi un beat',
    beatAide: 'Décris ton beat en une phrase : le style, l’ambiance, le tempo.',
    beatChamp: 'Ton idée',
    beatExemple: 'phonk sombre pour un clip de clutch, 140',
    beatPret: 'Ton beat est prêt. L’aide de l’IA est notée pour ta sortie.',

    // « Continue mon idée »
    suite: 'Continue mon idée',
    suiteTitre: (nom: string) => `Après « ${nom} »`,
    suiteAide: 'L’IA ajoute une section juste après celle-ci. Tu peux l’annuler d’un geste.',
    genre: 'Ajouter',
    genres: { refrain: 'Un refrain', pont: 'Un pont', variation: 'Une variation' } as Record<string, string>,
    suiteChamp: 'Une précision ? (facultatif)',
    suiteExemple: 'plus calme, avec une cloche',
    suiteAjoutee: (nom: string) => `« ${nom} » ajoutée après cette section.`,

    // « Aide aux paroles »
    paroles: 'Aide aux paroles',
    parolesTitre: (nom: string) => `Paroles · ${nom}`,
    parolesAide: (n: number) => `${n} mesure${n > 1 ? 's' : ''} : une ligne par mesure. L’IA propose, tu choisis, puis tu modifies.`,
    theme: 'Le thème',
    themeExemple: 'rouler la nuit, rêver plus grand',
    langue: 'Langue',
    langues: { fr: 'Français', en: 'Anglais', es: 'Espagnol' } as Record<string, string>,
    propositions: 'Choisis une proposition',
    proposition: (n: number) => `Proposition ${n}`,
    rime: (r: string) => `Rime : ${r}`,
    syllabes: (n: number) => `${n} syll.`,
    choisir: 'Mettre dans mes paroles',
    autres: 'Demander d’autres idées',
    parolesMises: 'Paroles ajoutées : modifie-les à ta façon.',
  },
};
