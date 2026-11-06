# Passation — OCKA (studio de musique open source, façon BandLab)

Mise à jour : **6 novembre 2026**, après l'intégration de la **vague C3 de la v2** (voir « v2 : vague C3 » plus bas).
Les phases 0 à 6 et les vagues C1, C2 et C3 sont construites et testées automatiquement (types, tests unitaires, parcours dans
Chrome, relecture QA). Il reste à les essayer sur le Xiaomi et à les écouter pour de vrai.

## En une phrase
OCKA est une appli web gratuite et open source (licence MIT), qui s'installe comme une appli (PWA). Elle sert à faire
des beats, enregistrer sa voix et sortir des morceaux sur Spotify, depuis le téléphone. Il n'y a pas de compte. Rien
n'est envoyé en ligne, sauf si tu branches toi-même l'IA facultative avec ta clé.

## Où sont les choses
- **Code** : dossier `ocka/app`. C'est la **racine du dépôt** (README, `.github/`, `src/`, `tests/`). Sur le PC :
  `C:\dev\ocka`.
- **Conception** (copiée dans `docs/` du dépôt) : `decisions-phases-2-6.md` (l'emporte sur `phases-2-6.md`),
  `decisions-phases-0-1.md`, `brief-phases-0-1.md`, `contrat-vague-a.md`, et cette passation. v2 (dans
  `ocka/conception`) : `brief-v2.md`, `decisions-v2.md` (l'emporte), `contrat-v2-c1.md`, `-c2.md`, `-c3.md`,
  `c3-demandes-integration.md`.
- **Banque d'instruments** : `public/instruments/` (41 instruments CC0), outils `outils/instruments/` (`preparer.py`,
  `verifier.py`, recettes), code `src/instruments/`.
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

## Tests automatiques de la v1 (vague B, tous verts le 5 novembre)
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

## v2 : vague C1 (5 novembre 2026)

### Ce qui est fait
- **Pistes d'instruments** (jusqu'à 16) : Beat → Batterie | Instruments, une carte par piste (M/S, volume, menu),
  « + Piste » par familles avec recherche et écoute (même avant de créer la piste), « Gérer les instruments ».
- **41 instruments enregistrés CC0** (VCSL, VSCO-2-CE, FreePats, Karoryfer, Virtuosity), téléchargés à la demande
  depuis la même origine, rangés dans le Cache Storage `ocka-instruments`, jamais précachés. Avant un export, ce qui
  manque est téléchargé ; sans réseau : message clair, rien n'est exporté (jamais de piste muette).
- **Échantillonneur** (M1) : zones jouées avec `detune`, couches de vélocité, boucles, glissé, budget de 128 Mio.
- **Piano roll** plein écran (Simple | Complet, accords en un toucher, quantification, copier/coller, vélocité).
- **Frise** (clips par section, « Rendre unique »), **mélangeur** (tranches, « Effets (n) », « Pompe »), inserts
  (égaliseur, filtres, saturation, écho, chorus, compresseur, bitcrusher, envois), **automation** et **LFO** en
  « Avancé » (réglage gardé dans les réglages, plus dans localStorage), pistes séparées par piste.
- Les morceaux /2 s'ouvrent sans changer de son (test nul v2 : mix −83,6 dB, pistes ≤ −144 dB).

### Tests (tous verts)
- TypeScript : **0 erreur**. Vitest : **62 fichiers, 774 tests**. Build : bundle principal **586,9 ko (197,2 ko gzip)** ;
  précache : 26 fichiers, 2,6 Mo, **sans** les instruments (28 Mo copiés dans `dist/instruments`).
- E2E : **22 tests** (dont piano roll, frise et son, et le nouveau « morceau complet v2 » : 3 instruments de la banque,
  Saturation, Pompe, automation → −14,0 LUFS, −3,9 dBTP, pistes non vides ; hors ligne → erreur claire).
