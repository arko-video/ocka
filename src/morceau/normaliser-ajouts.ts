// Normalisation des ajouts de la version 2 : sons importés, pads perso et infos du titre (sortie).
// Tous facultatifs : un champ absent reste absent, un champ présent ressort propre.

import { apercu, estObjet, Ids, Journal, lireBooleen, lireChoix, lireNombre, lireTexte, verifierCles } from './normaliser-outils';
import {
  NIVEAUX_IA,
  PADS_PERSO,
  PLAFONDS,
  REGLE_CLE_SON,
  ROLES_CREDIT,
  type InfosTitre,
  type Morceau,
  type PadPerso,
  type SonImporte,
} from './types';

/** Code de langue : « fr », « en », « pt-BR »… (ou « instrumental » quand c'est permis). */
export const REGLE_LANGUE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

export function normaliserSons(v: unknown, journal: Journal): { sons: SonImporte[] | undefined; ids: Ids } {
  const ids = new Ids('son');
  if (v === undefined || v === null) return { sons: undefined, ids };
  if (!Array.isArray(v)) {
    journal.corrige('sons', 'Les sons devaient être une liste : aucun son gardé.');
    return { sons: [], ids };
  }
  const sons: SonImporte[] = [];
  let total = 0;
  if (v.length > PLAFONDS.sons) journal.corrige('sons', `Trop de sons : seuls les ${PLAFONDS.sons} premiers sont gardés.`);
  v.slice(0, PLAFONDS.sons).forEach((b, i) => {
    const c = `sons[${i}]`;
    if (!estObjet(b)) return journal.ignore(c, 'Ce son n’est pas un objet : ignoré.');
    verifierCles(b, ['id', 'nom', 'fichier', 'frequence', 'duree', 'canaux'], c, journal);
    if (typeof b.fichier !== 'string' || !REGLE_CLE_SON.test(b.fichier)) {
      return journal.ignore(`${c}.fichier`, `Le fichier de ce son (« ${apercu(b.fichier)} ») n'est pas un fichier d'OCKA : son ignoré.`);
    }
    const duree = lireNombre(b.duree, `${c}.duree`, journal, { defaut: 0, min: 0, max: PLAFONDS.dureeSons, nom: 'la durée' });
    if (total + duree > PLAFONDS.dureeSons) {
      return journal.ignore(c, `Les sons d'un morceau durent ${PLAFONDS.dureeSons} s au plus en tout : ce son est retiré.`);
    }
    total += duree;
    const canaux = lireNombre(b.canaux, `${c}.canaux`, journal, { defaut: 1, min: 1, max: 2, nom: 'le nombre de canaux', entier: true });
    sons.push({
      id: ids.donner(b.id, i, `${c}.id`, journal),
      nom: lireTexte(b.nom, `Son ${i + 1}`, `${c}.nom`, journal, 60),
      fichier: b.fichier,
      frequence: lireNombre(b.frequence, `${c}.frequence`, journal, { defaut: 48000, min: 8000, max: 192000, nom: 'la fréquence', entier: true }),
      duree,
      canaux: canaux === 2 ? 2 : 1,
    });
  });
  return { sons, ids };
}

/** Pads perso : chaque pad pointe vers un son existant (sinon il est retiré). */
export function normaliserPads(v: unknown, idsSons: Ids, journal: Journal): Morceau['pads'] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!estObjet(v)) {
    journal.corrige('pads', 'Les pads devaient être un objet { perso1: idSon } : aucun pad gardé.');
    return {};
  }
  const pads: Partial<Record<PadPerso, string>> = {};
  for (const [pad, ref] of Object.entries(v)) {
    if (!(PADS_PERSO as readonly string[]).includes(pad)) {
      journal.ignore(`pads.${apercu(pad)}`, `Le pad « ${apercu(pad)} » n'existe pas (perso1 à perso4) : ignoré.`);
      continue;
    }
    const son = idsSons.trouver(ref);
    if (!son) {
      journal.ignore(`pads.${pad}`, `Le pad ${pad} utilise un son qui n'existe pas : pad vidé.`);
      continue;
    }
    pads[pad as PadPerso] = son;
  }
  return pads;
}

