// Liste blanche des champs que l'IA a le droit d'écrire, appliquée AVANT le normaliseur.
// L'IA ne touche jamais `prises`, `sons`, `infos`, `master`, `pads`, `pistes`, `kit`, ni les boucles :
// ces champs sont simplement ignorés. Tout objet copié ici est sans prototype (un « __proto__ » écrit par l'IA
// devient une clé ordinaire, que le normaliseur renomme). Les listes et les textes sont coupés tôt. Fonctions pures.

import { dictionnaire } from '../morceau/normaliser-outils';
import { PLAFONDS } from '../morceau/types';

type Objet = Record<string, unknown>;

/** Instruments que l'IA peut écrire (pas les pads perso : ils dépendent des sons importés). */
export const INSTRUMENTS_IA = ['kick', 'snare', 'clap', 'charley', 'charleyOuvert', 'rim', 'cowbell', 'perc'] as const;
const PISTES_SECTION = ['batterie', 'basse', 'accords', 'melodie'] as const;

/** Champs refusés trouvés dans la réponse (pour les tests et la console : jamais montrés tels quels). */
export interface Filtre {
  ignores: string[];
}

export function estObjet(v: unknown): v is Objet {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Copie les seules clés permises (lues avec Object.hasOwn), note les autres. */
function garder(v: Objet, cles: readonly string[], chemin: string, f: Filtre): Objet {
  const res: Objet = dictionnaire();
  for (const k of Object.keys(v)) {
    if (cles.includes(k)) res[k] = v[k];
    else if (f.ignores.length < 50) f.ignores.push(chemin ? `${chemin}.${k.slice(0, 30)}` : k.slice(0, 30));
  }
  return res;
}

/** Texte : seulement une chaîne, sans caractères de contrôle (sauf retour à la ligne), coupée. */
export function texte(v: unknown, max: number, lignes = false): string | undefined {
  if (typeof v !== 'string') return undefined;
  const propre = v.replace(lignes ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, lignes ? '' : ' ');
  return propre.slice(0, max);
}

/** Nombre ou booléen tel quel (le normaliseur borne) ; toute autre forme est retirée. */
function simple(v: unknown): unknown {
  return typeof v === 'number' || typeof v === 'boolean' ? v : typeof v === 'string' ? v.slice(0, 20) : undefined;
}

function sansVides(o: Objet): Objet {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}

/**
 * Ligne de batterie : une liste de nombres, ou l'écriture compacte « x---o---x-x-o--- »
 * (x = frappe, o = frappe douce, tout autre caractère = rien). Coupée à 256 pas.
 */
export function ligneBatterie(v: unknown): number[] | undefined {
  if (typeof v === 'string') {
    return [...v.replace(/\s+/g, '').slice(0, 256)].map((c) => (c === 'x' || c === 'X' ? 1 : c === 'o' || c === 'O' ? 0.5 : 0));
  }
  if (Array.isArray(v)) return v.slice(0, 256).map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0));
  return undefined;
}

function instruments(v: unknown, chemin: string, f: Filtre): Objet | undefined {
  if (!estObjet(v)) return undefined;
  const brut = garder(v, INSTRUMENTS_IA, chemin, f);
  const res: Objet = dictionnaire();
  for (const k of Object.keys(brut)) {
    const l = ligneBatterie(brut[k]);
    if (l) res[k] = l;
  }
  return res;
}

function notes(v: unknown, cles: readonly string[], chemin: string, f: Filtre): Objet[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .slice(0, PLAFONDS.notesParMotif)
    .filter(estObjet)
    .map((n) => {
      const g = garder(n, cles, chemin, f);
      for (const k of Object.keys(g)) g[k] = simple(g[k]);
      return sansVides(g);
    });
}

