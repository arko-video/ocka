# Batteries et percussions (voir recettes.py). Notes General MIDI : 36 grosse caisse, 38 caisse claire, 42/44/46 charley…
# Batteries multi-micros : chaque coup = micro proche + overheads (+ salle), mélangés en stéréo avant l'encodage.
ZIP_RUSTY = 'https://github.com/sfzinstruments/karoryfer.big-rusty-drums/releases/download/v1.100/Big_Rusty_Drums_1100.zip'
ZIP_SWIRLY = 'https://github.com/sfzinstruments/karoryfer.swirly-drums/releases/download/v1.104/Swirly.Drums_1104.zip'
ZIP_VIRTU = 'https://versilian-studios.com/Distro/Virtuosity_Drums_v0.925.zip'
FP_PERC = ('https://github.com/freepats/world-percussion/releases/download/2020-09-05/'
           'WorldPercussion-SFZ+WAV-20200905.7z')
CHARLEY = [[42, 44, 46]]
DEUX = [(1, 79, 50), (80, 127, 110)]


def rusty(note, nom, dossier, fichier, couches, duree, micros=(('cl', 1.0), ('oh', 0.6))):
    """Big Rusty : Samples/<pièce>/<articulation>/<micro>/<nom>_vl<n>_rr1.flac"""
    return {'note': note, 'nom': nom, 'duree_max': duree,
            'fichiers': [[(f'Samples/{dossier}/{m}/{fichier}_vl{v}_rr1.flac', p) for m, p in micros] for v in couches]}


def virtu(note, nom, piece, art, couches, duree, proche=None, rr=True):
    """Virtuosity : Samples/<micro>/<pièce>/<micro>_<pièce>_<art>_vl<n>[_rr1].flac ; overheads + salle (+ proche)."""
    micros = ([(proche, 0.8)] if proche else []) + [('oh', 1.0), ('room', 0.45)]
    suffixe = '_rr1' if rr else ''
    return {'note': note, 'nom': nom, 'duree_max': duree,
            'fichiers': [[(f'Samples/{m}/{piece}/{m}_{piece}_{art}_vl{v}{suffixe}.flac', p) for m, p in micros]
                         for v in couches]}


def swirly(note, nom, dossier, fichier, couches, duree, parties=(('', 1.0),)):
    """Swirly : Samples/<pièce>/<nom>_vl<n>_rr1[_partie].wav (son sec, peaux haut/bas mélangées)."""
    return {'note': note, 'nom': nom, 'duree_max': duree,
            'fichiers': [[(f'Samples/{dossier}/{fichier}_vl{v}_rr1{s}.wav', p) for s, p in parties] for v in couches]}


def vcsl(note, nom, sfz, cle, duree):
    return {'note': note, 'nom': nom, 'cle': cle, 'duree_max': duree,
            'source': {'type': 'vcsl', 'sfz': sfz}}


VCSL_PERC = 'Membranophones/Struck Membranophones/'
VCSL_IDIO = 'Idiophones/Struck Idiophones/'