/** Lit un code de langue (ou « instrumental » si `instrumental`). undefined s'il est illisible. */
export function lireLangue(v: unknown, chemin: string, journal: Journal, instrumental: boolean): string | undefined {
  if (typeof v === 'string') {
    const t = v.trim();
    if (instrumental && t.toLowerCase() === 'instrumental') return 'instrumental';
    const [l, r] = t.split(/[-_]/);
    const code = r ? `${l!.toLowerCase()}-${r}` : t.toLowerCase();
    if (REGLE_LANGUE.test(code)) return code;
  }
  journal.corrige(chemin, `La langue « ${apercu(v)} » est illisible (exemples : fr, en${instrumental ? ', instrumental' : ''}) : retirée.`);
  return undefined;
}

/** ISRC : 2 lettres, 3 lettres ou chiffres, 7 chiffres (tirets et espaces retirés). */
export function lireIsrc(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(s) ? s : null;
}

export function normaliserInfos(v: unknown, journal: Journal): InfosTitre | undefined {
  if (v === undefined || v === null) return undefined;
  if (!estObjet(v)) {
    journal.corrige('infos', 'Les infos du titre devaient être un objet : remises à zéro.');
    return {};
  }
  verifierCles(v, ['explicite', 'langue', 'credits', 'featuring', 'isrc', 'ia'], 'infos', journal);
  const infos: InfosTitre = {};
  if (v.explicite !== undefined && v.explicite !== null) infos.explicite = lireBooleen(v.explicite, false, 'infos.explicite', journal);
  if (v.langue !== undefined && v.langue !== null) {
    const l = lireLangue(v.langue, 'infos.langue', journal, true);
    if (l) infos.langue = l;
  }
  if (v.credits !== undefined && v.credits !== null) {
    const brutes = Array.isArray(v.credits) ? v.credits : [];
    if (brutes.length > 20) journal.corrige('infos.credits', 'Trop de crédits : seuls les 20 premiers sont gardés.');
    infos.credits = [];
    brutes.slice(0, 20).forEach((b, i) => {
      const c = `infos.credits[${i}]`;
      if (!estObjet(b)) return journal.ignore(c, 'Ce crédit n’est pas un objet : ignoré.');
      verifierCles(b, ['nom', 'role'], c, journal);
      const nom = lireTexte(b.nom, '', `${c}.nom`, journal, 100).trim();
      if (!nom) return journal.ignore(c, 'Ce crédit n’a pas de nom : ignoré.');
      infos.credits!.push({ nom, role: lireChoix(b.role, ROLES_CREDIT, 'auteur', `${c}.role`, journal, 'le rôle') });
    });
  }
  if (v.featuring !== undefined && v.featuring !== null) {
    const f = lireTexte(v.featuring, '', 'infos.featuring', journal, 100).trim();
    if (f) infos.featuring = f;
  }
  if (v.isrc !== undefined && v.isrc !== null && v.isrc !== '') {
    const isrc = lireIsrc(v.isrc);
    if (isrc) infos.isrc = isrc;
    else journal.corrige('infos.isrc', `L'ISRC « ${apercu(v.isrc)} » est illisible (12 caractères, ex. FRAB12400001) : retiré.`);
  }
  if (v.ia !== undefined && v.ia !== null) {
    const ia = estObjet(v.ia) ? v.ia : {};
    if (!estObjet(v.ia)) journal.corrige('infos.ia', 'La déclaration de l’IA devait être un objet : « aucune » partout.');
    verifierCles(ia, ['paroles', 'musique', 'voix'], 'infos.ia', journal);
    const lire = (k: 'paroles' | 'musique' | 'voix') => lireChoix(ia[k], NIVEAUX_IA, 'aucune', `infos.ia.${k}`, journal, `l'IA (${k})`);
    infos.ia = { paroles: lire('paroles'), musique: lire('musique'), voix: lire('voix') };
  }
  return infos;
}
