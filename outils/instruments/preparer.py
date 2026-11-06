# Prépare la banque d'instruments d'OCKA : python3 -I outils/instruments/preparer.py [id…]
# Pour chaque recette : sources CC0 vérifiées → zones (≤ 3 demi-tons) → coupe, boucle fondue, crête → Ogg Opus
# → mesures APRÈS décodage → public/instruments/<id>/instrument.json ; puis public/instruments/catalogue.json.

import json
import os
import shutil
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

import numpy as np  # noqa: E402

import audio  # noqa: E402
import sources  # noqa: E402
import traitement  # noqa: E402
import zones  # noqa: E402
from banques import AUTEURS, BANQUES, PAGES  # noqa: E402
from recettes import RECETTES  # noqa: E402

PUBLIC = os.path.normpath(os.path.join(ICI, '..', '..', 'public', 'instruments'))
PROVENANCE = os.path.join(ICI, 'provenance')
CIBLE_LUFS = -20.0       # sonie momentanée d'une note jouée à fond (instruments mélodiques)
CIBLE_KIT_LUFS = -16.0   # pièce la plus forte d'une batterie
BUDGET_S = 60.0          # secondes mono décodées au plus (§2)
VERSION = '@1'           # l'id d'un instrument est sa référence dans un morceau (« vcsl-marimba@1 ») ; dossier = avant « @ »
MARGE_S = 1.2


def licence(rec, shas):
    b = BANQUES[rec['banque']]
    return {
        'nom': b['licence'],
        'url': PAGES.get(rec.get('page'), b['url']),
        'auteur': AUTEURS.get(rec.get('page'), b['auteur']),
        'sha256': sorted(set(shas)),
    }


