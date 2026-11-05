# Ajouter OCKA dans Mon Hub

Ce dossier contient un module Mon Hub prêt à copier. Il ajoute une page « OCKA » avec un bouton qui ouvre OCKA dans un
onglet Chrome intégré à l'appli. C'est le même modèle qu'Arko (déjà branché dans Mon Hub).

## Avant de commencer
- OCKA doit être en ligne : `https://arko-video.github.io/ocka/`. Sinon le bouton n'ouvrira rien.
- `url_launcher` est déjà dans Mon Hub, et le bloc `<queries>` d'Android aussi (ajoutés pour Arko) : rien à installer.
- Fais un point Git dans `C:\dev\mon_hub` :
  ```
  git add .
  git commit -m "avant module OCKA"
  ```

## Étapes (dans `C:\dev\mon_hub`)
1. Copie `ecran_ocka.dart` dans `lib/modules/ocka/ecran_ocka.dart` (crée le dossier `ocka`).
2. `lib/noyau/catalogue.dart` : ajoute ce bloc **juste après celui d'Arko**, avant le `];` de la fin :
   ```dart
     ModuleInfo(
       id: 'ocka',
       nom: 'OCKA',
       description: 'Fais tes beats, pose ta voix, sors tes morceaux sur Spotify',
       icone: Icons.graphic_eq,
       categorie: 'Création',
     ),
   ```
3. `lib/modules/registre.dart` :
   - dans les imports, entre `import 'mini_jeux/mini_jeux_etat.dart';` et `import 'podometre/ecran_podometre.dart';` :
     ```dart
     import 'ocka/ecran_ocka.dart';
     ```
   - dans le `switch`, juste après `case 'arko': return const EcranArko();` :
     ```dart
         case 'ocka':
           return const EcranOcka();
     ```
4. `lib/noyau/village.dart`, dans `nomBatiment`, juste après `'arko' => 'Le Studio vidéo',` :
   ```dart
         'ocka' => 'Le Studio son',
   ```
5. `lib/noyau/design.dart`, dans `teinteModule`, juste après la ligne de `'arko'` :
   ```dart
         'ocka' => const Color(0xFFA855F7), // violet (la couleur d'OCKA)
   ```
6. `lib/ecrans/ecran_bienvenue.dart`, dans `packsModules`, remplace la ligne du pack Création :
   ```dart
     ('🎬', 'Création', ['arko']),
   ```
   par :
   ```dart
     ('🎬', 'Création', ['arko', 'ocka']),
   ```
7. Vérifie, puis lance :
   ```
   flutter analyze
   flutter test
   flutter run -d edge --web-port 8080
   ```
   Pendant que ça tourne : `r` recharge, `R` redémarre, `q` quitte. Essaie ensuite sur le Xiaomi : le module OCKA
   doit apparaître dans la catégorie Création, avec son bâtiment « Le Studio son » dans le village.
8. Si tout marche, fais un point Git :
   ```
   git add .
   git commit -m "module OCKA"
   ```

## Si `flutter test` se plaint
`test/envie_test.dart` vérifie que chaque module d'un pack existe dans le catalogue : fais bien l'étape 2 (catalogue)
en même temps que l'étape 6 (pack Création). Le plus sûr en cas de doute : demande à Claude pendant une session où ton
PC est relié.

## Plus tard
- Envoyer un son d'OCKA vers Arko depuis Mon Hub (OCKA sait déjà « Envoyer vers Arko »).
- Partager la clé du collègue IA de Mon Hub avec l'IA d'OCKA, sans jamais mettre de clé dans le code de l'appli.
