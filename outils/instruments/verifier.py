# Vérifie la banque APRÈS décodage : python3 -I outils/instruments/verifier.py
# - chaque zone jouée à sa racine est juste à ±5 cents (YIN), une fois retiré son accord `cents` (le fichier joue
#   racine + cents ; l'échantillonneur joue avec detune = 100 × (midi − racine) − cents) ;
# - aucun clic au raccord des boucles (rugosité au raccord ≤ celle du son continu + 6 dB) ;
# - longueur décodée = `fin`, budget de 60 s mono respecté.
# Le bilan est écrit dans outils/instruments/bilan.json.

import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

import audio  # noqa: E402
from recettes import RECETTES  # noqa: E402

PUBLIC = os.path.normpath(os.path.join(ICI, '..', '..', 'public', 'instruments'))
TOLERANCE_CENTS = 5.0
TOLERANCE_CLIC_DB = 6.0
POURQUOI_PAS_DE_JUSTESSE = {
    'Batteries': 'batterie : pas de hauteur',
    'Percussions': 'percussions : pas de hauteur',
}


def verifier_instrument(rec):
    dossier = os.path.join(PUBLIC, rec['id'])
    inst = json.load(open(os.path.join(dossier, 'instrument.json')))
    canaux = inst['canaux']
    res = {'id': inst['id'], 'zones': [], 'erreurs': []}
    sans_hauteur = POURQUOI_PAS_DE_JUSTESSE.get(inst['famille']) or (
        None if rec.get('justesse', True) else rec.get('pourquoi', 'hauteur non mesurable (son inharmonique)'))
    total = 0.0
    for z in inst['zones']:
        dec = audio.decoder(os.path.join(dossier, z['fichier']), canaux)
        mono = dec.mean(axis=1)
        total += len(dec) / audio.FREQ * canaux
        r = {'fichier': z['fichier'], 'racine': z['racine']}
        if len(dec) != z['fin']:
            res['erreurs'].append(f'{z["fichier"]} : {len(dec)} échantillons décodés, fin = {z["fin"]}')
        if sans_hauteur or z['racine'] > rec.get('justesse_max', 127):
            r['justesse'] = None
            r['pourquoi'] = sans_hauteur or 'extrême aigu : période de quelques échantillons, YIN muet'
        else:
            debut = z['debut'] + int(rec.get('mesure_debut', 0.15) * audio.FREQ)
            c = audio.justesse_cents(mono, z['racine'], debut, duree=rec.get('mesure_duree', 0.35), partiel=rec.get('partiel'))
            if c is None:
                res['erreurs'].append(f'{z["fichier"]} : hauteur introuvable')
                r['justesse'] = None
            else:
                ecart = c - z['cents']
                r['justesse'] = round(ecart, 2)
                if abs(ecart) > TOLERANCE_CENTS:
                    res['erreurs'].append(f'{z["fichier"]} : {ecart:+.1f} cents')
        if 'boucle' in z:
            c = audio.clic_db(mono, z['boucle']['debut'], z['boucle']['fin'])
            r['clicDb'] = round(c, 2)
            if c > TOLERANCE_CLIC_DB:
                res['erreurs'].append(f'{z["fichier"]} : clic au bouclage ({c:+.1f} dB)')
        res['zones'].append(r)
    res['dureeDecodeeS'] = round(total, 3)
    if total > 60.0 + 1e-6:
        res['erreurs'].append(f'budget dépassé : {total:.2f} s')
    if abs(total - inst['budgetS']) > 0.01:
        res['erreurs'].append(f'budgetS annoncé {inst["budgetS"]} ≠ mesuré {total:.3f}')
    justes = [abs(z['justesse']) for z in res['zones'] if z.get('justesse') is not None]
    clics = [z['clicDb'] for z in res['zones'] if 'clicDb' in z]
    res['resume'] = {
        'zones': len(res['zones']),
        'justesseMesuree': len(justes),
        'pireEcartCents': round(max(justes), 2) if justes else None,
        'sansHauteur': sans_hauteur,
        'boucles': len(clics),
        'pireClicDb': round(max(clics), 2) if clics else None,
    }
    return res


def main(ids):
    bilan = {'toleranceCents': TOLERANCE_CENTS, 'toleranceClicDb': TOLERANCE_CLIC_DB, 'instruments': []}
    erreurs = 0
    for rec in RECETTES:
        if ids and rec['id'] not in ids:
            continue
        if not os.path.exists(os.path.join(PUBLIC, rec['id'], 'instrument.json')):
            continue
        r = verifier_instrument(rec)
        bilan['instruments'].append(r)
        erreurs += len(r['erreurs'])
        s = r['resume']
        print(f'{r["id"]:28s} {s["zones"]:3d} zones  pire écart {s["pireEcartCents"]} c  '
              f'boucles {s["boucles"]} (pire {s["pireClicDb"]} dB)  {len(r["erreurs"])} erreur(s)', flush=True)
        for e in r['erreurs']:
            print('    ✗', e)
    bilan['erreurs'] = erreurs
    if not ids:
        with open(os.path.join(ICI, 'bilan.json'), 'w') as f:
            json.dump(bilan, f, ensure_ascii=False, indent=1)
            f.write('\n')
    print('OK' if erreurs == 0 else f'{erreurs} erreur(s)')
    return erreurs


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:]) else 0)
