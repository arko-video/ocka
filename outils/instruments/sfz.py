# Lecture simple d'un fichier SFZ (texte NON FIABLE) : on n'en tire que des régions (échantillon, note, vélocités…).
# Gère <control> default_path, <global>/<master>/<group>/<region>, #define, et #include via un lecteur fourni.

import re

ENTETE = re.compile(r'<(\w+)>')
OPCODE = re.compile(r'([A-Za-z0-9_]+)=')
AVEC_ESPACES = {'sample', 'default_path', 'group_label', 'region_label', 'master_label', 'global_label'}
NOTES = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def nom_vers_midi(nom):
    """« C4 » → 60, « A#0 » → 22, « Bb3 » → 58 ; un nombre reste un nombre."""
    nom = str(nom).strip()
    if re.fullmatch(r'-?\d+', nom):
        return int(nom)
    m = re.fullmatch(r'([A-Ga-g])([#b]?)(-?\d)', nom)
    if not m:
        raise ValueError(f'note illisible : {nom!r}')
    n = NOTES[m.group(1).lower()] + {'#': 1, 'b': -1, '': 0}[m.group(2)]
    return 12 * (int(m.group(3)) + 1) + n


def _sans_commentaires(texte):
    return '\n'.join(l.split('//')[0] for l in texte.splitlines())


def _developper(texte, lire_include, definitions, profondeur=0):
    if profondeur > 8:
        raise ValueError('#include trop imbriqués')
    sortie = []
    for ligne in _sans_commentaires(texte).splitlines():
        s = ligne.strip()
        m = re.match(r'#define\s+(\$\w+)\s+(.*)', s)
        if m:
            definitions[m.group(1)] = m.group(2).strip()
            continue
        m = re.match(r'#include\s+"([^"]+)"', s)
        if m:
            sortie.append(_developper(lire_include(m.group(1)), lire_include, definitions, profondeur + 1))
            continue
        for cle in sorted(definitions, key=len, reverse=True):
            ligne = ligne.replace(cle, definitions[cle])
        sortie.append(ligne)
    return '\n'.join(sortie)


def _opcodes(bloc):
    res = {}
    positions = [(m.start(), m.end(), m.group(1)) for m in OPCODE.finditer(bloc)]
    for i, (_, fin, cle) in enumerate(positions):
        suite = positions[i + 1][0] if i + 1 < len(positions) else len(bloc)
        valeur = bloc[fin:suite]
        res[cle] = valeur.strip() if cle in AVEC_ESPACES else valeur.split()[0] if valeur.split() else ''
    return res


def lire_sfz(texte, lire_include=None):
    """Rend la liste des régions (dict d'opcodes hérités) ; `sample` est préfixé par default_path."""
    texte = _developper(texte, lire_include or (lambda n: ''), {})
    niveaux = {'control': {}, 'global': {}, 'master': {}, 'group': {}}
    regions = []
    morceaux = ENTETE.split(texte)
    # morceaux = [avant, entete1, contenu1, entete2, contenu2, ...]
    for i in range(1, len(morceaux), 2):
        entete, contenu = morceaux[i], _opcodes(' '.join(morceaux[i + 1].split('\n')))
        if entete == 'control':
            niveaux['control'] = contenu
        elif entete == 'global':
            niveaux['global'], niveaux['master'], niveaux['group'] = contenu, {}, {}
        elif entete == 'master':
            niveaux['master'], niveaux['group'] = contenu, {}
        elif entete == 'group':
            niveaux['group'] = contenu
        elif entete == 'region':
            r = {**niveaux['global'], **niveaux['master'], **niveaux['group'], **contenu}
            if 'sample' not in r:
                continue
            r['sample'] = (niveaux['control'].get('default_path', '') + r['sample']).replace('\\', '/')
            for cle in ('pitch_keycenter', 'lokey', 'hikey', 'key'):
                if cle in r:
                    r[cle] = nom_vers_midi(r[cle])
            if 'key' in r:
                r.setdefault('lokey', r['key'])
                r.setdefault('hikey', r['key'])
                r.setdefault('pitch_keycenter', r['key'])
            for cle in ('lovel', 'hivel', 'offset', 'loop_start', 'loop_end', 'tune', 'transpose', 'seq_position'):
                if cle in r:
                    r[cle] = int(float(r[cle]))
            r.setdefault('lovel', 0)
            r.setdefault('hivel', 127)
            regions.append(r)
    return regions
