# Les autres instruments mélodiques (les 10 prioritaires sont dans recettes.py).
FP = 'https://freepats.zenvoid.org/'
GH_FP = 'https://github.com/freepats/'
ZIP_OSIRIS = 'https://github.com/sfzinstruments/Osiris_Piano/releases/download/v0.925/Osiris_Piano_0925.zip'
UNE = [(1, 127, 90)]
TENU = {'tenu': True, 'relache': 0.3, 'duree_max': 4, 'boucle_debut': 0.4, 'fondu': 0.12, 'mesure_debut': 0.4}


def fp(url_relative, sfz):
    return {'type': 'archive', 'banque': 'freepats', 'url': url_relative, 'sfz': sfz}


def vsco(sfz):
    return {'type': 'vsco', 'sfz': sfz}


def vcsl(sfz):
    return {'type': 'vcsl', 'sfz': sfz}


CLAVIERS = [
    {'id': 'karoryfer-piano-doux', 'nom': 'Piano doux', 'famille': 'Claviers', 'banque': 'karoryfer',
     'page': 'karoryfer-osiris', 'garder': ['/UC/A/'],
     'source': {'type': 'zip', 'banque': 'karoryfer', 'url': ZIP_OSIRIS, 'sfz': 'Osiris Piano/Programs/01-natural.sfz'},
     'plage': (21, 108), 'couches': [(1, 127, 100)], 'relache': 0.4, 'duree_max': 6, 'mesure_debut': 0.08,
     'ecart_max': 60, 'justesse_max': 103},  # aigus « una corda » jusqu'à +45 cents, corrigés par `cents`
    {'id': 'freepats-piano-bastringue', 'nom': 'Piano bastringue', 'famille': 'Claviers', 'banque': 'freepats',
     'page': 'freepats-piano-fb',
     'source': fp(GH_FP + 'old-piano-FB/releases/download/2020-04-01/PianoFB-SFZ+FLAC-20200401.7z', 'PianoFB 20200401.sfz'),
     'plage': (21, 108), 'couches': UNE, 'relache': 0.35, 'duree_max': 6, 'mesure_debut': 0.08, 'ecart_max': 70},
    {'id': 'freepats-piano-fm', 'nom': 'Piano électrique FM', 'famille': 'Claviers', 'banque': 'freepats',
     'page': 'freepats-piano-fm',
     'source': fp(GH_FP + 'fm-piano1/releases/download/2019-09-16/FM-Piano1-SFZ+FLAC-20190916.7z', 'FM-Piano1 20190916.sfz'),
     'plage': (28, 98), 'couches': [(1, 79, 60), (80, 127, 115)], 'transpo_max': 3, 'relache': 0.3,
     'duree_max': 3, 'mesure_debut': 0.1},
    {'id': 'vcsl-orgue', 'nom': "Orgue d'église", 'famille': 'Claviers', 'banque': 'vcsl',
     'source': vcsl('Aerophones/Edge-blown Aerophones/Pipe Organ - Loud'), 'plage': (36, 96), 'couches': UNE,
     **TENU, 'boucle_debut': 0.3, 'partiel': 1},  # jeux de mutation (quinte) : on mesure le partiel 1
    {'id': 'freepats-orgue-electrique', 'nom': 'Orgue électrique', 'famille': 'Claviers', 'banque': 'freepats',
     'page': 'freepats-orgue-tirettes',
     'source': fp(FP + 'Organ/DrawbarOrganEmulation/DrawbarOrganEmulation-SFZ-20190712.tar.xz',
                  'DrawbarOrganEmulation-20190712.sfz'),
     'plage': (36, 96), 'couches': UNE, **TENU, 'boucle_debut': 0.25, 'relache': 0.1,
     # Jeu de 16' le plus fort (YIN, M1) : chaque touche sonne une octave plus bas. Tirettes un peu désaccordées
     # entre elles : hauteur mesurée sur tout le son, sur 0,85 s (comme le banc de M1).
     'racine_decalee': -12, 'mesure_debut': 0.25, 'mesure_duree': 0.85},
    {'id': 'freepats-accordeon', 'nom': 'Accordéon', 'famille': 'Claviers', 'banque': 'freepats',
     'page': 'freepats-accordeon',
     'source': fp(GH_FP + 'button-accordion-HN/releases/download/2024-03-29/ButtonAccordionHN-SFZ+FLAC-20240329.7z',
                  'PRESET Button Accordion HN tuned.sfz'),
     'plage': (47, 81), 'couches': UNE, **TENU, 'ecart_max': 60},
    {'id': 'vcsl-clavecin', 'nom': 'Clavecin', 'famille': 'Claviers', 'banque': 'vcsl',
     'source': vcsl('Chordophones/Zithers/Harpsichord, English - Normal'), 'plage': (34, 89), 'couches': UNE,
     'relache': 0.15, 'duree_max': 3, 'mesure_debut': 0.08},
]

