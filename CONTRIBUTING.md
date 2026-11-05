# Contribuer à OCKA

Merci de vouloir aider ! OCKA doit rester **gratuit, simple et pensé pour faire et publier de la musique**.

## Proposer une idée ou signaler un problème
- Ouvre une *issue* avec le modèle « Bug » ou « Idée ».
- Pour un bug, donne ton téléphone, ta version de Chrome, ce que tu as fait, ce qui s'est passé, et une capture si possible.
- Ne joins jamais une prise de voix privée ni une clé API.
- Une faille de sécurité ne va pas dans une *issue* publique : voir `SECURITY.md`.

## Proposer du code
1. Installe [Node.js](https://nodejs.org) 22, puis lance `npm install` et `npm run dev`.
2. Fais un petit changement à la fois.
3. Vérifie que tout passe : `npm run verif` (types et tests rapides), et si possible `npm run e2e`.
4. Ouvre une *pull request* qui explique **pourquoi** tu fais ce changement.

## Règles du projet
- **Le morceau** (`src/morceau/`) est la seule source de vérité. On écrit toujours le format `ocka.morceau/2` ; le
  normaliseur lit les versions 1 et 2, et tout ce qui entre (fichier, projet importé, réponse de l'IA) passe par lui.
  L'interface modifie le morceau uniquement par des fonctions pures d'édition (`src/ui/edition/`), avec Annuler.
- **Un seul graphe audio** pour l'écoute et l'export : tout nouveau son passe par `construireGraphe()`. Rien n'est
  synthétisé pendant la lecture.
- **Rien ne quitte le téléphone** : aucun serveur, aucun traqueur. La seule exception est l'IA, facultative, avec la
  clé de l'utilisateur, et seulement après un geste. La CSP n'autorise que ses 3 fournisseurs.
- **Stockage** : tout ce qui appartient à OCKA est préfixé `ocka-` (dossiers OPFS, bases IndexedDB, clés locales), car
  OCKA partage son origine avec Arko. On ne touche jamais à rien d'autre.
- **Textes** : tous les textes de l'interface sont dans `src/textes/` (un fichier par domaine), en français simple, au
  tutoiement. Le contenu de l'aide est dans `src/ui/aide/pages-*.ts`.
- **Aide** : pas de règle inventée. Une règle d'un distributeur ou de Spotify doit être vérifiée sur sa page officielle,
  et chaque lien externe va dans `src/ui/aide/liens.ts` (pages d'aide officielles seulement ; un test le vérifie).
- **Licences** : uniquement du code et des ressources libres (MIT, Apache-2.0, MPL-2.0, OFL, CC0). Aucun son, image ou
  police copiés sans licence claire.
- Code et textes **en français**, simples à lire. Les fichiers restent courts (moins de 300 lignes).
- Interface **mobile d'abord** : 360 px de large sans défilement de côté, des cibles de 44 px au moins.
