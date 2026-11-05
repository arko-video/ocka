# OCKA, phases 0 à 6 : rapport QA et intégration

Mis à jour le 5 novembre 2026. Build + preview sur le port 4194, Chrome headless (`channel: 'chrome'`, Linux), viewport
360×740, faux micro (clics à 1 kHz toutes les 0,5 s). Lancer depuis `app/` : `npx playwright test -c tests/qa/playwright.qa.config.ts`,
avec le serveur de dev ouvert à côté (`npx vite --port 5198 --strictPort`) pour autotune, master-js, mémoire (album)
et dev-aller-vite.
Les WAV et les bilans JSON sont dans `tests/qa/sorties/`. Les e2e : `npx playwright test` (tests/e2e).

## Intégration de la vague B (5 novembre 2026) — phases 0 à 6

### Vérifications (toutes)
- `npx tsc --noEmit -p .` : **0 erreur**. `npx vitest run` : **49 fichiers, 453 tests verts**.
- `npx vite build` : OK. Bundle principal `index-*.js` **442,8 ko (149,9 ko gzip)** (vague A : 345,7 ko) ; CSS 51,8 ko.
  À la demande : Mediabunny (728 ko) et l'encodeur AAC (1,13 Mo). Précache du service worker : 25 fichiers, 2,49 Mo.
- **Dev (`npx vite`)** dans Chrome : nouveau phonk, Lecture, « Une autre idée » / « Revenir » (batterie et mélodie),
  Boucles OCKA (écouter, utiliser), Au hasard : **0 erreur, 0 alerte** dans la console, serveur de dev sans erreur.
  Gardé comme scénario `dev-aller-vite.qa.ts`.
- **E2E : 16 tests verts** (13 fichiers) : parcours, captures, melodie, sortie, projet, m4a, pistes, aide, ia (3),
  autotune, **sonie-styles** (nouveau, 3) et **captures-vague-b** (nouveau).
  - Sonie (ffmpeg ebur128, WAV 24 bits « standard ») : **phonk −14,0 LUFS / −4,4 dBTP** (71,1 s), **pop −14,0 / −1,9**
    (87,3 s), **boom bap −14,0 / −2,0** (106,7 s). Seuils : −14 ± 0,5 LUFS, ≤ −1 dBTP, durée exacte.
- **QA : 19 tests** (12 fichiers). Tous verts, dont mémoire, test nul, reproductibilité, sécurité ; voir la note sur le
  test nul.
  | Scénario | Résultat |
  |---|---|
  | Export trap / drill / lo-fi (24 bits) | −14,0 LUFS ; −3,9 / −4,1 / −1,3 dBTP ; durées exactes ; 5,8 à 7,2 s |
  | Trap « fort » 16 bits | −11,1 LUFS, −2,2 dBTP |
  | Voix (faux micro) | 31 clics, écart max **6,2 ms** (±20 ms) |
  | Autotune | 3 min dans le Worker en **3,1 s** ; fichier `auto-<prise>-1.0-A-mineur.f32` ; même longueur ; repli sur du bruit |
  | Master JS = worklet | **−130,5 dB** (chaînes 1 et 2, fondu compris) |
  | Mémoire, 12 exports FLAC de 3 min | tas JS 4,8 → 5,3 Mo (pente 0,1) ; Chrome **+2 Mo/export** (1185 → 1187 Mo) |
  | Mémoire, album de 12 titres | Chrome après : 983 Mo (avant : 1032), crête +221 Mo, 176 s. Ancien chemin : +803 Mo |
  | Performance | export 3 min en **10,1 s**, −14,0 LUFS ; lecture : 70 pas, moyenne 108 ms, p95 126 ms, 0 saut |
  | Reproductibilité | **−84,9 dB** (même page) et **−84,9 dB** (après rechargement), aucun décalage |
  | Test nul contre la phase 1 | mix **−83,0 dB**, batterie −85,5, basse −127,6, accords −75,8 ; sonie −14,0 / −14,0 |
  | Sécurité | `connect-src 'self'` + **seulement** api.anthropic.com, api.openai.com, generativelanguage.googleapis.com ; 0 requête sortante, 0 violation, 0 erreur |
- **Test nul, à surveiller** : dans la série complète (après 8 min de scénarios mémoire), il a échoué une fois : c'est le
  rendu de la **copie figée de la phase 1** qui avait un écart à la fin (seconde 63, −37,5 dB contre sa propre
  référence), alors que le rendu actuel restait à −82,8 dB de la référence. Relancé seul : vert (−83,0 dB). Ce n'est pas
  le code d'OCKA, mais le banc de comparaison ; à relancer seul en cas d'échec.
