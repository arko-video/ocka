// Règles de Spotify et des distributeurs (pures, testées dans Vitest). Propriétaire : A1.
// typeSortie : single / EP / album. verifierSortie : la liste « Prêt pour Spotify ? » (vide = prêt), bloquants d'abord.
// Chaque problème dit où le corriger (écran de l'assistant, titre concerné, champ à mettre en avant).

import { arrangement, dureeMorceau } from '../morceau/temps';
import type { Morceau } from '../morceau/types';
import { titreComplet } from './noms';
import { parolesMusixmatch } from './paroles';
import { comparable, estVraiNom, problemesTitre } from './regles-titre';
import type { ProblemeSortie, Sortie, TypeSortie } from './types';

/** Une écoute compte sur Spotify à partir de 30 s : en dessous, le titre est refusé. */
export const DUREE_MIN_TITRE = 30;
/** Single et EP : moins de 30 minutes au total. */
export const DUREE_MAX_COURT = 30 * 60;
/** Pochette : en dessous, refusée ; idéal 3000 × 3000. */
export const COTE_MIN = 1425;
export const COTE_IDEAL = 3000;
/** En dessous de 4 semaines, la vérification du distributeur (~3 semaines) risque de faire rater la date. */
export const JOURS_CONSEILLES = 28;
/** DistroKid refuse les sorties dont les titres font en moyenne moins de 60 s. */
export const MOYENNE_MIN_DISTROKID = 60;

const JOUR = 86_400_000;

/** Règle de Spotify : single = 1 à 3 titres et < 30 min ; EP = 4 à 6 titres et < 30 min ; sinon album. */
export function typeSortie(durees: readonly number[]): TypeSortie {
  const n = durees.length;
  const total = durees.reduce((s, d) => s + (Number.isFinite(d) ? Math.max(0, d) : 0), 0);
  if (n === 0) return 'single';
  if (total < DUREE_MAX_COURT && n <= 3) return 'single';
  if (total < DUREE_MAX_COURT && n <= 6) return 'ep';
  return 'album';
}