GUITARES = [
    {'id': 'freepats-guitare-saturee', 'nom': 'Guitare saturée', 'famille': 'Guitares', 'banque': 'freepats',
     'page': 'freepats-guitare-saturee',
     'source': fp(GH_FP + 'electric-guitar-FSBS-dist2/releases/download/2022-09-11/EGuitarFSBS-dist2-SFZ+FLAC-20220911.7z',
                  'EGuitarFSBS-dist2 bridge 20220911.sfz'),
     'plage': (40, 86), 'couches': [(1, 127, 110)], 'relache': 0.15, 'duree_max': 3, 'transpo_max': 3},
    {'id': 'freepats-ukulele', 'nom': 'Ukulélé', 'famille': 'Guitares', 'banque': 'freepats', 'page': 'freepats-ukulele',
     'source': fp(GH_FP + 'ukulele1/releases/download/2026-08-11/Ukulele-SFZ+WAV-20260811.7z', 'Ukulele 20260811.sfz'),
     'plage': (60, 84), 'couches': UNE, 'relache': 0.2, 'duree_max': 3},
]

CORDES = [
    {'id': 'vsco-violon', 'nom': 'Violon', 'famille': 'Cordes', 'banque': 'vsco', 'source': vsco('SViolinVib'),
     'plage': (55, 96), 'couches': [(1, 127, 100)], **TENU, 'mono': True},
    {'id': 'vsco-violoncelles', 'nom': 'Violoncelles', 'famille': 'Cordes', 'banque': 'vsco',
     'source': vsco('CelloEnsSusVib'), 'plage': (36, 77), 'couches': [(1, 127, 100)], **TENU, 'boucle_debut': 0.45},
    {'id': 'vsco-cordes-staccato', 'nom': 'Cordes staccato', 'famille': 'Cordes', 'banque': 'vsco',
     'parties': [{'source': vsco('CelloEnsSpic'), 'plage': (36, 57)}, {'source': vsco('ViolinEnsSpic'), 'plage': (58, 88)}],
     'couches': [(1, 79, 40), (80, 127, 100)], 'relache': 0.1, 'duree_max': 0.8, 'mesure_debut': 0.04},
    {'id': 'vcsl-harpe', 'nom': 'Harpe', 'famille': 'Cordes', 'banque': 'vcsl',
     'source': vcsl('Chordophones/Composite Chordophones/Concert Harp'), 'plage': (28, 101), 'couches': [(1, 127, 80)],
     'relache': 0.4, 'duree_max': 3.5, 'mesure_debut': 0.1},
]

