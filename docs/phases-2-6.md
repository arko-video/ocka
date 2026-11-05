# OCKA — Brief des phases 2 à 6 (proposition à relire par l'équipe)

4 novembre 2026. Base : phases 0 et 1 livrées et testées (`decisions-phases-0-1.md`, `src/morceau/types.ts`, `src/moteur/api.ts`).
Romain a dit « fait toutes les phases ». Il est souvent en cours : chaque question ouverte est tranchée ici, puis notée dans la passation.
**Priorité de Romain : sortir des morceaux et des ALBUMS sur Spotify.** Tout ce qui sert cette priorité passe avant le reste.

## Principes communs (inchangés)
- Le format `ocka.morceau/1` reste la seule source de vérité. On n'ajoute que des **champs facultatifs** : un vieux morceau s'ouvre toujours, et le normaliseur complète ce qui manque.
- **Un seul chemin de son** : `construireGraphe` sert à l'écoute et à l'export. Tout nouveau son (mélodie, sons importés, effets de voix) passe par lui.
- **Rien n'est envoyé en ligne**, sauf l'appel à l'IA avec la clé de l'utilisateur, après son geste (phase 6).
- Tout est en français, au pouce, sur Chrome Android d'abord. Les fichiers font moins de 300 lignes.
- Tout son fourni par OCKA est **fabriqué par notre code** (CC0) : un morceau fait avec OCKA appartient à son auteur.
- Le budget d'usage de Romain est limité : on livre **phase par phase** (zip + lien de test), pour qu'un arrêt en route laisse toujours une version qui marche.

## Ordre de livraison
1. **Vague A = phases 2 et 3** : albums et dossier de sortie, transfert téléphone ↔ PC, mélodie (synthés, piano, clavier, piano roll), sons importés, effets de voix, M4A, pistes séparées, envoi vers Arko.
2. **Vague B = phases 4, 5 et 6** : 3 styles de plus, boucles fabriquées par OCKA, « Idée au hasard », aide dans l'appli, module Mon Hub, IA compositrice.

---

## Phase 2 — Instruments, mélodie, albums

### 2.1 Mélodie (nouvelle piste `melodie`)
- **Format** :
  - `MotifMelodie { type: 'melodie'; pas; notes: { pas; duree; midi; vel? }[]; son: SonMelodie }`
  - `SonMelodie = 'piano' | 'lead' | 'pluck' | 'nappe' | 'cloche' | 'basseSynth'`
  - Les notes sont en MIDI absolu (le piano roll est chromatique). Le motif dure 1 à 4 mesures (16 à 64 pas).
  - `Section.motifs.melodie?` pointe vers ce motif. La piste `melodie` s'ajoute à `pistes` (le normaliseur l'ajoute aux vieux morceaux).
- **Sons fabriqués par OCKA**, en JS, mis en cache par note dans la `Banque`, à `ctx.sampleRate` (comme les accords) :
  - `piano` : piano synthétisé (modes inharmoniques, marteau, décroissance qui dépend de la hauteur). Pas d'échantillons Salamander (la licence CC BY oblige à citer l'auteur dans chaque sortie).
  - `lead` : 2 scies désaccordées + filtre passe-bas avec enveloppe.
  - `pluck` : Karplus-Strong.
  - `nappe` et `cloche` : on réutilise ceux des accords.
  - `basseSynth` : basse « reese » pour la drill et la pop.
- **Étape « Mélodie »** entre Beat et Structure. Le studio passe à 6 étapes : Beat → Mélodie → Structure → Voix → Son → Exporter.
  - **Piano roll** :
    - le motif de la section choisie, 1 à 4 mesures, défilement horizontal
    - par défaut, il n'affiche **que les notes de la gamme** (on ne peut pas faire de fausse note) ; un interrupteur « Toutes les notes » montre les 12 notes
    - toucher une case vide pose une note de 1 pas ; toucher une note l'efface ; un appui long puis un glissé l'allonge ; on la déplace en la faisant glisser
    - les cases font au moins 40 px de haut
  - **Clavier à l'écran** : 2 octaves de touches d'au moins 44 px, avec un choix d'octave. Les notes de la gamme sont mises en couleur, et le mode « gamme seulement » cache les autres.
  - **« Enregistrer au clavier »** : décompte d'une mesure, on joue sur le beat en boucle, puis les notes sont **calées à la double-croche** et posées dans le motif. La latence de sortie est retirée du temps des touches.
  - Le choix du son se fait par des pastilles (Piano, Lead, Pluck, Nappe, Cloche, Basse synthé).
  - On garde Annuler / Rétablir.

