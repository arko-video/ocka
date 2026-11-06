# OCKA v2 — Décisions (après la relecture, 5 novembre 2026)

Ce document complète `brief-v2.md` et l'emporte en cas de conflit. Il vient de 2 relectures :
- son, moteur et licences, vérifiées en ligne le 5/11 ;
- architecture et interface.

## 1. Format `ocka.morceau/3` (gelé ENTIÈREMENT dès le contrat C0, jusqu'aux champs de C3)
- **Motifs par section, affichés comme des clips.** Pas de clips libres. La frise a une ligne par piste et une colonne par passage de section. Chaque cellule est un clip qui boucle jusqu'à la fin de la section. Un motif utilisé dans plusieurs sections indique « dans N sections » et propose « Rendre unique ».
- `Section.motifs` devient un dictionnaire sans prototype : `Record<idPiste, idMotif>`.
- `MotifMelodie` est remplacé par `MotifNotes { type:'notes'; pas 16–128; notes: Note[] }`, avec `Note { pas; duree; midi; vel; glisse? }`. `pas` et `duree` sont arrondis au 1/24 de pas. Au plus 1024 notes par motif, triées et dédoublonnées.
- **Pistes :**
  - `PisteFixe` (ids `batterie | basse | accords | sons | voix`) et `PisteInstrument` (`genre:'instrument'`, `nom`, `instrument` = `'ocka-piano@1' | 'vcsl-marimba@1' | 'ocka-303@1' | 'sf2-<idSon>-<banque>-<preset>@1'…`, `synthe?`, `swing?`), au plus 16 ;
  - toutes deux ont une `Tranche` : volume, pan, muet, solo, `inserts?` (6 au plus), `sidechain?`, `auto?` (courbes par section, 64 points au plus), `lfo?` (2 au plus).
- **Autres ajouts :**
  - `Section.perf?` (effets de performance) ;
  - `Morceau.marqueurs?` ;
  - `Morceau.soundfonts?` ;
  - `SonImporte.recette?` (kick, sfxr) et ses découpes (`tranches?`) ;
  - `Prise.autotune?` : gamme, vitesse, force, humaniser, `formants` (décalage), préréglage, notes corrigées.
- **Migration `/2 → /3` sans changer le son.** La piste mélodie garde l'id `melodie` (même pan par défaut, même nom de stem) et prend l'instrument `ocka-<son>@1`. Si plusieurs sons sont utilisés, on crée `melodie-2`, etc.
  - **Test nul** sur un corpus `/2` (références de la phase 1 + vague B) : ≤ −90 dB pour la batterie, la 808 et la voix. Pour le mix complet, on tolère la limite de reproductibilité de Chrome (−80 dB).
- **Normaliseur :**
  - il lit les versions 1 à 3 et écrit en `/3` ;
  - un vieil OCKA en `/2` refuse un `/3` (testé) ;
  - plafonds ; ids de pistes jamais égaux à un id fixe ;
  - instrument inconnu mais bien écrit : gardé, avec un conseil ; mal écrit : remplacé par `ocka-piano@1` ;
  - il est idempotent.
- `morceau/acces.ts` : des accesseurs remplacent tous les `motifs.melodie` du code.

## 2. Instruments échantillonnés
- **Sources CC0 vérifiées (seulement celles-ci)** :
  - **VCSL** (CC0) : piano Steinway B et Kawai, saxo ténor, marimba, vibraphone, glockenspiel, kalimba, orgues, harpe, percussions latines ;
  - **VSCO-2-CE** (CC0) : piano droit, violons et violoncelles en section (tenu, spiccato), cor, trombone, tuba, trompette, flûte, clarinette, hautbois, basson ;
  - **FreePats**, seulement les pages marquées CC0 : piano droit KW, honky-tonk, guitare nylon, guitare électrique claire et saturée, basse, ukulélé, accordéon, orgue à tirettes, piano électrique DX7, clarinette, saxo, harpe, xylophone, cloches tubulaires, kalimba, percussions du monde ;
  - **Karoryfer** (CC0, LICENSE vérifié) : batteries Big Rusty et Unruly, balais Swirly, contrebasses Meatbass et Smolken, basses, guitares, saxos alto et baryton, tuba, violoncelle Bigcat ;
  - **Virtuosity Drums** (CC0) : batterie jazz ;
  - **Osiris Piano** (CC0).
