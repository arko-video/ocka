# Passation — OCKA (studio de musique open source, façon BandLab)

Mise à jour : **5 novembre 2026**, après l'intégration de la vague B. Les phases 0 à 6 sont construites et testées
automatiquement (types, tests unitaires, parcours dans Chrome, relecture QA). Il reste à les essayer sur le Xiaomi et à
les écouter pour de vrai.

## En une phrase
OCKA est une appli web gratuite et open source (licence MIT), qui s'installe comme une appli (PWA). Elle sert à faire
des beats, enregistrer sa voix et sortir des morceaux sur Spotify, depuis le téléphone. Il n'y a pas de compte. Rien
n'est envoyé en ligne, sauf si tu branches toi-même l'IA facultative avec ta clé.

## Où sont les choses
- **Code** : dossier `ocka/app`. C'est la **racine du dépôt** (README, `.github/`, `src/`, `tests/`). Sur le PC :
  `C:\dev\ocka`.
- **Conception** (copiée dans `docs/` du dépôt) : `decisions-phases-2-6.md` (l'emporte sur `phases-2-6.md`),
  `decisions-phases-0-1.md`, `brief-phases-0-1.md`, `contrat-vague-a.md`, et cette passation.
- **Rapport de tests** : `tests/qa/RAPPORT-QA.md`. Captures d'écran 360×800 : `tests/e2e/captures/`.
- **Module Mon Hub** : `integration/mon-hub/` (`ecran_ocka.dart` + `LISEZ-MOI.md`).

## Ce que fait OCKA (phases 0 à 6)
- **Mes morceaux** : onglets Morceaux | Sorties ; Nouveau, Ouvrir, Renommer, Dupliquer, Supprimer ; « Importer un
  projet » (`.ocka` ou `.ocka-sortie`). Sauvegarde automatique, Annuler / Rétablir, hors ligne.
- **6 styles** : trap, drill, lo-fi, **phonk** (cloche 808 accordée, 808 saturée, charleys en triolets), **pop**,
  **boom bap** (swing, vinyle). Un morceau complet est prêt (6 sections, 4 motifs de batterie, accords, 808).
- **Au hasard** : style, tempo, tonalité, accords, batterie et mélodie tirés par une graine ; « Une autre idée »,
  « Revenir ». Ce sont des règles, pas de l'IA.
- **Beat** : bascule **Batterie | Mélodie**.
  - Batterie : pads 4×4 (fort, doux, vide), roulements, vue d'ensemble, tempo, swing, 3 suites d'accords, 808,
    « Une autre idée » / « Revenir », **« + Ton son »** (4 pads perso).
  - Mélodie : 8 pads de la gamme (octave −1/0/+1), 6 sons (piano, piano électrique, lead, pluck, cloche, nappe),
    « Enregistrer au clavier » (calé à la double-croche), grille simple, **Boucles OCKA** (6 motifs prêts, écrits sur
    les accords, à écouter avant de les poser), « Une autre idée ».
- **Structure** : sections (ajouter, dupliquer, déplacer, renommer, supprimer), paroles, **boucle** d'un son importé
  (1, 2, 4 ou 8 mesures, calée au tempo, alerte au-delà d'un demi-ton).
- **Voix** : calibrage du retard, décompte, prompteur, prises, préréglages Naturel / Rap / Chant, effets **Réverbe,
  Écho, Radio, Doubler**, et **autotune doux** (curseur Naturel ↔ Robot ; repli expliqué si la prise n'a pas assez de
  notes chantées ; l'export attend la correction).
- **Son** : volume, panoramique, muet, solo ; master Neutre / Chaud / Clair / Lo-fi ; **Colle** (compresseur doux en
  JS) ; bouton **A/B** au même volume perçu.
- **Exporter** :
  - **« Sortir sur Spotify »** : assistant Infos → Pochette → Vérifier, puis le **dossier ZIP** pour le distributeur :
    FLAC 16 bits (RouteNote) ou WAV 24 bits (DistroKid), pochette 3000 × 3000 (importée ou fabriquée, 4 modèles),
    paroles au format Musixmatch, fiche HTML + texte avec le guide pas à pas. Contrôles des règles de Spotify (titre,
    vrai nom dans les crédits, gros mots, ISRC, IA, durée, type single / EP / album). Date par défaut : dans 6 semaines
    (chez RouteNote, environ 3 à 5 semaines : 21 à 23 jours ouvrés de vérification, puis la livraison).
  - WAV 44,1 kHz 24 bits (−14 LUFS, ou −11 en « fort »), **M4A** 256 kb/s, **Pistes séparées** (WAV 32 bits flottants,
    avant le master), **Envoyer vers Arko**, **Exporter le projet** (`.ocka`).
- **Aide** : un « ? » dans l'en-tête de chaque écran (studio, accueil, choix du style, assistant de sortie) ouvre
  l'aide de l'écran ; « Tout le guide », FAQ, « À propos », 3 conseils au premier lancement. Liens : seulement les pages
  d'aide officielles (une seule liste : `src/ui/aide/liens.ts`, reprise par la fiche de sortie).
- **IA compositrice (facultative)**, avec la clé de l'utilisateur (Anthropic, OpenAI ou Gemini, gardée dans
  `ocka-cles`) : « Lance-moi un beat », « Continue mon idée », « Aide aux paroles ». Coût estimé et texte envoyé montrés
  avant l'envoi ; réponse filtrée (liste blanche puis normaliseur) ; refus d'imiter un artiste réel.
  - Déclaration pour le distributeur, pré-remplie : un morceau écrit par « Lance-moi un beat » → musique **« IA »**
    (et paroles « IA » s'il en a écrit) ; « Continue mon idée » → musique « aide » ; « Aide aux paroles » → paroles
    « aide ». Le niveau ne redescend jamais.

## Tests automatiques (tous verts le 5 novembre)
- TypeScript strict : **0 erreur**. Vitest : **49 fichiers, 453 tests**.
- Build : bundle principal **442,8 ko (149,9 ko gzip)** ; l'encodeur AAC et Mediabunny se chargent à la demande.
- E2E dans Chrome (vraie CSP) : **16 tests** (parcours, captures, mélodie, sortie Spotify, projet, M4A, pistes, aide,
  IA, autotune, sonie des styles, captures de la vague B).
- QA : **19 tests** (export, voix, autotune, master JS, mémoire, performance, reproductibilité, test nul, sécurité,
  dev). Détails : `tests/qa/RAPPORT-QA.md`.
- Sonie (ffmpeg) : tous les styles à **−14,0 LUFS** ; crête vraie de −1,3 à −4,4 dBTP. Mode « fort » : −11,1 LUFS.
- Export d'un morceau de 3 min : **10,1 s** sur PC. Mémoire : +2 Mo par export (avant : +100 Mo) ; un album de
  12 titres ne retient plus rien.
- Voix recalée à **6,2 ms** près (faux micro). Autotune : 3 min de voix en 3,1 s ; une voix fausse de 30 à 40 cents
  ressort à ±3 cents.
- Test nul contre la phase 1 : **−83 dB** (un vieux morceau sonne comme avant). Reproductibilité : −84,9 dB.
- Sécurité : la CSP n'ouvre que les 3 adresses des fournisseurs d'IA ; aucun appel réseau sans l'IA.
- En dev (`npx vite`) : plus d'erreur « Cycle detected » (corrigée à l'intégration).

## Ce qui reste à vérifier sur le Xiaomi
- Calibrage et retard réel de la voix (casque filaire), et le conseil Bluetooth.
- Fluidité des pads, du clavier de mélodie et de la grille au toucher ; lecture sans craquement avec la mélodie.
- Durée d'un export de 3 min et d'un dossier de sortie de plusieurs titres ; **mémoire** sur un album (sur PC : +2 Mo
  par export, à confirmer sur le téléphone) ; Wake Lock et mise en veille pendant l'export.
- Feuille de partage Android (« Envoyer vers Arko »), AAC natif (M4A), quotas et `persist()`, installation de la PWA.
- L'IA avec une **vraie clé** chez chacun des 3 fournisseurs (les tests utilisent une fausse réponse d'Anthropic).

## Ce qu'il faut écouter (au casque, puis sur des enceintes)
- Les 3 nouveaux kits (phonk, pop, boom bap), et surtout la **cloche 808 accordée du phonk** dans la mélodie
  (nouveau son, branché à l'intégration).
- Les 6 sons de mélodie ; le **« Piano »** par résonateurs : s'il ne convainc pas, on l'appelle « Piano doux ».
- Les Boucles OCKA et « Au hasard » sur plusieurs graines.
- Les effets de voix, l'**autotune sur une vraie voix chantée** (Naturel puis Robot), la Colle et le bouton A/B.
- Un vrai morceau exporté (WAV et FLAC du dossier de sortie).

## Décisions à valider par Romain
- Paroles écrites par « Lance-moi un beat » déclarées « IA » (comme la musique), pas « aide ».
- Le « ? » est dans l'en-tête de chaque écran : plus de bouton flottant.
- Le nom : une appli de musique « Oka » (MWM) existe déjà ; à vérifier avant de publier.

## Publier sur GitHub (sur le PC de Romain)
1. Copie le contenu de `ocka/app` dans `C:\dev\ocka` (sans `node_modules`, `dist`, `test-results` : le `.gitignore`
   les ignore de toute façon).
2. Dans `C:\dev\ocka` :
   ```
   npm ci
   npm run verif
   git init
   git add .
   git commit -m "OCKA : phases 0 à 6"
   git branch -M main
   git remote add origin https://github.com/arko-video/ocka.git
   git push -u origin main
   ```
   (Si le dépôt existe déjà : `git add .`, `git commit -m "OCKA : phases 2 à 6"`, `git push`.)
3. Sur GitHub : Settings → Pages → Source → **GitHub Actions**. Le fichier `.github/workflows/publier.yml` vérifie
   (types + tests) puis publie à chaque envoi sur `main`. Adresse : `https://arko-video.github.io/ocka/`.
4. Ouvre l'adresse sur le Xiaomi dans Chrome, puis menu ⋮ → « Ajouter à l'écran d'accueil ».

## Brancher le module Mon Hub
Quand OCKA est en ligne : suis `integration/mon-hub/LISEZ-MOI.md` dans `C:\dev\mon_hub` (copier `ecran_ocka.dart`
dans `lib/modules/ocka/`, puis 5 petits ajouts : catalogue, registre, village, design, pack Création), puis
`flutter analyze`, `flutter test`, et un essai sur le Xiaomi. Fais un point Git avant et après.

## Plus tard
- « Sons venus d'OCKA » dans Arko (facultatif).
- Partager la clé IA du collègue de Mon Hub avec OCKA (jamais de clé dans le code).