VENTS = [
    {'id': 'vsco-clarinette', 'nom': 'Clarinette', 'famille': 'Vents', 'banque': 'vsco', 'source': vsco('ClarinetSus'),
     'plage': (50, 91), 'couches': [(1, 127, 70)], **TENU, 'mono': True},
    {'id': 'vsco-hautbois', 'nom': 'Hautbois', 'famille': 'Vents', 'banque': 'vsco', 'source': vsco('OboeSusVib'),
     'plage': (58, 91), 'couches': [(1, 127, 100)], **TENU, 'mono': True},
    {'id': 'vsco-basson', 'nom': 'Basson', 'famille': 'Vents', 'banque': 'vsco', 'source': vsco('BassoonSus'),
     'plage': (34, 75), 'couches': [(1, 127, 100)], **TENU, 'mono': True},
    {'id': 'vsco-cor', 'nom': "Cor d'harmonie", 'famille': 'Vents', 'banque': 'vsco', 'source': vsco('FHornSus'),
     'plage': (35, 62), 'couches': [(1, 127, 100)], **TENU},  # pas d'échantillon entre C4 et D5
    {'id': 'vsco-trompette', 'nom': 'Trompette', 'famille': 'Vents', 'banque': 'vsco', 'source': vsco('TrumpetSus'),
     'plage': (53, 86), 'couches': [(1, 127, 100)], **TENU, 'mono': True},
    {'id': 'vsco-trombone', 'nom': 'Trombone', 'famille': 'Vents', 'banque': 'vsco', 'source': vsco('TromboneSus'),
     'plage': (34, 67), 'couches': [(1, 127, 100)], **TENU, 'mono': True},
    {'id': 'vsco-tuba', 'nom': 'Tuba', 'famille': 'Vents', 'banque': 'vsco', 'source': vsco('TubaSus'),
     'plage': (28, 62), 'couches': [(1, 127, 100)], **TENU, 'mono': True, 'fondu': 0.25, 'essais_boucle': 14},  # grave : fondu long
    {'id': 'vcsl-saxophone', 'nom': 'Saxophone ténor', 'famille': 'Vents', 'banque': 'vcsl',
     'source': vcsl('Aerophones/Reed Aerophones/Tenor Saxophone - Vibrato'), 'plage': (44, 86), 'couches': UNE,
     **TENU, 'mono': True},
]

PERCUSSIONS_MELODIQUES = [
    {'id': 'vcsl-glockenspiel', 'nom': 'Glockenspiel', 'famille': 'Percussions mélodiques', 'banque': 'vcsl',
     'source': vcsl('Idiophones/Struck Idiophones/Glockenspiel'), 'plage': (67, 96), 'couches': UNE,
     'transpo_max': 3.5, 'relache': 0.5, 'duree_max': 3, 'justesse': False,
     'pourquoi': 'lames aux partiels inharmoniques : YIN varie de ±25 cents selon l’instant mesuré'},
    {'id': 'freepats-kalimba', 'nom': 'Kalimba', 'famille': 'Percussions mélodiques', 'banque': 'freepats',
     'page': 'freepats-kalimba', 'source': fp(FP + 'Ethnic/Kalimba/Kalimba-SFZ-20190723.tar.xz', 'Kalimba-20190723.sfz'),
     'plage': (52, 76), 'couches': UNE, 'transpo_max': 3.5, 'relache': 0.3, 'duree_max': 3, 'mesure_debut': 0.1,
     'ecart_max': 60},
    {'id': 'vcsl-xylophone', 'nom': 'Xylophone', 'famille': 'Percussions mélodiques', 'banque': 'vcsl',
     'source': vcsl('Idiophones/Struck Idiophones/Xylophone - Medium Mallets'), 'plage': (55, 96),
     'couches': [(1, 79, 40), (80, 127, 110)], 'transpo_max': 3.5, 'relache': 0.2, 'duree_max': 1.5,
     'mesure_debut': 0.03},
    {'id': 'vcsl-cloches', 'nom': 'Cloches tubulaires', 'famille': 'Percussions mélodiques', 'banque': 'vcsl',
     'source': vcsl('Idiophones/Struck Idiophones/Tubular Bells 1'), 'plage': (60, 77), 'couches': [(1, 127, 100)],
     'relache': 0.8, 'duree_max': 5, 'justesse': False,
     'pourquoi': 'cloche : la note entendue est un son virtuel (partiels inharmoniques), YIN ne la mesure pas'},
]

SUITE = CLAVIERS + GUITARES + CORDES + VENTS + PERCUSSIONS_MELODIQUES
