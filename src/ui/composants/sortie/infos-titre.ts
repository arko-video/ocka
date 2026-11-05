// Fonctions PURES d'édition des infos d'un titre (assistant de sortie) : elles renvoient un nouveau morceau,
// ou le même si rien ne change. Testées dans infos-titre.test.ts. Propriétaire : A1.

import type { InfosTitre, Morceau, NiveauIa, RoleCredit } from '../../../morceau/types';

export type Credit = { nom: string; role: RoleCredit };

/** Déclaration de l'IA par défaut : les styles et le hasard d'OCKA sont des règles, pas de l'IA générative. */
export const IA_AUCUNE = { paroles: 'aucune', musique: 'aucune', voix: 'aucune' } as const;

/** Crédits pré-remplis avec le vrai nom : il a écrit, composé et produit (le beat est fait dans OCKA). */
export function creditsParDefaut(vraiNom: string): Credit[] {
  return [
    { nom: vraiNom, role: 'auteur' },
    { nom: vraiNom, role: 'compositeur' },
    { nom: vraiNom, role: 'producteur' },
  ];
}

/**
 * Complète un titre qui entre dans une sortie : IA « aucune » si rien n'est déclaré, crédits avec le vrai nom
 * s'il n'y en a aucun pour l'auteur ni le compositeur. Ne remplace jamais ce que l'utilisateur a déjà écrit.
 */
export function completerInfos(m: Morceau, vraiNom?: string): Morceau {
  const infos: InfosTitre = { ...(m.infos ?? {}) };
  let change = false;
  if (!infos.ia) {
    infos.ia = { ...IA_AUCUNE };
    change = true;
  }
  const nom = vraiNom?.trim();
  const credits = (infos.credits ?? []).filter((c) => c.nom.trim());
  if (nom && !credits.some((c) => c.role === 'auteur' || c.role === 'compositeur')) {
    const producteur = credits.some((c) => c.role === 'producteur');
    infos.credits = [...credits, ...creditsParDefaut(nom).filter((c) => c.role !== 'producteur' || !producteur)];
    change = true;
  }
  return change ? { ...m, infos } : m;
}

/** Change un champ des infos (undefined ou '' = retiré). */
export function reglerInfo<K extends keyof InfosTitre>(m: Morceau, cle: K, valeur: InfosTitre[K] | undefined): Morceau {
  const infos: InfosTitre = { ...(m.infos ?? {}) };
  if (valeur === undefined || valeur === '') delete infos[cle];
  else infos[cle] = valeur;
  return { ...m, infos };
}

/** Titre du morceau tel qu'on le tape (coupé à 80 caractères ; les espaces de bord sont retirés à la vérification). */
export function reglerTitre(m: Morceau, titre: string): Morceau {
  const t = titre.slice(0, 80);
  return t === m.titre ? m : { ...m, titre: t };
}

export function reglerIa(m: Morceau, partie: 'paroles' | 'musique' | 'voix', niveau: NiveauIa): Morceau {
  const ia = { ...(m.infos?.ia ?? IA_AUCUNE), [partie]: niveau };
  return reglerInfo(m, 'ia', ia);
}

export function reglerCredit(m: Morceau, index: number, c: Partial<Credit>): Morceau {
  const credits = [...(m.infos?.credits ?? [])];
  const avant = credits[index];
  if (!avant) return m;
  credits[index] = { nom: (c.nom ?? avant.nom).slice(0, 100), role: c.role ?? avant.role };
  return reglerInfo(m, 'credits', credits);
}

export function ajouterCredit(m: Morceau, nom = ''): Morceau {
  const credits = m.infos?.credits ?? [];
  if (credits.length >= 20) return m;
  const roles = new Set(credits.map((c) => c.role));
  const role: RoleCredit = !roles.has('auteur') ? 'auteur' : !roles.has('compositeur') ? 'compositeur' : 'interprete';
  return reglerInfo(m, 'credits', [...credits, { nom, role }]);
}

export function retirerCredit(m: Morceau, index: number): Morceau {
  const credits = (m.infos?.credits ?? []).filter((_, i) => i !== index);
  return reglerInfo(m, 'credits', credits.length ? credits : undefined);
}

/** ISRC tapé : majuscules, sans espaces ni tirets, 12 caractères au plus. */
export function nettoyerIsrc(s: string): string {
  return s.replace(/[\s-]/g, '').toUpperCase().slice(0, 12);
}
export const isrcValide = (s: string) => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(s);

/** Infos d'un titre remplies (pour la pastille « Complet » de la liste). */
export function infosCompletes(m: Morceau): boolean {
  const i = m.infos ?? {};
  const roles = new Set((i.credits ?? []).filter((c) => c.nom.trim()).map((c) => c.role));
  const credits = roles.has('compositeur') && (i.langue === 'instrumental' || roles.has('auteur'));
  return i.explicite !== undefined && !!i.ia && credits && !!m.titre.trim();
}

/** Déplace un élément d'une liste (flèches haut / bas). */
export function deplacer<T>(liste: readonly T[], index: number, sens: -1 | 1): T[] {
  const j = index + sens;
  if (index < 0 || index >= liste.length || j < 0 || j >= liste.length) return [...liste];
  const r = [...liste];
  [r[index], r[j]] = [r[j]!, r[index]!];
  return r;
}
