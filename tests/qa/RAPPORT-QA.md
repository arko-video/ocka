# OCKA : rapport QA et intégration

Mis à jour le 6 novembre 2026 (intégration de la vague C3 de la v2). Chrome headless (`channel: 'chrome'`, Linux),
viewport 360×740, faux micro (clics à 1 kHz). Depuis `app/` : `npx vite build`, puis `npx playwright test` (e2e,
preview 4173) et `npx playwright test -c tests/qa/playwright.qa.config.ts` (QA, preview 4194) avec les serveurs de
dev ouverts à côté : `npx vite --port 5198 --strictPort` (autotune, master-js, mémoire, gels, voix avancée, effets de
fin, dev-aller-vite), 5212 (effets-m2), 5223 (autotune-avance). **Relancer le serveur de dev après toute
modification du code** : avec le rechargement à chaud, un test qui importe `/ocka/src/…` peut tomber sur une autre
copie d'un module que le graphe (vu à l'intégration C3 : un gel « ignoré »). Les bilans JSON sont dans
`tests/qa/sorties/`.

## Intégration de la vague C3 (6 novembre 2026) : P, S, L, R, V

### Vérifications (toutes vertes)
- `npx tsc --noEmit -p .` : **0 erreur**. `npx vitest run` : **91 fichiers, 1 172 tests verts**. Aucun fichier de `src/` ni de
  `tests/` à 300 lignes ou plus.
- `npx vite build` : JS chargé au démarrage **907 ko (303 ko gzip)** en 8 morceaux (`index` 222,6 ko, `api` 573,4 ko,
  `lecture` 69,2 ko…), contre 986 ko d'un bloc avant l'intégration (C2 : 772 ko) ; 13 panneaux chargés à la première
  ouverture (3 à 15 ko chacun) ; Mediabunny (727 ko) et l'encodeur AAC (1,13 Mo) à la demande. Précache : 59
  fichiers, 3 236 Kio, aucun instrument.
