# OCKA v2 — Contrat C3 (5 novembre 2026)

Base : C2 intégrée, puis nettoyage (chemin `workletHorsLigne` du master retiré). Code : `/home/claude/ocka/app`.
Complète `decisions-v2.md` (§1, §3, §6, §7 C3) et `brief-v2.md` (§F, points 1 à 11). 5 développeurs EN PARALLÈLE :
**P** (piano roll malin, MIDI), **S** (sons, SoundFonts), **L** (synthés), **R** (performance, looper, confort), **V** (voix).

## 0. Ce qui est FIGÉ (intégrateur : personne d'autre n'y touche)
- **Format `/3` inchangé** (types*.ts, normaliseur). Les champs de C3 y sont : `Section.perf`, `Morceau.marqueurs`,
  `soundfonts`, `tranchesPads`, `SonImporte.recette` / `tranches`, `PisteInstrument.synthe` / `swing`, `Note.glisse`.
- **Moteur** : `synthese/registre-synthes.ts`, `synthese/outils-notes.ts`, `instruments/notes.ts`, `planning.ts`,
  `instruments/{preparation,banque,pistes,fournisseur,jeu-gels,note-seule}.ts`, `graphe.ts`, `synthese/travaux.ts`,
  `gels.ts`, `types-moteur.ts` (`OptionsGraphe.gels`), `erreur.ts`, `api.ts` ; `morceau/acces.ts` (`syntheOcka`,
  `declarerSynthes`) ; `enregistrement/crochets-prise.ts`, `autotune/autotune.ts` (`lirePcmVoix` appelle le crochet).
- **Les 6 fichiers `api-*.ts` ci-dessous** : types et signatures (reliés par `relier` aux fichiers des devs).
- **Interface** : `ui/etat.ts` (`PANNEAUX` + `sonEdite`), `ui/navigation.ts` (`ouvrirX`), `ui/App.tsx`, `ui/lecture.ts`
  (`surGels` recharge le lecteur), `ui/composants/EntreesC3.tsx` (entrées, data-testid figés), `textes/index.ts`,
  `textes/entrees.ts`, `stockage/dossiers.ts`.
- **Tests du contrat** : `moteur/contrat-c3.test.ts`, `synthese/registre-synthes.test.ts` (test nul des 6 sons v1),
  `synthese/plomberie-synthes.test.ts`, `tests/e2e/contrat-c3.spec.ts`, `tests/qa/gels.qa.ts` (test nul des gels).
- Stockage ajouté : OPFS `ocka-references` (V), `ocka-gels` (V, R) ; IndexedDB `ocka-confort` (R).
- Codes d'erreur ajoutés : `midi_illisible`, `midi_indisponible` (P), `sf2_illisible`, `sf2_trop_lourd` (S),
  `reference_illisible` (V).

## 1. Points d'extension (déjà branchés, rien à changer ailleurs)
- **Registre des synthés** : un fichier `moteur/synthese/synthes/<id>.ts` = `export default` une `DefinitionSynthe`
  (api-synthes.ts : `id`, `nom`, `famille`, `motsCles`, `pret`, `params` 0–1 avec `crans`, `points`, `relache`, `tenu`,
  `mode`, `rendreNote(midi, reglages, variante)` SANS durée ou `rendreMotif(notes, duree, reglages)`), + 1 ligne dans
  `synthes/index.ts`. Instrument « `ocka-<id>@1` ». `pret: false` = muet, absent du catalogue, conseil du normaliseur.
  `pret: true` → déclaré au normaliseur, ajouté à « + Piste » (`instrumentsSynthes`), joué par le Worker (clé de cache
  = son, midi, empreinte des réglages ; `''` pour les défauts). Mode **« motif »** (303) : un événement par passage du
  motif dans la section (`planning.ts`), notes en secondes, slide = `Note.glisse` → `glisse` (note MIDI suivante),
  accent = `vel ≥ 0,8`, un tampon par passage (même passage = même clé), joué au gain `GAIN_NOTE`. Une note seule
  d'un synthé « motif » (pads, piano roll) = un passage d'une note.
