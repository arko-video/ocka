# OCKA v2 — Contrat C2 (5 novembre 2026)

Base : C1 intégrée. Au contrat : tsc = 0, Vitest 902/902 (63 fichiers), e2e 24/24 (dont `contrat-c2.spec.ts`), QA `test-nul-v2` verte.
Code : `/home/claude/ocka/app`. Ce contrat complète `decisions-v2.md` (§4 à §7) et `brief-v2.md` (§C, D, E).

## 0. Ce qui est FIGÉ (fichiers de l'intégrateur : personne d'autre n'y touche)
- `morceau/types.ts` : `STYLES` (35 ids). `Prise.autotune` (`AutotunePrise`, `NoteAutotune`, types-ajouts.ts) : inchangé.
- `morceau/styles/definition.ts` (type `DefinitionStyle`), `styles/index.ts` (registre), `styles.ts`, `styles-motifs.ts`,
  et les 6 styles d'avant : `styles/{trap,drill,lofi,phonk,pop,boombap}.ts` (son figé : empreintes + test nul).
- `autotune/api-autotune.ts`, `dubler/api-dubler.ts` : types et signatures (reliés par `relier` aux fichiers des devs).
- `ui/etat.ts`, `ui/navigation.ts`, `ui/App.tsx`, `textes/index.ts`, `stockage/dossiers.ts`, `ia/requetes.ts`,
  `moteur/*` (le moteur lit le son des styles dans le registre), `composants/pianoroll/BarreOutils.tsx`,
  `composants/pistes/VueInstruments.tsx`, `moteur/contrat.test.ts`, `morceau/styles/registre.test.ts`, `e2e/contrat-c2.spec.ts`.
- Panneaux (etat.PANNEAUX) : `editeurAutotune` (`priseEditee`, `ouvrirEditeurAutotune(idPrise)`), `chanter`
  (`pisteEditee`, `ouvrirChanter(idPiste)`), `beatbox` (`ouvrirBeatbox()`). Entrées : « Notes » d'une prise (Voix,
  « Avancé », `editer-notes-prise`), `pr-chanter` (piano roll Complet), `pistes-chanter` (vue Pistes), `beatbox` (Batterie).
- Codes d'erreur ajoutés : `entrainement_incomplet`, `reponse_ia_invalide`. Base IndexedDB : `BASES_IDB.dubler` (`ocka-dubler`).

## 1. Le style (S1, S2) : `export default` un `DefinitionStyle` dans `morceau/styles/<id>.ts`
`{ id, famille, textes:{nom (≤ 20), phrase}, genre, reglages, batterie, basse, suites, instrumentsParDefaut, boucles, son, onde? }`
- `famille` : `rap | electro | monde | poprockjazz | cinema`. `genre` : une clé de `GENRES` (textes/sortie.ts).
- `reglages` : `tempo` (dans `plage`, 60–200), `plage`, `swing` (0–0,6), `tonique`, `mode`, `son` (accords : piano |
  nappe | cloche), `preset` (master), `kit: '<id>@1'`, `volumes?`, `muettes?` (ex. couper la 808 si une contrebasse joue).
- `batterie()` : 4 motifs (intro, couplet, refrain, pont) en grilles (`motifBatterie`, styles-grilles.ts) ;
  `basse()` : 808 couplet / refrain (`quatreMesures`, `n`) ; `suites` : exactement 3 (la 1re = morceau neuf).
- `instrumentsParDefaut` : `{ id, nom, instrument, role, volume?, pan?, notes? }`. La 1re a l'id **`melodie`**
  (pads Simple, Boucles OCKA, hasard). `instrument` = id de la banque (`listerInstruments`, catalogue de BQ) ou
  `ocka-<son>@1`. `role` : melodie | accords | nappe | arpege | contrechant | lead | basse | percussions.
  `notes: { ecrire, sections, idMotif, depuis? }` : `ecrire` = un type de Boucle OCKA ou une fonction PURE
  `(m, idSection) => MotifNotes` écrite dans le fichier du style (accords plaqués, contrebasse, percussions…).
- `boucles` : les 6 types de Boucles OCKA, chacun une fois, avec un son OCKA (`SonMelodie`).
- `son` : `kits: { '<id>@1': ReglagesKit }` (kick, snare, charley, sourdine, perc Hz, bande, coupeBas, cowbell,
  vinyle, cretes) ; `basse808?` (tau, force, passeBas, glisse) ; `fill?` (frappes 8–15 de la dernière mesure) ;
  `variantes?` (`epiano: 'lofi'`, `cloche: 'cowbell'`). Batteries enregistrées (rock, jazz…) : une piste instrument
  de rôle `percussions` (instrument de la banque), le kit synthétisé restant discret (`volumes.batterie`).