- **Captures 360×800** (`tests/e2e/captures/b-*.png`, relues à l'œil) : accueil, « Lance-moi un beat », réglages de
  l'IA, choix du style (6 styles, haut et bas), Au hasard, Beat (« Une autre idée »), Boucles OCKA, Mélodie, Structure
  (boutons IA), « Continue mon idée », « Aide aux paroles », autotune (repli), assistant de sortie, aide de l'assistant.
  Aucun débordement, texte lisible, **un seul « ? »** par écran (vérifié par le test).

### Changements demandés par les développeurs (faits)
- **B1** : la cloche du phonk est la cloche 808 accordée (`varianteNote('cloche', 'phonk')` = `'cowbell'`,
  `cowbellAccordee(f, 1,2 s)`), les autres styles ne changent pas (test) ; `api.ts` exporte Boucles OCKA, Au hasard,
  « Une autre idée » et l'écoute des boucles : l'interface passe par lui ; `aller-vite.css` importé par `main.tsx` ;
  `creerMorceauDepuis(m)` dans `ui/mes-morceaux.ts` (utilisé par le choix du style ET « Lance-moi un beat ») ;
  `nouveau()` des tests accepte les 6 styles. Les 2 erreurs de `ecoute.ts` étaient déjà corrigées (0 erreur).
- **B2** : `api.ts` expose les fonctions de `src/ia` (l'interface n'importe plus `src/ia`) ; « Lance-moi un beat »
  déclare musique **« ia »** (et paroles « ia » s'il en écrit), « Continue mon idée » et « Aide aux paroles » restent
  « aide », jamais de baisse (tests Vitest et e2e mis à jour). `master-js.qa.ts` : plus de `process`, compile.
- **B3** : `<BoutonAide />` dans l'en-tête de l'assistant de sortie, de l'accueil et du choix du style ; le « ? »
  flottant d'`App.tsx` est retiré. Délais RouteNote : « environ 3 à 5 semaines (21 à 23 jours ouvrés de vérification,
  puis la livraison) » dans l'aide, la fiche, l'assistant et le conseil de date ; défaut 6 semaines inchangé. La fiche
  de sortie reprend les liens de `src/ui/aide/liens.ts` (Musixmatch : la page d'aide de Musixmatch Pro).
- **B4** : `stockage/morceaux.test.ts` suit la nouvelle règle : autotune allumé dans le morceau, fichier
  `auto-<prise>-<force>-<tonalité>.f32` gardé ; une ancienne force et une prise morte sont effacées (5 fichiers).

### Bugs corrigés pendant l'intégration
1. **« Cycle detected » (@preact/signals) en dev** `aller-vite/idees.ts` → `ui/idees.ts`. Reproduit dans le journal
   du serveur de dev de B2 : `effect()` créé au chargement → `endBatch` → écriture de `versionIdees` dans un effet qui
   le lisait, relancé plus de 100 fois. Correction : plus aucun effet ; le fil des idées est oublié quand le numéro de
   séance change (`numeroSeance()` dans `ui/etat.ts`, une simple variable) ; `versionIdees` n'est écrit que par les
   gestes. Le fichier, qui dépendait de l'interface, passe dans `src/ui/`. Test : `ui/idees.test.ts`.
2. Double copie de « créer un morceau déjà fait » (choix du style et IA) : une seule fonction, avec le message d'erreur.

### Mineur (noté, non corrigé)
- Un toast (« Nouvelle idée… », « Prise enregistrée ») reste 4 s par-dessus un panneau ouvert juste après et cache une
  ligne pendant ce temps.

---

## Vague A (4 novembre 2026)

### Vérifications statiques
- `npx tsc --noEmit -p .` : 0 erreur. `npx vitest run` : 38 fichiers, 308 tests verts.
- `npx vite build` : bundle principal `index-*.js` **345,7 ko (116,7 ko gzip)**. Chargés à la demande : Mediabunny (728 ko)
  et l'encodeur AAC WebAssembly (1,13 Mo), mis en cache hors ligne par le service worker.
- Dev (`npx vite`) : la lecture marche dans Chrome (nœud `ocka-limiteur` créé, son en sortie, 0 erreur) depuis que
  Prefresh n'instrumente plus les modules des worklets (`vite.config.ts`).
- Aucun fichier de `src/` ni de `tests/` au-delà de 300 lignes (le plus long : `lecteur.ts`, 299).

## QA : 15 scénarios, 15 verts

| Scénario | Résultat |
|---|---|
| Trap / Drill / Lo-fi (WAV 24 bits) | durées exactes (68,571 / 67,606 / 112,941 s). **−14,0 LUFS**, −3,9 / −4,1 / −1,3 dBTP. 4,5 à 7,7 s |
| Trap « fort » 16 bits | **−11,1 LUFS, −2,2 dBTP**, pcm_s16le, durée exacte |
| Voix (faux micro) | prise sur le Couplet, 31 clics, **écart max 6,2 ms** (±20 ms). Calibrage : `signal_faible` (attendu) |
| Persistance, Annuler / Rétablir | OK (nouveau stockage : base `ocka-morceaux`, dossier `ocka-prises`) |
| Lecture : boucle de section en cours de lecture | 0 son en retard ; le son ne s'éteint plus à la fin du morceau |
| Performance | export 3 min en 9,7 s, −14,0 LUFS. Lecture : 70 pas, moyenne 108,3 ms, p95 125 ms, 0 saut |
| Sécurité | CSP du build = CSP de la source ; seules ouvertures : `'wasm-unsafe-eval'` et `worker-src blob:` ; jamais de `https:`. 0 requête sortante, 0 violation, 0 erreur |
| **Reproductibilité** (nouveau) | 3 exports du même trap : pas au bit près, **−85,0 dB** (même page) et **−88,6 dB** (après rechargement), crête de l'écart −81,5 dBFS, aucun décalage. Seuil −70 dB |
| **Test nul contre la phase 1** (nouveau) | morceau trap de la phase 1 (version 1, chaîne 1, sans mélodie), migré depuis `keyval-store`. Mix **−84,1 dB**, batterie −85,8, basse −127,6, accords −75,8 (nouvelle banque de notes) ; sonie identique (−14,0 / −14,0). Phase 1 contre sa référence : −84,1 dB |
| **Mémoire** (nouveau) | 12 dossiers FLAC de 3 min : tas JS plat (4,5 → 5,0 Mo, pente 0,1 Mo/export). Mémoire de Chrome : **+100 Mo par export**, voir « Problème de conception » |

## E2E : 7 verts (tests/e2e)
- **parcours**, **captures** (360×800 : Beat Mélodie, Structure avec boucle, Voix avec effets, Son A/B, Exporter, les 3 écrans
  de l'assistant, l'onglet Sorties ; aucun défilement horizontal ; relues à l'œil).
- **melodie** : 4 notes dans la grille → piste « Mélodie » des pistes séparées : 8 attaques, **écart 0,02 ms** (±2 ms). Sans mélodie : pas de piste.
- **sortie** : 2 titres de 34 s, assistant complet, pochette fabriquée, « Vérifier » sans bloquant ; `unzip -t` OK ; 2 FLAC
  décodés sans erreur (44 100 Hz, s16, 2 canaux) ; pochette 3000×3000 ; fiches ; noms sûrs (« Nuit: blanche » → `01 - Nuit blanche.flac`, « Route\Est » → `02 - Route-Est.flac`).
- **projet** : prise au faux micro, `.ocka` exporté puis réimporté : morceau identique (sauf clés de fichiers), PCM de la prise identique, même durée.
- **m4a** : aac, 44 100 Hz, 2 canaux, 256 kb/s, par le **secours WebAssembly** (ce Chrome Linux n'a pas d'AAC natif). Avec l'ancienne CSP, l'export restait bloqué.
- **pistes** : `unzip -t` OK, 3 WAV (batterie, basse, accords) en 32 bits flottants, non vides, de la bonne longueur.

## Bugs corrigés pendant l'intégration
1. **Chaîne 1 ≠ phase 1 (batterie jusqu'à +3 dB)** `moteur/graphe.ts`, `instruments/sources.ts`. Hors ligne, les gains des
   frappes ne sont plus débranchés : la réverbe de caisse claire (stéréo) restait active, et Chrome passait toute la piste batterie
   (mono) en stéréo, +3 dB (fin du morceau, mesures de break). Test nul : −35 dB. Correction : en chaîne 1, les envois de caisse
   et de clap sont débranchés à la fin du son, comme en phase 1 → −84 dB. (La chaîne 2 n'est pas touchée : batterie toujours stéréo.)
2. **Fuite mémoire à chaque export** `export-rendu.ts`, `stems.ts`, `ab.ts`, `instruments/sources.ts`, `instruments/banque.ts` :
   graphe et bus jamais détruits après un rendu hors ligne, `onended` jamais reçus, banque gardée. Corrigé (graphe, bus, banque
   lâchés, `onended` retirés, rendu repris par `ArrayBuffer.transfer`) : de ~110 Mo à ~64 Mo retenus par export de 3 min (reste : Chrome).
3. **M4A bloqué sans fin** si l'encodeur ne démarre pas (`m4a.ts`) : délai de 30 s par étape → `format_impossible` (3,4 s sous l'ancienne CSP).
4. **Dev** : Prefresh injectait du code HMR dans les worklets (et dans `crete.ts`, importé par le worklet) : exclus.
5. **Intégration** : CSP, `format_impossible`, docs des API, `BASES_IDB.versArko` (+ `magasin('versArko')` dans `arko/envoi.ts`),
   `ecartCalage` ré-exporté et branché dans le panneau Boucle, `graphe.latence` dans l'export, faux `port` du worklet, QA sur le nouveau stockage.

## Problème de conception (non corrigé)
**Chrome ne libère jamais un `OfflineAudioContext` où un AudioWorklet a été chargé** (le fil du worklet le retient, avec son tampon
de rendu interne) tant que la page vit : ~64 Mo par titre de 3 min, même avec un worklet vide (mesuré). La phase 1 avait déjà
ce défaut. Un album de 10 titres retient ~650 Mo : risque de fermeture de l'onglet sur un téléphone. Remède proposé (M1/M2) :
hors ligne, ne pas charger de worklet : rendre l'entrée du master (après la couleur), puis appliquer `MasterFlux` (le même code
que le worklet) et le fondu en JS, par blocs de 128 ; pour les pistes séparées, remplacer le worklet de capture par un
`ChannelMerger` à 12 canaux. En plus, chaque retour sur « Vérifier » décode la pochette 3000 px pour une vignette (~36 Mo de cache
d'images, purgeable) : une vignette réduite serait plus sobre.

## Mineur (noté)
- Le normaliseur arrondit les temps des prises au millième (déjà en phase 1) : jusqu'à 0,5 ms de décalage après réouverture ou import.
- Assistant : les rôles des crédits sont coupés à 360 px (« Compositeur (m… »).

## Pas vérifiable sans un vrai téléphone
Latence réelle et calibrage (le faux micro n'entend pas le chirp), Bluetooth, feuille de partage Android (« Envoyer vers Arko »),
AAC natif d'Android, Wake Lock et mise en veille, quotas et `persist()` réels, mémoire disponible pour un album, tenue au toucher.

## Vague B — B4 Moteur (5 novembre 2026)
- **Mémoire des exports corrigée** : plus AUCUN worklet hors ligne. Export et A/B : le rendu s'arrête à l'entrée du
  master ; `MasterFlux` + fondu appliqués en JS, en place (`moteur/audio/master-hors-ligne.ts`). Pistes séparées :
  `ChannelMerger` (2 canaux par piste), par passes de ≤ 128 Mo de rendu (2 pistes par passe pour 3 min).
  - `master-js.qa.ts` : JS contre worklet, chaînes 1 et 2, fondu compris : **−130,5 dB** (le master seul : au bit près).
  - 12 exports FLAC de 3 min (`memoire.qa.ts`, caches purgés par une alerte mémoire) : **+2 Mo/export** (avant : +100,
    dont ~64 retenus par le worklet et ~36 de pochette décodée, purgeable). Tas JS plat. Seuils : < 10 Mo/export.
  - Album de 12 titres de 3 min (`exporterDossierSortie`) : onglet **+13 Mo** après (ancien chemin : **+819 Mo**),
    crête de tout Chrome +336 Mo ; 128 s pour l'album.
  - Temps : 10,7 à 11,4 s par export de 3 min (avant : 11,2 à 12,4 s). Test nul −82,9 dB, reproductibilité −88,4 / −84,9 dB.
- **Autotune doux** (`src/autotune`) : `autotune.qa.ts` : 3 min de voix dans le Worker en **3,5 s** (PC) ; voix de
  synthèse fausse de 30 à 40 cents → **±3 cents** (Vitest, seuil ±15) ; bruit : repli, au bit près.
- `stockage/morceaux.test.ts` (A2) attendait l'ancienne règle « auto-<prise>… » : mis à jour à l'intégration (voir plus haut).
