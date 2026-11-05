// Règles d'écriture d'un titre et d'un nom (pures) : celles de Spotify et des distributeurs. Propriétaire : A1.
// Utilisées par verifierSortie (regles.ts) pour le nom de la sortie et pour chaque titre.

export interface ProblemeTitre {
  code: string;
  niveau: 'bloquant' | 'conseil';
  message: string;
}

/** Pour comparer deux textes : sans accents, en minuscules, ponctuation → espaces. */
export function comparable(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Les mots d'un titre (un « - » ou un « & » seul ne compte pas). */
export function mots(s: string): string[] {
  return s
    .trim()
    .split(/\s+/)
    .filter((m) => /[\p{L}\p{N}]/u.test(m));
}

/** « NUIT NOIRE » → « Nuit noire » (exemple montré à l'utilisateur). */
function enPhrase(s: string): string {
  const l = s.toLocaleLowerCase('fr');
  return l.charAt(0).toLocaleUpperCase('fr') + l.slice(1);
}

/** Tout en MAJUSCULES (au moins 4 lettres, pour laisser passer « OK » ou « DNA »). */
export function estEnMajuscules(s: string): boolean {
  const lettres = s.match(/\p{L}/gu) ?? [];
  return lettres.length >= 4 && s === s.toLocaleUpperCase('fr') && s !== s.toLocaleLowerCase('fr');
}

/** Commence par un numéro de piste : « 01 - Nuit », « 1. Nuit », « 3) Nuit », « Track 2 », « Piste 4 ». */
export function aUnNumero(s: string): boolean {
  return /^\s*(?:(?:track|piste|titre)\s*\d+|\d{1,3}\s*[-.)_:–—](?!\d))/i.test(s);
}

/** Contient le nom de l'artiste (mot entier, sans tenir compte des accents ni de la casse). */
export function contientArtiste(titre: string, artiste: string): boolean {
  const a = comparable(artiste);
  if (a.length < 2) return false;
  return ` ${comparable(titre)} `.includes(` ${a} `);
}

/** « prod. X », « prod by X », « produced by X ». */
export function contientProd(s: string): boolean {
  return /\bprod(?:\.|\s+by\b|uced\s+by\b)/i.test(s);
}

/** « feat. X », « ft. X », « featuring X » écrit dans le titre. */
export function contientFeat(s: string): boolean {
  return /(?:^|[\s(\[])(?:feat\.?|ft\.|featuring)(?=\s|$)/i.test(s);
}

export const MOTS_MAX = 12;

/**
 * Problèmes d'un titre (de la sortie ou d'un morceau). `deMorceau` : vérifie aussi le « feat. » écrit dans le titre
 * (pour un morceau, l'invité va dans le champ « featuring »).
 */
export function problemesTitre(titre: string, artiste: string, deMorceau: boolean): ProblemeTitre[] {
  const t = titre.trim();
  const p: ProblemeTitre[] = [];
  if (!t) return p;
  if (estEnMajuscules(t)) {
    p.push({
      code: 'titre_majuscules',
      niveau: 'bloquant',
      message: `« ${t} » est tout en MAJUSCULES : Spotify le refuse. Écris-le normalement, par exemple « ${enPhrase(t)} ».`,
    });
  }
  if (aUnNumero(t)) {
    p.push({ code: 'titre_numero', niveau: 'bloquant', message: `Enlève le numéro au début de « ${t} » : le numéro de piste est ajouté tout seul.` });
  }
  if (contientArtiste(t, artiste)) {
    p.push({ code: 'titre_artiste', niveau: 'bloquant', message: `Enlève ton nom d’artiste du titre « ${t} » : il est déjà dans le champ Artiste.` });
  }
  const n = mots(t).length;
  if (n > MOTS_MAX) {
    p.push({ code: 'titre_trop_long', niveau: 'bloquant', message: `Le titre « ${t.slice(0, 40)}… » fait ${n} mots : ${MOTS_MAX} au plus.` });
  }
  if (contientProd(t)) {
    p.push({ code: 'titre_prod', niveau: 'bloquant', message: `Enlève « prod. » du titre « ${t} » : le producteur va dans les crédits, jamais dans le titre.` });
  }
  if (deMorceau && contientFeat(t)) {
    p.push({
      code: 'titre_feat',
      niveau: 'conseil',
      message: `Enlève l’invité du titre « ${t} » et écris son nom dans « Un invité ? » : OCKA ajoute « (feat. Nom) » tout seul.`,
    });
  }
  return p;
}

/**
 * Vrai nom complet exigé pour les auteurs et compositeurs : au moins 2 mots (prénom et nom), des lettres
 * (tirets, apostrophes et initiales permis), pas de chiffre ni de « @ ».
 */
export function estVraiNom(nom: string): boolean {
  const m = nom.trim().split(/\s+/).filter(Boolean);
  return m.length >= 2 && m.every((x) => /^\p{L}[\p{L}\p{M}'’.-]*$/u.test(x));
}