- QA : test nul v2 et phase 1, reproductibilité (−84,4 dB), sécurité (instruments depuis la même origine seulement),
  effets M2, performance (export 3 min en 12,7 s), mémoire (12 exports : +2,7 Mo/export ; album : +3 Mo ; inserts JS :
  +330 Mo pendant l'export, +9 à +18 Mo après). Détails : `tests/qa/RAPPORT-QA.md`.
- Banque : `verifier.py` 0 erreur, pire écart **3,8 cents** ; banc de l'échantillonneur : piano ±2,8, orgue ±0,3 cent.

### Corrigé à l'intégration
- Le signe de `cents` (tous les instruments jouaient faux de 2 fois leur écart : piano +6 à +14 cents).
- L'orgue électrique jouait une octave trop bas (jeu de 16').
- La banque n'était pas reliée à l'appli (le choix d'instrument ne montrait que les 6 sons d'OCKA), et le normaliseur
  ne connaissait pas ses instruments (un conseil « pas encore disponible » par piste).

### À écouter et à essayer sur le Xiaomi
- Chaque instrument au casque (timbre, attaques, boucles des sons tenus), l'orgue électrique (octave corrigée).
- Téléchargement d'un instrument en 4G, puis lecture et export en mode avion.
- Un export de 3 min avec compresseur ou bitcrusher sur plusieurs pistes (crête de +330 Mo sur PC).
- Le piano roll au doigt (pincer, glisser, poignée) et le dessin de l'automation.

### Ensuite
Vague C2 : voir la section suivante.

## v2 : vague C2 (5 novembre 2026)

### Ce qui est fait
- **35 styles en 5 familles** (Rap 14, Électro 6, Monde 5, Pop/rock/jazz 8, Cinéma 2) : écran du choix par familles,
  recherche sans accents, « Au hasard » (général ou dans une famille), écoute rapide de 4 mesures. Chaque style a
  son tempo, son groove, son kit `@1`, sa 808, ses 3 suites d'accords et ses instruments de départ (banque CC0 ou
  sons d'OCKA). Nouveau champ `tranche` des instruments de départ : réverbe en cloud, compresseur sur la contrebasse
  du jazz rap (les 33 autres styles n'ont aucun effet de départ : leur son ne bouge pas).
- **Autotune avancé** : préréglages Naturel / Pop / Robot / Hyperpop, gamme détectée (2 propositions, la tonalité du
  morceau départage), vitesse, force, humaniser, formants ; « Corriger tout seul » (préréglage du style) et « Avec
  l'IA » (notes seulement ; `infos.ia.voix` passe à « aide », un seul Annuler) ; éditeur de notes en « Avancé ».
- **Ta voix → instrument (Chanter)** : YIN dans un AudioWorklet, roue des 12 notes, accords, glissé, enregistrement
  d'une section posé en notes (recalé). **Beatbox** : entraînement (5 exemples par son, k-NN), kit en direct,
  frappes posées dans le motif de batterie.

### Tests
Voir `tests/qa/RAPPORT-QA.md` (section C2) pour les chiffres : TypeScript 0 erreur, Vitest, build, tous les e2e
(dont la nouvelle **session v2** : phonk + piano chanté au faux micro, prise de voix, autotune Pop, dossier de
sortie FLAC à −14 LUFS) et toute la QA (27/28 : seul l'ancien chemin « worklet » de l'export d'album, que l'appli
n'utilise plus, retient de nouveau +805 Mo dans Chrome ; le vrai chemin reste à +3 à +12 Mo).

### Corrigé à l'intégration
- « Au hasard » changeait la tonalité et les accords, mais les instruments de départ (guitare, piano, contrebasse…)
  restaient dans l'ancienne tonalité : ils sont réécrits (`reecrireNotesDeDepart`).
- Les durées des notes écrites par les styles n'étaient pas sur la grille du 1/24 de pas à la fin d'un motif (R&B,
  jazz : le normaliseur les réécrivait).
- 44 tests échouaient parce que la banque n'était pas déclarée au normaliseur dans Vitest (l'appli, elle, la déclare
  au démarrage : vérifié en dev).
- Le disque de la VM s'est rempli (12 Go de sorties d'e2e dans `/tmp/ocka-e2e`) : les tests du dubler restaient
  bloqués. À vider de temps en temps.