def ecrire_instrument(rec, zones_json, shas, canaux, duree_dec, provenance):
    dossier = os.path.join(PUBLIC, rec['id'])
    inst = {
        'id': rec['id'] + VERSION, 'nom': rec['nom'], 'famille': rec['famille'], 'licence': licence(rec, shas),
        'canaux': canaux, 'gainDb': rec.get('gain', 0.0), 'relache': rec.get('relache', 0.3),
        'budgetS': round(duree_dec, 3), 'zones': zones_json,
    }
    if rec.get('exclusif'):
        inst['exclusif'] = rec['exclusif']
    if rec.get('mono'):
        inst['mono'] = True
    with open(os.path.join(dossier, 'instrument.json'), 'w') as f:
        json.dump(inst, f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.makedirs(PROVENANCE, exist_ok=True)
    with open(os.path.join(PROVENANCE, rec['id'] + '.json'), 'w') as f:
        json.dump({'id': rec['id'], 'source': rec['source'] if 'source' in rec else None, 'fichiers': provenance},
                  f, ensure_ascii=False, indent=1, default=str)
        f.write('\n')
    return inst


def nouveau_dossier(rec):
    dossier = os.path.join(PUBLIC, rec['id'])
    shutil.rmtree(dossier, ignore_errors=True)
    os.makedirs(dossier)
    return dossier


def produire(rec, dossier, elements, canaux, cible, commun=None):
    """elements : dict(nom, x, zone, vel, cents, duree, sha, source). Encode, mesure et rend (zones, durée décodée)."""
    zs, total, provenance = [], 0.0, []
    for e in elements:
        y, m = traitement.fabriquer_encoder(e['x'], e['duree'], rec, os.path.join(dossier, e['nom']), canaux == 2)
        sonie = audio.sonie(y)
        if commun is None:
            gain = cible - (sonie + m['gain_crete_db'])
        else:
            gain = commun - m['gain_crete_db']
        zs.append(traitement.zone_json(e['nom'], e['zone'], e['cents'], e['vel'], gain, m))
        total += m['fin'] / audio.FREQ * canaux
        provenance.append({'fichier': e['nom'], 'source': e['source'], 'sha256': e.get('shas', e['sha']),
                           'transposition': e['zone'].get('transpo', 0), 'decalage_decodeur': m['decalage']})
    return zs, total, provenance


def parties(rec):
    """Une recette peut assembler plusieurs sources (ex. violoncelles en bas, violons en haut)."""
    for p in rec.get('parties', [rec]):
        regions, charger = sources.ouvrir(p['source'])
        regions = zones.filtrer(regions, p.get('garder', ()), p.get('exclure', ()))
        par_couche = [zones.couche(zones.filtrer(regions, c[3]) if len(c) > 3 else regions, c[2]) for c in rec['couches']]
        if not all(par_couche):
            raise RuntimeError(f'{rec["id"]} : une couche de vélocité est vide')
        bas, haut = p['plage']
        zs = zones.choisir_racines(set(par_couche[0]), bas, haut, rec.get('transpo_max', 2.5))
        yield charger, par_couche, zs


def preparer_melodique(rec):
    stereo = rec.get('stereo', False)
    canaux = 2 if stereo else 1
    elements = []
    for charger, par_couche, zs in parties(rec):
        elements += elements_partie(rec, charger, par_couche, zs, stereo)
    elements.sort(key=lambda e: (e['vel'][0], e['zone']['racine']))
    return finir_melodique(rec, elements, canaux)


def elements_partie(rec, charger, par_couche, zs, stereo):
    elements = []
    for ci, c in enumerate(rec['couches']):
        vb, vh = c[0], c[1]
        pc = par_couche[ci]
        for z in zs:
            native = z['native'] if z['native'] in pc else min(pc, key=lambda k: (abs(k - z['racine']), k))
            zz = dict(z, native=native, transpo=z['racine'] - native)
            x, sha, nom_src = traitement.charger(charger, pc[native], stereo, rec)
            x, longueur = traitement.preparer_brut(x, zz['transpo'], rec)
            # « racine_decalee » : le son entendu n'est pas la touche de la source (orgue au jeu de 16' : −12).
            d = rec.get('racine_decalee', 0)
            zz = dict(zz, racine=z['racine'] + d, bas=z['bas'] + d, haut=z['haut'] + d)
            dev = traitement.mesurer_justesse(x, zz['racine'], rec)
            if dev is not None and abs(dev) > rec.get('ecart_max', 45):
                raise RuntimeError(f'{rec["id"]} : {nom_src} joue {dev:+.0f} cents loin de {zz["racine"]} (mauvaise note ?)')
            # `cents` = l'accord du fichier (il joue racine + cents) : l'échantillonneur le retire (ZoneSource).
            elements.append({'nom': f'z{z["racine"]:03d}-v{ci + 1}.ogg', 'x': x, 'zone': zz, 'vel': (vb, vh),
                             'cents': dev or 0.0, 'longueur': min(longueur, rec.get('duree_max', 4.0)),
                             'sha': sha, 'source': nom_src})
    return elements


def finir_melodique(rec, elements, canaux):
    budget_fichier = (rec.get('budget', BUDGET_S) - MARGE_S) / canaux
    durees = zones.repartir([e['longueur'] for e in elements], budget_fichier, rec.get('duree_min', 0.25))
    for e, d in zip(elements, durees):
        e['duree'] = min(float(d), len(e['x']) / audio.FREQ)
    dossier = nouveau_dossier(rec)
    zj, total, prov = produire(rec, dossier, elements, canaux, CIBLE_LUFS + rec.get('cible_db', 0.0))
    return ecrire_instrument(rec, zj, [e['sha'] for e in elements], canaux, total, prov)


def mixer(charger, fichiers, rec):
    """Somme pondérée de plusieurs micros (fichiers mono ou stéréo), en stéréo."""
    total = None
    shas, noms = [], []
    for membre, poids in fichiers:
        x, sha, nom = traitement.charger(charger, {'sample': membre}, True, rec)
        x = x * poids
        if total is None:
            total = x
        else:
            n = max(len(total), len(x))
            total = np.pad(total, ((0, n - len(total)), (0, 0))) + np.pad(x, ((0, n - len(x)), (0, 0)))
        shas.append(sha)
        noms.append(nom)
    return total, shas, noms


def preparer_kit(rec):
    stereo = rec.get('stereo', True)
    canaux = 2 if stereo else 1
    elements, shas = [], []
    ouverts = {}
    for p in rec['kit']:
        src = p.get('source', rec.get('source'))
        cle = json.dumps(src, sort_keys=True)
        if cle not in ouverts:
            ouverts[cle] = sources.ouvrir(src)
        regions, charger = ouverts[cle]
        for ci, (vb, vh, vs) in enumerate(rec['couches']):
            if 'fichiers' in p:
                x, s, noms = mixer(charger, p['fichiers'][min(ci, len(p['fichiers']) - 1)], rec)
                nom_src = ' + '.join(noms)
            else:
                rs = zones.filtrer(regions, p.get('garder', ()), p.get('exclure', ()))
                choix = zones.couche(rs, vs if 'vel' not in p else p['vel'][min(ci, len(p['vel']) - 1)])
                if p['cle'] not in choix:
                    raise RuntimeError(f'{rec["id"]} : pas de région {p["cle"]} pour {p["nom"]}')
                x, sha, nom_src = traitement.charger(charger, choix[p['cle']], stereo, rec)
                s = [sha]
            precedent = elements[-1] if elements else None
            if precedent and precedent['zone']['racine'] == p['note'] and precedent['source'] == nom_src:
                precedent['vel'] = (precedent['vel'][0], vh)  # même son pour les deux couches : une seule zone
                continue
            x, longueur = traitement.preparer_brut(x, 0, rec)
            z = {'racine': p['note'], 'bas': p['note'], 'haut': p['note']}
            elements.append({'nom': f'n{p["note"]:03d}-v{ci + 1}.ogg', 'x': x, 'zone': z, 'vel': (vb, vh), 'cents': 0.0,
                             'longueur': min(longueur, p.get('duree_max', rec.get('duree_max', 1.5))),
                             'sha': s[0], 'shas': s, 'source': nom_src})
            shas += s
    budget_fichier = (rec.get('budget', BUDGET_S) - MARGE_S) / canaux
    durees = zones.repartir([e['longueur'] for e in elements], budget_fichier, 0.1)
    for e, d in zip(elements, durees):
        e['duree'] = min(float(d), len(e['x']) / audio.FREQ)
    # Gain commun : les pièces gardent leurs niveaux relatifs ; la plus forte atteint CIBLE_KIT_LUFS.
    sonies = [audio.sonie(e['x'][:int(e['duree'] * audio.FREQ)]) for e in elements]
    commun = CIBLE_KIT_LUFS + rec.get('cible_db', 0.0) - max(sonies)
    dossier = nouveau_dossier(rec)
    zj, total, prov = produire(rec, dossier, elements, canaux, None, commun=commun)
    return ecrire_instrument(rec, zj, shas, canaux, total, prov)


def catalogue():
    entrees = []
    for rec in RECETTES:
        chemin = os.path.join(PUBLIC, rec['id'], 'instrument.json')
        if not os.path.exists(chemin):
            continue
        inst = json.load(open(chemin))
        entrees.append({'id': inst['id'], 'nom': inst['nom'], 'famille': inst['famille'],
                        'taille': traitement.taille(os.path.join(PUBLIC, rec['id'])),
                        'dureeS': inst['budgetS'], 'licence': inst['licence']['nom']})
    with open(os.path.join(PUBLIC, 'catalogue.json'), 'w') as f:
        json.dump({'format': 'ocka.instruments/1', 'instruments': entrees}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    # Les ids de CETTE version, dans le code (le normaliseur doit les connaître sans réseau : declarerInstruments).
    with open(os.path.join(ICI, '..', '..', 'src', 'instruments', 'ids-banque.ts'), 'w') as f:
        f.write('// Généré par outils/instruments/preparer.py (avec catalogue.json) : les instruments de la banque de cette\n'
                '// version. Déclarés au normaliseur (declarerInstruments) au chargement d\'api-banque.ts.\n'
                'export const IDS_BANQUE: readonly string[] = [\n')
        for e in entrees:
            f.write(f"  '{e['id']}',\n")
        f.write('];\n')
    return entrees


def main(ids):
    for rec in RECETTES:
        if ids and rec['id'] not in ids:
            continue
        if rec['banque'] not in BANQUES:
            raise RuntimeError(f'banque non vérifiée : {rec["banque"]}')
        inst = preparer_kit(rec) if 'kit' in rec else preparer_melodique(rec)
        t = traitement.taille(os.path.join(PUBLIC, rec['id']))
        print(f'{rec["id"]:28s} {len(inst["zones"]):3d} zones  {inst["budgetS"]:5.1f} s  {t / 1e6:5.2f} Mo', flush=True)
    e = catalogue()
    print(f'catalogue : {len(e)} instruments, {sum(x["taille"] for x in e) / 1e6:.1f} Mo')


if __name__ == '__main__':
    main(sys.argv[1:])
