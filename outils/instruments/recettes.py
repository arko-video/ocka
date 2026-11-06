# Les recettes de la banque, famille par famille. Champs :
#   id, nom (français), famille, banque (banques.py), page (banques.PAGES), source ou parties[{source, plage, garder}],
#   plage (bas, haut) en MIDI, couches [(velBas, velHaut, vélocité lue dans le SFZ, [filtre])],
#   tenu (boucle), stereo, relache (s), duree_max (s), transpo_max (demi-tons, hors ligne), justesse (YIN ou non),
#   garder / exclure (expressions sur le chemin de l'échantillon), mono (monophonique), cible_db (correction de sonie).
from recettes_kits import KITS
from recettes_suite import SUITE

FP = 'https://freepats.zenvoid.org/'
GH_FP = 'https://github.com/freepats/'
ZIP_SWAG = 'https://github.com/sfzinstruments/karoryfer.swagbass/releases/download/v1.001/Karoryfer.Swagbass.v1.001.zip'
ZIP_MEAT = 'https://github.com/sfzinstruments/karoryfer.meatbass/releases/download/v1.001/Karoryfer.Meatbass.v1.001.zip'
UNE = [(1, 127, 90)]
DEUX = [(1, 79, 50), (80, 127, 110)]

PRIORITAIRES = [
    {'id': 'vcsl-piano-queue', 'nom': 'Piano à queue', 'famille': 'Claviers', 'banque': 'vcsl',
     'source': {'type': 'vcsl', 'sfz': 'Chordophones/Zithers/Grand Piano, Steinway B'}, 'garder': ['/Sus/'],
     'plage': (21, 106), 'couches': [(1, 127, 80)], 'relache': 0.35, 'duree_max': 6, 'mesure_debut': 0.08},
    {'id': 'vsco-piano-droit', 'nom': 'Piano droit', 'famille': 'Claviers', 'banque': 'vsco',
     'source': {'type': 'vsco', 'sfz': 'UprightPiano'}, 'plage': (21, 108), 'couches': [(1, 127, 80)],
     'relache': 0.35, 'duree_max': 6, 'mesure_debut': 0.08, 'ecart_max': 70},  # piano ancien, aigus désaccordés
    {'id': 'freepats-guitare-nylon', 'nom': 'Guitare nylon', 'famille': 'Guitares', 'banque': 'freepats',
     'page': 'freepats-guitare-nylon',
     'source': {'type': 'archive', 'banque': 'freepats', 'sfz': 'SpanishClassicalGuitar-20190618.sfz',
                'url': FP + 'Guitar/SpanishClassicalGuitar/SpanishClassicalGuitar-SFZ+FLAC-20190618.7z'},
     'plage': (40, 84), 'couches': UNE, 'relache': 0.25, 'duree_max': 4},
    {'id': 'freepats-guitare-claire', 'nom': 'Guitare électrique claire', 'famille': 'Guitares', 'banque': 'freepats',
     'page': 'freepats-guitare-claire',
     'source': {'type': 'archive', 'banque': 'freepats', 'sfz': 'EGuitarFSBS-clean bridge small 20260807.sfz',
                'url': GH_FP + 'electric-guitar-FSBS-clean/releases/download/2026-08-07/'
                               'EGuitarFSBS-clean-bridge-small-SFZ+FLAC-20260807.7z'},
     'plage': (40, 86), 'couches': UNE, 'relache': 0.2, 'duree_max': 4, 'transpo_max': 3},
    {'id': 'vsco-cordes', 'nom': 'Cordes en section', 'famille': 'Cordes', 'banque': 'vsco', 'tenu': True,
     'parties': [{'source': {'type': 'vsco', 'sfz': 'CelloEnsSusVib'}, 'plage': (36, 57)},
                 {'source': {'type': 'vsco', 'sfz': 'ViolinEnsSusVib'}, 'plage': (58, 88)}],
     'couches': [(1, 127, 100)], 'relache': 0.45, 'duree_max': 4, 'boucle_debut': 0.45, 'fondu': 0.15,
     'mesure_debut': 0.4},
    {'id': 'vsco-pizzicato', 'nom': 'Cordes pizzicato', 'famille': 'Cordes', 'banque': 'vsco',
     'parties': [{'source': {'type': 'vsco', 'sfz': 'CelloEnsPizz'}, 'plage': (36, 57)},
                 {'source': {'type': 'vsco', 'sfz': 'ViolinEnsPizz'}, 'plage': (58, 88)}],
     'couches': [(1, 79, 40), (80, 127, 100)], 'relache': 0.2, 'duree_max': 1.4, 'mesure_debut': 0.04},
    {'id': 'vsco-flute', 'nom': 'Flûte', 'famille': 'Vents', 'banque': 'vsco', 'tenu': True,
     'source': {'type': 'vsco', 'sfz': 'FluteSusVib'}, 'plage': (60, 96), 'couches': UNE,
     'relache': 0.25, 'duree_max': 4, 'boucle_debut': 0.4, 'fondu': 0.12, 'mesure_debut': 0.35, 'mono': True},
    {'id': 'karoryfer-basse', 'nom': 'Basse électrique', 'famille': 'Basses', 'banque': 'karoryfer',
     'page': 'karoryfer-swagbass',
     'source': {'type': 'zip', 'banque': 'karoryfer', 'url': ZIP_SWAG, 'sfz': 'Swagbass/swagbass_clean.sfz'},
     'exclure': ['noises/'], 'plage': (24, 64), 'couches': [(1, 79, 40), (80, 127, 90)], 'relache': 0.12,
     'duree_max': 2.5, 'mono': True, 'mesure_debut': 0.1},
    {'id': 'karoryfer-contrebasse', 'nom': 'Contrebasse', 'famille': 'Basses', 'banque': 'karoryfer',
     'page': 'karoryfer-meatbass',
     'source': {'type': 'zip', 'banque': 'karoryfer', 'url': ZIP_MEAT, 'sfz': 'Meatbass/Programs/pizz_basic.sfz'},
     'exclure': ['noise'], 'plage': (24, 60), 'couches': [(1, 79, 48), (80, 127, 110)], 'relache': 0.15,
     'duree_max': 2.2, 'mesure_debut': 0.1},
    {'id': 'vcsl-marimba', 'nom': 'Marimba', 'famille': 'Percussions mélodiques', 'banque': 'vcsl',
     'source': {'type': 'vcsl', 'sfz': 'Idiophones/Struck Idiophones/Marimba'}, 'plage': (41, 96),
     'couches': [(1, 79, 64, ['_soft_|_med_']), (80, 127, 64, ['_loud_'])], 'transpo_max': 3.5,
     'relache': 0.3, 'duree_max': 2.5, 'mesure_debut': 0.03},
    {'id': 'vcsl-vibraphone', 'nom': 'Vibraphone', 'famille': 'Percussions mélodiques', 'banque': 'vcsl',
     'source': {'type': 'vcsl', 'sfz': 'Idiophones/Struck Idiophones/Vibraphone - Soft Mallets'}, 'plage': (53, 89),
     'couches': [(1, 79, 60), (80, 127, 110)], 'relache': 0.5, 'duree_max': 4, 'mesure_debut': 0.4},
]

RECETTES = PRIORITAIRES + SUITE + KITS
