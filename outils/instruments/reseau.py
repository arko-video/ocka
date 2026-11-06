# Téléchargement des sources (données NON FIABLES) pour la banque d'instruments d'OCKA.
# - chaque fichier est rangé sous telechargements/<banque>/…, dans un dossier qui n'appartient qu'à lui ;
# - on garde le SHA-256 de chaque fichier source dans sources-verrou.json (reproductible : un SHA qui change = arrêt) ;
# - les archives ZIP distantes sont lues par morceaux (requêtes HTTP Range) : on ne prend que les fichiers utiles ;
# - rien de ce qui est téléchargé n'est exécuté : on ne fait que lire des octets.

import hashlib
import io
import json
import os
import re
import tarfile
import time
import urllib.parse
import urllib.request
import zipfile

ICI = os.path.dirname(os.path.abspath(__file__))
VERROU = os.path.join(ICI, 'sources-verrou.json')
RACINE_TELECHARGEMENTS = os.environ.get(
    'OCKA_TELECHARGEMENTS',
    '/tmp/claude-0/-home-claude/327ea8c0-317a-5474-83a2-dbe668eff1bf/scratchpad/bq/telechargements',
)
HOTES_PERMIS = {
    'raw.githubusercontent.com', 'github.com', 'freepats.zenvoid.org', 'karoryfer.com', 'versilian-studios.com',
}

_verrou = None


def _lire_verrou():
    global _verrou
    if _verrou is None:
        _verrou = json.load(open(VERROU)) if os.path.exists(VERROU) else {}
    return _verrou


def _ecrire_verrou():
    with open(VERROU, 'w') as f:
        json.dump(_lire_verrou(), f, indent=1, sort_keys=True, ensure_ascii=False)
        f.write('\n')


def sha256_octets(octets):
    return hashlib.sha256(octets).hexdigest()


def sha256_fichier(chemin):
    h = hashlib.sha256()
    with open(chemin, 'rb') as f:
        for bloc in iter(lambda: f.read(1 << 20), b''):
            h.update(bloc)
    return h.hexdigest()


def nom_sur(nom):
    """Un nom de fichier local sans danger (aucun / ni ..)."""
    nom = re.sub(r'[^A-Za-z0-9._#+, ()-]', '_', nom)
    return nom.lstrip('.') or 'fichier'


def chemin_relatif_sur(chemin):
    """Refuse les chemins absolus, les « .. » et les noms vides (archives piégées)."""
    morceaux = [m for m in chemin.replace('\\', '/').split('/') if m not in ('', '.')]
    if not morceaux or chemin.startswith('/') or any(m == '..' for m in morceaux):
        raise ValueError(f'chemin refusé dans une archive : {chemin!r}')
    return '/'.join(nom_sur(m) for m in morceaux)


def _verifier_hote(url):
    hote = urllib.parse.urlsplit(url).hostname or ''
    if urllib.parse.urlsplit(url).scheme != 'https' or hote not in HOTES_PERMIS:
        raise ValueError(f'hôte non permis : {url}')


def _ouvrir(url, plage=None, essais=4):
    _verifier_hote(url)
    entetes = {'User-Agent': 'ocka-banque/1.0'}
    if plage:
        entetes['Range'] = f'bytes={plage[0]}-{plage[1]}'
    for i in range(essais):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=entetes), timeout=120).read()
        except Exception as e:  # réseau instable : on réessaie un peu
            if i == essais - 1 or getattr(e, 'code', 0) == 404:
                raise
            time.sleep(2 + 3 * i)


def noter_sha(cle, sha):
    """Note le SHA-256 d'une source ; s'il a changé depuis la dernière fois, on s'arrête."""
    v = _lire_verrou()
    if cle in v and v[cle] != sha:
        raise RuntimeError(f'SHA-256 changé pour {cle} : {v[cle]} → {sha}')
    if cle not in v:
        v[cle] = sha
        _ecrire_verrou()
    return sha


def telecharger(url, banque, nom_local=None):
    """Télécharge un fichier (une fois) sous telechargements/<banque>/ ; rend (chemin, sha256)."""
    nom_local = chemin_relatif_sur(nom_local or urllib.parse.unquote(urllib.parse.urlsplit(url).path).lstrip('/'))
    chemin = os.path.join(RACINE_TELECHARGEMENTS, nom_sur(banque), nom_local)
    if not os.path.exists(chemin):
        os.makedirs(os.path.dirname(chemin), exist_ok=True)
        octets = _ouvrir(url)
        with open(chemin + '.part', 'wb') as f:
            f.write(octets)
        os.replace(chemin + '.part', chemin)
    return chemin, noter_sha(url, sha256_fichier(chemin))