### 2.2 Sons importés (« Tes sons »)
- **Format** : `Morceau.sons?: SonImporte[]`, avec `SonImporte { id; nom; fichier (clé OPFS); frequence; duree; canaux: 1 | 2 }`.
- **Import** :
  - depuis un fichier (WAV, MP3, M4A, OGG), décodé par `decodeAudioData`, puis écrit en PCM dans OPFS (comme les prises)
  - limite de 60 s par son et de 16 sons par morceau
  - **rappel court** : « N'importe que des sons que tu as le droit d'utiliser (les tiens, ou libres de droits). Un extrait de chanson peut faire refuser ton morceau sur Spotify. »
- **Deux usages** :
  1. **Pad** : un son importé devient un instrument de batterie `perso1` à `perso4`, joué sur la grille comme le kick.
  2. **Boucle** : `Section.boucle?: { son: string; mesures: 1 | 2 | 4 | 8; caler: boolean }`. La boucle repart au début de la section et tous les N mesures. `caler` règle la vitesse de lecture pour que la boucle dure exactement N mesures (ça change un peu la hauteur, comme un sampler).
- Ces sons sont copiés avec le morceau (Dupliquer), comptés par le ramasse-miettes et exportés avec le projet.

### 2.3 Albums et dossier de sortie (LE CŒUR DE LA PRIORITÉ SPOTIFY)
- **Format** `ocka.album/1`, stocké dans IndexedDB :
  ```
  Album {
    format; id; titre; artiste; annee; genre; label?; titres: string[] (ids des morceaux, dans l'ordre);
    pochette?: string (clé du Blob JPEG 3000×3000); langue: 'fr' | 'en' | …;
    modifieLe
  }
  ```
- **Infos par titre**, dans le morceau :
  `Morceau.infos?: { explicite?: boolean; featuring?: string; auteurs?: string; compositeurs?: string; producteur?: string; isrc?: string; ia?: 'aucune' | 'partielle' | 'totale' }`
  - L'ISRC et l'UPC restent vides par défaut : c'est le distributeur qui les donne.
- **Accueil** : deux onglets, « Morceaux » et « Albums ».
  - **Nouvel album** : titre et artiste, puis on ajoute des morceaux.
  - **Écran Album** :
    - la pochette
    - les infos
    - la liste des titres : flèches haut/bas, Retirer, toucher pour ouvrir le morceau
    - le type de sortie calculé : **single** (1 à 3 titres, chacun < 10 min), **EP** (4 à 6 titres, moins de 30 min au total), sinon **album**
- **Pochette** :
  - **Importer une image** : recadrage carré au doigt (glisser, pincer), puis sortie **3000 × 3000 en JPEG sRGB** (qualité 0,92) par un canevas.
  - **« Fabriquer une pochette »** (sans image) : 8 modèles dessinés par le code (dégradés, formes, grain), avec le titre et l'artiste dans nos polices. Les couleurs viennent d'un tirage avec une graine. Bouton « Autre ».
  - **Contrôles affichés** : carré, au moins 640 px (on sort toujours 3000), aucune adresse web ni pseudo de réseau social dans le texte, le texte doit correspondre au titre et à l'artiste.
- **« Prêt pour Spotify ? »** : une liste de contrôle avant le dossier de sortie. Chaque ligne a un bouton « Corriger ».
  - titre et artiste remplis
  - pochette présente
  - chaque titre fait au moins 30 s et n'est pas vide
  - « explicite » répondu pour chaque titre
  - aide de l'IA déclarée
  - paroles présentes (conseillé, pas obligatoire)
  - aucun titre en double
