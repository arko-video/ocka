# Fabrication d'UN fichier de zone : coupe, transposition, boucle ou fondu, crête, Opus, mesures après décodage.

import os

import numpy as np

import audio

PIC_DB = -1.0
SUITE = 4096  # échantillons recopiés après la fin de boucle (le codec voit la même chose des deux côtés)


def charger(charger_source, region, stereo, rec):
    chemin, sha, nom = charger_source(region)
    x, sr = audio.lire(chemin)
    decal = int(region.get('offset', 0) or 0)
    x = x[decal:]
    x = audio.vers48k(x, sr)
    if stereo:
        x = np.repeat(x, 2, axis=1) if x.shape[1] == 1 else x[:, :2]
    else:
        x = audio.en_mono(x) if rec.get('canal') is None else x[:, min(rec['canal'], x.shape[1] - 1)]
    return x, sha, nom


def preparer_brut(x, transpo, rec):
    """Attaque, transposition hors ligne ; rend le signal et sa durée naturelle (s)."""
    a = audio.attaque(x)
    x = x[a:]
    if transpo:
        x = audio.transposer(x, transpo)
    return x, audio.duree_naturelle(x)


def mesurer_justesse(x, racine, rec):
    """Écart (cents) mesuré par YIN, ou None si la recette dit la hauteur non mesurable (cloches, extrême aigu)."""
    if not rec.get('justesse', True) or racine > rec.get('justesse_max', 127):
        return None
    c = audio.justesse_cents(x, racine, int(rec.get('mesure_debut', 0.15) * audio.FREQ), duree=rec.get('mesure_duree', 0.35),
                            partiel=rec.get('partiel'))
    if c is None:
        raise RuntimeError(f'{rec["id"]} : hauteur introuvable pour la note {racine}')
    return c


def fabriquer(x, duree, rec, essai=0):
    """Coupe à `duree` s : boucle fondue (sons tenus) ou fondu de sortie (sons qui s'éteignent)."""
    n = int(duree * audio.FREQ)
    if rec.get('tenu'):
        debut = int((rec.get('boucle_debut', 0.3) + 0.037 * essai) * audio.FREQ)
        longueur = min(n, len(x) - 3600) - debut - SUITE  # 3600 : place pour chercher la fin de boucle
        if longueur < int(0.25 * audio.FREQ):
            raise RuntimeError(f'boucle trop courte ({longueur} éch.) pour {rec["id"]}')
        y, ls, le = audio.boucler(x, debut, longueur, fondu_s=rec.get('fondu', 0.08), suite=SUITE)
        y = audio.fondu_sortie(y, 0.02)
        return y, (ls, le)
    y = x[:n].copy()
    if len(x) > n:
        audio.fondu_sortie(y, min(0.6 * duree, rec.get('fondu_fin', 0.8)))
    else:
        audio.fondu_sortie(y, 0.005)
    return y, None


def encoder(y, boucle, chemin, rec, stereo):
    """Crête à −1 dBFS, Opus, puis décodage : début, fin et boucle sont mesurés sur le son décodé."""
    pic = float(np.max(np.abs(y))) or 1.0
    g = 10 ** (PIC_DB / 20) / pic
    y = (y * g).astype(np.float32)
    audio.encoder_opus(y, chemin, 128 if stereo else 96)
    dec = audio.decoder(chemin, 2 if stereo else 1)
    dec_m = dec if stereo else dec[:, 0]
    k = audio.decalage(y, dec_m)
    k = 0 if abs(k) <= 8 else k  # ±8 : bavure du codec sur l'attaque, pas un vrai décalage (ffmpeg retire l'amorce)
    res = {'gain_crete_db': 20 * np.log10(g), 'debut': max(0, k), 'fin': len(dec), 'dec': dec_m, 'decalage': k}
    if boucle:
        ls, le = boucle[0] + k, boucle[1] + k
        le = affiner_fin(dec_m if dec_m.ndim == 1 else dec_m.mean(axis=1), ls, le)
        if not (0 < ls < le <= len(dec)):
            raise RuntimeError(f'boucle hors du fichier décodé : {ls}–{le} / {len(dec)}')
        res['boucle'] = {'debut': int(ls), 'fin': int(le)}
    return res


def affiner_fin(dec, ls, le, w=48, cherche=48):
    """Sur le son DÉCODÉ : décale la fin de boucle de quelques échantillons pour que le raccord colle au mieux."""
    ref = dec[ls - w:ls + w].astype(np.float64)
    meilleur, fin = np.inf, le
    for d in range(-cherche, cherche + 1):
        e = le + d
        if e - w < ls or e + w > len(dec):
            continue
        err = np.sum((dec[e - w:e + w] - ref) ** 2)
        if err < meilleur:
            meilleur, fin = err, e
    return fin


def fabriquer_encoder(x, duree, rec, chemin, stereo, essais=6, seuil_db=3.0):
    """Boucle : si le raccord décodé « accroche » encore (codec), on décale un peu le début et on réessaie."""
    meilleur = None
    essais = rec.get('essais_boucle', essais)
    for essai in range(essais if rec.get('tenu') else 1):
        y, boucle = fabriquer(x, duree, rec, essai)
        m = encoder(y, boucle, chemin, rec, stereo)
        c = audio.clic_db(m['dec'] if m['dec'].ndim == 1 else m['dec'].mean(axis=1),
                          m['boucle']['debut'], m['boucle']['fin']) if boucle else 0.0
        if meilleur is None or c < meilleur[0]:
            meilleur = (c, essai, y, m)
        if c <= seuil_db:
            break
    c, essai, y, m = meilleur
    if essai != (essais - 1 if rec.get('tenu') else 0) or c > seuil_db:
        y, boucle = fabriquer(x, duree, rec, essai)
        m = encoder(y, boucle, chemin, rec, stereo)
    return y, m


def zone_json(fichier, z, cents, vel, gain_db, mesure):
    zone = {
        'fichier': fichier, 'racine': int(z['racine']), 'cents': round(float(cents), 1),
        'bas': int(z['bas']), 'haut': int(z['haut']), 'velBas': int(vel[0]), 'velHaut': int(vel[1]),
        'gainDb': round(float(np.clip(gain_db, -40, 40)), 1), 'debut': int(mesure['debut']), 'fin': int(mesure['fin']),
    }
    if 'boucle' in mesure:
        zone['boucle'] = mesure['boucle']
    return zone


def taille(dossier):
    return sum(os.path.getsize(os.path.join(dossier, f)) for f in os.listdir(dossier))
