# Outils audio de la banque : lecture, 48 kHz, attaque, justesse (YIN), sonie, boucles, Opus.
import fractions
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy import signal

FREQ = 48000
AMORCE = 312  # pré-saut (pre-skip) de libopus à 48 kHz


def lire(chemin):
    x, sr = sf.read(chemin, dtype='float32', always_2d=True)
    return x, sr


def reechantillonner(x, sr_depart, sr_arrivee):
    if sr_depart == sr_arrivee:
        return x.astype(np.float32)
    f = fractions.Fraction(sr_arrivee, sr_depart).limit_denominator(2000)
    return signal.resample_poly(x, f.numerator, f.denominator, axis=0).astype(np.float32)


def vers48k(x, sr):
    return reechantillonner(x, sr, FREQ)


def transposer(x, demi_tons):
    """Change la hauteur en rejouant plus vite ou plus lentement (hors ligne, avant l'encodage)."""
    if demi_tons == 0:
        return x
    f = fractions.Fraction(2 ** (-demi_tons / 12)).limit_denominator(1000)
    return signal.resample_poly(x, f.numerator, f.denominator, axis=0).astype(np.float32)


def en_mono(x):
    """Spaced pair : la somme L+R creuse le son (filtre en peigne). Si les canaux se ressemblent peu, on garde le plus fort."""
    if x.shape[1] == 1:
        return x[:, 0]
    l, r = x[:, 0], x[:, 1]
    n = min(len(l), FREQ)
    c = np.dot(l[:n], r[:n]) / (np.linalg.norm(l[:n]) * np.linalg.norm(r[:n]) + 1e-12)
    if c > 0.7:
        return 0.5 * (l + r)
    return l if np.sum(l[:n] ** 2) >= np.sum(r[:n] ** 2) else r


def enveloppe_db(x, pas=256):
    m = x if x.ndim == 1 else np.max(np.abs(x), axis=1)
    m = np.abs(m)
    n = len(m) // pas
    if n == 0:
        return np.array([-120.0])
    e = m[:n * pas].reshape(n, pas).max(axis=1)
    return 20 * np.log10(e + 1e-9)


