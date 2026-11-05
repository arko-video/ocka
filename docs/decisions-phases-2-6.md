# OCKA — Décisions des phases 2 à 6 (après la revue de l'équipe)

4 novembre 2026. Ce document complète `phases-2-6.md` et **l'emporte en cas de conflit**. Il vient de 3 relectures : son et moteur, débutant + Spotify (règles vérifiées en ligne), architecture et sécurité.
Romain a demandé **toutes les phases**. Rien n'est coupé, mais tout est **ordonné par la priorité Spotify**, et chaque vague est livrée seule.

## 0. Règles d'organisation
- **Pas de git dans la VM** : c'est la règle de Romain, donc pas de worktree. Chaque développeur **possède des fichiers précis** (tableau en fin de document).
  - Un fichier partagé n'est modifié que par l'intégrateur, ou par la tâche « contrat » avant le lancement.
  - Si tu as besoin d'un changement dans un fichier qui ne t'appartient pas, tu l'écris dans ton rapport final. Tu ne le fais pas toi-même.
- **Ordre** : tâche « contrat » (gel), puis la vague A (5 développeurs en parallèle), puis l'intégration et la QA, puis une livraison. Ensuite la vague B (4 développeurs), puis l'intégration et la QA, puis une livraison.
- **Rendus de référence des phases 0 et 1** : `/home/claude/ocka/references-phase1/` (qa-trap, qa-drill, qa-lofi, qa-voix, qa-trap-3min, qa-trap-fort-16, avec les bilans JSON).
  - Ce sont des sorties des scénarios `tests/qa/*.qa.ts`. Ces scénarios ont refait les mêmes rendus après les changements.
  - **Test nul** : pour un morceau des phases 0 et 1 (chaîne master 1, sans mélodie), la batterie, la 808 et la voix doivent rester identiques (≤ −90 dB d'écart). Les accords peuvent changer à cause de la nouvelle banque de notes (voir 2.2) : on tolère alors ±0,5 LU de sonie et une enveloppe spectrale proche, et on le note.

## 1. Format
- **`ocka.morceau/2`** : on écrit toujours en version 2. Le normaliseur lit les versions 1 et 2.
  - Un vieil onglet de la phase 1 (PWA en « prompt ») **bloque** déjà les versions supérieures à 1 : il refuse le morceau au lieu d'effacer les nouveaux champs. Un test le vérifie.
- **Ajouts** (tous facultatifs dans le fichier, complétés par le normaliseur) :
  - `MotifMelodie { type: 'melodie'; pas (16 à 64); notes: { pas; duree; midi; vel? }[]; son: SonMelodie }`
    - `SonMelodie = 'piano' | 'epiano' | 'lead' | 'pluck' | 'cloche' | 'nappe'`
    - `piano` = nouveau piano par résonateurs ; `epiano` = le piano électrique FM des accords
    - **Pas de basse synthé** : la 808 suffit.
  - `Section.motifs.melodie?`, `Section.boucle?: { son; mesures: 1 | 2 | 4 | 8; caler: boolean }`
  - `IdPiste` + `'melodie' | 'sons'`. Le normaliseur ajoute ces pistes : volume 0,8, panoramique 0.
  - `InstrumentBatterie` + `'perso1' | 'perso2' | 'perso3' | 'perso4'`, et `Morceau.pads?: Partial<Record<'perso1'…'perso4', idSon>>`
  - `Morceau.sons?: SonImporte[]` avec `SonImporte { id; nom; fichier; frequence; duree; canaux: 1 | 2 }`
  - `Piste.effets?: { reverbe?: number; echo?: number; radio?: boolean; doubler?: boolean; autotune?: number }` (0 à 1 ; l'autotune est arrondi au dixième)
  - `Master.chaine?: 1 | 2` : 1 = chaîne des phases 0 et 1 (les vieux morceaux) ; 2 = avec la colle (nouveaux morceaux)
  - `Morceau.infos?: InfosTitre` :
    ```
    InfosTitre {
      explicite?: boolean;
      langue?: string | 'instrumental';
      credits?: { nom: string; role: 'auteur' | 'compositeur' | 'producteur' | 'interprete' }[];
      featuring?: string;
      isrc?: string;
      ia?: { paroles: NiveauIa; musique: NiveauIa; voix: NiveauIa };
    }
    NiveauIa = 'aucune' | 'aide' | 'ia'
    ```
  - `Style` + `'phonk' | 'pop' | 'boombap'` : figé dès le contrat. Les `Record<Style, …>` reçoivent des valeurs provisoires, que la vague B remplace.
  - `Morceau.album` est **abandonné** : on l'ignore et on ne l'écrit plus.
- **Sorties** : le format `ocka.sortie/1` (« Sortie » remplace « Album »), stocké dans IndexedDB `ocka-sorties`.
  ```
  Sortie {
    format; id; titre; artiste; lienProfil?; dateSortie (ISO, défaut aujourd'hui + 6 semaines);
    genre; label? (défaut : nom de l'artiste, jamais « N/A »); langue; upc?;
    titres: string[] (ids de morceaux, ordre); pochette?: string (clé IndexedDB ocka-pochettes);
    distributeur: 'routenote' | 'distrokid' | 'autre'; niveau: 'standard' | 'fort';
    modifieLe
  }
  ```
  - `Sortie.titres` est la **seule source de vérité**. Un morceau peut être dans plusieurs sorties.
  - Supprimer un morceau le retire de ses sorties. `normaliserSortie` retire les ids morts et les doublons.
- **Réglages** (IndexedDB `ocka-reglages`) : `vraiNom` (demandé une seule fois, pour pré-remplir les crédits), `artiste`, `lienProfil`, `distributeur`.
- **Normaliseur, durci** :
  - plafonds : 64 motifs, 64 sections, 200 entrées dans `ordre`, 512 notes par motif, 200 prises, 16 sons, 32 titres par sortie
  - ids au format `^[A-Za-z0-9_-]{1,40}$`
  - `fichier` vérifié par une regex de clé OCKA
  - ids de prise dédoublonnés
  - **dictionnaires créés avec `Object.create(null)`** (bug `__proto__` actuel dans `normaliser-motifs.ts`)
  - idempotent : normaliser deux fois donne le même résultat

## 2. Son et moteur
1. **Rien n'est synthétisé pendant la lecture.**
   - Les notes mélodiques (accords + mélodie) sont synthétisées **sans durée**, sur une longueur fixe par son. On les coupe par une rampe de gain (relâchement) puis `stop()`.
   - Le cache ne dépend donc plus du tempo. Les tampons sont mono, sauf la nappe.
   - Le calcul se fait **dans un Worker**, juste après `charger()`, pour toutes les notes du morceau. Le cache LRU fait environ 48 Mo par contexte.
   - La 808 reste comme avant : monophonique, avec glissé, cache par durée.
   - Une note pas encore prête au moment de la jouer est **sautée**, avec un compteur de test : jamais de calcul dans `planifier()`.
2. **Bus master persistant** :
   - Le limiteur et les réverbes du master ne sont créés qu'une fois par contexte. `charger()` ne refait que les pistes et les sources.
   - Le worklet du limiteur renvoie `false` après un message « fin ».
   - `detruire()` débranche tout.
3. **Mélodie** :
   - piano par résonateurs récursifs (environ 15 ms par note)
   - pluck Karplus-Strong avec **retard fractionnaire** (passe-tout)
   - lead : 2 scies désaccordées + filtre
   - `epiano`, `cloche` et `nappe` sont repris des accords
   - le nom affiché « Piano » ne sera validé qu'après une écoute ; sinon on l'appelle « Piano doux »
4. **Sons importés** :
   - rééchantillonnés **une fois** avec `reechantillonner` (sinc), dans un Worker, jamais avec `playbackRate`
   - fondus de 3 ms à chaque relance de boucle
   - avertissement si le calage change la hauteur de plus d'un demi-ton
   - pads : silence de début coupé, et une nouvelle frappe coupe la précédente
   - **plafond : 120 s de sons au total par morceau**, 20 Mo par fichier, durée vérifiée **avant** `decodeAudioData`
5. **Effets de voix** :
   - **Réverbe** : un envoi.
   - **Écho** : croche pointée, retour 0,35, filtres passe-haut 250 Hz et passe-bas 4 kHz dans la boucle.
   - **Radio** : 2 passe-haut à 400 Hz + 2 passe-bas à 3 kHz, saturation WaveShaper `oversample '4x'`, +4 dB.
   - **Doubler** : 2 retards modulés de 12 et 19 ms, à gauche et à droite.
6. **Colle (chaîne 2)** :
   - compresseur **en JS dans le worklet du master**, et non `DynamicsCompressorNode`, qui ajoute un gain impossible à couper et un retard non compté
   - 2:1, attaque 30 ms, relâchement 250 ms, détecteur filtré en passe-haut à 100 Hz, au plus 3 dB de réduction
   - la colle et la couleur dépendent du preset
   - pas de largeur M/S : à la place, des **panoramiques par défaut** par instrument (charley +0,15, perc −0,2, mélodie +0,1, accords −0,1)
7. **A/B** : l'écart de sonie entre « avec » et « sans » la couleur et la colle est mesuré hors temps réel en BS.1770, sur 8 mesures du refrain (±0,5 LU), puis compensé.
8. **Stems** :
   - un WAV **32 bits flottants** par piste, **avant le master**
   - promesse : « posés ensemble, ils redonnent le mix avant le mastering »
   - test : la somme des stems moins l'entrée du master doit rester ≤ −90 dBFS, sans décalage
9. **Clavier** : on retire `outputLatency` + environ 25 ms (le délai du toucher) avant de caler à la double-croche.
10. **M4A** : AAC 256 kb/s, encodé pendant la dernière passe de l'export (pas de second rendu). La crête vraie est vérifiée après décodage.

## 3. Sortir sur Spotify (règles vérifiées en ligne par la relecture)
- **Audio du dossier** :
  - **FLAC 16 bits / 44,1 kHz, avec dither TPDF, par défaut**, car RouteNote refuse le WAV (FLAC ou MP3 320 seulement)
  - WAV 24 bits pour DistroKid, ou si on le choisit
  - **encodeur FLAC fait main** : prédicteurs fixes d'ordre 0 à 4 + codage de Rice, en flux, blocs de 4096
  - vérifié dans les tests par ffmpeg (`-v error -f null`) et par une comparaison échantillon par échantillon avec le PCM 16 bits
- **Type de sortie** (règle de Spotify) :
  - single = 1 à 3 titres, moins de 30 min au total
  - EP = 4 à 6 titres, moins de 30 min
  - sinon, album
  - chaque titre fait au moins 30 s (seuil où une écoute compte)
  - conseil : DistroKid refuse un album dont les titres font en moyenne moins de 60 s
- **Date de sortie** : par défaut aujourd'hui + 6 semaines, car la modération de RouteNote prend environ 3 semaines, puis la livraison 1 à 2. Conseil : le pitch dans Spotify for Artists doit partir au moins 7 jours avant.
- **Pochette** :
  - une image importée de **moins de 1425 px de côté est refusée**
  - entre 1425 et 3000 px, on la garde à sa taille (on ne l'agrandit pas) et on prévient
  - au-delà, sortie en 3000 × 3000, JPEG sRGB, qualité 0,92
  - recadrage **centré**, ajusté en glissant (pas de pincement en v1)
  - **4 modèles** « Fabriquer une pochette » dessinés en 3000 natifs
  - interdits rappelés : URL, pseudos, prix, code-barres, « Out now », logos de plateformes, images sans droits (anime, visage de quelqu'un d'autre)
- **Contrôles du titre** : pas tout en MAJUSCULES, pas de numéro de piste, pas le nom de l'artiste, 12 mots au plus. Un featuring s'écrit « (feat. X) ». Le producteur va dans les crédits, jamais dans le titre.
- **Crédits** : le **vrai nom complet** des auteurs et compositeurs est exigé. Il est pré-rempli depuis `vraiNom`.
- **Déjà sorti ?** On recopie l'ISRC, sinon le titre est un doublon, et les doublons sont interdits.
- **Paroles** :
  - générées **au format Musixmatch** depuis la structure : chaque répétition écrite en entier, une ligne par vers, sans étiquette « Refrain »
  - langue choisie par titre, ou « Instrumental »
- **Déclaration de l'IA** : élément par élément (paroles, musique, voix). OCKA la pré-remplit : « aucune », ou « aide » si l'IA de la phase 6 a servi. Les styles et le hasard d'OCKA sont des règles, pas de l'IA générative.
- **Fiche** : `fiche-de-sortie.html` (tout est **échappé**) et `.txt`, avec le guide pas à pas du distributeur choisi.
  - On cite la limite d'âge du distributeur : renvoyer vers sa page.
  - On ne cite plus Amuse comme gratuit.
- **Conseils** : « Cherche ton nom d'artiste sur Spotify avant » (risque de mauvais profil), et le champ « Lien de ton profil Spotify ».
- **Dossier ZIP** `Artiste - Titre (sortie).zip` :
  - `01 - Titre.flac` (ou `.wav`)
  - `pochette.jpg`
  - `paroles/01 - Titre.txt`
  - `fiche-de-sortie.html` et `fiche-de-sortie.txt`
  - Chaque titre est rendu **directement dans le ZIP** par un **écrivain** passé à l'export : en-tête connu d'avance, CRC corrigé par `seek`, aucun fichier temporaire.
  - Méthode « stocké », pas de ZIP64 : refus au-delà de 3,9 Go.
  - Place libre vérifiée avant : au moins 2,2 × la taille estimée, car le téléchargement recopie le fichier.
  - Wake Lock, progression par titre, Annuler, **un seul niveau** (standard ou fort) pour toute la sortie.
  - `QuotaExceededError` → `ErreurOcka('disque_plein')`, et le fichier partiel est effacé.
  - Dossier OPFS `ocka-sorties`. **Corriger `ouvrirEcriture()`**, qui efface aujourd'hui les autres exports.

## 4. Interface
- **Toujours 5 étapes.** Beat a une bascule **« Batterie | Mélodie »**.
- **Mélodie v1** :
  - **8 pads de la gamme** sur une octave, avec un choix d'octave (−1, 0, +1) : jamais de fausse note
  - pastilles de son
  - **« Enregistrer au clavier »** : décompte, boucle de la section, calage à la double-croche
  - **grille simple** sous les pads : les 8 lignes de la gamme × les pas du motif. On touche une case vide pour poser une note de la durée choisie (pastilles 1/16, 1/8, 1/4, 1/2), et on touche une note pour l'effacer. **Aucun appui long ni glissé.**
  - « Une autre idée » (vague B) et « Boucles OCKA » (vague B)
- **Tes sons** : dans Batterie, « + Ton son » → importer → choisir un pad perso. Dans Structure, une carte de section → « Boucle » → choisir un son et un nombre de mesures. On affiche le rappel sur les droits.
- **Voix** : les effets en pastilles (Réverbe, Écho, Radio, Doubler), avec un curseur pour Réverbe et Écho. L'autotune arrive en vague B.
- **Son** : la couleur (4 pastilles), « Colle » (interrupteur, activé en chaîne 2) et le bouton **A/B**.
- **Exporter** :
  - un gros bouton **« Sortir sur Spotify »**, qui crée une sortie d'un titre et ouvre l'assistant
  - en dessous, en plus petit : WAV, M4A « pour écouter », « Pistes séparées », « Envoyer vers Arko » et « Exporter le projet »
- **Accueil** : onglets **« Morceaux | Sorties »**, et le bouton « Importer un projet ».
- **Assistant de sortie, en 3 écrans** : **Infos → Pochette → Vérifier**, puis « Préparer le dossier ».
  - Les questions sont en mots simples (« Il y a des gros mots ? » pour l'explicite).
  - Les titres se rangent avec des flèches haut/bas.
  - Chaque problème a un bouton « Corriger » qui ramène au bon endroit.
- **Aide** (vague B) : un bouton « ? » qui ouvre l'aide de l'écran en cours. Le guide de sortie se trouve aussi dans la fiche.

## 5. Fichiers, stockage et sécurité
- **Même origine qu'Arko** (`arko-video.github.io`) :
  - tout ce qui appartient à OCKA est préfixé : dossiers OPFS `ocka-prises` (existant), `ocka-exports` (existant), `ocka-sons`, `ocka-sorties`, `ocka-tmp`, et bases IndexedDB `ocka-*`
  - **on ne touche jamais à rien d'autre**
  - la clé IA va dans `ocka-cles`
- **Ramasse-miettes** :
  - il compte les prises, les sons, les pochettes et les fichiers de l'autotune
  - il tourne sous `navigator.locks.request('ocka-menage')`
  - la règle « avant la séance » ne s'applique que s'il n'y a pas d'autre onglet (`BroadcastChannel` + verrou)
- `navigator.storage.persist()` est demandé après un geste (première prise ou premier export). S'il est refusé, on conseille « Exporter le projet ».
- **Import d'un `.ocka` ou d'un `.ocka-sortie`** :
  - lecture par le **répertoire central** avec `File.slice` ; au plus 1 Go pour un projet, 3,9 Go pour une sortie
  - **refusés** : ZIP chiffré, ZIP64, compression autre que 0 ou 8, noms en double, nom local différent du nom central, plages qui se chevauchent
  - noms acceptés : **une liste blanche exacte**
  - deflate (`DecompressionStream('deflate-raw')`) **uniquement pour le JSON**, coupé à 2 Mo
  - **chaque fichier reçoit une clé OPFS neuve** : un nom venu du ZIP ne devient jamais un chemin, et une clé d'origine n'est jamais réutilisée
  - une prise sans son fichier est retirée
  - la place est vérifiée avant (somme des tailles × 1,1)
  - le morceau ou la sortie est enregistré **en dernier** : l'import est tout ou rien

## 6. IA (vague B)
- On copie `fournisseurs/` et `cle.ts` d'Arko dans `src/ia/`.
- CSP `connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com`, sans Hugging Face. On adapte `tests/qa/securite.qa.ts`.
- Les appels partent de la page, pas d'un Worker.
- La réponse est limitée à 1 Mo, puis passe par une **liste blanche de champs**, puis par le normaliseur. L'IA ne touche jamais `prises`, `sons`, `infos`, `master` ni `pads`.
- Les paroles et les titres envoyés sont des **données délimitées**. Les réponses s'affichent en texte brut.
- On refuse d'imiter un artiste réel.

## 7. Report
- **Autotune** : en vague B, avec un développeur dédié.
  - YIN à 16 kHz, seuil 0,12, de 70 à 1 000 Hz, médiane sur 5 trames, hystérésis de ±20 cents
  - on ne corrige que le centre de la hauteur (passe-bas de 150 ms) ; les sons non voisés sont recopiés avec des fondus de 20 ms
  - même longueur que la prise
  - **repli** : moins de 60 % de trames voisées → pas d'autotune, et on le dit
  - fichiers `ocka-prises/auto-…` comptés par le ramasse-miettes ; l'export attend la correction
- **« Sons venus d'OCKA » dans Arko** : facultatif, à la fin.

## 8. Répartition — vague A (après le contrat)
| Dév | Possède | Livre |
|---|---|---|
| **Contrat** (avant tous) | `types.ts`, `normaliser*.ts`, `api.ts` (ajouts + bouchons `ErreurOcka('pas_encore')`), `src/textes/` (découpage de `textes-fr.ts` par domaine, avec un fichier par développeur), `etat.ts`, `navigation.ts`, `App.tsx` (écrans vides branchés), `src/stockage/dossiers.ts` (noms OPFS/IDB, quota, `persist`, `disque_plein`), `index.html`, `package*.json` | gel du contrat, tests du normaliseur v2 |
| **A1 Sorties** | `src/sortie/`, `src/stockage/sorties.ts`, `src/stockage/reglages.ts`, `src/ui/ecrans/sortie/`, `src/ui/composants/sortie/`, `MesMorceaux.tsx`, `ui/mes-morceaux.ts`, `src/textes/sortie.ts`, CSS associée | assistant, pochette, contrôles, fiche, paroles Musixmatch, orchestration du dossier |
| **A2 Fichiers** | `src/zip/`, `src/moteur/flac/`, `src/moteur/export.ts`, `sortie-wav.ts`, `wav.ts`, `src/projets/`, `src/stockage/morceaux.ts` + index, `src/enregistrement/fichiers-opfs.ts` + `prises.ts`, `src/sons/import.ts` | ZIP (écriture en flux, lecture sûre), FLAC, écrivain d'export (WAV, FLAC, M4A), projets, ramasse-miettes, import de sons |
| **M1 Moteur** | `graphe.ts`, `planning.ts`, `lecteur.ts`, `instruments/*`, `synthese/*`, `reechantillonner.ts`, nouveau Worker de synthèse | banque sans durée + Worker + LRU, bus persistant, mélodie, lecture des sons importés (pads et boucles), option `pistesSeparees` du graphe |
| **M2 Effets** | `chaines.ts`, `moteur/audio/*` (worklets), `moteur/stems.ts`, `moteur/ab.ts`, `src/arko/` | effets de voix, colle en JS, chaîne 2, A/B, stems 32f, envoi vers Arko |
| **U Studio** | `ui/ecrans/{Beat,Structure,Voix,Son,Exporter}.tsx`, `ui/composants/{beat,melodie,sons,structure,voix,son}/`, `ui/edition/*`, `ui/lecture.ts`, `ui/voix.ts`, `ui/exportation.ts`, `src/textes/studio.ts`, CSS associée | bascule Batterie / Mélodie, pads, clavier, grille, Tes sons, boucles, pastilles d'effets, A/B, boutons d'Exporter |
| **Intégrateur** (moi) | tout le reste, et les fusions | QA, e2e, livraison |