KITS = [
    {'id': 'karoryfer-batterie', 'nom': 'Batterie acoustique', 'famille': 'Batteries', 'banque': 'karoryfer',
     'page': 'karoryfer-rusty', 'couches': DEUX, 'relache': 0.08, 'exclusif': CHARLEY,
     'source': {'type': 'fichiers-zip', 'banque': 'karoryfer', 'url': ZIP_RUSTY},
     'kit': [
         rusty(36, 'Grosse caisse', 'kick_24/kick', 'k', (7, 13), 0.9, (('kick', 1.0), ('oh', 0.5))),
         rusty(37, 'Bord de caisse', 'snare_14/sidestick', 'sn_ss', (2, 4), 0.5, (('top', 1.0), ('oh', 0.6))),
         rusty(38, 'Caisse claire', 'snare_14/center', 'sn_center', (5, 9), 1.0,
               (('top', 1.0), ('btm', 0.4), ('oh', 0.6))),
         rusty(40, 'Caisse claire (rimshot)', 'snare_14/rimshot', 'sn_rims', (3, 6), 1.0, (('top', 1.0), ('oh', 0.6))),
         rusty(42, 'Charley fermé', 'hihat_14/tc', 'ht_tc', (4, 7), 0.4),
         rusty(44, 'Charley au pied', 'hihat_14/chik', 'ht_chik', (3, 5), 0.4),
         rusty(46, 'Charley ouvert', 'hihat_14/open', 'ht_open', (3, 5), 1.8),
         rusty(43, 'Tom basse', 'tom_22/center', 't22', (4, 6), 1.6),
         rusty(47, 'Tom medium', 'tom_15/center', 't15', (4, 6), 1.3),
         rusty(50, 'Tom aigu', 'tom_14/center', 't14', (3, 5), 1.2),
         rusty(49, 'Crash', 'crash_17/cr', 'cr', (3, 5), 2.6),
         rusty(51, 'Ride', 'ride_22/rd', 'rd', (5, 9), 2.2),
         rusty(53, 'Cloche du ride', 'ride_22/bl', 'rd_bl', (2, 4), 1.6),
     ]},
    {'id': 'virtuosity-batterie-jazz', 'nom': 'Batterie jazz', 'famille': 'Batteries', 'banque': 'virtuosity',
     'couches': DEUX, 'relache': 0.08, 'exclusif': CHARLEY,
     'source': {'type': 'fichiers-zip', 'banque': 'virtuosity', 'url': ZIP_VIRTU},
     'kit': [
         virtu(36, 'Grosse caisse', 'kick', 'snon', (2, 4), 0.9, proche='kickmic'),
         virtu(37, 'Bord de caisse', 'snare', 'crossstick', (8, 14), 0.5, proche='snaremic', rr=False),
         virtu(38, 'Caisse claire', 'snare', 'center', (18, 32), 1.0, proche='snaremic', rr=False),
         virtu(40, 'Caisse claire (rimshot)', 'snare', 'rimshot', (6, 11), 1.0, proche='snaremic', rr=False),
         virtu(42, 'Charley fermé', 'hh', 'closed', (2, 4), 0.4),
         virtu(44, 'Charley au pied', 'hh', 'pedal', (2, 3), 0.4),
         virtu(46, 'Charley ouvert', 'hh', 'open', (2, 4), 1.8),
         virtu(43, 'Tom basse', 'ltom', 'center', (8, 14), 1.6, rr=False),
         virtu(48, 'Tom aigu', 'htom', 'center', (8, 14), 1.3, rr=False),
         virtu(49, 'Crash', 'crash', 'crash', (2, 3), 2.6),
         virtu(51, 'Ride', 'ride', 'ride', (2, 3), 2.4),
         virtu(53, 'Cloche du ride', 'ride', 'bell', (2, 3), 1.6),
     ]},
    {'id': 'karoryfer-batterie-balais', 'nom': 'Batterie aux balais', 'famille': 'Batteries', 'banque': 'karoryfer',
     'page': 'karoryfer-swirly', 'couches': DEUX, 'relache': 0.08, 'exclusif': CHARLEY,
     'source': {'type': 'fichiers-zip', 'banque': 'karoryfer', 'url': ZIP_SWIRLY},
     'kit': [
         swirly(36, 'Grosse caisse', 'marching_kick', 'marching_kick', (7, 12), 0.9,
                (('_beater', 1.0), ('_reso', 0.7))),
         swirly(38, 'Caisse claire (balai)', 'snare_main', 'snare_hit', (6, 11), 0.9, (('_top', 1.0), ('_btm', 0.4))),
         swirly(40, 'Caisse claire (bord)', 'snare_edge', 'snare_edge', (5, 9), 0.9, (('_top', 1.0), ('_btm', 0.4))),
         swirly(42, 'Charley fermé', 'hat_tight', 'hh_tight', (8, 14), 0.4),
         swirly(44, 'Charley au pied', 'hat_foot', 'hh_foot', (5, 8), 0.4),
         swirly(46, 'Charley ouvert', 'hat_open', 'hh_open', (8, 13), 1.6),
         swirly(43, 'Tom basse', 'tom_floor', 'tom_floor', (7, 11), 1.4),
         swirly(47, 'Tom medium', 'tom_mlow', 'tom_mlow', (7, 11), 1.2),
         swirly(50, 'Tom aigu', 'tom_mhi', 'tom_mhi', (6, 9), 1.1),
         swirly(49, 'Crash', 'crash', 'crash', (7, 11), 2.4),
         swirly(51, 'Ride', 'ride', 'ride', (8, 14), 2.2),
         swirly(56, 'Cloche (cowbell)', 'cowbell', 'cowbell', (5, 8), 0.6),
     ]},
    {'id': 'vcsl-percussions-latines', 'nom': 'Percussions latines', 'famille': 'Percussions', 'banque': 'vcsl',
     'couches': [(1, 79, 50), (80, 127, 110)], 'relache': 0.08, 'kit': [
         vcsl(39, 'Claquement de mains', VCSL_IDIO + 'Claps', 61, 0.6),
         vcsl(54, 'Tambourin', VCSL_IDIO + 'Tambourine 1', 60, 0.8),
         vcsl(56, 'Cloche (cowbell)', VCSL_IDIO + 'Cowbells', 62, 0.6),
         vcsl(60, 'Bongo aigu', VCSL_PERC + 'Bongos', 60, 0.6),
         vcsl(61, 'Bongo grave', VCSL_PERC + 'Bongos', 63, 0.7),
         vcsl(62, 'Conga étouffée', VCSL_PERC + 'Conga', 62, 0.5),
         vcsl(63, 'Conga ouverte', VCSL_PERC + 'Conga', 63, 0.8),
         vcsl(64, 'Conga grave (tumba)', VCSL_PERC + 'Conga', 65, 0.9),
         vcsl(67, 'Agogo aigu', VCSL_IDIO + 'Agogo Bells', 60, 0.8),
         vcsl(68, 'Agogo grave', VCSL_IDIO + 'Agogo Bells', 61, 0.8),
         vcsl(69, 'Cabasa', VCSL_IDIO + 'Cabasa', 60, 0.4),
         vcsl(70, 'Shaker', VCSL_IDIO + 'Shaker, Small', 61, 0.4),
         vcsl(73, 'Guiro court', VCSL_IDIO + 'Guiro', 61, 0.4),
         vcsl(74, 'Guiro long', VCSL_IDIO + 'Guiro', 62, 1.0),
         vcsl(75, 'Claves', VCSL_IDIO + 'Claves', 60, 0.4),
         vcsl(76, 'Wood-block aigu', VCSL_IDIO + 'Woodblock', 62, 0.4),
         vcsl(81, 'Triangle', VCSL_IDIO + 'Triangles', 60, 2.0),
     ]},
    {'id': 'freepats-percussions', 'nom': 'Percussions du monde', 'famille': 'Percussions', 'banque': 'freepats',
     'page': 'freepats-percussions', 'couches': [(1, 127, 100)], 'relache': 0.08,
     'source': {'type': 'archive', 'banque': 'freepats', 'url': FP_PERC, 'sfz': 'WorldPercussion 20200905.sfz'},
     'kit': [{'note': n, 'nom': nom, 'cle': n, 'duree_max': d} for n, nom, d in [
         (48, 'Cajón grave', 0.6), (50, 'Cajón claqué', 0.5), (51, 'Bongo grave', 0.6), (52, 'Bongo aigu', 0.5),
         (54, 'Œuf shaker', 0.4), (57, 'Tambourin', 0.6), (59, 'Claquement de mains', 0.5), (60, 'Claves', 0.4),
         (61, 'Castagnettes', 0.4), (62, 'Conga', 0.7), (63, 'Conga grave', 0.8), (64, 'Conga aiguë', 0.6),
         (67, 'Maracas', 0.4), (69, 'Darbouka (doum)', 0.7), (70, 'Darbouka (tak)', 0.4), (71, 'Darbouka (pa)', 0.4)]]},
]