- **Dossier de sortie** = un fichier ZIP `Artiste - Album (sortie).zip` :
  - `01 - Titre.wav` … : WAV 44,1 kHz 24 bits (ou 16 bits), tous au même niveau (master de chaque morceau, standard ou fort)
  - `pochette.jpg` (3000 × 3000)
  - `paroles/01 - Titre.txt`
  - `fiche-de-sortie.txt` et `fiche-de-sortie.html` : tout ce qu'il faut recopier chez le distributeur (titres, ordre, durées, explicite, crédits, langue, genre, année, aide de l'IA, ISRC vides), avec les étapes à suivre pour RouteNote
- **ZIP fait main** :
  - méthode « stocké » (le WAV ne se compresse pas), CRC32 calculé au fil de l'eau
  - écrit **en flux dans OPFS** : jamais tout l'album en mémoire, car 12 titres font environ 570 Mo
  - pas de ZIP64 : on refuse au-delà de 3,9 Go, avec un message
  - progression par titre et bouton Annuler
- **Téléchargement** : on donne le `File` OPFS, comme pour l'export d'un titre.

### 2.4 Projets : finir sur PC (décision « oui » de Romain)
- **« Exporter le projet »** : `Titre.ocka`, un ZIP qui contient `morceau.json`, les prises en WAV 32 bits flottants et les sons importés.
- **« Exporter l'album »** : `Album.ocka-album`, un ZIP qui contient `album.json`, la pochette et chaque projet `.ocka`.
- **« Importer »** dans « Mes morceaux » : on lit le ZIP, on **normalise** le JSON (jamais de confiance aveugle), on recopie les fichiers dans OPFS avec de nouvelles clés, et on donne de nouveaux ids pour ne rien écraser.
- On passe par un fichier (Drive, câble, mail) : aucun serveur.

---

## Phase 3 — Effets et mastering

### 3.1 Effets de voix (par piste voix, au-dessus du préréglage)
`Piste.effets?: { reverbe?: number; echo?: number; radio?: boolean; doubler?: boolean; autotune?: number }` (niveaux de 0 à 1).
- **Réverbe** : niveau d'envoi vers la réverbe existante (le préréglage donne la valeur de départ).
- **Écho** : DelayNode calé sur le tempo (croche pointée), avec retour 0,35 et passe-bas 4 kHz sur le retour.
- **Voix radio** : passe-bande 300 Hz à 3,4 kHz + légère saturation.
- **Doubler** : 2 copies décalées de 12 et 19 ms, légèrement désaccordées par un retard modulé, à gauche et à droite.
- **Autotune doux** :
  - traité **hors temps réel**, dans un Worker, sur le PCM de chaque prise : détection de hauteur YIN (fenêtres de 40 ms, pas de 10 ms), note visée = la note **de la gamme du morceau** la plus proche, correction par PSOLA
  - `autotune` règle la force et la vitesse : 0,3 = naturel, 1 = effet robot
  - le PCM corrigé est mis en cache par (prise, force, tonalité). L'écoute et l'export jouent **le même PCM corrigé** : on garde un seul chemin de son
  - pendant le calcul, on joue la prise brute avec un petit badge « Autotune en préparation… »

### 3.2 Mastering
- Les 4 couleurs existent : neutre, chaud, clair, lo-fi. On ajoute une **« colle »** de bus (compresseur doux 2:1, attaque 30 ms) réglée par le préréglage, et une **largeur stéréo** (mid/side) douce pour « clair ».
- **Bouton A/B** dans Son : on écoute le master avec ou sans la couleur et la colle, au même volume perçu (gain compensé).
- Le niveau standard (−14) ou fort (−11) reste comme avant.

