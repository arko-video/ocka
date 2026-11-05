# OCKA

**Fais tes beats, pose ta voix, sors tes morceaux sur Spotify. Gratuit, open source, sans compte.**

OCKA est un studio de musique pensé pour le téléphone (Chrome sur Android d'abord), qui s'installe comme une appli
(menu ⋮ de Chrome → « Ajouter à l'écran d'accueil ») et marche hors ligne.
Tout se passe sur ton appareil : tes prises de voix et tes morceaux ne sont jamais envoyés en ligne.

En ligne : <https://arko-video.github.io/ocka/> · Code : <https://github.com/arko-video/ocka>

## Ce que fait OCKA (phases 0 à 6)

1. **Choisis un style** : trap, drill, lo-fi, **phonk** (cloche 808 accordée), **pop** ou **boom bap**. Un morceau
   complet est prêt (intro, couplets, refrains, outro), avec son kit de batterie, sa 808 et ses accords. **« Au hasard »** tire le style, le tempo, la tonalité, les accords, la batterie et une
   mélodie (sans IA ni réseau : ce sont des règles).
2. **Beat**, avec la bascule **Batterie | Mélodie** :
   - Batterie : pads au pouce (fort, doux, vide), roulements de charley, tempo, swing, 3 suites d'accords, basse 808, et
     **« + Ton son »** (4 pads perso avec tes propres sons : WAV, MP3, M4A ou OGG).
   - Mélodie : **8 pads de la gamme** (jamais de fausse note, octave −1 / 0 / +1), 6 sons (piano, piano électrique, lead,
     pluck, cloche, nappe), **« Enregistrer au clavier »** (calé à la double-croche) et une **grille** simple.
   - **« Une autre idée »** (batterie et mélodie) tire une variation du motif en cours ; « Revenir » rend l'idée d'avant.
   - **« Boucles OCKA »** : des motifs de mélodie prêts (arpège, contre-chant, nappe…), fabriqués à partir des accords
     du morceau, donc toujours dans la bonne tonalité.
3. **Structure** : ajoute, duplique, déplace tes sections ; écris tes paroles ; mets **une boucle** de tes sons sur une
   section (1, 2, 4 ou 8 mesures, calée au tempo).
4. **Voix** : calibrage du retard du téléphone, décompte, prompteur, plusieurs prises, des **effets** (Réverbe, Écho,
   Radio, Doubler) et un **autotune doux** : chaque prise est recalée sur les notes de la gamme du morceau, hors temps
   réel, sans changer sa longueur. Si la prise n'a pas assez de notes chantées, OCKA ne la touche pas et le dit.
5. **Son** : volume, panoramique, muet, solo, couleur du master, **Colle** (compresseur doux du master) et le bouton
   **A/B** pour comparer avec et sans mastering, au même volume.
6. **Exporter** :
   - **« Sortir sur Spotify »** : un assistant en 3 écrans (Infos → Pochette → Vérifier) prépare le **dossier complet**
     pour ton distributeur (RouteNote, DistroKid…) : titres en **FLAC 16 bits** (ou WAV 24 bits), **pochette**
     3000 × 3000 (importée ou fabriquée), **paroles** au format Musixmatch et une **fiche** à recopier, avec le guide pas
     à pas. Il vérifie les règles de Spotify (titre, crédits avec ton vrai nom, gros mots, IA, durée…).
   - Et aussi : WAV 44,1 kHz 24 bits (−14 LUFS, crête vraie ≤ −1 dBTP), **M4A** pour écouter, **Pistes séparées**
     (un WAV 32 bits flottants par instrument), **Envoyer vers Arko** (pour la vidéo TikTok) et **Exporter le projet**
     (`.ocka`, à réimporter sur un autre appareil, par exemple pour finir sur PC).
7. **Accueil** : onglets **Morceaux | Sorties** (single, EP ou album), et « Importer un projet ».
8. **Aide dans l'appli** : le bouton **« ? »** ouvre l'aide de l'écran en cours, et « Tout le guide » mène au reste :
   ton premier morceau en 10 minutes, enregistrer ta voix proprement, sortir sur Spotify pas à pas, tes droits, finir
   sur PC, installer OCKA, une FAQ et « À propos ». Les liens mènent seulement aux pages d'aide officielles
   (RouteNote, DistroKid, Spotify for Artists, Musixmatch). Au premier lancement, 3 conseils s'affichent une fois.
9. **IA compositrice (facultative)**, avec **ta propre clé** (Anthropic, OpenAI ou Gemini) :
   - **« Lance-moi un beat »** : une phrase → un morceau complet ;
   - **« Continue mon idée »** : ajoute une section ou une variation (une seule étape d'Annuler) ;
   - **« Aide aux paroles »** : des propositions de lignes, avec les rimes et les syllabes ; tu choisis, puis tu modifies.

   Sans clé, rien ne change : l'IA est éteinte par défaut. Le coût estimé et le texte exact envoyé sont montrés avant
   l'envoi. L'IA ne reçoit jamais ta voix ni tes sons et refuse d'imiter un artiste réel. Son usage est noté pour la
   déclaration chez ton distributeur : un morceau écrit par « Lance-moi un beat » est déclaré **musique « IA »** ;
   « Continue mon idée » et « Aide aux paroles » sont déclarés **« aide de l'IA »**. Les styles, « Au hasard » et les
   Boucles OCKA ne sont pas de l'IA : ce sont des règles.

Et partout : **Annuler / Rétablir**, sauvegarde automatique, et OCKA marche **hors ligne** une fois installé.

Tout reste sur ton appareil (stockage du navigateur). Pense à « Exporter le projet » de temps en temps : c'est ta copie.

## Mon Hub

OCKA existe aussi comme module de l'appli Mon Hub : voir `integration/mon-hub/LISEZ-MOI.md`.

## Lancer OCKA sur ton ordinateur

Il faut [Node.js](https://nodejs.org) 22 ou plus récent.

```bash
npm install
npm run dev
```

## Vérifier que tout marche

```bash
npm run verif     # types + tests rapides
npm run e2e       # parcours dans Chrome : mélodie, sortie Spotify, projet, M4A, pistes, aide, IA, autotune,
                  # sonie des styles, captures
npx vite --port 5198 --strictPort   # (dans un autre terminal) serveur de dev, pour 4 scénarios QA
npx playwright test -c tests/qa/playwright.qa.config.ts   # relecture QA (voir tests/qa/RAPPORT-QA.md)
```

Les tests e2e et QA utilisent Google Chrome (`channel: 'chrome'`), ainsi que `ffmpeg`, `ffprobe` et `unzip`.

## Documents

- `docs/` : la passation et les décisions de conception (phases 0 à 6).
- `CONTRIBUTING.md` : comment proposer une idée ou du code.
- `SECURITY.md` : ce qu'OCKA protège, et comment signaler une faille.
- `CREDITS.md` : les projets libres utilisés et leurs licences.

## Licence

OCKA est sous licence **MIT** (voir `LICENSE`). Tous les sons d'OCKA (batteries, basse, accords, mélodies, boucles) sont
**fabriqués par son code** et sont dans le domaine public (CC0) : un morceau fait avec OCKA t'appartient, tu peux le
publier et le vendre. Voir `CREDITS.md`.
