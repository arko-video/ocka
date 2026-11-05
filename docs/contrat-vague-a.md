# OCKA — Contrat de la vague A (figé le 4 novembre 2026)

Base : `decisions-phases-2-6.md` (il fait foi). État au gel : `tsc` 0 erreur, Vitest 143 tests verts, e2e `parcours` et `captures` verts.
Chaque fonction nouvelle existe déjà sous forme de **bouchon** : elle lève `ErreurOcka('Bientôt disponible', 'pas_encore')`.
Ton travail : remplacer les bouchons de **tes** fichiers par le vrai code, **sans changer la signature**.

## Règles communes
- **Pas de git** dans la VM (jamais `git`, ni worktree).
- **Tu ne modifies que tes fichiers** (liste ci-dessous). Tu peux créer des fichiers dans tes dossiers.
- Besoin d'un changement ailleurs (type, signature, texte commun, fichier d'un autre) ? **Écris-le dans ton rapport final** : l'intégrateur le fera.
- **Fichiers figés** (intégrateur seulement) : `src/morceau/types.ts`, `src/morceau/normaliser*.ts`, `src/sortie/types.ts`,
  `src/moteur/api.ts`, `api-sorties.ts`, `api-fichiers.ts`, `api-effets.ts`, `erreur.ts`, `relier.ts`, `types-moteur.ts`,
  `src/zip/types.ts`, `src/stockage/dossiers.ts`, `src/textes/{index,commun}.ts`, `src/ui/{etat,navigation}.ts`, `src/ui/App.tsx`,
  `src/main.tsx`, `src/ui/composants/*.tsx` (racine), `index.html`, `package*.json`.