### À écouter et à essayer sur le Xiaomi
- **Les 29 nouveaux styles**, au casque : est-ce que chacun sonne comme son style (groove, kit, 808, instruments) ?
  Surtout tes priorités : rage, plugg, cloud (réverbe), Memphis, jazz rap (contrebasse compressée), UK drill.
  « Au hasard » plusieurs fois : les instruments doivent rester dans la tonalité.
- **Chanter, avec un casque filaire** : le retard en direct (100 à 200 ms attendus), la justesse de la roue, puis
  enregistrer une section : les notes posées doivent tomber au bon endroit. Essaie aussi en Bluetooth : OCKA doit
  prévenir.
- **Beatbox avec ta vraie bouche** : 5 « boum », « ka », « ts », puis un beat ; dis-moi combien de frappes sont bien
  reconnues (sur des sons de synthèse : 6/6 ; vise 85 à 95 %).
- **Autotune** sur ta vraie voix : Naturel, Pop, Robot, Hyperpop ; « Corriger tout seul » ; l'éditeur de notes au
  doigt (glisser une note, couper, fusionner) ; « Avant / Après ».
- Un morceau complet de bout en bout sur le téléphone, puis un dossier de sortie : mémoire et temps d'export.

### Ensuite
Vague C3 : voir la section suivante.

## v2 : vague C3 (6 novembre 2026)

### Ce qui est fait
- **Piano roll malin et MIDI (P)** : arpège, strum, humaniser, glissé, swing par piste, riff machine, quantification
  avec force ; en « Avancé », les **notes fantômes** des autres pistes (gris) dans l'aperçu ET dans la grille du piano
  roll. Fichiers `.mid` (import, export) ; **clavier MIDI** (Web MIDI) : jeu en direct (la note tient tant que la
  touche est enfoncée, relâchée au note-off, 30 s au plus), enregistrement calé.