- **Un style fini** : retirer `// provisoire — C2` et l'appel à `copieProvisoire` (plus de `provisoire: true`).
  Il doit SONNER comme son style (tempo, groove, kit, 808, accords, instruments). Une fois livré, son kit `@1` ne
  change plus (sinon `@2`).
- Le registre l'a déjà : rien à changer dans index.ts, accueil.ts, boucles.ts, sorties.ts, ChoixStyle ou le moteur.

## 2. S1 — les 9 styles rap
- **Fichiers** : `morceau/styles/{rage,plugg,cloud,jerseyclub,afrotrap,rapmelodique,jazzrap,ukdrill,memphis}.ts`,
  `textes/styles-rap.ts` (groupe `stylesRap`), `morceau/styles/rap.test.ts` (nouveau).
- **Implémente** : `export default` un `DefinitionStyle` par fichier (§1).
- **Consomme** (lecture seule) : `styles-grilles.ts` (`motifBatterie`, `n`, `quatreMesures`), `aller-vite/boucles.ts`
  (`ecrireBoucle`, `TypeBoucle`), `morceau/theorie.ts`, `MELODIE_PIANO` (definition.ts), catalogue de BQ (ids).
- Tests : chaque style se distingue de sa base provisoire (motifs, kit, 808) ; `registre.test.ts` reste vert.

## 3. S2 — les 20 autres styles et l'écran du choix par familles
- **Fichiers** : `morceau/styles/{hyperpop,bossanova,rnb,afrobeats,reggaeton,amapiano,house,techno,dnb,ukgarage,
  synthwave,jazz,rock,poppunk,funk,reggae,gospel,orchestral,ambient,kpop}.ts`, `ui/ecrans/ChoixStyle.tsx`,
  `ui/styles/choix-style.css` (couleurs des cartes par style comprises), `textes/styles-autres.ts` (groupe
  `choixStyle` : familles, recherche), `morceau/styles/autres.test.ts` (nouveau), `tests/e2e/choix-style.spec.ts`.
- **Implémente** : les 20 `DefinitionStyle` (§1) ; l'écran : familles (`FAMILLES_STYLES`, `stylesDeFamille`),
  recherche (nom et id, sans accents), carte « Au hasard » gardée. data-testid gardés : `style-<id>`, `style-hasard`,
  `hasard-*`, `ecran-styles`, `recherche-style`, `famille-<famille>` ; classe `.carte-style` sur chaque style (35).
- **Consomme** : comme S1 ; `ideeAuHasard`, `creerMorceau`, `T.styles`, `T.allerVite`.

## 4. A1 — moteur de l'autotune avancé et IA
- **Fichiers** : `src/autotune/*` sauf `api-autotune.ts` (dont `avance.ts`, `autotune.ts`, `correction.ts`,
  `autotune.worker.ts`, nouveaux fichiers), `src/ia/autotune.ts` ; leurs tests Vitest ; `tests/qa/autotune*.qa.ts`.
- **Implémente** (`avance.ts`, signatures de `api-autotune.ts`) :
  - `analyserNotes(prise, options?) → Promise<AnalyseNotes>` (courbe `CourbeHauteur` + `NoteDetectee[]`, Worker, cache) ;
  - `detecterGamme(notes) → GammeDetectee[]` (2 au plus) ; `reglagesPreset(preset) → AutotunePrise` ;
    `reglagesDeForce(force) → AutotunePrise` (le curseur actuel = un préréglage : même son, testé) ;
  - `nomRenduAutotune(prise, reglages, tonalite) → string` ; `rendreAutotune(prise, reglages, tonalite, options?)
    → Promise<PcmVoix | null>` (PSOLA, décalage des formants, seule la note changée recalculée ±100 ms) ;
  - `corrigerToutSeul(analyse, tonalite) → ConseilAutotune` ; `appliquerConseil(m, idPrise, conseil) → Morceau` (pur).
  - Dans `autotune.ts` : `lirePcmVoix` et `preparerAutotuneMorceau` jouent le rendu dès que `Prise.autotune` existe
    (écoute = export) ; `fichiersAutotune` garde les rendus (ménage).
  - IA (`ia/autotune.ts`) : `requeteAutotune(notes, { tonalite, style, tempo }) → Requete` (action `autotune`, notes
    seulement, jamais l'audio, `MAX_NOTES_IA`) et `lireAutotune(texte, analyse) → ConseilAutotune` (liste blanche,
    erreur `reponse_ia_invalide`).
- **Consomme** : `yin.ts`, `psola.ts`, `gamme.ts` (les siens), `enregistrement/prises.ts` (`lirePrise`),
  `fichiers-opfs.ts`, `ia/appel.ts` (`demander`), `ia/consignes.ts` (`donnees`), `ia/liste-blanche.ts`.

