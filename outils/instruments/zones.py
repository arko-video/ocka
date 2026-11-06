# Choix des zones d'un instrument mélodique : racines espacées d'au plus 3 demi-tons, budget de secondes.

import re

import numpy as np


def filtrer(regions, garder=(), exclure=()):
    res = []
    for r in regions:
        s = r['sample']
        if r.get('trigger', 'attack') not in ('attack', 'first'):
            continue  # sons de relâchement, etc.
        if all(re.search(g, s) for g in garder) and not any(re.search(e, s) for e in exclure):
            res.append(r)
    return res


def couche(regions, vel):
    """Régions jouées à cette vélocité, une par note racine (premier round robin)."""
    par_note = {}
    for r in sorted(regions, key=lambda r: (int(r.get('seq_position', 1)), float(r.get('lorand', 0) or 0), r['sample'])):
        if r['lovel'] <= vel <= r['hivel'] and r.get('pitch_keycenter') is not None:
            k = r['pitch_keycenter'] - int(r.get('transpose', 0) or 0)
            par_note.setdefault(k, r)
    return par_note


def choisir_racines(natives, bas, haut, transpo_max=2.5, ecart=3):
    """
    Programmation dynamique : le moins de zones possible (puis le moins de transposition hors ligne),
    racines espacées d'au plus `ecart`, la première ≤ bas+1, la dernière ≥ haut−1.
    Une racine absente des échantillons est fabriquée en transposant la note native la plus proche.
    """
    nat = sorted(natives)
    candidats = {}
    for n in range(bas - 1, haut + 2):
        d = min(nat, key=lambda k: (abs(k - n), k))
        if abs(n - d) <= transpo_max:
            candidats[n] = (d, n - d)
    notes = sorted(candidats)
    cout = {}
    prec = {}
    for n in notes:
        c0 = 1 + 0.15 * abs(candidats[n][1])
        if n <= bas + 1:
            cout[n], prec[n] = c0, None
        for m in notes:
            if m < n and n - m <= ecart and m in cout and cout[m] + c0 < cout.get(n, 1e9):
                cout[n], prec[n] = cout[m] + c0, m
    fins = [n for n in cout if n >= haut - 1]
    if not fins:
        raise RuntimeError(f'plage {bas}–{haut} impossible avec les notes {nat}')
    n = min(fins, key=lambda k: cout[k])
    chemin = []
    while n is not None:
        chemin.append(n)
        n = prec[n]
    chemin.reverse()
    zones = []
    for i, r in enumerate(chemin):
        z_bas = bas if i == 0 else zones[-1]['haut'] + 1
        z_haut = haut if i == len(chemin) - 1 else r + (chemin[i + 1] - r - 1) // 2
        zones.append({'racine': r, 'bas': z_bas, 'haut': z_haut, 'native': candidats[r][0], 'transpo': candidats[r][1]})
    for z in zones:
        if z['racine'] - z['bas'] > 1.5 or z['haut'] - z['racine'] > 1.5:
            if not (z['bas'] == bas or z['haut'] == haut):
                raise RuntimeError(f'zone trop large : {z}')
    return zones


def repartir(longueurs, budget, minimum=0.2):
    """Partage `budget` secondes : chaque son garde sa longueur naturelle, plafonnée au même niveau c."""
    longueurs = np.asarray(longueurs, dtype=float)
    if longueurs.sum() <= budget:
        return np.maximum(longueurs, minimum)
    bas_, haut_ = 0.0, float(longueurs.max())
    for _ in range(60):
        c = (bas_ + haut_) / 2
        if np.minimum(longueurs, c).sum() > budget:
            haut_ = c
        else:
            bas_ = c
    return np.maximum(np.minimum(longueurs, bas_), minimum)