- **Gels** (`moteur/gels.ts`) : `Gel { piste, de, a, pcm (stéréo, après la tranche, commence à de), cle }`. Le graphe
  (écoute ET export, pistes séparées, A/B) les demande à `outilsGels.fournisseurs` = [R `gelsPerformance`, V
  `gelsPistes`] : la porte de la piste se ferme pendant [de, a[ et le rendu joue à sa place (coupure nette, même
  échantillon). Gel entier (de = 0, a ≥ durée) : les notes de la piste ne sont plus ni préparées ni jouées. Outil
  commun : `rendrePistesSeparees(m, ids, de, a, frequence)` (0,5 s rendues avant `de`). Écoute : `attendre` = false →
  seulement ce qui est prêt, le reste en tâche de fond puis `prevenirGels()`. Effets de perf dans le Worker :
  travail `{ type: 'perf', canaux, effet, secondesParPas }` → `appliquerEffetPerf` (registre `EFFETS_PERF` de R,
  `moteur/effets-perf.ts`, chargé DANS le Worker : fonctions pures, aucun Web Audio, aucun import du graphe).
  Test nul : `gels.qa.ts` (basse entière + accords 2–6 s gelés tels quels : ≤ −90 dB).
- **Crochet des prises** : `lirePcmVoix` (écoute et export) → autotune → `crochetPrise` → V `traiterPrise(prise, m,
  pcm, attendre)` : le MÊME objet si rien ne change, sinon un nouveau `PcmVoix` (`version` changée).
- **Pads découpés** : un pad perso joue `son.tranches[tranchesPads[pad]]` (clé et tampon de la découpe) ; le son
  entier sinon. **SoundFonts** : `fournisseur.ts` envoie les ids `sf2-…` vers `chargerSourceSf2` / `lireZoneSf2` (S).
  **Métronome** : la banque du lecteur prend `signalClic(fort, frequence, metronomeChoisi())` (R ; « clic » = celui
  d'avant). **Raccourcis** : `App.tsx` appelle `raccourciC3(e)` (R) avant les siens.

## 2. P — piano roll malin, MIDI
- **Fichiers** : `ui/edition/outils-notes.ts`, `midi/midi.ts`, `midi/web-midi.ts` (+ nouveaux fichiers dans `src/midi/`),
  `ui/composants/outils-notes/*` (`PanneauOutilsNotes`, `PanneauMidi`), `textes/outils-notes.ts`, leurs tests.
- **Signatures** (`ui/edition/api-outils-notes.ts`) : `arpeger`, `gratter` (strum), `humaniser`, `reglerGlisse`,
  `reglerSwingPiste`, `riffMachine` (graine, gamme, style, densité), `notesFantomes` ; réutilise `poserAccord` et
  `quantifier` (force déjà là, C1). (`midi/api-midi.ts`) : `importerMidi(octets, m)`, `exporterMidi(m)`,
  `listerAppareilsMidi`, `jouerMidiDirect(lecteur, o)`, `enregistrerMidi(lecteur, m, o)`.
- Entrées : `pr-outils-malins`, `pr-midi` (menu Outils du piano roll Complet), `pistes-midi` (vue Pistes).

## 3. S — découpe, éditeur, WSOLA, BPM, tonalité, SoundFonts
- **Fichiers** : `sons/avances.ts` (+ nouveaux dans `src/sons/`, sauf `import.ts`), `sf2/sf2.ts` (+ `src/sf2/*`, Worker
  d'analyse), `ui/composants/sons-avances/*` (`PanneauEditeurSon`), `textes/sons-avances.ts`, leurs tests.
- **Signatures** (`sons/api-sons-avances.ts`) : `decouperAttaques`, `decouperEgal`, `poserDecoupes`, `tranchesVersPads`,
  `editerSon(m, idSon, OperationSon)` (couper, fondu, normaliser, inverser → NOUVEAU son importé), `etirerPcm`,
  `etirerSon` (WSOLA ±20 %), `detecterBpm` (bpm, double, moitié), `detecterTonaliteSon` (2 choix). (`sf2/api-sf2.ts`) :
  `importerSoundfont`, `presetsSoundfont`, `ajouterSoundfont`, `supprimerSoundfont` ; `TAILLE_MAX_SF2` 32 Mo,
  `MEMOIRE_MAX_SF2` 64 Mio ; presets « `sf2-<id>-<banque>-<preset>@1` » déclarés par `declarerInstruments`.
- Entrée : `son-editer` (« Tes sons », un son choisi ; `sonEdite`).

## 4. L — synthés, sons courts
- **Fichiers** : `moteur/synthese/synthes/*` (dont `index.ts`, `reglages.ts`, `sons-courts.ts` ; bouchons `303.ts`,
  `nes.ts`, `onde.ts` en `pret: false`), `ui/composants/synthe/*` (`PanneauSynthe`, `PanneauSonsCourts`),
  `textes/synthes.ts`, leurs tests. **Les 6 sons v1 (`piano` … `nappe`) ne changent JAMAIS** (empreintes testées).
- **À faire** : 303 (mode « motif »), chiptune NES (impulsion 12,5/25/50 %, triangle, bruit), onde dessinée (64
  points, `tablesOnde` en plusieurs résolutions), supersaw, chœurs (formants, d'après `voix-synthese.ts`), log drum,
  cuivres en section, Rhodes et Wurlitzer modaux, piano jouet, célesta, steel drum (un fichier chacun).
- **Signatures** (`moteur/api-synthes.ts`) : `reglerParamSynthe`, `dessinerOnde`, `tablesOnde`, `kickParDefaut`,
  `sfxrAuHasard(categorie, graine)`, `fabriquerSon(recette)`, `enregistrerSonFabrique(recette, nom, m)` (par
  `importerSon` d'un WAV ; recette gardée). Lecture seule : `instrumentsSynthes`, `definitionSynthe`, `reglagesLus`.
- LFO : l'interface existe déjà (C1, `PanneauAutomation`) ; le panneau Synthé peut y renvoyer.
- Entrées : `pr-synthe` (pistes « ocka-… »), `sons-fabriquer` (« Tes sons »).

## 5. R — performance, looper, confort, marqueurs
- **Fichiers** : `moteur/performance.ts`, `moteur/effets-perf.ts`, `moteur/looper.ts`, `moteur/confort.ts` (+ nouveaux dans
  `src/moteur/perf/` si besoin), `ui/looper/*` (`PanneauLooper`, `PanneauPerformance`, `PanneauConfort`,
  `raccourcis.ts`), `textes/performance.ts`, leurs tests.
- **Signatures** (`moteur/api-performance.ts`) : `ajouterEffetPerf`, `reglerEffetPerf`, `retirerEffetPerf` ; registre
  `EFFETS_PERF` (effets-perf.ts : stutter, demi-tempo, tape-stop, gate, reverse ; PURES, même longueur, sans clic) et
  `gelsPerformance` (performance.ts) ; looper : `grilleLooper`, `creerLooper(lecteur, m)` (lancement à la mesure, par le Lecteur
  public), `journalVersMorceau` ; confort : `tapTempo`, `metronomeChoisi`, `reglerMetronome` (`SONS_METRONOME`),
  `etapesHistorique`, modèles (`listerModeles`, `sauverModele`, `supprimerModele`, `appliquerModele`), marqueurs
  (`ajouterMarqueur`, `modifierMarqueur`, `retirerMarqueur`, `marqueursPlaces`).
- Entrées : `structure-looper`, `structure-perf` (Structure), `ouvrir-confort` (en-tête).

## 6. V — punch-in, comping, nettoyeur, doublage, chaînes, référence, gel
- **Fichiers** : `enregistrement/voix-avancee.ts` (+ nouveaux dans `src/enregistrement/`, sauf ceux d'avant),
  `moteur/reference.ts`, `moteur/gel.ts`, `ui/composants/voix-avancee/*` (`PanneauVoixAvancee`, `PanneauReference`),
  `textes/voix-avancee.ts`, leurs tests.
- **Signatures** (`enregistrement/api-voix-avancee.ts`) : `creerPunch` (`ZonePunch`, pré-roll 1–2 mesures),
  `assemblerComp(m, section, occurrence, PassageComp[])`, `nettoyerPrise` (porte, réduction spectrale, désesseur),
  `doublerPrise`, `ecouterReglage` (crochet), `chainesVoix`, `appliquerChaineVoix` (inserts C1 de la piste voix),
  `importerReference` (Mediabunny, en flux), `listerReferences`, `supprimerReference`, `creerEcouteReference`
  (A/B au même volume perçu, le Lecteur n'est pas modifié), `gelerPiste`, `degelerPiste`, `pistesGelees`.
- **Règle (format)** : punch-in, comping, nettoyeur et doublage écrivent une NOUVELLE prise (fichier OPFS, même ancre,
  même alignement), choisie à la place de la source, gardée non choisie (Annuler la rechoisit).
- Entrées : `voix-avancee` (Voix), `son-reference` (Son).

## 7. Règles communes
- Pas de git, aucune dépendance, fichiers < 300 lignes, en français. On ne touche qu'à SES fichiers ; un besoin ailleurs
  ou un défaut du contrat → le rapport. Ne renommer ni déplacer aucun dossier (en créer un nouveau est permis).
- Un bouchon remplacé garde sa signature exacte (tsc échoue sinon). L'interface n'importe que `moteur/api.ts`,
  `src/morceau` et `ui/edition/api-*.ts` ; erreurs = `ErreurOcka` ; tant qu'une fonction lève `pas_encore` : un
  message « bientôt », jamais de plantage. Les panneaux montrent eux-mêmes ce qui est « Avancé » (decisions §6).
- Morceau : fonctions PURES, même objet si rien ne change, `normaliserMorceau(x).problemes` vide, un Annuler.
- Un seul chemin de son (`construireGraphe`) ; **export : aucun worklet** ; calculs lourds dans un Worker ; rien ne
  part en ligne. Aucun data-testid existant ne change ; textes seulement dans son fichier (groupes uniques).
- Avant de rendre : `npx tsc --noEmit -p .` = 0 ; `npx vitest run` ; `npx vite build` PUIS `npx playwright test` ;
  QA (`npx vite --port 5198 --strictPort` ouvert) : `npx playwright test -c tests/qa/playwright.qa.config.ts`
  — au moins `test-nul-v2 test-nul gels memoire securite` (L : le registre ; R, V : les gels ; tous : le test nul).
- Rapport : fichiers touchés, signatures implémentées, écarts, tests ajoutés, mesures (CPU, mémoire, latence).

## 8. Écarts (et pourquoi)
- **Comping, nettoyeur, doublage : pas de champ dans le format** (le §1 ne les a pas gelés). Plutôt qu'un `/3` modifié
  (un OCKA C2 perdrait ces réglages sans rien dire), leur résultat est une nouvelle prise ; le crochet ne sert qu'à
  écouter un réglage avant de l'appliquer. Doublage : mono (même prise) ; la largeur stéréo reste `effets.doubler`.
  À trancher par Romain : un champ `Prise.voix?` dans une version future du format.
- **Gel d'une piste** : pas dans le format (il ne change pas le son) : l'état vit dans la séance. Les envois partagés
  (réverbe, écho) d'une piste gelée ne sont pas gelés ; sa tranche reste branchée (silencieuse).
- **SoundFont** : 32 Mo par fichier à l'import (le format accepte 64 Mo : un projet venu d'ailleurs reste lisible).
- `optionsInserts.workletHorsLigne` (chaîne des inserts) est GARDÉ : il ne sert qu'au banc QA (écoute simulée,
  worklet contre JS, decisions §3) ; l'export ne l'utilise jamais.
- Les 6 sons v1 passent par le registre ; leurs fonctions restent dans `instruments/melodie*.ts` (son figé).