## 5. A2 — interface de l'autotune et éditeur de notes
- **Fichiers** : `ui/ecrans/Voix.tsx`, `ui/composants/voix/*` (dont `EditeurNotes.tsx`, déjà branché),
  `ui/edition/autotune.ts` (nouveau : éditions PURES de `Prise.autotune` — préréglage, réglages, déplacer, couper,
  fusionner une note, justesse, vibrato), `ui/styles/voix.css`, `textes/autotune.ts` (groupe `autotuneAvance`),
  `tests/e2e/autotune-avance.spec.ts`.
- **Implémente** : préréglages Naturel / Pop / Robot / Hyperpop et réglages (gamme détectée ou choisie, vitesse
  0–400 ms, force, humaniser, formants) dans Voix ; l'éditeur (courbe sur un piano roll, blocs de notes) dans
  le panneau `editeurAutotune` ; « Corriger tout seul » et « Aide de l'IA » (coût affiché avant, un seul Annuler).
- **Consomme** (par `moteur/api.ts`) : tout `api-autotune.ts` ; `requeteAutotune`, `lireAutotune`, `demander`,
  `estimerCout`, `texteEnvoye` (`ia/index.ts`) ; `modifier`, `priseEditee`, `modeAvance`, `ouvrirEditeurAutotune`.
  Tant qu'une fonction lève `pas_encore` : un message « bientôt », jamais de plantage.

## 6. D — Ta voix → instrument (Chanter) et Beatbox
- **Fichiers** : `src/dubler/*` sauf `api-dubler.ts` (dont `dubler.ts`, le worklet, le détecteur, le beatbox),
  `ui/composants/dubler/*` (`PanneauChanter.tsx`, `PanneauBeatbox.tsx` déjà branchés, roue des 12 notes…),
  `ui/composants/beat/VueBatterie.tsx` (bouton `beatbox`, déjà posé), `textes/dubler.ts` (groupes `chanter`,
  `beatbox`), leurs tests, `tests/e2e/dubler.spec.ts`.
- **Implémente** (`dubler.ts`, signatures de `api-dubler.ts`) : `demarrerDirect(m, ReglagesDirect)`, `reglerDirect`,
  `arreterDirect`, `noteCourante() → NoteCourante` (silence hors du direct), `accordChante(midi, tonalite, type)` ;
  beatbox : `mesuresAttaque`, `detecterAttaques`, `classerAttaque` (k-NN, k = 3), `enregistrerExemple`,
  `lireEntrainement` / `sauverEntrainement` (`magasin('dubler')`), `demarrerBeatbox`, `arreterBeatbox` ;
  notes : `demarrerEnregistrementNotes`, `arreterEnregistrementNotes → NotesChantees`, `quantifierNotesChantees`,
  `poserNotesChantees` (pur) ; `mesurerLatenceDetection(mode) → LatenceDetection`.
- **Consomme** (lecture seule) : `autotune/yin.ts` et `gamme.ts` (A1 : ne pas les modifier ; copier une fonction
  si besoin), `enregistrement/micro.ts` (`ouvrirMicro`, `fermerMicro`), `contexte.ts`, `latence.ts`
  (`latenceMemorisee`, `ajustementLatence`), `chargerSource` / `lireZone` (instruments), `ui/lecture.ts` (lecteur),
  `voix-synthese.ts` (signaux de test), `pisteEditee`, `ouvrirChanter`, `ouvrirBeatbox`.
- Honnêteté : 100 à 200 ms de retard en direct sur Android (casque filaire), plus en Bluetooth ; l'enregistrement est recalé.

## 7. Règles communes
- Pas de git, aucune dépendance, fichiers < 300 lignes, en français. On ne touche qu'à SES fichiers ; un besoin
  hors de ses fichiers ou un défaut du contrat → le dire à l'intégrateur (rapport), ne pas le contourner.
- Aucun data-testid existant ne change. Textes : seulement dans son fichier de textes, groupes uniques (test).
- L'interface n'importe que `moteur/api.ts` et `src/morceau` ; erreurs = `ErreurOcka` (message en français).
- Rien ne part en ligne sauf l'IA (clé de l'utilisateur, après un geste) : jamais l'audio.
- Avant de rendre : `npx tsc --noEmit` = 0, `npx vitest run` vert, `npx vite build` PUIS `npx playwright test`
  (de vieux serveurs de preview sont réutilisés), et `npx playwright test -c tests/qa/playwright.qa.config.ts
  test-nul-v2` vert (S1, S2 : le son des 6 styles d'avant ne bouge pas ; A1 : la voix non plus sans `Prise.autotune`).
- Rapport : fichiers touchés, signatures implémentées, écarts, tests ajoutés, mesures (latence, réussite du beatbox).