class FichierHttp(io.RawIOBase):
    """Un fichier distant lu par requêtes Range (pour zipfile), avec un petit cache de blocs."""

    BLOC = 1 << 20

    def __init__(self, url):
        self.url, self.pos, self.blocs = url, 0, {}
        _verifier_hote(url)
        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'ocka-banque/1.0'})
        self.taille = int(urllib.request.urlopen(req, timeout=60).headers['Content-Length'])

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, decalage, depuis=0):
        self.pos = [decalage, self.pos + decalage, self.taille + decalage][depuis]
        return self.pos

    def _bloc(self, n):
        if n not in self.blocs:
            debut = n * self.BLOC
            self.blocs[n] = _ouvrir(self.url, (debut, min(self.taille, debut + self.BLOC) - 1))
            if len(self.blocs) > 64:
                self.blocs.pop(next(iter(self.blocs)))
        return self.blocs[n]

    def read(self, n=-1):
        if n < 0:
            n = self.taille - self.pos
        n = max(0, min(n, self.taille - self.pos))
        morceaux = []
        while n > 0:
            b = self._bloc(self.pos // self.BLOC)
            d = self.pos % self.BLOC
            m = b[d:d + n]
            morceaux.append(m)
            self.pos += len(m)
            n -= len(m)
        return b''.join(morceaux)

    def readinto(self, tampon):
        octets = self.read(len(tampon))
        tampon[:len(octets)] = octets
        return len(octets)


_zips = {}


def zip_distant(url):
    if url not in _zips:
        _zips[url] = zipfile.ZipFile(FichierHttp(url))
    return _zips[url]


def membre_zip_distant(url, membre, banque):
    """Extrait UN fichier d'un ZIP distant ; rend (chemin local, sha256 du fichier extrait)."""
    archive = nom_sur(os.path.basename(urllib.parse.urlsplit(url).path))
    chemin = os.path.join(RACINE_TELECHARGEMENTS, nom_sur(banque), archive, chemin_relatif_sur(membre))
    if not os.path.exists(chemin):
        os.makedirs(os.path.dirname(chemin), exist_ok=True)
        info = zip_distant(url).getinfo(membre)
        if info.file_size > 400 << 20:
            raise ValueError(f'fichier trop gros dans {url} : {membre}')
        with open(chemin + '.part', 'wb') as f:
            f.write(zip_distant(url).read(info))
        os.replace(chemin + '.part', chemin)
    return chemin, noter_sha(f'{url}#{membre}', sha256_fichier(chemin))


def _extraire_7z(chemin_archive, dest):
    """7z lu par libarchive (py7zr ne connaît pas Deflate + Delta) ; chaque nom est vérifié avant l'écriture."""
    import libarchive
    with libarchive.file_reader(chemin_archive) as a:
        for e in a:
            rel = chemin_relatif_sur(e.pathname)
            if e.isdir:
                continue
            if not e.isfile:
                raise ValueError(f'entrée refusée (lien ou spécial) : {e.pathname}')
            cible = os.path.join(dest, rel)
            os.makedirs(os.path.dirname(cible), exist_ok=True)
            with open(cible, 'wb') as f:
                for bloc in e.get_blocks():
                    f.write(bloc)


def extraire_archive(chemin_archive, banque):
    """Décompresse une archive .7z / .tar.* téléchargée dans son propre dossier ; rend ce dossier."""
    dest = os.path.join(RACINE_TELECHARGEMENTS, nom_sur(banque), 'extrait-' + nom_sur(os.path.basename(chemin_archive)))
    if os.path.isdir(dest):
        return dest
    import shutil
    shutil.rmtree(dest + '.part', ignore_errors=True)
    os.makedirs(dest + '.part', exist_ok=True)
    if chemin_archive.endswith('.7z'):
        _extraire_7z(chemin_archive, dest + '.part')
    else:
        with tarfile.open(chemin_archive) as a:
            for m in a.getmembers():
                chemin_relatif_sur(m.name)
            a.extractall(dest + '.part', filter='data')
    for racine, _, fichiers in os.walk(dest + '.part'):
        for f in fichiers:
            if os.path.islink(os.path.join(racine, f)):
                raise ValueError(f'lien symbolique refusé : {f}')
    os.replace(dest + '.part', dest)
    return dest