def attaque(x, seuil_db=-40, pas=64):
    """Premier échantillon qui dépasse (crête − 40 dB), moins 1 ms."""
    e = enveloppe_db(x, pas)
    i = int(np.argmax(e > e.max() + seuil_db))
    return max(0, i * pas - FREQ // 1000)


def duree_naturelle(x, seuil_db=-50, pas=256):
    """Durée (s) jusqu'au moment où le son reste sous (crête − 50 dB)."""
    e = enveloppe_db(x, pas)
    au_dessus = np.nonzero(e > e.max() + seuil_db)[0]
    return (au_dessus[-1] + 1) * pas / FREQ if len(au_dessus) else 0.0


def _ponderation_k(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def sonie(x, fenetre_s=0.4):
    """Sonie « momentanée » maximale (LUFS approchés, BS.1770) sur la première seconde."""
    y = _ponderation_k(x[:FREQ + int(fenetre_s * FREQ)].astype(np.float64))
    if y.ndim == 1:
        y = y[:, None]
    n, pas = int(fenetre_s * FREQ), FREQ // 20
    meilleure = -120.0
    for d in range(0, max(1, len(y) - n + 1), pas):
        p = np.mean(np.sum(y[d:d + n] ** 2, axis=1))
        meilleure = max(meilleure, -0.691 + 10 * np.log10(p + 1e-12))
    return meilleure


def yin(x, f_attendue, debut=None, duree=0.3):
    """Fréquence fondamentale (Hz) par YIN, cherchée entre f/1.4 et f×1.4, médiane sur plusieurs trames.
    Au-dessus de 700 Hz, le signal est suréchantillonné ×4 (période de quelques échantillons seulement)."""
    x = x if x.ndim == 1 else x.mean(axis=1)
    debut = int(0.12 * FREQ) if debut is None else debut
    sr = FREQ
    if f_attendue > 700:
        morceau = x[debut:debut + int((duree + 0.1) * FREQ)]
        x, sr, debut = signal.resample_poly(morceau, 4, 1), FREQ * 4, 0
    t_min, t_max = int(sr / (f_attendue * 1.4)), int(sr / (f_attendue / 1.4)) + 2
    w = max(2 * t_max, 1024)
    fin = min(len(x) - w - t_max - 1, debut + int(duree * sr))
    res = []
    for d in range(debut, max(debut + 1, fin), max(256, w // 4)):
        if d + w + t_max >= len(x):
            break
        a = x[d:d + w].astype(np.float64)
        diff = np.array([np.sum((a - x[d + t:d + t + w]) ** 2) for t in range(0, t_max + 1)])
        cumul = np.cumsum(diff[1:])
        cmnd = np.ones_like(diff)
        cmnd[1:] = diff[1:] * np.arange(1, t_max + 1) / (cumul + 1e-12)
        t = int(np.argmin(cmnd[t_min:t_max])) + t_min
        if cmnd[t] > 0.35 or t <= t_min or t >= t_max - 1:
            continue
        a_, b_, c_ = cmnd[t - 1], cmnd[t], cmnd[t + 1]
        dec = 0.5 * (a_ - c_) / (a_ - 2 * b_ + c_) if (a_ - 2 * b_ + c_) != 0 else 0.0
        res.append(sr / (t + dec))
    return float(np.median(res)) if res else None


def justesse_cents(x, racine, debut, duree=0.35, partiel=None):
    """Écart (cents) entre le son et sa note racine, par YIN. Sous 65 Hz, la fondamentale est faible (pianos, basses) :
    on isole le partiel k (k·f0 ≥ 130 Hz) par un passe-bande et on mesure sa période avec YIN, puis on divise par k.
    `partiel` force ce passe-bande (orgue à tirettes : le jeu de quinte 5 1/3' rend le son périodique à f0/2)."""
    x = x if x.ndim == 1 else x.mean(axis=1)
    f0 = 440.0 * 2 ** ((racine - 69) / 12)
    k = partiel or 1
    if f0 < 65 or partiel:
        k = partiel or int(np.ceil(130 / f0))
        sos = signal.butter(4, [k * f0 / 1.12, k * f0 * 1.12], btype='bandpass', fs=FREQ, output='sos')
        x = signal.sosfiltfilt(sos, x[:debut + int((duree + 0.3) * FREQ)])
    f = yin(x, k * f0, debut=debut, duree=duree)
    return None if f is None else float(cents_entre(f / k, racine))


def cents_entre(f, midi):
    return 1200 * np.log2(f / (440.0 * 2 ** ((midi - 69) / 12)))


def boucler(x, debut, longueur, fondu_s=0.08, suite=4096):
    """
    Boucle préparée AVANT l'encodage : fin de boucle calée sur la forme d'onde du début (corrélation),
    fondu enchaîné qui amène la fin vers ce qui précède le début, puis on recopie le début de la boucle après la fin
    (le codec voit ainsi la même chose des deux côtés du raccord). Rend (signal, debut, fin).
    """
    mono = x if x.ndim == 1 else x.mean(axis=1)
    f = int(fondu_s * FREQ)
    debut = max(debut, f + 1)
    fin_visee = min(debut + longueur, len(x) - suite - 1)
    w, cherche = 1024, 2400
    ref = mono[debut - w // 2:debut + w // 2]
    meilleur, fin = -2.0, fin_visee
    for e in range(max(debut + f * 2, fin_visee - cherche), min(fin_visee + cherche, len(x) - suite - w)):
        seg = mono[e - w // 2:e + w // 2]
        c = np.dot(ref, seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-12)
        if c > meilleur:
            meilleur, fin = c, e
    y = x[:fin].copy()
    rampe = np.linspace(0.0, 1.0, f, dtype=np.float32)
    if y.ndim == 2:
        rampe = rampe[:, None]
    y[fin - f:fin] = y[fin - f:fin] * (1 - rampe) + x[debut - f:debut] * rampe
    y = np.concatenate([y, x[debut:debut + suite]])
    return y, debut, fin


def fondu_sortie(x, duree_s):
    n = min(len(x), int(duree_s * FREQ))
    if n > 0:
        r = (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, n))).astype(np.float32)
        x[-n:] *= r if x.ndim == 1 else r[:, None]
    return x


def encoder_opus(y, chemin, debit_k):
    """Ogg Opus 48 kHz, sans métadonnées variables (reproductible)."""
    canaux = 1 if y.ndim == 1 else y.shape[1]
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'a.wav')
        sf.write(wav, y, FREQ, subtype='FLOAT')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libopus', '-b:a', f'{debit_k}k',
                        '-vbr', 'on', '-application', 'audio', '-ac', str(canaux), '-map_metadata', '-1',
                        '-fflags', '+bitexact', '-flags:a', '+bitexact', chemin], check=True)


def decoder(chemin, canaux=None):
    """Décode un .ogg comme le ferait le navigateur (pré-saut retiré) ; rend un tableau (n, canaux)."""
    sortie = subprocess.run(['ffmpeg', '-v', 'error', '-i', chemin, '-f', 'f32le', '-ar', str(FREQ)] +
                            (['-ac', str(canaux)] if canaux else []) + ['-'], check=True, capture_output=True).stdout
    a = np.frombuffer(sortie, dtype=np.float32)
    c = canaux or int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries',
                                      'stream=channels', '-of', 'csv=p=0', chemin], capture_output=True,
                                     text=True).stdout.strip() or 1)
    return a.reshape(-1, c)


def decalage(original, decode, max_dec=AMORCE * 2):
    """Décalage (échantillons) du son décodé par rapport à l'original (0 attendu : ffmpeg retire l'amorce)."""
    # Moindres carrés sur les 50 premières ms, ATTAQUE COMPRISE (le son décodé est prolongé de silence à gauche) :
    # un son périodique ne peut pas tromper la mesure. Opus garde mal la forme d'onde des aigus : on compare
    # sous 1,5 kHz.
    sos = signal.butter(4, 1500, fs=FREQ, output='sos')
    o = signal.sosfilt(sos, original if original.ndim == 1 else original.mean(axis=1))
    d = signal.sosfilt(sos, decode if decode.ndim == 1 else decode.mean(axis=1))
    n = min(2400, len(o), len(d))
    d = np.concatenate([np.zeros(max_dec), d, np.zeros(max_dec)])
    ref = o[:n].astype(np.float64)
    meilleur, dec = np.inf, 0
    for k in range(-max_dec, max_dec + 1):
        e = np.sum((d[max_dec + k:max_dec + k + n] - ref) ** 2)
        if e < meilleur - 1e-12:
            meilleur, dec = e, k
    return dec


def clic_db(y, debut, fin, n=512):
    """Écart (dB) entre la « rugosité » au raccord de boucle et celle du signal continu au même endroit."""
    m = y if y.ndim == 1 else y.mean(axis=1)

    def rugosite(seg):
        d2 = np.diff(seg, 2)
        centre = len(seg) // 2
        pic = np.max(np.abs(d2[centre - 24:centre + 24]))
        fond = np.sqrt(np.mean(d2 ** 2)) + 1e-9
        return 20 * np.log10(pic / fond + 1e-9)

    raccord = np.concatenate([m[fin - n:fin], m[debut:debut + n]])
    naturel = m[debut - n:debut + n]
    return float(rugosite(raccord) - rugosite(naturel))
