# OCKA v2 — Contrat C1 (figé au contrat C0, 5 novembre 2026)

Ce document dit, pour chaque développeur de la vague C1, ce qu'il possède, ce qu'il implémente et ce qu'il consomme.
Il complète `decisions-v2.md` (qui fait foi). Le code du contrat est dans `app/` ; tout est vert à la fin de C0.

## 1. Ce qui est figé (ne pas changer sans demande dans le rapport)
- **Format `ocka.morceau/3`, en entier jusqu'aux champs de C3** : `src/morceau/types.ts` (+ `types-regles.ts`
  règles et PLAFONDS, `types-mixage.ts` tranche/inserts/automation/LFO/sidechain, `types-ajouts.ts` perf, marqueurs,
  SoundFonts, recettes, découpes, autotune de prise, synthé). **Plafonds = constantes exportées** (`PLAFONDS`,
  `BORNES_NOTE`, `PARAMS_EFFETS`, `GRILLE_PAS` = 24).
- **Normaliseur** (lit /1, /2, /3, écrit /3, idempotent) : `normaliser.ts`, `migration-v3.ts`, `normaliser-pistes.ts`,
  `normaliser-mixage.ts`, `normaliser-v3.ts`, `normaliser-motifs.ts`, `normaliser-sections.ts`, `normaliser-ajouts.ts`.
- **Accesseurs** : `src/morceau/acces.ts`. Ne JAMAIS lire `section.motifs.<piste>` ni `m.motifs[id]` à la main.
- **Signatures C1** : `src/moteur/api-instruments.ts` (BQ), `api-effets.ts` (M2), `api.ts` (`Lecteur.entendreNote`,
  `Lecteur.notesMuettes`), `src/ui/edition/api-edition.ts` (U1, U2), `src/moteur/types-moteur.ts` (`OptionsGraphe.
  pistesSeparees: Record<string, AudioNode>`, `OptionsNote`, `ZoneSource`, `SourceZones`, `ChaineInserts`,
  `Echantillonneur`). Les bouchons lèvent `ErreurOcka('Bientôt disponible', 'pas_encore')`.
- **Interface** : `ui/etat.ts` (`vueBeat` « batterie | instruments », `vueStructure`, `PANNEAUX`, `pisteEditee`,
  `modePianoRoll`, `modeAvance`/`reglerAvance`), `ui/navigation.ts` (`ouvrirPianoRoll`, `ouvrirEffets`), `ui/App.tsx`
  (panneaux branchés), `stockage/dossiers.ts` (`DOSSIERS_OPFS.sf2` = `ocka-sf2`, `CACHES.instruments` =
  `ocka-instruments`, `cacheOcka()`), textes : un fichier par développeur dans `src/textes/`.
- **data-testid** : tous gardés. `vue-melodie` est un alias (un `<span>` dans le bouton `vue-instruments`) qui
  ouvre la vue Instruments, où la mélodie (mode Simple) reste affichée telle quelle.