- **E2E : 47/47** (26 fichiers, 11,1 min), dont `contrat-c3` (intros `*-intro`, « Effets de fin » de la carte de
  section), outils de notes et MIDI, sons avancés, synthés, performance et looper, voix avancée, session v2
  (FLAC −14,0 LUFS, −4,5 dBTP), choix du style (orchestral avec les cuivres d'OCKA : −14,0 LUFS, −1,3 dBTP).
- **QA : 32/32.**
  | Scénario | Résultat |
  |---|---|
  | Test nul v2 (10 morceaux /2) | mix pire **−83,5 dB** ; pistes pire −143,8 dB, basse identique |
  | Test nul contre la phase 1 | mix −82,8 dB, batterie −85,9, basse −127,6 ; −14,0 / −14,0 LUFS |
  | Reproductibilité | −88,6 dB (même page), −88,3 dB (après rechargement), aucun décalage |
  | Gels (`gels.qa.ts`) | basse entière + accords 2–6 s gelés : −77,8 à −83,7 dB selon les passages, toujours au plancher de Chrome mesuré dans le même test (−76,8 à −79,3 dB) ; gel modifié audible (−18 dB) |
  | Gel d'une piste (V) | accords −102,9 dB, batterie −81,9, **basse −70,3 dB** (voir « Reste ») ; mix complet au plancher ; dégel automatique |
  | Effets de fin (R) | écoute = export au plancher (−81 dB), recalcul −130 dB, l'effet ne touche que son passage |
  | Référence (V) | sonie OCKA = ffmpeg à ±0,05 LU (WAV, MP3), compensation exacte, tampon ≤ 10 s |
  | Effets M2 (5) | écoute = export, Σ stems, réponses, sidechain, CPU ×4 : 0 coupure |
  | Autotune, autotune avancé | autotune simple : 3 min en 4,4 s ; avancé : analyse 3,8 s, rendu 0,8 s, recalcul d'une note 34 ms ; 0 échantillon changé hors zone |
  | Master JS = worklet | −130,5 dB |
  | Performance | export 3 min en 11,7 s, −14,0 LUFS ; lecture 68 pas, p95 125,2 ms, 0 saut |
  | Mémoire, 12 exports FLAC | tas 4,5 → 6,6 Mo ; Chrome 1 036 → 1 030 Mo |
  | Mémoire, album 12 titres | onglet +15 Mo après, crête +337 Mo, 138 s |
  | Mémoire, inserts JS | crête de l'onglet +331 à +362 Mo pendant, +9 à +41 Mo après ; −14,0 LUFS |
  | Sécurité (3) | CSP inchangée, 0 requête sortante, 0 violation ; instrument depuis la même origine |
- Synthés C3 branchés dans les styles (rendu de chaque piste dans Chrome) : supersaw (rage −27,8 dB RMS, hyperpop
  −32,1), chœurs (gospel −25,1), log drum (amapiano −23,7), cuivres (funk −28,1, K-pop −29,4, orchestral −32,4),
  Rhodes (R&B −21,8), Wurlitzer (funk −27,3) : tous sonnent, 0 erreur.

### Corrigé à l'intégration
1. **Heure négative (−5e-16 s)** : une note reprise au début d'une fenêtre de rendu tombait à
   (−début + t) + (début − t) ; Web Audio refusait (`Sources.jouer`). Heure bornée à 0 ; contournement de R retiré.
2. `rendrePistesSeparees` calculait toutes les pistes : les autres sont muettes, sans inserts ni prises
   (`morceauPourRendu`, outil commun ; `morceauPourGel` de V s'en sert).
3. Effets de fin d'une piste gelée en entier perdus : posés dans son rendu gelé.
4. Seuils QA honnêtes : gels ≤ 6 dB au-dessus du plancher mesuré ET ≤ −75 dB (le plancher de Chrome varie de −76,8
   à −84 dB selon la charge : −80 dB fixe échouait sur le plancher lui-même) ; basse gelée seule ≤ −65 dB.
5. Demandes des développeurs : voir `docs/passation-ocka.md` (vague C3) ; toutes traitées.

### Reste
- **Basse gelée seule : −70,3 dB** à l'entrée du master, quelques ms au début de certaines notes de 808 (toujours
  les mêmes), alors que le rendu gelé est identique AU BIT PRÈS à la piste séparée de la basse (vérifié), et que deux
  exports normaux sont identiques. Inaudible (≈ 1/3 300 de la crête) ; la cause est dans le mélange du bus, pas
  trouvée. Le mix complet gelé reste au plancher de Chrome.
- Doublage gauche/droite (prise stéréo) : demande un champ du format (`/4`).
- Écoutes de Romain (passation).

## Vagues précédentes (résumé ; le détail est dans la passation, `docs/passation-ocka.md`)

| Vague | Types | Vitest | E2E | QA | Bundle principal | Points clés |
|---|---|---|---|---|---|---|
| A (4/11) | 0 | 38 fichiers, 308 | 7 | 15/15 | 345,7 ko | −14,0 LUFS partout ; voix recalée à 6,2 ms ; reproductibilité −85 dB |
| B (5/11) | 0 | 49, 453 | 16 | 19/19 | 442,8 ko | plus aucun worklet hors ligne : +2 Mo/export (avant +100) ; master JS = worklet −130,5 dB |
| C1 (5/11) | 0 | 62, 774 | 22 | toutes | 586,9 ko | banque CC0 (41 instruments, pire écart 3,8 cents) ; test nul v2 −83,6 dB ; Σ stems −144 dB |
| C2 (5/11) | 0 | 72, 1 048 | 36 | 27/28 | 772,0 ko | 35 styles ; autotune avancé ; Chanter, Beatbox ; seul l'ancien chemin worklet de l'album fuyait (retiré au contrat C3) |

Mesures de référence (C2, PC) : export de 3 min en 12,7 à 15,3 s ; lecture p95 ≈ 125 ms, 0 saut ; 12 exports FLAC :
+0 à +2,7 Mo/export ; album de 12 titres : onglet +3 à +12 Mo après, crête +333 à +346 Mo ; inserts JS : crête
+315 à +346 Mo pendant l'export, +3 à +26 Mo après ; sécurité : `connect-src 'self'` + les 3 domaines d'IA, 0 requête
sortante ; test nul contre la phase 1 −84,1 dB.

Défauts connus, toujours vrais :
- Un toast reste 4 s par-dessus un panneau ouvert juste après.
- Le normaliseur arrondit les temps des prises au millième (≤ 0,5 ms après réouverture).
- Le test nul contre la phase 1 compare à une copie figée de la phase 1 : en cas d'échec après les scénarios mémoire,
  le relancer seul (une fois, c'était la copie figée qui dérivait, pas OCKA).

Pas vérifiable sans un vrai téléphone : latence réelle et calibrage, Bluetooth, feuille de partage Android, AAC natif,
Wake Lock, quotas et `persist()`, mémoire d'un album, tenue au toucher, clavier MIDI USB réel.