- **Sons avancés et SoundFonts (S)** : découpe aux attaques ou à parts égales → pads, éditeur (couper, fondu,
  normaliser, inverser : un NOUVEAU son), WSOLA ±20 %, BPM (double, moitié), tonalité (2 choix) ; `.sf2` de 32 Mo au
  plus (analyse dans un Worker, zones lues par morceaux). Intégration : les SoundFonts partent dans le projet exporté
  (`soundfonts/sf2-<id>.sf2`, recopiées avec un id neuf à l'import) ; le ménage efface les `.sf2` qu'aucun morceau
  n'utilise ; les presets d'une SoundFont du morceau sont connus du normaliseur à l'ouverture (plus de conseil).
- **12 synthés et sons courts (L)** : 303 (mode « motif » : accents, slides), chiptune NES, onde dessinée, supersaw,
  chœurs, log drum, cuivres en section, Rhodes, Wurlitzer, piano jouet, célesta, steel drum ; kick maker et bruitages
  sfxr (« Muter » passe maintenant par `api-synthes.ts`). **Les styles s'en servent** (intégration) : supersaw en rage
  (lead) et hyperpop (une piste au lieu des deux leads écartés), chœurs en gospel, log drum en amapiano (la 808 qui
  l'imitait est coupée au départ), cuivres en funk, K-pop et orchestral, Rhodes en R&B et lo-fi (piste mélodie),
  Wurlitzer en funk. Empreinte du morceau neuf du lo-fi mise à jour volontairement (planning inchangé).
- **Performance, looper, confort (R)** : effets de fin par section (bégaiement, demi-tempo, arrêt cassette, coupures,
  à l'envers ; calculés hors ligne dans le Worker, mêmes échantillons à l'écoute et à l'export), entrée « Effets de
  fin » sur la carte de section ; looper (lancement à la mesure, « Enregistrer ce que je joue ») : pendant le looper,
  ni un gel prêt ni une modification ne rechargent le lecteur ; tap tempo, son ET volume du métronome
  (`volumeMetronome` dans l'API, volume dans la clé du clic), historique, modèles de pistes, repères, raccourcis.
- **Voix avancée, référence, gel (V)** : punch-in, comping, nettoyeur, doublage (mono), 6 chaînes de voix (« Grosse
  réverbe » ajoutée ; « Drill sombre »), référence A/B au même volume perçu (`creerEcouteReference(lecteur, id,
  { morceau, passage })`), gel d'une piste (badge « gelée » aussi sur la carte de la piste ; les effets de fin de la
  piste sont dans son rendu gelé).

### Fichiers
`src/midi/`, `src/ui/edition/outils-notes*.ts`, `src/ui/composants/outils-notes/` (P) ; `src/sons/`, `src/sf2/`,
`src/ui/composants/sons-avances/` (S) ; `src/moteur/synthese/synthes/` (un fichier par synthé), `src/ui/composants/synthe/`
(L) ; `src/moteur/{performance,effets-perf,looper,confort}.ts`, `src/moteur/perf/`, `src/ui/looper/` (R) ;
`src/enregistrement/voix-avancee*.ts` et voisins, `src/moteur/{reference,gel}.ts`, `src/ui/composants/voix-avancee/`
(V). Moteur commun des gels : `src/moteur/gels.ts`. Panneaux lourds chargés à la demande : `src/ui/paresseux.tsx`.

### Corrigé à l'intégration
- **Moteur** : une reprise de note au début d'une fenêtre de rendu tombait à −5e-16 s et Web Audio refusait
  (`Sources.jouer`) : heure bornée à 0 ; le contournement de R (« rendre depuis 0 ») est retiré.
- `rendrePistesSeparees` calculait TOUTES les pistes (gel lent) : les autres pistes sont maintenant muettes, sans
  inserts ni prises (`morceauPourRendu`, la logique du gel de V, dans l'outil commun).
- Les effets de fin d'une piste gelée en entier disparaissaient (le gel entier passait devant) : ils sont posés dans
  son rendu gelé.
- Demandes des 5 développeurs (`conception/c3-demandes-integration.md`) : toutes traitées (liste plus haut), plus :
  `PcmSon` exporté par `api.ts` ; data-testid `*-bientot` devenus `*-intro` (`synthe-sans-reglages` pour un son sans
  réglages), `contrat-c3.spec.ts` mis à jour (et vérifie l'entrée « Effets de fin » de la carte de section) ;
  textes « bientôt » morts retirés ; seuil QA des gels honnête (voir Tests).
- Bundle : 13 panneaux (outils, MIDI, éditeur de son, synthé, sons courts, looper, effets de fin, voix avancée,
  référence, Chanter, Beatbox, éditeur d'autotune, aide) chargés à la première ouverture.

### Tests
- TypeScript : **0 erreur**. Vitest : **91 fichiers, 1 172 tests verts**. Aucun fichier à 300 lignes ou plus.
- Build : JS chargé au démarrage **907 ko (303 ko gzip)** (avant l'intégration : 986 ko d'un bloc ; C2 : 772 ko),
  13 panneaux à la demande. Précache : 59 fichiers, 3,2 Mo, sans instrument.
- E2E : **47/47** (dont le contrat C3 mis à jour et les parcours de P, S, L, R, V). QA : **32/32** (test nul v2
  −83,5 dB ; reproductibilité −88,6 dB ; export de 3 min en 11,7 s ; mémoire : 12 FLAC sans hausse, album +15 Mo
  après, inserts +9 à +41 Mo après ; sécurité : 0 requête sortante). Détails : `tests/qa/RAPPORT-QA.md`.
- **Seuil des gels** : le plancher de Chrome (deux exports identiques qui diffèrent quand même) a été mesuré de
  −76,8 à −84 dB selon la charge de la machine ; un seuil fixe de −80 dB échouait donc sur le plancher lui-même. Règle
  retenue : un export avec gels doit rester à 6 dB au plus du plancher mesuré dans le même test, et jamais au-dessus
  de −75 dB (inaudible). Mesuré : −77,8 à −83,7 dB.
- **Écart connu** : une basse gelée SEULE (master compris) diffère de −70,3 dB de la basse normale, quelques ms au
  début de certaines notes de 808, alors que son rendu gelé est identique au bit près à sa piste séparée. Inaudible ;
  la cause (dans le mélange du bus) n'est pas trouvée ; le mix complet reste au plancher.
- Les synthés C3 des styles sonnent tous (rendu de chaque piste dans Chrome : −21,8 à −32,4 dB RMS).

### Reporté (et pourquoi)
- **Doublage gauche/droite** : la prise est mono, le doublage reste mono (la largeur stéréo reste `effets.doubler`).
  Une prise stéréo demande un champ dans le format (`Prise.voix?`) : à décider pour un format `/4`.
- **Bundle principal** : 986 → 907 ko au démarrage (13 panneaux à la demande, ~110 ko). Le gros du reste est le moteur, relié statiquement par `api.ts` (`relier`) :
  le découper (MIDI, SoundFonts, IA, sortie à la demande) demande de rendre ces API asynchrones : plus tard.
- BPM et attaques (0,5 à 0,9 s) et import d'un MIDI de 96 000 notes (1,1 s) sur le fil principal : acceptable.
- Chœurs et cuivres : ≈ 130 ms par note dans le Worker (préparés avant la lecture, jamais pendant).

### À écouter et à essayer sur le Xiaomi
- **À écouter au casque** (panneau Synthé d'une piste, puis ses préréglages) : la **303 « Squelch »**, le
  **supersaw « Rage »**, les **chœurs « Gospel « ah » »**, le **log drum « Amapiano »**, le **Rhodes « Lo-fi »** ;
  dans « Fabriquer un son » : le **kick « Phonk saturé »** et les bruitages **« Pièce »** et **« Laser »**. Puis les
  styles qui s'en servent maintenant (réglages par défaut du synthé) : rage, hyperpop, gospel, amapiano, funk
  (cuivres + Wurlitzer), K-pop et orchestral (cuivres), R&B et lo-fi (Rhodes).
- Un **clavier MIDI USB** sur le Xiaomi (OTG) : notes tenues, enregistrement calé.
- Une **SoundFont** à toi (≤ 32 Mo) : presets, mémoire, puis « Exporter le projet » et réimport.
- Le **looper** au doigt, les effets de fin, le gel d'une piste sur un gros morceau (le téléphone respire ?).
- Punch-in et comping sur une vraie voix ; la référence A/B avec un morceau du commerce.

### Ensuite
Retours de Romain sur ces écoutes, puis la publication (GitHub Pages) et le module Mon Hub.


## Brancher le module Mon Hub
Quand OCKA est en ligne : suis `integration/mon-hub/LISEZ-MOI.md` dans `C:\dev\mon_hub` (copier `ecran_ocka.dart`
dans `lib/modules/ocka/`, puis 5 petits ajouts : catalogue, registre, village, design, pack Création), puis
`flutter analyze`, `flutter test`, et un essai sur le Xiaomi. Fais un point Git avant et après.

## Plus tard
- « Sons venus d'OCKA » dans Arko (facultatif).
- Partager la clé IA du collègue de Mon Hub avec OCKA (jamais de clé dans le code).