## 2. Règles communes
- Pas de git. Aucune dépendance npm. Fichiers < 300 lignes, en français. On n'écrit que dans SES fichiers ;
  un besoin ailleurs = une demande dans le rapport (l'intégrateur tranche).
- Morceau : fonctions PURES (nouveau morceau ou le même objet si rien ne change), résultat accepté par le
  normaliseur SANS problème (tester `normaliserMorceau(x).problemes` vide). Dictionnaires sans prototype
  (`Object.create(null)`), lus avec `Object.hasOwn`.
- Pistes : 5 fixes (`IDS_FIXES` : batterie, basse, accords, sons, voix) + 16 pistes instrument au plus. Ordre écrit :
  batterie, basse, accords, instruments…, sons, voix. Un id de piste instrument n'est jamais un id fixe
  (`idPisteLibre`). Section → `motifs[idPiste] = idMotif` ; instrument → `MotifNotes` ; notes sur la grille du
  1/24 de pas, `vel` 0,1 à 1 (l'échantillonneur prend `vel × 127` pour la couche et `vel^1,6` pour le gain).
- Instruments : `ocka-<son>@1` = sons v1 (piano, epiano, lead, pluck, cloche, nappe), joués comme avant. Inconnu
  mais bien écrit (`REGLE_INSTRUMENT`) : gardé, conseil du normaliseur, **muet** et compté (`Graphe.muettes`,
  `Lecteur.notesMuettes`) ; mal écrit : `ocka-piano@1`. BQ déclare son catalogue par `declarerInstruments(ids)`.
- Un seul chemin de son (`construireGraphe`) pour l'écoute et l'export. Export : aucun worklet.
- **Tests à chaque vague** (decisions §7) + `tests/qa/test-nul-v2.qa.ts` (corpus /2, références v1) DOIT rester vert :
  ≤ −90 dB batterie, 808, voix (pistes séparées) ; ≤ −80 dB le reste et le mix.
- Lancer : `npx tsc --noEmit -p .` ; `npx vitest run` ; `npx playwright test` (tests/e2e) ;
  `npx playwright test -c tests/qa/playwright.qa.config.ts test-nul-v2 test-nul memoire securite`.

## 3. BQ — banque d'instruments
- **Possède** : `public/instruments/**`, `outils/instruments/**`, `src/instruments/**`, `CREDITS.md`, `src/textes/bq.ts`.
- **Implémente** (bouchons dans `src/moteur/api-instruments.ts`, objet `bouchonsBQ` : BQ remplace SEULEMENT les
  lignes `relier(() => bouchonsBQ.x)` par `relier(() => sonModule.x)`) :
  `listerInstruments(): Promise<InfoInstrument[]>` · `telechargerInstrument(id, {surProgression, signal})` ·
  `instrumentsInstalles(): Promise<{id, octets}[]>` · `supprimerInstrument(id)` · `tailleInstruments(): Promise<number>`
  · `instrumentsManquants(m): Promise<string[]>` · `preparerInstrumentsExport(m, options)` (hors ligne →
  « hors_ligne », jamais de piste muette à l'export) · `chargerSource(id, signal?): Promise<SourceZones>` ·
  `lireZone(id, fichier, signal?): Promise<PcmSon>`. Codes : `hors_ligne`, `instrument_inconnu`,
  `instrument_corrompu`, `instrument_absent`, `disque_plein`, `annule`.
- **Consomme** : `cacheOcka('instruments')` (stockage/dossiers.ts), `declarerInstruments` (morceau/acces.ts),
  `SourceZones`/`ZoneSource` (types-moteur.ts : `InstrumentJson` doit y rester assignable, test dans contrat.test.ts),
  `FAMILLES_INSTRUMENTS` (ses `FAMILLES` en sont un sous-ensemble).

## 4. M1 — N pistes, échantillonneur, test nul
- **Possède** : `graphe.ts`, `planning.ts`, `lecteur.ts`, `moteur/instruments/*` (dont `echantillonneur.ts`,
  bouchon), `moteur/synthese/*`, `src/textes/moteur.ts`.
- **Implémente** : `creerEchantillonneur(ctx, source): Echantillonneur` (`moteur/instruments/echantillonneur.ts`) ;
  jeu des pistes instrument non-`ocka` dans le graphe (aujourd'hui `Evenement.note.son === null` → muet compté) ;
  `Lecteur.entendreNote(piste, midi, {vel, instrument, duree})` pour tous les instruments ; glissé (`Note.glisse`) ;
  swing par piste (`PisteInstrument.swing`) ; préparation par zones jouées (budget 128 Mio).
- **Consomme** : `chargerSource`, `lireZone` (BQ) ; `ChaineInserts`, `programmerAutomation`, `gainsSidechain` (M2) ;
  accesseurs `pistesInstrument`, `motifNotesDe`, `sonOcka`, `sonDeLaPiste` (preparation.ts).
- **Ne change pas le son des morceaux /2** : `PAN_DEFAUT.melodie` ne vaut que pour la piste d'id `melodie`.

## 5. M2 — inserts, sidechain, automation, LFO, pistes séparées
- **Possède** : `chaines.ts`, `moteur/effets/*` (`inserts.ts`, bouchon), `automation.ts` (bouchon), `sidechain.ts`
  (bouchon), `stems.ts`, `ab.ts`, `src/textes/effets.ts`.
- **Implémente** (déclarés dans `api-effets.ts`) : `insertParDefaut(type, id)` · `presetsInserts()` ·
  `valeurCible(m, idPiste, cible, t)` · `valeurReelle(piste, cible, v)` · `gainsSidechain(m, idPiste, de, a)` ; internes :
  `creerChaineInserts(ctx, piste, horsLigne): ChaineInserts`, `traiterInsertsJs(canaux, frequence, inserts)`,
  `programmerAutomation(m, idPiste, params, de, a, origine)`. `exporterPistes` : déjà une piste par piste
  (`nomsFichiers` : nom de la piste instrument, « Nom (2) » en cas de doublon).
- **Consomme** : `PARAMS_EFFETS`, `Cible`, `Courbe`, `Lfo`, `Sidechain` (types-mixage.ts) ; le planning du kick (M1).

## 6. U1 — vue Pistes, choix d'instrument, piano roll, accords en un toucher
- **Possède** : `ecrans/Beat.tsx`, `composants/{pistes,pianoroll,melodie}/*` (placeholders : `VueInstruments.tsx`,
  `ChoixInstrument.tsx`, `GererInstruments.tsx`, `PianoRoll.tsx`), `edition/{notes,pistes}.ts` (bouchons),
  `edition/melodie.ts`, `src/textes/pistes.ts` (et ses clés de `studio.ts`).
- **Implémente** (déclarés dans `ui/edition/api-edition.ts`) : `ajouterNote` · `supprimerNotes` · `deplacerNotes` ·
  `allongerNote` · `reglerVelocite` · `quantifier` · `copierNotes`/`collerNotes` · `changerLongueurMotif` ·
  `poserAccord` · `ajouterPiste` (null au-delà de 16 → texte `T.pistes.trop`) · `dupliquerPiste` · `supprimerPiste` ·
  `renommerPiste` · `changerInstrument` · `deplacerPiste`.
- **Consomme** : `listerInstruments`, `telechargerInstrument`, `instrumentsInstalles`… (BQ) ; `Lecteur.entendreNote`
  (M1) ; `ouvrirPianoRoll`, `PANNEAUX`, `pisteEditee`, `modePianoRoll`, `modeAvance` (etat/navigation).
- Garder les testid du mode Simple (pads, grille, `enregistrer-clavier`…) et l'alias `vue-melodie`.

## 7. U2 — frise, mélangeur, inserts, automation
- **Possède** : `ecrans/Structure.tsx`, `ecrans/Son.tsx`, `composants/{frise,son,automation,structure}/*`
  (placeholders : `frise/Frise.tsx`, `son/PanneauEffets.tsx`), `edition/{mixage,automation,sections}.ts`,
  `src/textes/frise.ts`. Pose le bouton qui ouvre `PANNEAUX.avance` (écran Son) et la bascule `vueStructure`.
- **Implémente** (api-edition.ts) : `reglerTranche` · `ajouterInsert` · `retirerInsert` · `deplacerInsert` ·
  `reglerInsert` · `appliquerPresetInserts` · `reglerSidechain` · `poserPoint` · `deplacerPoint` · `retirerPoint` ·
  `effacerCourbe` · `reglerLfo` · `rendreUnique` (bouchon dans `edition/sections.ts`).
- **Consomme** : `insertParDefaut`, `presetsInserts`, `valeurCible`, `valeurReelle`, `gainsSidechain` (M2) ;
  `sectionsAvecMotif`, `pisteAUnMotif`, `pistesInstrument` (acces.ts) ; `ouvrirEffets`, `vueStructure`, `modeAvance`.

## 8. Écarts du contrat C0 par rapport aux décisions (et pourquoi)
- `PLAFONDS.motifs` passe de 64 à 256 (16 pistes × sections) ; `MotifNotes.pas` 16 à 128 (multiple de 16) ;
  `Note.midi` 12 à 120 ; `vel` reste 0,1 à 1 (comme /2). Valeurs non fixées par les décisions.
- Les « melodie-N » migrées portent le pan par défaut (+0,1, chaîne 2) DANS leur pan : le graphe ne l'ajoute qu'à
  la piste `melodie` (sinon une piste neuve aurait un pan caché).
- `Morceau.tranchesPads?` (pad → n° de découpe) ajouté pour « chaque tranche va sur un pad » (non nommé au §1).
- Envois réverbe/écho = inserts `envoi-reverbe`/`envoi-echo` (pris à leur place dans la chaîne) : la Tranche
  garde exactement les champs du §1. `Cible` a aussi `hauteur` (pistes instrument : pitch bend, vibrato LFO).
- Une IA qui écrit encore des motifs « melodie » : lus comme motifs de notes (lireBeat passe par la migration /2,
  le son est gardé ; lireSuite pose les notes sur la piste mélodie). Les consignes de l'IA restent celles de v1 (A1, C2).
- Les bouchons de BQ sont dans `api-instruments.ts` (C0 ne peut pas écrire dans `src/instruments/`).
