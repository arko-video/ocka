# Crédits

OCKA est sous licence **MIT**. Merci aux auteurs de ces projets libres :

| Projet | Rôle | Licence |
|---|---|---|
| [Preact](https://preactjs.com) et [@preact/signals](https://github.com/preactjs/signals) | interface | MIT |
| [idb-keyval](https://github.com/jakearchibald/idb-keyval) | sauvegarde des morceaux | Apache-2.0 |
| [Mediabunny](https://mediabunny.dev) | fabrication et lecture des M4A | MPL-2.0 |
| `@mediabunny/aac-encoder` | encodeur AAC de secours en WebAssembly (téléphones sans AAC natif) | MPL-2.0 ; il contient l'encodeur AAC de [FFmpeg](https://ffmpeg.org), sous **LGPL 2.1 ou plus** (aucun composant GPL ni « nonfree »). Licences : `node_modules/@mediabunny/aac-encoder/licenses/ffmpeg` |
| [Workbox](https://github.com/GoogleChrome/workbox) via vite-plugin-pwa | fonctionnement hors ligne | MIT |
| [Inter](https://rsms.me/inter/) et [Space Grotesk](https://github.com/floriankarsten/space-grotesk) | polices | SIL OFL 1.1 |

## Sons
- **Les sons de base d'OCKA sont fabriqués par son code** (synthèse) : batteries, basse, accords, mélodies, les
  6 styles, les « Boucles OCKA » et les instruments `ocka-…`. Ils sont dans le domaine public (CC0).
- Les **instruments enregistrés** (v2, « + Piste ») sont des échantillons d'autres auteurs, tous en **CC0 1.0** :
  voir « Instruments (CC0) » plus bas.
- Les briques de synthèse viennent d'[Arko](https://github.com/arko-video/arko), du même auteur (MIT).
- Un morceau fait avec OCKA t'appartient : aucune licence de beat à acheter, aucune limite.
- **Tes sons** (pads perso, boucles) : ce sont TES fichiers. OCKA rappelle à chaque import de n'utiliser que des sons
  que tu as le droit d'utiliser (les tiens, ou libres de droits) ; un extrait de chanson peut faire refuser un morceau.
- L'encodeur FLAC, le ZIP et le dither TPDF sont écrits à la main dans OCKA (MIT), sans bibliothèque.

## Instruments (CC0)
Les instruments enregistrés (téléchargés à la demande depuis `public/instruments/`) viennent **uniquement** de
banques en **CC0 1.0** (domaine public), vérifiées une par une le 5 novembre 2026 : tu n'as rien à créditer dans
tes sorties. On cite quand même leurs auteurs, avec merci. Les échantillons ont été coupés, bouclés, accordés,
mis au même volume et réencodés en Ogg Opus par `outils/instruments/preparer.py` ; chaque `instrument.json` donne
l'URL, l'auteur et le SHA-256 de ses fichiers source. Copies des licences : `outils/instruments/licences/`.

| Banque | Auteurs | Licence | Instruments pris |
|---|---|---|---|
| [Versilian Community Sample Library (VCSL)](https://github.com/sgossner/VCSL) | Versilian Studios LLC (Sam Gossner et contributeurs) | CC0 1.0 | piano à queue (Steinway B), orgue d'église, clavecin, harpe, saxophone ténor, marimba, vibraphone, glockenspiel, xylophone, cloches tubulaires, percussions latines |
| [VS Chamber Orchestra: Community Edition (VSCO-2-CE)](https://github.com/sgossner/VSCO-2-CE) | Versilian Studios LLC (Sam Gossner), Ivy Audio (Simon Dalzell) | CC0 1.0 | piano droit, cordes en section, pizzicato, staccato, violon, violoncelles, flûte, clarinette, hautbois, basson, cor, trompette, trombone, tuba |
| [FreePats](https://freepats.zenvoid.org/) (pages marquées CC0 seulement) | Piotr Barcz (piano bastringue) ; Roberto (guitare nylon, orgue électrique, piano FM) ; FSBS (guitares électriques) ; Mateusz Dąbrowski (ukulélé) ; Jeff Stauffer et michael02022 (accordéon) ; Xavimart, Gonzalo et Roberto (kalimba, percussions du monde) | CC0 1.0 | piano bastringue, piano électrique FM, orgue électrique, accordéon, guitare nylon, guitare électrique claire, guitare saturée, ukulélé, kalimba, percussions du monde |
| [Karoryfer Samples](https://shop.karoryfer.com/) : Big Rusty Drums 1.100, Swirly Drums 1.104, Swagbass 1.001, Meatbass 1.001, Osiris Piano 0.925 (LICENSE CC0 lu dans chaque archive) | Karoryfer Lecolds (D. Smolken, L. Zamenhof) ; Osiris avec Versilian Studios | CC0 1.0 | batterie acoustique, batterie aux balais, basse électrique, contrebasse, piano doux |
| [Virtuosity Drums](https://versilian-studios.com/virtuosity-drums/) 0.925 | Versilian Studios LLC et Karoryfer Lecolds (batteur : Austin McMahon) | CC0 1.0 | batterie jazz |

**Refusés** (pas CC0) : Salamander Grand Piano et YDP Grand Piano (CC-BY 3.0), MuldjordKit (CC-BY 4.0),
le General MIDI de FreePats (GPL), Splendid Grand et SM Drums (provenance floue).

## Aide dans l'appli
- Les textes de l'aide et du guide sont écrits pour OCKA (MIT). Les liens mènent aux pages d'aide officielles de
  RouteNote, DistroKid, Spotify for Artists et Musixmatch, qui restent la référence (leurs règles peuvent changer).
