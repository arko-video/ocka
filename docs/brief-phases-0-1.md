# OCKA — Brief des phases 0 et 1 (à relire par l'équipe)

4 novembre 2026. C'est le plan du doc « Plan — studio de musique open source (façon BandLab) », avec les réponses de Romain :
- Nom : **OCKA**.
- Beats **et** voix, avec **Spotify en priorité** (morceaux complets, albums).
- Notre propre code, licence MIT, appli à part + module Mon Hub, lien avec Arko.
- Pas de réseau social en v1. Le distributeur sera choisi plus tard.
- On crée sur le téléphone et on peut finir sur PC.

Romain est en cours. Les questions ouvertes sont tranchées ici et seront notées dans la passation.

## But de cette livraison (phases 0 + 1)
Un débutant, sur Chrome Android, doit pouvoir faire tout ceci en 10 minutes :
1. Choisir un style.
2. Ajuster le beat.
3. Arranger 3 ou 4 sections.
4. Enregistrer sa voix.
5. Mélanger.
6. Exporter un **WAV 44,1 kHz / 16 bits / stéréo, PCM (code 0x0001)**, au **niveau Spotify (−14 LUFS intégré, crête vraie ≤ −1 dBTP)**, ou un M4A.

Le morceau est sauvegardé tout seul. On retrouve ses morceaux dans « Mes morceaux ».

## Pile (reprise d'Arko)
- Vite 8, TypeScript strict, Preact + signals, vite-plugin-pwa, idb-keyval, Vitest, Playwright (`channel: 'chrome'`), GitHub Pages (`base: '/ocka/'`).
- Mediabunny 1.65.1 (+ `@mediabunny/aac-encoder`) pour le M4A.
- Code et textes en français, simples, fichiers de moins de 300 lignes.
- Des briques de synthèse sont reprises d'Arko (`src/moteur/synthese/`, même auteur, MIT).

## Le format « morceau » `ocka.morceau/1`
C'est la seule source de vérité, comme la recette d'Arko. Le fichier fait foi : `src/morceau/types.ts`.
- Les temps musicaux sont en **pas de double-croche** : 16 pas par mesure de 4/4. Le tempo va de 60 à 200 BPM et le swing de 0 à 0,6.
- `motifs` contient les motifs réutilisables :
  - batterie : 16 pas × instruments, avec une vélocité de 0 à 1
  - basse : notes (pas, durée, degré de la gamme)
  - accords : un degré par mesure, ou par demi-mesure
- `sections` contient Intro, Couplet, Refrain, Pont ou Outro. Chaque section a 1 à 16 mesures et pointe vers un motif par piste. `ordre` donne l'arrangement, et une section peut revenir plusieurs fois.
- `pistes` : batterie, basse, accords, voix. Pour chacune : volume, panoramique, muet, solo.
- `prises` : les enregistrements de voix. Chaque prise a sa place dans l'arrangement (mesure de départ), son fichier (clé OPFS), son décalage de latence et son gain. La prise choisie est marquée.
- `master` : préréglage (neutre, chaud, fort, clair, lo-fi) et niveau cible (−14 LUFS).
- Un **normaliseur** corrige au lieu de rejeter, avec des messages en français, comme celui d'Arko. Une IA pourra écrire ce format en phase 6.