- Le **type** de chaque fonction publique est écrit dans `api-*.ts` (avec sa doc : entrées, sorties, codes d'erreur).
  Si ton implémentation s'en écarte, `tsc` échoue dans `api-*.ts` : c'est voulu.
- L'interface (`src/ui`) importe **seulement** `src/moteur/api.ts` et `src/morceau/*`. Entre modules du moteur, importe le fichier du propriétaire.
- Erreurs pour l'utilisateur : `ErreurOcka(message en français, code)` (codes connus dans `erreur.ts`). Quota plein, `AbortError` :
  passe par `enErreurOcka(e)` de `src/stockage/dossiers.ts`.
- Stockage : **uniquement** les noms de `dossiers.ts` (`DOSSIERS_OPFS`, `BASES_IDB`, `magasin(nom)`, `dossierOpfs(nom)`).
  Rien hors `ocka-*` (même origine qu'Arko). Avant une grosse écriture : `verifierPlace(octets, facteur)`.
- Un morceau ou une sortie qui vient de l'extérieur passe **toujours** par `normaliserMorceau` / `normaliserSortie`.
  Ids : `REGLE_ID` (1 à 40 caractères `A-Za-z0-9_-`, jamais `__proto__`, `constructor`…). Clés de fichiers : `REGLE_CLE_PRISE`,
  `REGLE_CLE_SON`, `REGLE_CLE_POCHETTE` (`types.ts`).
- Fichiers de **moins de 300 lignes**, code et commentaires en **français simple**, **aucune dépendance npm**, pas de réseau.
- **Tests Vitest** pour ta logique pure, dans **ton propre** fichier `*.test.ts` (les tests partagés comme `moteur.test.ts`, `tests/e2e`
  et `tests/qa` sont à l'intégrateur). À la fin : `npx tsc --noEmit -p .` = 0 et `npx vitest run` vert. Les bouchons des autres lèvent
  « pas_encore » : ne fais pas dépendre tes tests de leur code (simule-le).
- **Test nul** (§0) : un morceau en chaîne 1 sans mélodie sonne pareil (batterie, 808, voix ≤ −90 dB d'écart).
- Textes : chacun dans **son** fichier de `src/textes/`, dans ses groupes (un test refuse les groupes en double).

## A1 — Sorties
**Possède** : `src/sortie/` (sauf `types.ts`), `src/stockage/sorties.ts`, `src/stockage/reglages.ts`, `src/ui/sorties.ts`,
`src/ui/ecrans/sortie/`, `src/ui/composants/sortie/`, `src/ui/ecrans/MesMorceaux.tsx`, `src/ui/mes-morceaux.ts`,
`src/textes/accueil.ts`, `src/textes/sortie.ts`, `src/ui/styles/accueil.css` et `sortie.css` (déjà importés par `main.tsx`).
**Implémente** (types et doc : `api-sorties.ts`) :
- `src/stockage/sorties.ts` : `listerSorties`, `ouvrirSortie`, `sauverSortie`, `supprimerSortie`, `nouvelleSortie(depuisMorceau?)`, `retirerMorceauDesSorties`
- `src/stockage/reglages.ts` : `lireReglages`, `ecrireReglages` (lecture via `normaliserReglages`)
- `src/sortie/regles.ts` : `typeSortie(durees)`, `verifierSortie(sortie, morceaux: Map, cotePochette?)` → `ProblemeSortie[]`
- `src/sortie/pochette.ts` : `preparerPochette(image, centre)`, `fabriquerPochette(modele 0..3, titre, artiste, graine)`, `lirePochette`, `stockerPochette` (interne, pour A2)
- `src/sortie/paroles.ts` : `parolesMusixmatch` · `src/sortie/fiche.ts` : `ficheSortie` · `src/sortie/dossier.ts` : `exporterDossierSortie`
- `src/ui/sorties.ts` : `sortirSurSpotify(idMorceau)`, `ouvrirAssistant(idSortie, ecran?)`
- Écrans `Infos`, `Pochette`, `Verifier` (vides, déjà branchés) ; onglets Morceaux | Sorties (`ongletAccueil`) ; « Importer un projet ».
- Ramasse-miettes des **pochettes** (sous `navigator.locks.request('ocka-menage')`), lancé par `listerSorties`.
**Consomme** : `creerZip` (A2), `exporterAudio({ ecrivain, niveau: sortie.niveau })`, `tailleEstimee` (A2), `importerProjet` (A2),
`listerMorceaux`/`ouvrirMorceau`/`supprimerMorceau`, `normaliserSortie`, `verifierPlace` (× 2,2), `sortieEditee`, `gardesRetour`
(`navigation.ts`) pendant le dossier. Après `supprimerMorceau` : appeler `retirerMorceauDesSorties`.

## A2 — Fichiers
**Possède** : `src/zip/` (sauf `types.ts`), `src/moteur/flac/`, `src/moteur/export.ts`, `sortie-wav.ts`, `wav.ts`, `src/projets/`,
`src/stockage/morceaux.ts`, `index-morceaux.ts` (+ tests), `src/enregistrement/fichiers-opfs.ts`, `prises.ts`, `src/sons/`.
**Implémente** (types et doc : `api-fichiers.ts`, `src/zip/types.ts`) :
- `src/zip/ecrire.ts` : `creerZip(dossier: NomDossier, nom)` → `EcrivainZip` (stocké, en flux, en-tête local corrigé par `seek`, refus > 3,9 Go)
- `src/zip/lire.ts` : `lireZip(f, regles: ReglesLectureZip)` → `LecteurZip` (répertoire central, `File.slice`, refus §5)
- `src/moteur/export.ts` : `exporterAudio(morceau, { format: wav24|wav16|flac16|m4a, niveau?, ecrivain?, … })` → `ResultatAudio`
  (`fichier: null` quand on écrit dans `ecrivain`), `tailleEstimee(duree, format)` ; `exporterWav` reste (l'interface l'utilise).
- `src/projets/exporter.ts` : `exporterProjet`, `exporterSortieProjet` · `src/projets/importer.ts` : `importerProjet` → `{ type, id }`
- `src/sons/import.ts` : `importerSon(f, morceau)` → `SonImporte` (ne modifie pas le morceau), `lireSon(son)` → `PcmSon | null`
- **Migrations** (une fois, sous le verrou `ocka-menage`) : dossier OPFS `prises` → `ocka-prises` (`ANCIEN_DOSSIER_PRISES`) ;
  base `keyval-store` (clés `ocka.*` seulement) → `ocka-morceaux` (`ANCIENNE_BASE`). **Corriger `ouvrirEcriture()`** (n'efface plus les autres exports).
- Ramasse-miettes : prises, sons, fichiers `auto-…` ; `dupliquerMorceau` copie aussi les sons. Retirer l'appel à `persist()` de `sauverMorceau`.
**Consomme** : `normaliserMorceau`/`normaliserSortie`, `ouvrirSortie`/`sauverSortie`/`lirePochette`/`stockerPochette` (A1),
`construireGraphe` (M1), `dossiers.ts`, `reechantillonner` (M1).

## M1 — Moteur
**Possède** : `src/moteur/graphe.ts`, `planning.ts`, `lecteur.ts` (+ tests), `instruments/*`, `synthese/*`, `reechantillonner.ts`, le nouveau Worker de synthèse.
**Implémente** :
- `Lecteur` (`api.ts`) : `entendreNote(son, midi)`, `latenceSortie` (bouchon : 0), `comparer(sans, compensationDb?)` → `ChaineMaster.contourner` ;
  `entendre('perso1'…'perso4')` joue le son du pad. Bouchons dans `lecteur.ts`.
- `construireGraphe(ctx, morceau, prises, destination?, options?: OptionsGraphe)` : `pistesSeparees` et `sons` (`types-moteur.ts`).
- Banque sans durée + Worker + LRU (~48 Mo), bus master persistant (utilise `creerChaineMaster` de M2, déjà jouable : son de phase 1),
  mélodie (`MotifMelodie`, 6 sons), pads perso et boucles (`Section.boucle`, `caler`), panoramiques par défaut de la chaîne 2
  (dans le graphe, **jamais** écrits dans `Piste.pan`), `CRETES` des pads perso (valeurs provisoires dans `instruments/batterie.ts`).
**Consomme** : `lireSon` (A2), `ChaineMaster`/`creerChaineVoix` (M2).

## M2 — Effets
**Possède** : `src/moteur/chaines.ts`, `master.ts`, `audio/*`, `stems.ts`, `ab.ts`, `src/arko/`.
**Implémente** (types : `types-moteur.ts`, doc : `api-effets.ts`) :
- `src/moteur/master.ts` : `creerChaineMaster(ctx, master)` → `ChaineMaster { entree, sortie, latence, regler, contourner, detruire }`
  (version de départ = son de phase 1 ; à faire : colle JS dans le worklet, chaîne 2, A/B, message « fin »).
- `src/moteur/chaines.ts` : `creerChaineVoix(ctx, piste, banque, sortie, tempo)` → `ChaineVoix { entree, detruire }` (réverbe, écho, radio, doubler).
- `src/moteur/stems.ts` : `exporterPistes` · `src/moteur/ab.ts` : `mesurerEcartAB` → `{ ecartLu }` · `src/arko/envoi.ts` : `envoyerVersArko`.
**Consomme** : `construireGraphe(…, { pistesSeparees })` (M1), `creerZip` (A2), `retardMaster`, `mesurerSonie`.

## U — Studio
**Possède** : `src/ui/ecrans/{Beat,Structure,Voix,Son,Exporter}.tsx`, `src/ui/composants/{beat,melodie,sons,structure,voix,son}/`,
`src/ui/edition/*` (+ tests), `src/ui/lecture.ts`, `voix.ts`, `exportation.ts`, `src/textes/studio.ts`, `src/ui/styles/{studio,beat,melodie,structure,voix,son}.css`.
**Implémente** : bascule Batterie | Mélodie (`vueBeat`), 8 pads de la gamme + octave, pastilles de son, « Enregistrer au clavier »
(calage : retirer `lecteur.latenceSortie` + ~25 ms), grille simple, « + Ton son » (pads perso), boucles dans Structure, pastilles d'effets,
couleur + Colle + A/B dans Son, boutons d'Exporter. Fonctions **pures** d'édition dans `ui/edition/` (créer le motif de mélodie, ajouter
un son, régler les effets…), avec tests. Ids neufs conformes à `REGLE_ID` (couper `nouvelId` de `sections.ts` à 36 caractères).
**Consomme** : `Lecteur.entendreNote/latenceSortie/comparer`, `mesurerEcartAB`, `importerSon`, `exporterAudio` (M4A), `exporterPistes`,
`envoyerVersArko`, `exporterProjet`, `demanderPersistance` (après la 1re prise gardée et le 1er export), `sortirSurSpotify` (A1, `ui/sorties.ts`).

## Écarts avec les décisions (et pourquoi)
- `Master.chaine` est **obligatoire** dans le type (facultatif dans le fichier) : le normaliseur le remplit toujours.
- Fonctions publiques **reliées à l'appel** (`relier`) : pas de bug d'ordre de chargement, et le type est vérifié.
- `exporterAudio` renvoie `ResultatAudio` (`fichier: File | null`, `octets`) et prend `niveau?` (un seul niveau par sortie).
- `importerSon(f, morceau)` (plafonds 16 sons / 120 s) ; `lireSon` et `lirePochette` peuvent renvoyer `null` (fichier disparu).
- `verifierSortie(sortie, Map, cotePochette?)` ; `ficheSortie` reçoit une `Map` ; `ResumeSortie` a `duree` et `type`.
- `ChaineMaster` a aussi `regler(master)` et `latence` ; `creerChaineVoix` renvoie `{ entree, detruire }` (boucle de l'écho).
- `Lecteur.comparer(sans, compensationDb?)` ; `Lecteur.entendre` garde `string` (pas de casse dans `ui/lecture.ts`).
- Ecran `sorties` = l'accueil sur l'onglet Sorties ; ajout de `gardesRetour` (Retour bloqué pendant une opération longue).
- Normaliseur : clé `album` lue sans message puis oubliée ; pistes `melodie`/`sons` ajoutées sans message ; un id illisible est
  **corrigé** (références suivies) au lieu d'être rejeté ; journal plafonné à 200 messages ; caractères de contrôle retirés des textes.