/** « 1:05 ». */
function mmss(s: number): string {
  const t = Math.max(0, Math.floor(s + 1e-6)); // comme l'interface (1:08 partout)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Morceau sans aucun son : aucune section jouée, ou ni motif, ni boucle, ni voix gardée. */
export function estVide(m: Morceau): boolean {
  const occ = arrangement(m);
  if (!occ.length) return true;
  const instruments = occ.some((o) => Object.values(o.section.motifs).some(Boolean) || !!o.section.boucle);
  return !instruments && !m.prises.some((p) => p.choisie);
}

/** Jours entre aujourd'hui (date locale) et « AAAA-MM-JJ ». */
function joursAvant(date: string, maintenant: number): number {
  const auj = new Date(maintenant);
  const debut = Date.UTC(auj.getFullYear(), auj.getMonth(), auj.getDate());
  const [a, m, j] = date.split('-').map(Number);
  return Math.round((Date.UTC(a!, m! - 1, j!) - debut) / JOUR);
}

export function verifierSortie(sortie: Sortie, morceaux: ReadonlyMap<string, Morceau>, cotePochette?: number | null): ProblemeSortie[] {
  const liste: ProblemeSortie[] = [];
  const ajouter = (code: string, niveau: ProblemeSortie['niveau'], message: string, corriger: ProblemeSortie['corriger']) =>
    liste.push({ code, niveau, message, corriger });
  const infosSortie = (champ: string) => ({ ecran: 'infos' as const, champ });

  // ---- la sortie
  if (!sortie.titre.trim()) ajouter('sortie_titre_vide', 'bloquant', 'Donne un nom à ta sortie.', infosSortie('titre'));
  for (const p of problemesTitre(sortie.titre, sortie.artiste, false)) ajouter(p.code, p.niveau, p.message, infosSortie('titre'));
  if (!sortie.artiste.trim()) ajouter('artiste_vide', 'bloquant', 'Écris ton nom d’artiste.', infosSortie('artiste'));
  if (!sortie.titres.length) ajouter('sortie_vide', 'bloquant', 'Ajoute au moins un morceau à ta sortie.', infosSortie('titres'));

  if (!sortie.pochette) {
    ajouter('pochette_absente', 'bloquant', 'Il faut une pochette : importe une image ou fabrique-la.', { ecran: 'pochette' });
  } else if (typeof cotePochette === 'number' && cotePochette < COTE_MIN) {
    ajouter('pochette_trop_petite', 'bloquant', `La pochette fait ${cotePochette} px de côté : il faut au moins ${COTE_MIN} px.`, { ecran: 'pochette' });
  } else if (typeof cotePochette === 'number' && cotePochette < COTE_IDEAL) {
    ajouter('pochette_petite', 'conseil', `La pochette fait ${cotePochette} px de côté : elle passe, mais 3000 × 3000 est l’idéal.`, { ecran: 'pochette' });
  }

  // ---- chaque titre
  const vus = new Set<string>();
  const durees: number[] = [];
  sortie.titres.forEach((id, i) => {
    const m = morceaux.get(id);
    const ici = (champ?: string) => ({ ecran: 'infos' as const, titre: id, ...(champ ? { champ } : {}) });
    if (!m) {
      ajouter('titre_introuvable', 'bloquant', `Le titre n° ${i + 1} n’existe plus : retire-le de la sortie.`, ici());
      return;
    }
    const nom = m.titre.trim() || `Titre ${i + 1}`;
    const infos = m.infos ?? {};
    const duree = dureeMorceau(m);
    durees.push(duree);

    if (!m.titre.trim()) ajouter('titre_vide', 'bloquant', `Donne un titre au morceau n° ${i + 1}.`, ici('titre'));
    for (const p of problemesTitre(m.titre, sortie.artiste, true)) ajouter(p.code, p.niveau, p.message, ici('titre'));
    const cle = comparable(titreComplet(m.titre, infos.featuring));
    if (cle && vus.has(cle)) {
      ajouter('titre_doublon', 'bloquant', `« ${nom} » est deux fois dans la sortie : les doublons sont interdits.`, ici('titre'));
    }
    vus.add(cle);

    if (estVide(m)) ajouter('titre_muet', 'bloquant', `« ${nom} » est vide : il n’y a aucun son.`, ici('duree'));
    else if (duree < DUREE_MIN_TITRE) {
      ajouter('titre_trop_court', 'bloquant', `« ${nom} » dure ${mmss(duree)} : il faut au moins 30 s (ajoute une section dans Structure).`, ici('duree'));
    }
    if (infos.explicite === undefined) {
      ajouter('explicite_manquant', 'bloquant', `« ${nom} » : réponds à « Il y a des gros mots ? ».`, ici('explicite'));
    }

    const instrumental = infos.langue === 'instrumental';
    const credits = (infos.credits ?? []).filter((c) => c.nom.trim());
    const roles = instrumental ? (['compositeur'] as const) : (['auteur', 'compositeur'] as const);
    for (const role of roles) {
      if (!credits.some((c) => c.role === role)) {
        const qui = role === 'auteur' ? 'qui a écrit les paroles (auteur)' : 'qui a composé la musique (compositeur)';
        ajouter(`credit_${role}_manquant`, 'bloquant', `« ${nom} » : ajoute ${qui}, avec son vrai nom.`, ici('credits'));
      }
    }
    const pseudos = credits.filter((c) => (c.role === 'auteur' || c.role === 'compositeur') && !estVraiNom(c.nom)).map((c) => `« ${c.nom.trim()} »`);
    if (pseudos.length) {
      ajouter(
        'credits_vrai_nom',
        'bloquant',
        `« ${nom} » : ${pseudos.join(', ')} → écris le vrai nom complet (prénom et nom), pas un pseudo. C’est obligatoire pour les auteurs et compositeurs.`,
        ici('credits'),
      );
    }
    if (!infos.ia) {
      ajouter('ia_non_declaree', 'conseil', `« ${nom} » : dis si l’IA a servi (paroles, musique, voix). Les distributeurs le demandent.`, ici('ia'));
    }
    if (!instrumental && !parolesMusixmatch(m)) {
      ajouter(
        'paroles_absentes',
        'conseil',
        `« ${nom} » n’a pas de paroles : écris-les dans Structure (Spotify les affiche), ou choisis « Instrumental ».`,
        ici('langue'),
      );
    }
  });

  // ---- conseils de la sortie
  if (sortie.titres.length === 1 && durees.length === 1) {
    const m = morceaux.get(sortie.titres[0]!)!;
    if (sortie.titre.trim() && m.titre.trim() && comparable(sortie.titre) !== comparable(m.titre)) {
      ajouter('titre_single', 'conseil', `Pour un single d’un seul titre, le nom de la sortie doit être celui du morceau (« ${m.titre.trim()} »).`, infosSortie('titre'));
    }
  }
  const jours = joursAvant(sortie.dateSortie, Date.now());
  if (jours < 0) {
    ajouter('date_passee', 'conseil', 'La date de sortie est passée : choisis une date dans 6 semaines.', infosSortie('dateSortie'));
  } else if (jours < JOURS_CONSEILLES) {
    ajouter(
      'date_proche',
      'conseil',
      `Sortie dans ${jours} jour${jours > 1 ? 's' : ''} : c’est court. Chez RouteNote, compte environ 3 à 5 semaines (21 à 23 jours ouvrés de vérification, puis la livraison), et le pitch Spotify doit partir 7 jours avant. Conseil : 6 semaines.`,
      infosSortie('dateSortie'),
    );
  }
  if (sortie.distributeur === 'distrokid' && durees.length >= 2) {
    const moyenne = durees.reduce((s, d) => s + d, 0) / durees.length;
    if (moyenne < MOYENNE_MIN_DISTROKID) {
      ajouter(
        'moyenne_distrokid',
        'conseil',
        `Tes titres durent en moyenne ${mmss(moyenne)} : DistroKid refuse les albums dont les titres font en moyenne moins d’une minute.`,
        infosSortie('titres'),
      );
    }
  }
  if (!sortie.lienProfil) {
    ajouter(
      'lien_profil_vide',
      'conseil',
      'Cherche ton nom d’artiste sur Spotify avant : si tu as déjà un profil, colle son lien ; sinon, vérifie qu’aucun autre artiste ne porte le même nom.',
      infosSortie('lienProfil'),
    );
  }
  // Bloquants d'abord (tri stable : l'ordre des titres est gardé).
  return [...liste.filter((p) => p.niveau === 'bloquant'), ...liste.filter((p) => p.niveau === 'conseil')];
}
