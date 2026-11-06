# OCKA

**Fais tes beats, pose ta voix, sors tes morceaux sur Spotify. Gratuit, open source, sans compte.**

OCKA est un studio de musique pensé pour le téléphone (Chrome sur Android d'abord), qui s'installe comme une appli
(menu ⋮ de Chrome → « Ajouter à l'écran d'accueil ») et marche hors ligne.
Tout se passe sur ton appareil : tes prises de voix et tes morceaux ne sont jamais envoyés en ligne.

En ligne : <https://arko-video.github.io/ocka/> · Code : <https://github.com/arko-video/ocka>

## Ce que fait OCKA (v1 : phases 0 à 6)

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

## Nouveau dans la v2 (vague C1)

- **Des pistes d'instruments, autant qu'il en faut** (jusqu'à 16, en plus de la batterie, de la 808, des accords, des
  sons et de la voix). Beat → **Batterie | Instruments** : une carte par piste (muet, solo, volume, renommer,
  dupliquer, déplacer, supprimer avec Annuler) et **« + Piste »** pour choisir un instrument par famille, avec la
  recherche et l'écoute avant de choisir.
- **41 instruments enregistrés**, tous libres de droits (CC0) : pianos (à queue, droit, doux, bastringue, électrique
  FM), orgues, clavecin, guitares (nylon, électrique claire et saturée), ukulélé, basses, contrebasse, cordes (tenues,
  staccato, pizzicato, violon, violoncelles), vents et cuivres, marimba, vibraphone, xylophone, glockenspiel, kalimba,
  cloches, batteries (acoustique, balais, jazz) et percussions. Ils se téléchargent quand tu les choisis (environ
  0,2 à 1 Mo chacun), puis restent sur le téléphone pour marcher sans réseau : **« Gérer les instruments »** montre la
  place prise. Avant un export, OCKA télécharge ce qui manque ; sans réseau, il le dit clairement (jamais de piste
  muette). Les 6 sons de la v1 restent là, toujours jouables.
- **Piano roll** plein écran (toucher une piste) : poser, glisser, allonger, vélocité, quantification, copier/coller,
  **accords en un toucher** dans la tonalité du morceau, « Rester dans la gamme », et le mode **Simple** (les 8 pads).
- **Structure → Frise** : une ligne par piste, un clip par passage de section ; un motif joué dans plusieurs sections
  le dit, et **« Rendre unique »** en fait une copie pour une seule section.
- **Son → mélangeur** : une tranche par piste (muet/solo, volume, panoramique), **« Effets (n) »** (égaliseur, filtres,
  saturation, écho, chorus/flanger, compresseur, bitcrusher, envois de réverbe et d'écho ; 6 par piste, préréglages)
  et **« Pompe »** (sidechain calé sur le kick). Les **pistes séparées** sortent un fichier par piste.
- **Réglage « Avancé »** (Son → Réglages avancés, désactivé par défaut) : les réglages fins de chaque effet, et les
  couloirs d'**automation** (volume, panoramique, réglages d'effets, dessinés au doigt section par section) et de
  **LFO** dans la frise. Ce réglage est gardé avec tes autres réglages.
- Les morceaux de la v1 s'ouvrent sans changer de son (la mélodie devient une piste « Mélodie »).

Et partout : **Annuler / Rétablir**, sauvegarde automatique, et OCKA marche **hors ligne** une fois installé.

Tout reste sur ton appareil (stockage du navigateur). Pense à « Exporter le projet » de temps en temps : c'est ta copie.

## Nouveau dans la v2 (vague C2)

- **35 styles**, rangés en 5 familles sur l'écran du choix (avec la recherche, sans accents, et « Au hasard ») :
  - **Rap** : trap, drill, UK drill, lo-fi, boom bap, phonk, Memphis, plugg, cloud, rage, jersey club, afro trap,
    rap mélodique, jazz rap ;
  - **Électro** : house, techno, drum & bass, UK garage, synthwave, hyperpop ;
  - **Monde** : afrobeats, amapiano, reggaeton, reggae, bossa nova ;
  - **Pop, rock et jazz** : pop, R&B, K-pop, rock, pop-punk, funk, gospel, jazz ;
  - **Cinéma et ambiance** : orchestral, ambient.

  Chaque style a son tempo, son groove, son kit, sa 808 et ses instruments de départ (piano droit et contrebasse en
  jazz rap, guitare nylon en bossa nova, batterie enregistrée en rock, cordes et cuivres en orchestral…), parfois
  avec leurs effets (réverbe en cloud, compresseur sur la contrebasse du jazz rap). « Au hasard » change la tonalité
  et les accords : les instruments suivent.
- **Autotune avancé** (Voix → carte « Autotune » de la prise gardée) : préréglages **Naturel, Pop, Robot,
  Hyperpop**, la gamme détectée dans ta voix (ou celle du morceau, ou une autre), la vitesse de correction, la force,
  « Humaniser » et les formants. **« Corriger tout seul »** (sans réseau) ou **« Avec l'IA »** (seule la liste des
  notes part, jamais ta voix ; la déclaration « voix : aide de l'IA » est notée pour la sortie). En « Avancé »,
  **l'éditeur de notes** : la courbe de ta voix sur un piano roll, des blocs de notes à déplacer, couper, fusionner,
  avec justesse et vibrato. Ce que tu entends est ce qui est exporté.
- **Ta voix → instrument (« Chanter »)** : chante, la piste joue ta mélodie en direct (roue des 12 notes, gamme du
  morceau, accords en un geste), puis enregistre une section et la mélodie est posée en notes dans le piano roll.
  **Casque obligatoire** ; il y a 100 à 200 ms de retard en direct sur Android (plus en Bluetooth : OCKA prévient),
  mais l'enregistrement est recalé.
- **Beatbox** (Beat → Batterie) : apprends à OCKA tes sons (5 exemples de « boum », « ka », « ts »), puis fais le beat
  à la bouche : le kit joue en direct et tes frappes sont posées dans le motif de batterie.

## Nouveau dans la v2 (vague C3)

- **Piano roll malin** (Complet → Outils) : arpège, strum, humaniser, glissé, swing par piste, « riff machine »
  (graine, gamme, style, densité) et, en « Avancé », les **notes fantômes** des autres pistes en gris.
- **MIDI** : importer et exporter des `.mid`, jouer et enregistrer avec un **clavier MIDI** USB (Web MIDI : la note
  tient tant que la touche est enfoncée).
- **Sons** : découpe d'un son en tranches (aux attaques ou à parts égales) posées sur les pads, éditeur (couper,
  fondu, normaliser, inverser), étirement **WSOLA** (±20 %), détection du **BPM** (avec le double et la moitié) et de
  la tonalité ; **SoundFonts** `.sf2` (32 Mo au plus), gardées avec le projet exporté.
