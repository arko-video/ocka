# OCKA v2 — Brief (à relire par l'équipe)

5 novembre 2026, 1 h. La base est livrée : phases 0 à 6, tous les tests verts (`conception/passation-ocka.md`, `decisions-phases-2-6.md`). Romain a essayé OCKA et trouve qu'il **manque cruellement d'instruments et de styles**. Il veut :
- « comme BandLab », c'est-à-dire autant de pistes que voulu ;
- de vrais instruments (piano classique, etc.) ;
- **tous les styles** ;
- un autotune réglable, modifiable et perfectionnable avec l'IA ;
- « je chante une mélodie et elle est retranscrite » : sa référence est **Dubler 2** (Vochlea). On chante et l'appli joue l'instrument en direct, recalé sur la gamme, avec un mode accords, du beatbox qui déclenche la batterie, et l'enregistrement dans le piano roll.

Les choix de Romain :
- sons enregistrés téléchargés à la demande : OUI ;
- styles : « fais tout » ;
- multipiste : « exactement comme BandLab ».

## Principes (inchangés)
- **Un seul chemin de son** : l'écoute et l'export passent par `construireGraphe`.
- **Rien n'est envoyé en ligne**, sauf l'IA (avec la clé de l'utilisateur, après un geste) et le téléchargement des instruments, qui vient de **la même origine** (fichiers servis par GitHub Pages avec l'appli : la CSP `connect-src 'self'` suffit).
- **Droits** : seulement des échantillons **CC0 / domaine public**, vérifiés banque par banque sur leur page d'origine (URL, auteur et licence dans CREDITS). Si une banque n'est pas CC0, on ne la prend pas, même si elle est « libre » avec attribution, car chaque sortie Spotify devrait alors créditer l'auteur.
- **Pas de git dans la VM. Aucune dépendance npm sans nécessité.** Fichiers de moins de 300 lignes, en français.
- **Compatibilité** : un morceau en `/2` s'ouvre toujours ; il est migré en `/3` et sonne pareil (test nul).

## A. Multipiste façon BandLab (format `ocka.morceau/3`)
- Des pistes **instrument**, en nombre libre (au plus 16) : `PisteInstrument { id, nom, instrument (id de la banque), volume, pan, muet, solo, effets? }`.
- Chaque piste a, pour chaque section, un **motif de notes** : `MotifNotes { pas (16 à 128), notes: { pas, duree, midi, vel }[] }`. C'est la généralisation de `MotifMelodie`.
- On garde les pistes batterie, basse 808, accords, sons et voix, et on peut ajouter des pistes instrument.
- La migration `/2 → /3` transforme la piste mélodie en piste instrument, avec le même son.
- **Interface** :
  - une vue **Pistes**, comme la vue Studio de BandLab, au pouce : la liste des pistes avec leur nom, leur instrument, M/S et volume, et un aperçu des notes par section ;
  - « + Piste » ouvre le **choix d'instrument** par familles ;
  - toucher une piste ouvre son **piano roll**.
- **Piano roll complet**, chromatique :
  - zoom, défilement, gamme mise en évidence ;
  - toucher pour poser, glisser pour déplacer, poignée pour allonger ;
  - vélocité ;
  - quantification (1/4 à 1/32, triolets) ;
  - copier-coller ;
  - annuler.
  - On garde le mode simple à 8 pads de la gamme pour débuter.
- **Mélangeur** : une tranche par piste. Les effets par piste (réverbe, écho, filtre) viennent si le temps le permet.

