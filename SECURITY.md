# Sécurité

## Signaler une faille
Si tu trouves une faille de sécurité, **ne l'ouvre pas en issue publique**. Écris à l'adresse de contact du propriétaire
du dépôt, avec les détails pour la reproduire. Tu auras une réponse dès que possible.

## Ce qu'OCKA protège
- **Tes prises de voix et tes morceaux** ne sont jamais envoyés : tout se fait sur ton appareil (stockage du navigateur).
- Une règle de sécurité stricte (Content-Security-Policy) interdit à la page de contacter d'autres sites que ceux
  nécessaires. `connect-src` n'autorise que la page elle-même et les 3 fournisseurs d'IA
  (`api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`).
- **L'aide** ne fait aucun appel réseau : ses liens ouvrent seulement des pages d'aide officielles dans un nouvel onglet
  (`rel="noopener noreferrer"`).

## La clé de l'IA
- L'IA est **facultative** et **éteinte par défaut**. Elle marche avec **ta propre clé**, chez le fournisseur que tu choisis.
- La clé est **gardée sur ton appareil**, dans la base IndexedDB `ocka-cles`, jamais dans le code, jamais dans un fichier
  exporté (`.ocka`, dossier de sortie). Si le téléphone refuse de la garder, elle reste en mémoire jusqu'à la fermeture.
- Elle n'est envoyée **qu'au fournisseur choisi**, avec ta demande, et seulement après un geste. Le texte exact envoyé
  peut être affiché avant l'envoi. L'IA ne reçoit jamais ta voix ni tes sons.
- « Oublier ma clé » l'efface de l'appareil. Si tu penses qu'elle a fuité, supprime-la aussi chez le fournisseur.
- La réponse de l'IA est limitée en taille, filtrée par une liste blanche de champs, puis passe par le normaliseur.
  Elle s'affiche en texte brut et ne peut pas toucher à tes prises, tes sons, tes infos de sortie ni ton master.

## Les fichiers que tu importes
- Un projet (`.ocka`, `.ocka-sortie`) est lu par son répertoire central, avec des tailles plafonnées. Sont refusés :
  ZIP chiffré, ZIP64, compression inconnue, noms en double ou incohérents, plages qui se chevauchent.
- Seuls des noms de fichiers d'une liste blanche sont acceptés, et chaque fichier reçoit une clé neuve : un nom venu
  du ZIP ne devient jamais un chemin. L'import est tout ou rien.
- La fiche de sortie (`fiche-de-sortie.html`) échappe tout le texte.

## Conseil pour héberger OCKA
Sur GitHub Pages, toutes les pages d'un même compte (`<compte>.github.io`) partagent le même stockage. Héberge OCKA sur
une **organisation GitHub dédiée**, ou sur un domaine à lui, pour qu'aucune autre page ne puisse lire ses données (dont
la clé de l'IA). OCKA partage volontairement son origine avec Arko (`arko-video.github.io`) : tout ce qui est à OCKA
est préfixé `ocka-`.