- **Exclus :**
  - Salamander (CC-BY 3.0 ; les paquets npm qui le disent « MIT » se trompent) ;
  - Splendid Grand, SM Drums (provenance floue) ;
  - le General MIDI de FreePats et la guitare folk FSS (GPL) ;
  - la batterie Muldjord (CC-BY).
- **Fabriqués par le code** :
  - Rhodes et Wurlitzer (synthèse modale, avec en appui le DX7 de FreePats) ;
  - piano jouet, célesta, steel drum, chœurs (formants, d'après `voix-synthese.ts`) ;
  - cuivres en section (empilement) ;
  - tous les synthés : supersaw, leads, plucks, nappes, basses synthé, 303, chiptune.
- **Sans source** : guitare folk à cordes acier (on la fabrique ou on la retire), clavecin (à chercher dans VSCO Keys).
- **Provenance** :
  - pour chaque banque : URL, auteur, licence et SHA-256 des fichiers source dans `public/instruments/<id>/instrument.json` et dans CREDITS ;
  - un test refuse toute licence qui n'est pas CC0 ou domaine public, et vérifie les SHA-256.
  - Téléchargement depuis la VM : raw.githubusercontent, releases GitHub, freepats.zenvoid.org et karoryfer.com marchent ; codeload, l'API GitHub et jsDelivr sont bloqués. Les noms de fichiers de VCSL et VSCO se lisent dans leurs fichiers `.sfz` (raw).
- **MÉMOIRE (risque n°1)** : un Opus décodé pèse environ 16 fois sa taille téléchargée.
  - Le plafond se compte en **secondes décodées** : au plus 60 s mono par instrument (environ 11 Mio). Budget de l'échantillonneur : **128 Mio**, en plus du cache LRU actuel de 48 Mo.
  - Un fichier par (zone, couche de vélocité). On ne décode que les zones que le morceau joue.
  - **Pas de rééchantillonnage sinc par note** : on joue les zones avec `detune` (zones espacées d'au plus 3 demi-tons, donc au plus ±1,5 demi-ton). C'est aussi ce qui rend le glide et le pitch bend possibles.
  - Opus mono à 96 kb/s ; stéréo à 128 kb/s pour le piano et la batterie seulement. Fondu enchaîné des boucles préparé avant l'encodage, points de boucle mesurés après décodage (décalage d'amorce de 312 échantillons).
  - Vélocité = choix de la couche + gain `(vel/127)^1,6`.
- **Format `instrument.json`** : `{ id, nom, famille, licence:{ nom, url, auteur, sha256[] }, canaux, gainDb, relache, budgetS, zones:[{ fichier, racine, cents, bas, haut, velBas, velHaut, gainDb, debut, fin, boucle? }], exclusif?, mono? }`. Interface `SourceZones` commune avec les `.sf2`.
- **Téléchargement à la demande** (même origine), mis en Cache Storage `ocka-instruments`, avec la progression. Écran « Gérer les instruments ». Avant un export, OCKA télécharge les instruments qui manquent ; hors réseau, l'erreur est claire, jamais de piste muette.

## 3. Son, effets, automation
- **Sidechain** = une automation de gain calculée d'après le planning du kick. Aucun CPU en plus, et identique à l'export.
- **Inserts :**
  - nœuds natifs : égaliseur, filtres, saturation (suréchantillonnage 4x), écho, chorus/flanger ;
  - en JS dans **un seul worklet par piste** en écoute : compresseur et bitcrusher ;
  - **à l'export, aucun worklet** (règle de mémoire de B4) : ces mêmes calculs se font en JS sur le rendu, comme `master-hors-ligne`. Un test vérifie l'écart entre le worklet et le JS.
  - Pas de réverbe par piste : 2 envois partagés (réverbe, écho).
  - Le gain de rattrapage du compresseur est compensé.
- **Automation et LFO :** des courbes d'AudioParam, avec la **phase calée sur le temps du morceau** (sinon un saut fausse l'écoute par rapport à l'export). Fader, sidechain et automation agissent sur des gains séparés.
- **Arpège, strum, humaniser, swing, accords en un toucher, riff machine :** des fonctions pures déterministes, avec une graine, qui ÉCRIVENT des notes. On peut les annuler.
- **Effets de performance, reverse, nettoyeur de voix :** un freeze hors ligne, traité dans le Worker et mis en cache.
- **Sample chop :** les tranches sont des décalages dans le même tampon.
- **WSOLA :** jusqu'à ±20 % environ.
- **BPM :** on montre aussi le double et la moitié.
- **Tonalité :** 2 choix proposés.

## 4. Autotune avancé
- Le PSOLA actuel préserve déjà les formants. On ajoute un réglage de **décalage** des formants.
- La vitesse de correction est la constante de temps du passe-bas de correction (0 = robot).
- Préréglages Naturel / Pop / Robot / Hyperpop. Le curseur actuel correspond à un préréglage, testé.
- **Éditeur de notes :**
  - on découpe aux sauts de plus de 70 cents tenus plus de 60 ms, et aux attaques ;
  - seule la note modifiée est recalculée, avec 100 ms de marge de chaque côté ;
  - on peut déplacer, couper, fusionner, et régler justesse et vibrato.
- **IA :** on envoie la liste des notes (jamais l'audio). Sans clé, on a « Corriger tout seul ».

## 5. Ta voix → instrument (façon Dubler)
- **Détection :** YIN (le `yin.ts` existant) dans un AudioWorklet, avec décimation à 16 kHz. Deux modes :
  - mode grave : 500 échantillons + τmax de 213, soit environ 45 ms ;
  - mode aigu : environ 20 ms.
- **Stabilité :** changement de note à ±65 cents tenus 40 ms. Porte de bruit qui s'ouvre à −42 dBFS et se ferme à −50 dBFS, avec un maintien de 60 ms.
- **Sortie :** le worklet pilote directement les signaux de contrôle (gain, `detune`).
- **Micro :** `getUserMedia` sans annulation d'écho, sans réduction de bruit et sans gain automatique. Casque obligatoire. Pas de SharedArrayBuffer : GitHub Pages ne peut pas mettre COOP/COEP.
- **Promesse honnête :** le jeu en direct aura 100 à 200 ms de retard sur Android (casque filaire), et plus de 250 ms en Bluetooth. **L'enregistrement est recalé.**
- **Beatbox :** attaques détectées par flux spectral, puis sur 40 ms : 12 bandes log, centroïde, ZCR et décroissance, normalisés, puis k-NN (k = 3). Il faut 5 exemples par son. On vise 85 à 95 % de réussite avec 3 sons. Tests sur de vraies prises de Romain plus tard ; en attendant, sur des sons de synthèse.

## 6. Interface (écran de 360 px)
- **Les 5 onglets restent :** Beat, Structure, Voix, Son, Exporter. L'assistant de sortie ne change pas.
- **Beat :** bascule « Batterie | Instruments ».
  - **Instruments** = la vue Pistes : une carte par piste, et « + Piste » pour choisir un instrument par famille (recherche, écoute, téléchargement).
  - Toucher une piste ouvre le **piano roll** en plein écran :
    - en haut, une barre de 48 px : retour, Simple | Complet, Annuler ;
    - à gauche, un clavier de 32 px, avec « Rester dans la gamme » activé par défaut ;
    - pincer pour zoomer, deux doigts pour défiler, toucher pour poser une note, glisser pour la déplacer ;
    - une poignée de 24 px sous la note sélectionnée pour l'allonger ;
    - en bas, un couloir de vélocité repliable ;
    - une barre Quantif · Accord · Copier/Coller · Chanter · Outils ;
    - le mode **Simple** = les 8 pads actuels.
  - **Chanter** = Ta voix → instrument.
- **Structure :** « Sections | Frise ». « Jouer en direct » ouvre le looper.
- **Voix :** préréglages de l'autotune, puis l'éditeur de notes dans « Avancé ».
- **Son :** une tranche compacte par piste (M/S, fader, « Effets (n) », « Pompe » pour le sidechain), puis le master et l'A/B.
- **Réglage « Avancé »** (désactivé par défaut) :
  - couloirs d'automation et de LFO, marqueurs ;
  - paramètres des inserts ;
  - arpège, strum, humaniser, force de quantification, swing par piste, notes fantômes ;
  - éditeur d'autotune, punch-in, comping, nettoyeur ;
  - référence A/B, freeze, clavier MIDI.
- Les `data-testid` existants sont gardés (avec un alias pour `vue-melodie`).

## 7. Vagues (pas de git dans la VM : chaque développeur possède ses fichiers)
- **C0, le contrat** (un seul agent) :
  - `types.ts` /3 complet, `normaliser*` + `normaliser-pistes.ts` + `migration-v3.ts`, `morceau/acces.ts` ;
  - `api*.ts` avec des bouchons, `types-moteur.ts` (`pistesSeparees: Record<string, AudioNode>`) ;
  - `etat.ts`, `navigation.ts`, `App.tsx`, `textes/*` (un fichier par développeur), `stockage/dossiers.ts` (`ocka-instruments`, `ocka-sf2`) ;
  - le corpus `/2` et ses rendus de référence (faits AVANT tout changement), les tests du normaliseur /3.
  - Tout reste vert.
- **C1** :
  - **BQ** : banque d'instruments (`public/instruments/**`, `outils/instruments/`, CREDITS, `src/instruments/*`) ;
  - **M1** : N pistes, échantillonneur, `SourceZones`, test nul (graphe, planning, lecteur, `moteur/instruments/*`, `synthese/*`) ;
  - **M2** : inserts, sidechain, automation, LFO, stems par piste (`chaines.ts`, `moteur/effets/*`, `automation.ts`, `sidechain.ts`, `stems.ts`, `ab.ts`) ;
  - **U1** : vue Pistes, choix d'instrument, piano roll complet, accords en un toucher (`Beat.tsx`, `composants/{pistes,pianoroll,melodie}/*`, `edition/{notes,pistes}.ts`) ;
  - **U2** : frise, mélangeur, inserts, dessin de l'automation (`Structure.tsx`, `Son.tsx`, `composants/{frise,son,automation,structure}/*`, `edition/{mixage,automation,sections}.ts`).
- **C2** :
  - **S1** : styles rap ;
  - **S2** : autres styles et choix par familles ;
  - **A1** : moteur d'autotune et IA ;
  - **A2** : interface de l'autotune et éditeur de notes ;
  - **D** : Ta voix → instrument et beatbox.
- **C3** :
  - **P** : piano roll malin, MIDI, Web MIDI ;
  - **S** : sample chop, éditeur, WSOLA, BPM et tonalité, SoundFont ;
  - **L** : 303, chiptune, sfxr, onde dessinée, kick, LFO ;
  - **R** : performance, looper, confort, marqueurs ;
  - **V** : punch-in, comping, nettoyeur, chaînes de voix, référence, freeze.
- **Priorités de Romain** (rap, phonk, lo-fi) en cas de manque de temps :
  1. format et piano roll ;
  2. 10 instruments clés (piano, Rhodes, guitares, cordes, pizzicato, chœurs, cloche, flûte, leads, 808) ;
  3. sidechain et inserts ;
  4. sample chop ;
  5. styles rap ;
  6. autotune ;
  7. punch-in et comping ;
  8. automation ;
  9. voix → instrument et looper ;
  10. chiptune ;
  11. le reste.
- **Tests à chaque vague :**
  - test nul /2 ;
  - Σ des stems = mix avant le master ;
  - mémoire (8 pistes, album) ;
  - performance de `planifier` sur 16 pistes ;
  - écoute = export après un saut au hasard (avec sidechain, automation, LFO) ;
  - justesse des instruments à ±5 cents (YIN) ;
  - pas de clic aux boucles ;
  - export hors ligne avec un instrument absent ;
  - CSP et sécurité ;
  - tous les e2e existants.