## B. Banque d'instruments échantillonnés (CC0)
- **Sources à vérifier** (une par une, sur leur page, en notant l'URL, l'auteur et la licence) :
  - Versilian Studios **VSCO-2 Community Edition** (orchestral, annoncé CC0) ;
  - **VCSL**, Versilian Community Sample Library (annoncé CC0) ;
  - **FreePats** : seulement les instruments marqués CC0 ;
  - les pianos (Salamander : vérifier s'il existe une version CC0, sinon on l'exclut ; chercher d'autres pianos à queue et droits en CC0) ;
  - autres sources CC0 sérieuses trouvées en ligne, joignables depuis la VM (GitHub, opengameart.org…).
- **Familles visées** (environ 40 instruments) :
  - **Claviers** : piano à queue, piano droit, Rhodes, Wurlitzer, clavecin, orgue, célesta, piano jouet ;
  - **Guitares** : nylon (bossa), folk, électrique claire, saturée ;
  - **Basses** : électrique, contrebasse ;
  - **Cordes** : violon, violoncelle, ensemble, pizzicato ;
  - **Vents** : flûte, clarinette, saxophone, trompette, trombone, cor, cuivres en section ;
  - **Percussions mélodiques** : marimba, vibraphone, glockenspiel, kalimba, steel drum ;
  - **Chœurs / voix** ;
  - **Synthés** fabriqués par le code : supersaw (hyperpop), leads, plucks, nappes, basses synthé, 808 ;
  - **Batteries enregistrées** : acoustique (rock, jazz, bossa), percussions latines (conga, shaker, clave, cabasa).
- **Format** :
  - échantillons ré-encodés en **Ogg Opus**, environ 96 kb/s mono (ou stéréo quand il le faut) ;
  - quelques notes par octave et 1 à 3 couches de vélocité, avec des boucles pour les sons tenus ;
  - un fichier `instrument.json` par instrument : zones, notes racines, vélocités, enveloppes, relâchement, réglage de volume ;
  - servis depuis `public/instruments/<id>/`.
  - **Taille** : au plus 8 Mo par instrument, 200 Mo au total (limite de GitHub Pages : 1 Go par site, et 100 Mo par fichier).
- **Moteur échantillonneur** :
  - choix de la zone ; rééchantillonnage par sinc fait **une seule fois**, dans le Worker, puis mis en cache ;
  - lecture par `AudioBufferSourceNode` ;
  - boucles et relâchement ;
  - préparé après `charger()`, sans aucun calcul pendant la lecture ;
  - les mêmes règles de mémoire que la banque actuelle.
- **Téléchargement à la demande** : à la première utilisation d'un instrument, avec une progression. Gardé dans le Cache Storage pour marcher hors ligne. Bouton « Gérer les instruments téléchargés » pour voir la place prise et en supprimer. Un morceau qui demande un instrument absent le télécharge avant l'export, et prévient s'il n'y a pas de réseau.

## C. Tous les styles
On garde trap, drill, lo-fi, phonk, pop et boom bap, et on ajoute :
- **Rap** : rage, plugg, cloud, jersey club, afro trap, rap mélodique, jazz rap, UK drill (si différent de drill), memphis ;
- **Autres** : hyperpop, bossa nova, R&B, afrobeats, reggaeton / dembow, amapiano, house, techno, drum & bass, UK garage, synthwave, jazz, rock, pop-punk, funk, reggae, gospel, orchestral / cinématique, ambient, k-pop.

Pour chaque style :
- tempo et swing typiques ;
- un kit (fabriqué par le code ou enregistré en CC0) ;
- 4 motifs de batterie ;
- 3 suites d'accords ;
- une basse ;
- les **instruments par défaut** pris dans la banque (bossa : guitare nylon + contrebasse + percussions ; hyperpop : supersaw + 808 distordue…) ;
- les Boucles OCKA ;
- tout le reste généré par des règles. Il faut que chaque style **sonne** comme son style.
- Le choix du style se fait par familles, avec une recherche.

## D. Autotune avancé
- **Réglages** :
  - gamme (détectée automatiquement, ou choisie) ;
  - vitesse de correction (0 à 400 ms) ;
  - force ;
  - **humaniser** (garder le vibrato) ;
  - **formants préservés** (sinon effet « chipmunk » si on décale beaucoup) ;
  - préréglages Naturel / Pop / Robot (T-Pain) / Hyperpop.
- **Éditeur note par note**, façon Melodyne simplifié :
  - la courbe de hauteur de la prise est affichée sur le piano roll ;
  - elle est découpée en notes (blocs) ;
  - on peut faire glisser une note vers le haut ou le bas, changer sa justesse et son vibrato, la couper en deux, la fusionner avec une autre.
  - Le rendu se fait par PSOLA, hors temps réel, puis est mis en cache, comme aujourd'hui.
- **Aide de l'IA** (même fournisseur et même clé que la phase 6) :
  - on envoie **seulement la liste des notes détectées** (hauteur, durée, justesse en cents, tonalité du morceau), **jamais l'audio** ;
  - l'IA renvoie la gamme conseillée, les notes à corriger et le préréglage ;
  - c'est appliqué en une seule étape d'Annuler.
  - Sans clé, on garde une version « Corriger tout seul » avec des règles.

## E. Ta voix → instrument (façon Dubler 2)
- **Détection de hauteur en direct**, dans un AudioWorklet : YIN ou MPM sur des fenêtres de 1024 à 2048 échantillons, avec hystérésis. Elle est calée sur la gamme du morceau, ou chromatique au choix.
- On joue en direct l'instrument de la piste choisie, avec le volume suivi et un glissé facultatif. La roue des 12 notes montre la note chantée, comme Dubler.
- **Mode accords** : la note chantée devient l'accord de la gamme (triade ou septième), joué par un instrument de nappe.
- **Beatbox → batterie** :
  - entraînement : on enregistre chaque son 5 fois (kick « boum », caisse claire « ka », charley « ts », plus un 4e au choix) ;
  - classification de chaque attaque, par mesures de spectre (MFCC simplifiés, centroïde, durée) et plus proche voisin ;
  - joue les sons du kit en direct ;
  - les entraînements sont gardés sur l'appareil.
- **Enregistrement** : on joue sur le beat en boucle, puis les notes sont **posées dans le piano roll** de la piste.
  - La latence est compensée par le calibrage existant.
  - La quantification est réglable, et on peut aussi ne rien caler.
  - On peut ensuite tout modifier.
- **Latence** :
  - le direct sur Android Chrome a environ 100 à 200 ms de retard : on le dit honnêtement, et on conseille un casque filaire ;
  - l'enregistrement, lui, est recalé.
  - Mesurer la latence de détection, de la note chantée à la note jouée, sans compter la sortie audio.

## F. Les fonctions utiles de FL Studio, BandLab et des autres logiciels (demande de Romain : « ajoute toutes les fonctions très utiles que je ne connais pas »)
Choisies pour un débutant au pouce qui sort sur Spotify. Les plus utiles en premier.
1. **Sidechain** (le « pompage » de la house, de l'EDM et du rap) : une piste baisse son volume quand le kick frappe. Un bouton par piste, avec une force réglable.
2. **Effets par piste** (inserts, comme le mixeur de FL) : égaliseur (3 bandes + passe-haut/passe-bas), compresseur, filtre, saturation/distorsion, bitcrusher, chorus, flanger/phaser, réverbe, écho. Chaîne réordonnable, préréglages.
3. **Automation** : une courbe sur la frise pour le volume, le filtre, le panoramique ou un effet (montée de filtre avant le drop, fondu…). On la dessine au doigt avec des points.
4. **Piano roll « malin »** :
   - **accords en un toucher** (comme les « chord stamps » de FL) ;
   - **arpégiateur** (haut, bas, aléatoire, vitesse) ;
   - **strum** (accord gratté façon guitare) ;
   - **glide/slide** entre notes et pitch bend ;
   - **notes fantômes** des autres pistes ;
   - **humaniser** (timing et vélocité) ;
   - quantification avec une force (50 % = plus naturel) ;
   - swing par piste ;
   - « Riff machine » : une mélodie générée par règles dans la gamme.
5. **Découper un son (sample chop, comme Slicex/Fruity Slicer)** : on importe un son, OCKA le coupe aux attaques ou en parts égales, et chaque morceau va sur un pad.
   Éditeur audio simple, comme Edison : couper, fondu, normaliser, inverser.
   **Étirer au tempo sans changer la hauteur** (WSOLA), et détection du **BPM et de la tonalité** d'un son importé.
6. **Effets de performance** (façon Gross Beat) sur une section : stutter, demi-tempo, tape stop, coupure (gate), reverse.
7. **Looper façon BandLab** : une grille de boucles qu'on lance en direct pour trouver une idée, puis « Enregistrer ce que je joue » dans l'arrangement.
8. **Voix** :
   - **punch-in** (réenregistrer un passage), avec pré-roll ;
   - **comping** (garder le meilleur morceau de chaque prise) ;
   - **nettoyeur de voix** (réduction de bruit simple, porte de bruit, désesseur) ;
   - doublage automatique ;
   - chaînes d'effets prêtes pour la voix (« Rap clair », « Hyperpop », « Lo-fi téléphone »…).
9. **Écoute de référence** : on importe un morceau pro, puis on compare en A/B avec son propre mix, au **même volume perçu** (c'est le meilleur outil pour apprendre à mixer).
10. **Confort** :
    - tap tempo ;
    - métronome au choix ;
    - historique d'Annuler visible ;
    - figer une piste (« freeze », qui la calcule une fois pour soulager le téléphone) ;
    - modèles de pistes ;
    - marqueurs ;
    - **clavier MIDI** par Web MIDI (USB sur Android et PC) ;
    - raccourcis clavier sur PC.
11. **Les idées de LMMS** (logiciel libre cité par Romain) :
    - **basse acide « 303 »** (comme LB302) ;
    - **fabricant de kick** (comme Kicker) : on règle la hauteur, la chute et le claquement, puis le kick va sur un pad ;
    - **instruments 8-bit / chiptune** (style NES, et bruitages façon sfxr), parfaits pour les vidéos gaming ;
    - **synthé à forme d'onde dessinée au doigt** (comme BitInvader) ;
    - **importer une SoundFont (.sf2)** de l'utilisateur, sous sa responsabilité : ça donne accès à des milliers d'instruments gratuits ;
    - **import et export MIDI (.mid)**, pour passer un morceau dans FL Studio ou un autre logiciel, et inversement ;
    - **LFO** : une modulation automatique (filtre qui ondule, trémolo) assignable à un réglage ;
    - **accords et arpège par instrument** (déjà au point 4).
12. **Plus tard** (trop lourd pour l'instant, noté) : séparer une chanson en pistes (le « Splitter » de BandLab, il faut un modèle d'IA lourd), collaboration en ligne.

## Livraison proposée
- **Vague C1** : format `/3` et multipiste, piano roll complet, échantillonneur et banque d'instruments (les familles d'abord, environ 40 instruments si les licences le permettent), mélangeur.
- **Vague C2** : tous les styles, autotune avancé et son éditeur, aide de l'IA à l'autotune, Ta voix → instrument, beatbox.
- **Vague C3** : les fonctions F :
  - **d'abord** (dans C1 si possible) : sidechain, effets par piste, automation, piano roll malin ;
  - **puis** : sample chop + éditeur, effets de performance, looper, voix (punch-in, comping, nettoyeur), référence A/B, confort.

Chaque vague se termine par une intégration, la QA (dont le test nul des morceaux `/2` et la mémoire), puis le lien de test et le zip.
