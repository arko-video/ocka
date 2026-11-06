# Où trouver les régions SFZ et les échantillons d'une recette (VCSL, VSCO, archives FreePats, ZIP distants).
# Rend une liste de régions (dict SFZ) et une fonction charger(region) → (chemin local, sha256, nom de source).

import glob
import os
import posixpath
import urllib.parse
import urllib.request

import reseau
import sfz

RAW_VCSL = 'https://raw.githubusercontent.com/sgossner/VCSL/master/'
RAW_VCSL_SFZ = 'https://raw.githubusercontent.com/smpldsnds/sgossner-vcsl/main/'
RAW_VSCO = 'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/SFZ/'


def _texte_url(url):
    reseau._verifier_hote(url)
    return urllib.request.urlopen(url, timeout=60).read().decode('utf-8', 'replace')


def _q(chemin):
    return urllib.parse.quote(chemin)


def ouvrir(source):
    """source = dict(type=…) ; rend (régions, charger)."""
    t = source['type']
    if t == 'vcsl':
        dossier = posixpath.dirname(source['sfz'])
        regions = sfz.lire_sfz(_texte_url(RAW_VCSL_SFZ + _q(source['sfz']) + '.sfz'))

        def charger(r):
            chemin = posixpath.normpath(posixpath.join(dossier, r['sample']))
            ch, sha = reseau.telecharger(RAW_VCSL + _q(chemin), 'vcsl', chemin)
            return ch, sha, chemin
        return regions, charger

    if t == 'vsco':
        regions = sfz.lire_sfz(_texte_url(RAW_VSCO + _q(source['sfz']) + '.sfz'))

        def charger(r):
            chemin = posixpath.normpath(r['sample'])
            ch, sha = reseau.telecharger(RAW_VSCO + _q(chemin), 'vsco', chemin)
            return ch, sha, chemin
        return regions, charger

    if t == 'archive':
        nom = os.path.basename(urllib.parse.urlsplit(source['url']).path)
        racine_nom = nom.replace('.tar.xz', '').replace('.7z', '')
        archive, sha_archive = reseau.telecharger(source['url'], source['banque'], f'{racine_nom}/{nom}')
        dossier = reseau.extraire_archive(archive, source['banque'])
        trouves = glob.glob(os.path.join(dossier, '*', source['sfz']))
        if len(trouves) != 1:
            raise RuntimeError(f'SFZ introuvable ou ambigu : {source["sfz"]} dans {dossier}')
        base = os.path.dirname(trouves[0])
        regions = sfz.lire_sfz(open(trouves[0], encoding='utf-8', errors='replace').read(),
                               lambda n: open(os.path.join(base, reseau.chemin_relatif_sur(n)), errors='replace').read())

        def charger(r):
            ch = os.path.join(base, reseau.chemin_relatif_sur(r['sample']))
            if not os.path.isfile(ch):
                raise FileNotFoundError(ch)
            return ch, sha_archive, nom
        return regions, charger

    if t == 'zip':
        url, banque = source['url'], source['banque']
        z = reseau.zip_distant(url)
        noms = set(z.namelist())
        base = posixpath.dirname(source['sfz'])

        def lire_membre(n):
            chemin = posixpath.normpath(posixpath.join(base, n))
            if chemin not in noms:
                return ''
            return open(reseau.membre_zip_distant(url, chemin, banque)[0], encoding='utf-8', errors='replace').read()

        regions = sfz.lire_sfz(lire_membre(posixpath.basename(source['sfz'])), lire_membre)

        def charger(r):
            chemin = posixpath.normpath(posixpath.join(base, r['sample']))
            if chemin not in noms:  # sensibilité à la casse (fichiers faits sous Windows)
                proches = [n for n in noms if n.lower() == chemin.lower()]
                if not proches:
                    raise FileNotFoundError(chemin)
                chemin = proches[0]
            ch, sha = reseau.membre_zip_distant(url, chemin, banque)
            return ch, sha, chemin
        return regions, charger

    if t == 'fichiers-zip':
        # Pas de SFZ utilisable : la recette nomme elle-même les fichiers (batteries multi-micros).
        url, banque = source['url'], source['banque']

        def charger(r):
            ch, sha = reseau.membre_zip_distant(url, r['sample'], banque)
            return ch, sha, r['sample']
        return [], charger

    raise ValueError(f'type de source inconnu : {t}')