### 3.3 Autres sorties
- **M4A** (AAC 256 kb/s, Mediabunny et `@mediabunny/aac-encoder`, déjà dans le projet) : « Pour écouter et partager ». Même master que le WAV.
- **Pistes séparées** (stems) : un ZIP qui contient un WAV par piste (batterie, basse, accords, mélodie, sons, voix).
  - Ces WAV ne passent **ni par le limiteur ni par le réglage de sonie**, et ont tous le même gain : posés ensemble, ils redonnent le mix.
  - Ils servent à faire mixer le morceau ailleurs, ou à le donner à un ami.
- **« Envoyer vers Arko »** :
  - si `navigator.canShare({ files })`, on partage le M4A avec la feuille de partage d'Android
  - sinon, on le télécharge et on dit : « Dans Arko : Son guide → Importer »
  - **Bonus si Arko et OCKA sont sur la même origine** (`arko-video.github.io`) : OCKA dépose le M4A dans une boîte IndexedDB partagée `arko-ocka-boite`, et Arko affiche « Sons venus d'OCKA » dans son panneau Son guide. C'est un petit ajout dans Arko, fait dans un second temps et facultatif.

---

## Phase 4 — Aller vite
- **3 styles de plus**, chacun avec un kit `@1` fabriqué par OCKA, 4 motifs de batterie, 3 suites d'accords et une basse :
  - **phonk** (135 BPM) : cowbell mélodique, 808 très saturée, charley en triolets
  - **pop** (110 BPM) : batterie franche, clap sur 2 et 4, accords en piano
  - **boom bap** (90 BPM) : swing 0,2, kick et caisse claire « poussiéreux », samples de jazz imités par les accords en piano électrique avec bruit de vinyle
- **Boucles OCKA** : une bibliothèque de **motifs de mélodie prêts**, environ 6 par style (arpège, contre-chant, mélodie de refrain, nappe…). Elle est générée par des règles à partir des accords du morceau, donc toujours dans la bonne tonalité. On l'ouvre depuis l'étape Mélodie : « Boucles OCKA » → écouter → « Utiliser ».
- **« Idée au hasard »** (sans IA ni réseau) :
  - dans le choix du style : « Au hasard » tire le style, puis le tempo dans la plage du style, la tonalité, la suite d'accords, la variation de batterie et une mélodie
  - dans Beat et Mélodie : « Une autre idée » tire une variation du motif en cours
  - la graine est gardée : « Revenir » rend l'idée d'avant, en plus d'Annuler

## Phase 5 — Public, aide et Mon Hub
- **Aide dans l'appli**, ouverte par un bouton « ? » dans l'en-tête :
  - « Faire ton premier morceau en 10 minutes »
  - « Enregistrer ta voix proprement » (casque filaire, pièce calme, distance du micro)
  - « Sortir ton album sur Spotify » : choisir un distributeur (RouteNote Free pour commencer), envoyer le dossier de sortie, délais (prévoir 2 à 4 semaines avant la date), déclarer l'aide de l'IA
  - « Tes droits » : les sons d'OCKA sont CC0, et ce que tu importes est sous ta responsabilité
  - FAQ
- **À propos** : licence MIT, crédits, lien vers le code.
- Les docs publiques (README, CONTRIBUTING, CREDITS) sont mises à jour.
- **Module Mon Hub** (comme Arko), dans `C:\dev\mon_hub` :
  - `lib/modules/ocka/ecran_ocka.dart`, qui ouvre `https://arko-video.github.io/ocka/` dans le navigateur intégré
  - entrée dans le catalogue (« OCKA », catégorie Création, icône `Icons.graphic_eq`)
  - `registre.dart`, nom de bâtiment « Le Studio son » dans `village.dart`, teinte violette, pack Création
  - Romain lance `flutter analyze` et `flutter test`

## Phase 6 — IA compositrice (facultative, clé de l'utilisateur)
- On reprend d'Arko : fournisseurs **Anthropic, OpenAI, Gemini**, clé gardée dans IndexedDB, **sans IA par défaut**.
  - La CSP `connect-src` ajoute seulement ces 3 domaines.
  - Modèles par défaut : `claude-haiku-5-5`, `gpt-6-luna`, `gemini-3.5-flash-lite`.