- **12 synthés fabriqués par le code** : 303 (accents, slides), chiptune NES, onde dessinée au doigt, supersaw,
  chœurs, log drum, cuivres en section, Rhodes, Wurlitzer, piano jouet, célesta, steel drum ; et « Fabriquer un
  son » : **kick** sur mesure et **bruitages** façon sfxr (pièce, laser, saut…). Les styles s'en servent : supersaw
  en rage et hyperpop, chœurs en gospel, log drum en amapiano, cuivres en funk, K-pop et orchestral, Rhodes en R&B et
  lo-fi, Wurlitzer en funk.
- **Performance** : effets de fin sur une section (bégaiement, demi-tempo, arrêt cassette, coupures, à l'envers),
  **looper** (« Jouer en direct », lancement à la mesure, « Enregistrer ce que je joue »), tap tempo, son et volume
  du métronome, historique d'Annuler, modèles de pistes, repères, raccourcis clavier.
- **Voix avancée** : punch-in, comping, nettoyeur (porte, réduction du souffle, désesseur), doublage, 6 chaînes de
  voix prêtes (dont « Grosse réverbe »), **morceau de référence** (A/B au même volume perçu) et **gel** d'une piste
  (badge « gelée » sur sa carte) pour soulager le téléphone.

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
                  # sonie des styles, piano roll, frise et mélangeur, morceau complet v2, choix du style,
                  # autotune avancé, Chanter et Beatbox (faux micro), session v2, captures, et C3 : outils de
                  # notes et MIDI, sons avancés, synthés, performance et looper, voix avancée
npx vite --port 5198 --strictPort   # (dans un autre terminal) serveur de dev, pour 4 scénarios QA
npx playwright test -c tests/qa/playwright.qa.config.ts   # relecture QA (voir tests/qa/RAPPORT-QA.md)
```

Les tests e2e et QA utilisent Google Chrome (`channel: 'chrome'`), ainsi que `ffmpeg`, `ffprobe` et `unzip`.

## Documents

- `docs/` : la passation (v1, vagues C1, C2 et C3 de la v2), les décisions de conception et les contrats des vagues.
- `CONTRIBUTING.md` : comment proposer une idée ou du code.
- `SECURITY.md` : ce qu'OCKA protège, et comment signaler une faille.
- `CREDITS.md` : les projets libres utilisés et leurs licences.

## Licence

OCKA est sous licence **MIT** (voir `LICENSE`). Les sons de base d'OCKA (batteries, basse, accords, mélodies, boucles)
sont **fabriqués par son code**, et les instruments enregistrés viennent uniquement de banques en **CC0** : tout est
dans le domaine public, un morceau fait avec OCKA t'appartient, tu peux le publier et le vendre. Voir `CREDITS.md`.