/** Un motif (batterie, basse, accords, mélodie), réduit aux champs du format. undefined si illisible. */
export function filtrerMotif(v: unknown, chemin: string, f: Filtre): Objet | undefined {
  if (!estObjet(v)) return undefined;
  const pas = simple(v.pas);
  switch (v.type) {
    case 'batterie': {
      const g = garder(v, ['type', 'pas', 'pistes', 'roulements'], chemin, f);
      return sansVides({ type: 'batterie', pas, pistes: instruments(g.pistes, `${chemin}.pistes`, f) ?? {}, roulements: instruments(g.roulements, `${chemin}.roulements`, f) });
    }
    case 'basse': {
      const g = garder(v, ['type', 'pas', 'notes', 'suitAccords'], chemin, f);
      return sansVides({ type: 'basse', pas, notes: notes(g.notes, ['pas', 'duree', 'degre', 'octave', 'glisse', 'vel'], `${chemin}.notes`, f) ?? [], suitAccords: typeof g.suitAccords === 'boolean' ? g.suitAccords : undefined });
    }
    case 'accords': {
      const g = garder(v, ['type', 'pas', 'accords', 'son'], chemin, f);
      return sansVides({ type: 'accords', pas, accords: notes(g.accords, ['pas', 'duree', 'degre'], `${chemin}.accords`, f) ?? [], son: simple(g.son) });
    }
    case 'melodie': {
      const g = garder(v, ['type', 'pas', 'notes', 'son'], chemin, f);
      return sansVides({ type: 'melodie', pas, notes: notes(g.notes, ['pas', 'duree', 'midi', 'vel'], `${chemin}.notes`, f) ?? [], son: simple(g.son) });
    }
    default:
      f.ignores.push(chemin);
      return undefined;
  }
}

/** Dictionnaire des motifs (64 au plus), sans prototype. */
export function filtrerMotifs(v: unknown, f: Filtre): Record<string, Objet> {
  const res = dictionnaire<Objet>();
  if (!estObjet(v)) return res;
  for (const id of Object.keys(v).slice(0, PLAFONDS.motifs)) {
    const m = filtrerMotif(v[id], `motifs.${id.slice(0, 30)}`, f);
    // Dictionnaire sans prototype : « __proto__ » reste une clé ordinaire ; le normaliseur le renomme et répare les renvois.
    if (m) res[id.slice(0, 40)] = m;
  }
  return res;
}

/** Une section : id, nom, mesures, motifs, fill, coupure, paroles (sans boucle : elle dépend des sons importés). */
export function filtrerSection(v: unknown, chemin: string, f: Filtre, avecParoles = true): Objet | undefined {
  if (!estObjet(v)) return undefined;
  const cles = ['id', 'nom', 'mesures', 'motifs', 'fill', 'coupure', ...(avecParoles ? ['paroles'] : [])];
  const g = garder(v, cles, chemin, f);
  const refs: Objet = dictionnaire();
  if (estObjet(g.motifs)) {
    const r = garder(g.motifs, PISTES_SECTION, `${chemin}.motifs`, f);
    for (const k of Object.keys(r)) if (typeof r[k] === 'string') refs[k] = (r[k] as string).slice(0, 40);
  }
  return sansVides({
    id: texte(g.id, 40),
    nom: texte(g.nom, 30),
    mesures: simple(g.mesures),
    motifs: refs,
    fill: typeof g.fill === 'boolean' ? g.fill : undefined,
    coupure: texte(g.coupure, 10),
    paroles: texte(g.paroles, 4000, true),
  });
}

/** Champs du morceau compact que « Lance-moi un beat » accepte. */
export const CHAMPS_BEAT = ['titre', 'style', 'tempo', 'swing', 'tonalite', 'motifs', 'sections', 'ordre'] as const;

/** Morceau compact écrit par l'IA → objet réduit à la liste blanche (pas encore normalisé). */
export function filtrerBeat(v: Objet, f: Filtre): Objet {
  const g = garder(v, CHAMPS_BEAT, '', f);
  const ton = estObjet(g.tonalite) ? garder(g.tonalite, ['tonique', 'mode'], 'tonalite', f) : undefined;
  const sections = Array.isArray(g.sections)
    ? g.sections.slice(0, PLAFONDS.sections).map((s, i) => filtrerSection(s, `sections[${i}]`, f)).filter((s) => s !== undefined)
    : [];
  return sansVides({
    titre: texte(g.titre, 100),
    style: texte(g.style, 20),
    tempo: simple(g.tempo),
    swing: simple(g.swing),
    tonalite: ton ? sansVides({ tonique: texte(ton.tonique, 4), mode: texte(ton.mode, 10) }) : undefined,
    motifs: filtrerMotifs(g.motifs, f),
    sections,
    ordre: Array.isArray(g.ordre) ? g.ordre.slice(0, PLAFONDS.ordre).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 40)) : undefined,
  });
}