- **Ce que l'IA écrit** : seulement un JSON compact (notes et degrés, jamais de son), environ 1 000 à 3 000 tokens.
  - Le schéma est un sous-ensemble d'`ocka.morceau/1` : style, tempo, tonalité, accords, batterie, basse, mélodies, sections, paroles.
  - Le JSON passe **toujours par le normaliseur**. Une réponse mal formée → message clair, et rien n'est changé.
- **Trois actions** :
  1. **« Lance-moi un beat »** : une phrase (« phonk sombre pour un clip de clutch, 140 ») → un nouveau morceau complet.
  2. **« Continue mon idée »** : on ajoute à un morceau ouvert une section (refrain, pont) ou une variation. C'est une seule étape d'Annuler.
  3. **« Aide aux paroles »** :
     - pour une section : un thème + le nombre de mesures → des propositions de lignes avec des rimes, et le nombre de syllabes par mesure
     - Romain choisit, puis modifie
     - en français par défaut
- **Garde-fous** :
  - la consigne refuse d'imiter un artiste réel (voix, nom, paroles connues)
  - aucune donnée n'est envoyée sans geste
  - le coût approximatif est affiché avant l'envoi
  - `infos.ia` passe à « partielle » quand l'IA a servi sur un morceau, pour aider à la déclaration chez le distributeur

---

## Contrat (à figer après la relecture)
- `types.ts` : `MotifMelodie`, `SonMelodie`, `SonImporte`, `Section.boucle`, `Section.motifs.melodie`, `IdPiste` + `'melodie' | 'sons'`, `InstrumentBatterie` + `'perso1'…'perso4'`, `Piste.effets`, `Morceau.sons`, `Morceau.infos`, `Style` + `'phonk' | 'pop' | 'boombap'`, `Album`.
- `api.ts` :
  - **Albums** : `listerAlbums`, `ouvrirAlbum`, `sauverAlbum`, `supprimerAlbum`, `preparerPochette(image, recadrage)`, `fabriquerPochette(modele, titre, artiste, graine)`, `verifierSortie(album)`, `exporterDossierSortie(album, options)`
  - **Projets** : `exporterProjet`, `exporterAlbumProjet`, `importerProjet`
  - **Sons** : `importerSon`, `supprimerSon`, `entendreNote`
  - **Sorties** : `exporterM4a`, `exporterPistes`, `envoyerVersArko`
  - **Voix** : `preparerAutotune`
  - **Aller vite** : `boucles(style, morceau)`, `ideeAuHasard(style?, graine)`, `varierMelodie`
  - **IA** : `ia.*`

## Tests (critère de fin de chaque vague)
- **Vitest** :
  - ZIP (lecture par un vrai décodeur : `unzip -t` dans un test e2e, et un mini-lecteur en test unitaire)
  - pochette (taille 3000, JPEG)
  - liste de contrôle
  - type de sortie (single / EP / album)
  - planning de la mélodie
  - calage du clavier
  - boucle calée au tempo
  - autotune (sinus qui glisse → notes de la gamme à ±15 cents)
  - écho calé sur le tempo
  - stems qui redonnent le mix (somme ≈ mix avant master, à −50 dB près)
  - normaliseur (vieux morceaux et projets importés malformés)
  - schéma de l'IA (réponses fausses)
- **E2E Chrome** :
  - mélodie posée au piano roll → export → énergie dans la bande de la mélodie
  - album de 2 titres courts + pochette fabriquée → « Prêt pour Spotify » → dossier ZIP : `unzip -t` OK, WAV 24 bits, `pochette.jpg` 3000×3000, fiche présente
  - projet `.ocka` exporté puis réimporté : identique, prises comprises
  - M4A lu par ffprobe (AAC, 44,1 kHz, stéréo)
  - IA simulée (routes interceptées) → morceau créé
  - styles phonk, pop et boom bap à −14 ± 0,5 LUFS
- **QA** : les 13 scénarios existants restent verts, plus des scénarios sur la mémoire (album de 12 titres sur un téléphone de 4 Go) et sur la CSP.
