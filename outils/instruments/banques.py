# Les banques acceptées (CC0 vérifié le 5 novembre 2026, page par page). Voir licences/<banque>.txt.
# Une banque absente d'ici ne peut pas servir : preparer.py refuse toute recette qui la nomme.

CC0 = 'CC0-1.0'

BANQUES = {
    'vcsl': {
        'titre': 'Versilian Community Sample Library (VCSL)',
        'auteur': 'Versilian Studios LLC (Sam Gossner et contributeurs)',
        'url': 'https://github.com/sgossner/VCSL',
        'licence_url': 'https://raw.githubusercontent.com/sgossner/VCSL/master/LICENSE',
        'licence': CC0,
    },
    'vsco': {
        'titre': 'VS Chamber Orchestra: Community Edition (VSCO-2-CE)',
        'auteur': 'Versilian Studios LLC (Sam Gossner) et Ivy Audio (Simon Dalzell)',
        'url': 'https://github.com/sgossner/VSCO-2-CE',
        'licence_url': 'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/SFZ/LICENSE',
        'licence': CC0,
    },
    'freepats': {
        'titre': 'FreePats',
        'auteur': 'Projet FreePats (roberto@zenvoid.org) et ses contributeurs, voir chaque instrument',
        'url': 'https://freepats.zenvoid.org/',
        'licence_url': 'https://creativecommons.org/publicdomain/zero/1.0/',
        'licence': CC0,
    },
    'karoryfer': {
        'titre': 'Karoryfer Samples (Karoryfer Lecolds)',
        'auteur': 'Karoryfer Lecolds',
        'url': 'https://shop.karoryfer.com/',
        'licence_url': 'https://creativecommons.org/publicdomain/zero/1.0/',
        'licence': CC0,
    },
    'virtuosity': {
        'titre': 'Virtuosity Drums',
        'auteur': 'Versilian Studios LLC et Karoryfer Lecolds (batteur : Austin McMahon)',
        'url': 'https://versilian-studios.com/virtuosity-drums/',
        'licence_url': 'https://raw.githubusercontent.com/sfzinstruments/virtuosity_drums/master/LICENSE',
        'licence': CC0,
    },
}

# Pages d'origine relues pour chaque source précise (affichées dans instrument.json → licence.url).
PAGES = {
    'freepats-piano-fb': 'https://freepats.zenvoid.org/Piano/honky-tonk-piano.html',
    'freepats-guitare-nylon': 'https://freepats.zenvoid.org/Guitar/acoustic-guitar.html',
    'freepats-guitare-claire': 'https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html',
    'freepats-guitare-saturee': 'https://freepats.zenvoid.org/ElectricGuitar/distorted-electric-guitar.html',
    'freepats-basse': 'https://freepats.zenvoid.org/ElectricGuitar/clean-electric-bass.html',
    'freepats-ukulele': 'https://freepats.zenvoid.org/GuitarFamily/ukulele.html',
    'freepats-accordeon': 'https://freepats.zenvoid.org/Organ/accordion.html',
    'freepats-orgue-tirettes': 'https://freepats.zenvoid.org/Organ/electric-organ.html',
    'freepats-piano-fm': 'https://freepats.zenvoid.org/ElectricPiano/synthesized-piano.html',
    'freepats-kalimba': 'https://freepats.zenvoid.org/Ethnic/kalimba.html',
    'freepats-percussions': 'https://freepats.zenvoid.org/Percussion/world-and-rare-percussion.html',
    'karoryfer-rusty': 'https://shop.karoryfer.com/pages/free-big-rusty-drums',
    'karoryfer-swirly': 'https://shop.karoryfer.com/pages/free-swirly-drums',
    'karoryfer-meatbass': 'https://shop.karoryfer.com/pages/free-meatbass',
    'karoryfer-osiris': 'https://shop.karoryfer.com/pages/free-osiris-piano',
    'karoryfer-swagbass': 'https://shop.karoryfer.com/pages/free-swagbass',
}

# Auteurs précis quand la banque regroupe plusieurs contributeurs.
AUTEURS = {
    'freepats-piano-fb': 'Piotr Barcz (enregistrement), FreePats',
    'freepats-guitare-nylon': 'Roberto (roberto@zenvoid.org), FreePats',
    'freepats-guitare-claire': 'FreePats (FSBS Electric Guitar)',
    'freepats-guitare-saturee': 'FreePats (FSBS Electric Guitar)',
    'freepats-basse': 'Andrea Biasior, FreePats',
    'freepats-ukulele': 'Mateusz Dąbrowski, FreePats',
    'freepats-accordeon': 'Jeff Stauffer (enregistrement), michael02022, FreePats',
    'freepats-orgue-tirettes': 'Roberto (roberto@zenvoid.org), FreePats',
    'freepats-piano-fm': 'Roberto (roberto@zenvoid.org), FreePats',
    'freepats-kalimba': 'Xavimart, Gonzalo et Roberto, FreePats',
    'freepats-percussions': 'Xavimart, Gonzalo et Roberto, FreePats (claves et conga : VCSL)',
    'karoryfer-osiris': 'Karoryfer Lecolds et Versilian Studios LLC',
    'karoryfer-swagbass': 'D. Smolken (jeu et échantillonnage), Karoryfer Lecolds',
    'karoryfer-meatbass': 'Drogomir Smolken (jeu), Ludwik Zamenhof (prise de son), Karoryfer Lecolds',
}

# Refusés (vérifiés, NON CC0 ou provenance floue) : gardés ici pour que personne ne les rajoute par erreur.
REFUSES = {
    'Salamander Grand Piano': 'CC-BY 3.0 (attribution obligatoire)',
    'YDP Grand Piano (FreePats)': 'CC-BY 3.0',
    'MuldjordKit (FreePats)': 'CC-BY 4.0',
    'FreePats General MIDI': 'GPL',
    'Splendid Grand Piano, SM Drums': 'provenance floue',
}
