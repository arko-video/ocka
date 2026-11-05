// Fiche de sortie (HTML entièrement échappé + texte), avec le guide du distributeur choisi (pur). Propriétaire : A1.
// Tout ce qu'il faut recopier chez le distributeur. Le HTML est une page autonome : pas de script, aucune ressource
// externe (CSP « default-src 'none' »), et CHAQUE texte passe par echapper() (aucune donnée de l'utilisateur brute).

import { dureeMorceau } from '../morceau/temps';
import type { Morceau } from '../morceau/types';
import { GENRES, LANGUES, NIVEAUX_IA_TEXTE, ROLES, ROLES_EN } from '../textes/sortie';
import { conseils, guideDistributeur, LIENS } from './guide';
import { nomTitre, titreComplet } from './noms';
import { parolesMusixmatch } from './paroles';
import { typeSortie } from './regles';
import type { Reglages, Sortie } from './types';

/** Échappe un texte pour le HTML (contenu ET attributs). */
export function echapper(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

interface Ligne {
  cle: string;
  valeur: string | string[];
}
interface Bloc {
  titre: string;
  lignes: Ligne[];
}

const TYPES = { single: 'Single', ep: 'EP', album: 'Album' } as const;

function mmss(s: number): string {
  const t = Math.max(0, Math.floor(s + 1e-6)); // comme l'interface (1:08 partout)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
/** « 2026-12-16 » → « 16/12/2026 ». */
export function dateFr(iso: string): string {
  const [a, m, j] = iso.split('-');
  return a && m && j ? `${j}/${m}/${a}` : iso;
}
/** « Electronic (Électro) » ; le nom français seulement s'il apporte quelque chose. */
export function nomGenre(genre: string): string {
  if (!genre) return 'à choisir';
  const fr = GENRES[genre];
  const pareil = (s: string) => s.toLowerCase().replace(/\s/g, '');
  return fr && pareil(fr) !== pareil(genre) ? `${genre} (${fr})` : genre;
}
export function nomLangue(code: string | undefined): string {
  if (!code) return 'pas choisie';
  if (code === 'instrumental') return 'Instrumental (pas de paroles)';
  return LANGUES[code] ? `${LANGUES[code]} (${code})` : code;
}

/** Le contenu de la fiche, avant mise en forme (le même pour le HTML et le texte). */
function contenu(sortie: Sortie, morceaux: ReadonlyMap<string, Morceau>, reglages: Reglages, extension: string) {
  const presents = sortie.titres.map((id) => morceaux.get(id)).filter((m): m is Morceau => !!m);
  const durees = presents.map(dureeMorceau);
  const total = durees.reduce((s, d) => s + d, 0);
  const lien = sortie.lienProfil ?? reglages.lienProfil;
  const blocSortie: Bloc = {
    titre: 'La sortie',
    lignes: [
      { cle: 'Titre', valeur: sortie.titre },
      { cle: 'Artiste', valeur: sortie.artiste },
      { cle: 'Type', valeur: `${TYPES[typeSortie(durees)]} (${presents.length} titre${presents.length > 1 ? 's' : ''}, ${mmss(total)})` },
      { cle: 'Date de sortie', valeur: `${dateFr(sortie.dateSortie)} (${sortie.dateSortie})` },
      { cle: 'Genre', valeur: nomGenre(sortie.genre) },
      { cle: 'Label', valeur: sortie.label || sortie.artiste },
      { cle: 'Langue', valeur: nomLangue(sortie.langue) },
      { cle: 'UPC / EAN', valeur: sortie.upc ?? 'laisse vide : le distributeur en donne un' },
      { cle: 'Profil Spotify', valeur: lien ?? 'pas encore (cherche ton nom sur Spotify avant)' },
      { cle: 'Volume', valeur: sortie.niveau === 'fort' ? 'Fort (−11 LUFS)' : 'Normal (−14 LUFS, celui de Spotify)' },
      { cle: 'Pochette', valeur: 'pochette.jpg' },
    ],
  };
  const blocsTitres: Bloc[] = [];
  sortie.titres.forEach((id, i) => {
    const m = morceaux.get(id);
    if (!m) return;
    const infos = m.infos ?? {};
    const complet = titreComplet(m.titre, infos.featuring);
    const credits = (infos.credits ?? []).filter((c) => c.nom.trim()).map((c) => `${c.nom} : ${ROLES[c.role]} — ${ROLES_EN[c.role]}`);
    const ia = infos.ia;
    const lignes: Ligne[] = [
      { cle: 'Titre', valeur: complet },
      { cle: 'Durée', valeur: mmss(dureeMorceau(m)) },
      { cle: 'Fichier', valeur: nomTitre(i, complet, extension) },
      { cle: 'Explicite (gros mots)', valeur: infos.explicite === undefined ? 'pas répondu' : infos.explicite ? 'Oui (Explicit)' : 'Non (Clean)' },
      { cle: 'Langue', valeur: nomLangue(infos.langue ?? sortie.langue) },
    ];
    if (infos.featuring) lignes.push({ cle: 'Invité (featuring)', valeur: infos.featuring });
    lignes.push({ cle: 'Crédits', valeur: credits.length ? credits : 'aucun (à remplir)' });
    lignes.push({ cle: 'ISRC', valeur: infos.isrc ? `${infos.isrc} (déjà sorti : recopie-le)` : 'laisse vide : le distributeur en donne un' });
    lignes.push({
      cle: 'IA',
      valeur: ia
        ? [`Paroles : ${NIVEAUX_IA_TEXTE[ia.paroles]}`, `Musique : ${NIVEAUX_IA_TEXTE[ia.musique]}`, `Voix : ${NIVEAUX_IA_TEXTE[ia.voix]}`]
        : 'pas déclarée',
    });
    if (infos.langue !== 'instrumental' && parolesMusixmatch(m)) lignes.push({ cle: 'Paroles', valeur: `paroles/${nomTitre(i, complet, 'txt')}` });
    blocsTitres.push({ titre: `${i + 1}. ${complet}`, lignes });
  });
  const guide = guideDistributeur(sortie.distributeur, dateFr(sortie.dateSortie), extension);
  return { blocSortie, blocsTitres, guide, conseils: conseils() };
}

/** Texte → HTML échappé, où seuls les liens connus (LIENS) deviennent cliquables. */
const URLS = Object.values(LIENS)
  .map(echapper)
  .sort((a, b) => b.length - a.length); // le plus long d'abord : un lien qui en prolonge un autre reste entier
const RE_LIENS = new RegExp(URLS.map((u) => u.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|'), 'g');

function texteAvecLiens(s: string): string {
  return echapper(s).replace(RE_LIENS, (u) => `<a href="${u}" rel="noopener noreferrer">${u}</a>`);
}

function tableHtml(b: Bloc): string {
  const lignes = b.lignes
    .map((l) => {
      const v = Array.isArray(l.valeur) ? `<ul>${l.valeur.map((x) => `<li>${echapper(x)}</li>`).join('')}</ul>` : echapper(l.valeur);
      return `<tr><th scope="row">${echapper(l.cle)}</th><td>${v}</td></tr>`;
    })
    .join('\n');
  return `<table>\n${lignes}\n</table>`;
}

const STYLE = `body{margin:0;background:#f6f4fa;color:#1a1524;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}h1{font-size:28px;margin:0 0 4px}h2{margin:32px 0 8px;font-size:21px;border-bottom:2px solid #a855f7;padding-bottom:4px}
h3{margin:20px 0 6px;font-size:18px}.sous{color:#5b5470;margin:0}table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}
th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid #e6e1ef}th{width:34%;color:#5b5470;font-weight:600}
td{font-weight:600;word-break:break-word;user-select:all}ul{margin:0;padding-left:18px}ol li,ul.conseils li{margin:6px 0}a{color:#7c2fd0}
.pied{margin-top:32px;color:#5b5470;font-size:14px}@media print{body{background:#fff}h2{break-after:avoid}}`;

/** Fiche avec l'extension réelle des fichiers audio (« flac » ou « wav ») : utilisée par le dossier. */
export function ficheAvecFormat(sortie: Sortie, morceaux: ReadonlyMap<string, Morceau>, reglages: Reglages, extension: string): { html: string; txt: string } {
  const c = contenu(sortie, morceaux, reglages, extension);
  const entete = `Fiche de sortie — ${sortie.titre || 'Sans titre'}`;
  const sous = `Tout ce qu’il faut recopier chez ${c.guide.nom}. Format des fichiers : ${c.guide.format}.`;

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(entete)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>${echapper(entete)}</h1>
<p class="sous">${echapper(sous)}</p>
<h2>${echapper(c.blocSortie.titre)}</h2>
${tableHtml(c.blocSortie)}
<h2>Les titres</h2>
${c.blocsTitres.map((b) => `<h3>${echapper(b.titre)}</h3>\n${tableHtml(b)}`).join('\n')}
<h2>${echapper(`Pas à pas : ${c.guide.nom}`)}</h2>
<ol>
${c.guide.etapes.map((e) => `<li>${texteAvecLiens(e)}</li>`).join('\n')}
</ol>
<h2>Conseils</h2>
<ul class="conseils">
${c.conseils.map((e) => `<li>${texteAvecLiens(e)}</li>`).join('\n')}
</ul>
<p class="pied">Préparée avec OCKA, studio de musique gratuit et open source.</p>
</main>
</body>
</html>
`;

  const txt: string[] = [entete.toUpperCase(), '='.repeat(Math.min(60, entete.length)), sous, ''];
  const blocTxt = (b: Bloc, retrait: string) => {
    for (const l of b.lignes) {
      if (Array.isArray(l.valeur)) {
        txt.push(`${retrait}${l.cle} :`);
        for (const v of l.valeur) txt.push(`${retrait}  - ${v}`);
      } else txt.push(`${retrait}${l.cle} : ${l.valeur}`);
    }
  };
  txt.push('LA SORTIE', '---------');
  blocTxt(c.blocSortie, '');
  txt.push('', 'LES TITRES', '----------');
  for (const b of c.blocsTitres) {
    txt.push(b.titre);
    blocTxt(b, '   ');
    txt.push('');
  }
  const pas = `PAS À PAS : ${c.guide.nom.toUpperCase()}`;
  txt.push(pas, '-'.repeat(pas.length));
  c.guide.etapes.forEach((e, i) => txt.push(`${i + 1}. ${e}`));
  txt.push('', 'CONSEILS', '--------');
  for (const e of c.conseils) txt.push(`- ${e}`);
  txt.push('', 'Préparée avec OCKA, studio de musique gratuit et open source.', '');
  return { html, txt: txt.join('\n') };
}

/** Fiche de sortie : FLAC conseillé, sauf DistroKid (WAV). */
export function ficheSortie(sortie: Sortie, morceaux: ReadonlyMap<string, Morceau>, reglages: Reglages): { html: string; txt: string } {
  return ficheAvecFormat(sortie, morceaux, reglages, sortie.distributeur === 'distrokid' ? 'wav' : 'flac');
}