## Moteur son (un seul chemin pour l'écoute et l'export)
- `construireGraphe(ctx, morceau, sons)` fonctionne aussi bien avec un `AudioContext` qu'avec un `OfflineAudioContext`. L'écoute et l'export utilisent donc **le même code**.
- **Batterie** : chaque frappe est un son **synthétisé en JS**, puis mis en cache en AudioBuffer et joué par AudioBufferSourceNode. Sons : kick 808, snare, clap, charley fermé et ouvert, rim, cowbell (phonk), perc.
- **Basse 808** : un son synthétisé par note, avec glissé (drill) et saturation douce.
- **Accords** : un synthé (piano électrique doux ou nappe), synthétisé en JS par note et mis en cache, puis voicing automatique.
- **Écoute** : planificateur « en avance » (fenêtre de 100 ms, toutes les 25 ms, sur `ctx.currentTime`). Il gère la boucle d'une section ou du morceau entier, la position de lecture et le métronome.
- **Mélangeur** : par piste, Gain → StereoPanner → bus master. Le master passe dans un compresseur doux, puis dans un limiteur (en JS à l'export).
- **Export** :
  - rendu `OfflineAudioContext(2, n, 44100)`
  - mesure de la sonie en **LUFS intégré** (BS.1770 simplifié : filtre K, fenêtres de 400 ms, double seuil)
  - gain vers −14 LUFS
  - limiteur à crête vraie −1 dBTP (sur-échantillonnage ×4)
  - **WAV PCM 16 bits** avec dither TPDF, et le code de format **0x0001** (exigence de Spotify)
  - M4A AAC 256 kb/s par Mediabunny
  - le nom du fichier vient du titre
- **Styles** (préréglages) :

  | Style | Tempo | Particularités |
  |---|---|---|
  | trap | 140 | demi-tempo, charley en roulements |
  | lo-fi | 85 | swing 0,25, accords jazzy |
  | phonk | 135 | cowbell, 808 saturée |
  | drill | 142 | 808 qui glissent |
  | pop | 110 | |
  | boom bap | 90 | |

  Chaque style propose 1 motif de batterie, **3 suites d'accords** et 1 ligne de basse.

## Enregistrement de la voix
- `getUserMedia` avec `echoCancellation`, `noiseSuppression` et `autoGainControl` à **false**. La capture passe par un **AudioWorklet** (pas MediaRecorder), et les morceaux de PCM sont écrits dans OPFS.
- **Calibrage de la latence** au premier usage : on joue un clic, le micro l'entend, on en déduit le décalage. On répète 5 fois et on garde la médiane, mémorisée par appareil. Sinon, on estime avec `outputLatency` + `baseLatency` + la latence d'entrée.
- **Conseil affiché** : un casque **filaire**, car le Bluetooth ajoute beaucoup de retard.
- **Décompte** d'une mesure, puis enregistrement sur la section choisie ou le morceau entier, avec plusieurs prises. On réécoute en solo ou avec le beat, et on garde la meilleure. La prise est **recalée** du décalage mesuré.

## Interface (au pouce, en français)
- Accueil « Mes morceaux » : bouton « Nouveau morceau », puis choix du style.
- Studio en 5 étapes, en haut : **Beat → Structure → Voix → Son → Exporter**.
  1. **Beat** : grille de 16 pas, une ligne par instrument. Gros pas d'au moins 40 px, défilement horizontal si besoin, vélocité par appui long. On y règle aussi le tempo, le swing, le kit, puis les accords (3 suites au choix) et la basse (activée ou non).
  2. **Structure** : la liste des sections, qu'on peut ajouter, dupliquer, renommer, déplacer ou supprimer. Pour chacune, une variante de motif (le refrain a plus de charley, par exemple) et un nombre de mesures. Le total s'affiche en mm:ss.
  3. **Voix** : calibrage, choix de la section, gros bouton rouge, décompte, liste des prises (écouter, garder, supprimer).
  4. **Son** : volume et panoramique par piste, muet et solo, préréglage du master.
  5. **Exporter** : titre, artiste, « WAV pour Spotify », « M4A pour écouter », « Envoyer vers Arko » (partage du fichier M4A), et l'astuce « Pour Spotify, passe par un distributeur ».
- Une barre de lecture reste visible : Lecture/Pause, boucle de la section, position.
- **Identité** : fond sombre #0E0B14, accent **violet électrique #A855F7** et magenta #EC4899, polices Space Grotesk et Inter. On fait différent d'Arko, mais de la même famille.

## Tests (critère de fin)
- **Vitest** :
  - théorie musicale (gammes, accords, degrés)
  - normaliseur
  - calcul du planning des notes
  - sonie (un sinus de 1 kHz à −20 dBFS donne environ −23 LUFS)
  - écriture du WAV (en-tête, code 0x0001)
  - limiteur
- **E2E Chrome** :
  - nouveau morceau trap, ajouter une frappe, 3 sections, export WAV, puis vérifier :
    - en-tête 44100 / 16 bits / 2 canaux / 0x0001
    - durée = mesures × 4 × 60 / tempo, à 10 ms près
    - sonie à −14 ± 1 LUFS (vérifiée par ffmpeg `ebur128`)
  - enregistrement avec un faux micro (`--use-file-for-fake-audio-capture`) : la prise est recalée
  - rechargement de la page : le morceau revient
