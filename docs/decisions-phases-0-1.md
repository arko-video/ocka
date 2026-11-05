# OCKA — Décisions des phases 0 et 1 (après la revue)

4 novembre 2026. Ce document complète `brief-phases-0-1.md` et l'emporte en cas de conflit. Les types de `src/morceau/types.ts` et le contrat de `src/moteur/api.ts` sont déjà à jour.

## Périmètre
- **3 styles finis** : trap (140 BPM, demi-tempo), drill (142, 808 qui glissent), lo-fi (85, swing 0,25). Les autres viendront plus tard.
- **Plus tard** : le M4A et l'envoi vers Arko (le WAV suffit pour Spotify), et le choix entre plusieurs prises qui se chevauchent. En v1 : **une prise choisie par section**.
- On ouvre **sur un morceau déjà prêt à enregistrer** : choisir un style crée tout de suite Intro, Couplet, Refrain, Couplet, Refrain, Outro, avec 4 motifs de batterie par style placés automatiquement.

## Format (déjà dans `types.ts`)
- **Roulements** de batterie : 2, 3, 4 ou 6 frappes dans un pas.
- **Sections** : `fill`, `coupure` (break / drop), `paroles` (affichées en prompteur).
- **Morceau** : `fondu` de fin et `kit` versionné (`trap@1`). Le bruit des sons est généré à graine fixe.
- **Prise** :
  - ancrée sur `{section, occurrence, mesure}`
  - avec `tempo`, `frequence`, `debutCoupe` / `finCoupe`, `decalage`
- **Piste voix** : préréglage `naturel | rap | chant` (passe-haut à 90 Hz, compresseur, réverbe).
- **Master** :
  - `preset` : neutre / chaud / clair / lo-fi
  - `niveau` : **standard** = −14 LUFS et ≤ −1 dBTP ; **fort** = −11 LUFS et ≤ −2 dBTP

## Son
- **Même chaîne master à l'écoute et à l'export.**
  - Le graphe est construit par la même fonction pour l'`AudioContext` et l'`OfflineAudioContext`.
  - Le limiteur du master est un **AudioWorklet**, chargé dans les deux contextes.
- **Synthèse et cache** : les sons sont synthétisés en JS puis mis en cache en AudioBuffer **à `ctx.sampleRate`**, pour éviter le rééchantillonnage linéaire de Chromium.
- **Prises** : rééchantillonnées avec un vrai filtre (sinc fenêtré) si leur fréquence diffère.
- **Planificateur** :
  - fenêtre de 200 ms, minuterie dans un Worker (sinon elle est ralentie en arrière-plan)
  - Wake Lock pendant la lecture et l'enregistrement
  - humanisation de ±8 % sur la vélocité, réverbe légère sur la caisse claire
  - bouton « Varier » (variations du motif)

## Export pour Spotify
- **WAV 44,1 kHz stéréo, PCM 24 bits par défaut**, avec le code de format **0x0001** (jamais 0xFFFE). Le 16 bits avec dither TPDF est une option.
- **Sonie BS.1770 complète** :
  - filtre K **recalculé pour la fréquence réelle**, à partir du prototype analogique
  - blocs de 400 ms qui se chevauchent à 75 %
  - seuils absolu −70 LUFS et relatif −10 LU
  - validation sur les signaux de l'EBU Tech 3341. Exemple : un sinus de 1 kHz à −20 dBFS sur **les deux canaux** donne −20,0 LUFS, et −23,0 LUFS s'il n'est que sur un seul canal.
- **Crête vraie** : suréchantillonnage ×4 **en flux**, sans tout garder en mémoire. Le limiteur vise la crête vraie.
- **Mémoire** : un morceau de 3 min doit passer sur un téléphone de 3 à 4 Go, avec un seul tampon complet à la fois.

## Enregistrement
- Calibrage par **chirp et intercorrélation**, capture et lecture dans le **même AudioContext**. Le 1er échantillon est daté par `currentFrame` dans le worklet.
- **7 essais**, refaits si l'écart dépasse 3 ms. On garde la médiane.
- Un **curseur manuel de ±100 ms**, et un nouveau calibrage proposé au `devicechange`.
- Avec un casque filaire, le micro n'entend pas le clic : on affiche « Colle l'écouteur contre le micro du téléphone pendant le calibrage ».
- **Bluetooth** : s'il est détecté (nom de l'appareil, latence de sortie supérieure à 150 ms), on prévient et on conseille fortement un casque filaire.
- On vérifie `track.getSettings()` : écho, bruit et gain automatique doivent être désactivés. Sinon, on le signale.

## Interface
- **Grille Beat** :
  - une **vue d'ensemble** des lignes (petites cases, en lecture)
  - plus des **pads 4×4 de 76 px** pour l'instrument choisi
  - un appui fait passer de **fort** à **doux**, puis à **vide**
  - un appui long règle les roulements (×2, ×3, ×4, ×6)
- **Prompteur** : les paroles de la section défilent pendant l'enregistrement.
- **Étapes** : Beat → Structure → Voix → Son → Exporter, avec la barre de lecture toujours visible.
- **Identité** : fond #0E0B14, violet #A855F7, magenta #EC4899, Space Grotesk et Inter.

## Tests (critère de fin)
- **Vitest** :
  - théorie
  - normaliseur
  - planning
  - sonie (signaux EBU 3341)
  - crête vraie
  - WAV (en-tête, 0x0001, 24 et 16 bits)
  - limiteur
  - roulements
- **E2E dans Chrome** :
  - nouveau morceau trap, une frappe ajoutée, export WAV, puis vérifications :
    - en-tête 44100 / 24 bits / 2 canaux / 0x0001
    - durée exacte à ±10 ms
    - ffmpeg `ebur128` : −14 ± 0,5 LUFS et crête vraie ≤ −1 dBTP
  - prise avec un faux micro (`--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>`), puis vérification de son recalage
  - rechargement de la page : le morceau revient
