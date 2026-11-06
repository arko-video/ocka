// Normalisation des sections (motifs par piste, boucles, effets de performance), de l'arrangement, des prises et du
// master. Les références (ordre, ancres, pistes, motifs, boucles) passent par les `Ids` des familles déjà
// normalisées : une section ou une piste renommée garde ses références.

import { normaliserAutotune, normaliserPerf } from './normaliser-v3';
import { apercu, dictionnaire, estObjet, Ids, Journal, lireBooleen, lireChoix, lireNombre, lireTexte, verifierCles, type Objet } from './normaliser-outils';
import { MESURES_BOUCLE, PLAFONDS, REGLE_CLE_PRISE, type Master, type Motif, type Piste, type Prise, type Section } from './types';

/** Type de motif attendu pour une piste (null : la piste n'a pas de motifs, ex. sons et voix). */
function typeAttendu(p: Piste): Motif['type'] | null {
  if (p.genre === 'instrument') return 'notes';
  return p.id === 'batterie' || p.id === 'basse' || p.id === 'accords' ? p.id : null;
}

/** Section.motifs : id de piste → id de motif du bon type (dictionnaire sans prototype). */
function normaliserRefs(v: unknown, motifs: Record<string, Motif>, idsMotifs: Ids, pistes: Piste[], idsPistes: Ids, c: string, journal: Journal): Section['motifs'] {
  const refs = dictionnaire<string>();
  for (const [cle, ref] of Object.entries(estObjet(v) ? v : {})) {
    if (ref === undefined || ref === null || ref === '') continue;
    const piste = pistes.find((p) => p.id === idsPistes.trouver(cle));
    const attendu = piste ? typeAttendu(piste) : null;
    if (!piste || !attendu) {
      journal.corrige(`${c}.motifs.${apercu(cle)}`, `La piste « ${apercu(cle)} » n'existe pas ou ne joue pas de motif : référence retirée.`);
      continue;
    }
    const cible = idsMotifs.trouver(ref);
    if (!cible || motifs[cible]?.type !== attendu) {
      journal.corrige(`${c}.motifs.${piste.id}`, `Le motif « ${apercu(ref)} » n'existe pas (ou n'est pas un motif de ${attendu}) : la piste ${piste.id} est silencieuse ici.`);
      continue;
    }
    refs[piste.id] = cible;
  }
  return refs;
}

export function normaliserSections(
  v: unknown,
  motifs: Record<string, Motif>,
  idsMotifs: Ids,
  idsSons: Ids,
  pistes: Piste[],
  idsPistes: Ids,
  journal: Journal,
): { sections: Section[]; ids: Ids } {
  const sections: Section[] = [];
  const ids = new Ids('section');
  if (!Array.isArray(v) && v !== undefined) journal.corrige('sections', 'Les sections devaient être une liste.');
  const brutes = Array.isArray(v) ? v : [];
  if (brutes.length > PLAFONDS.sections) journal.corrige('sections', `Trop de sections : seules les ${PLAFONDS.sections} premières sont gardées.`);
  brutes.slice(0, PLAFONDS.sections).forEach((b, i) => {
    const c = `sections[${i}]`;
    if (!estObjet(b)) return journal.ignore(c, 'Cette section n’est pas un objet : ignorée.');
    verifierCles(b, ['id', 'nom', 'mesures', 'motifs', 'fill', 'coupure', 'paroles', 'boucle', 'perf'], c, journal);
    const id = ids.donner(b.id, i, `${c}.id`, journal);
    const section: Section = {
      id,
      nom: lireTexte(b.nom, `Section ${i + 1}`, `${c}.nom`, journal, 40),
      mesures: lireNombre(b.mesures, `${c}.mesures`, journal, { defaut: 4, min: 1, max: 16, nom: 'le nombre de mesures', entier: true }),
      motifs: normaliserRefs(b.motifs, motifs, idsMotifs, pistes, idsPistes, c, journal),
      fill: lireBooleen(b.fill, false, `${c}.fill`, journal),
      coupure: lireChoix(b.coupure, ['aucune', 'break', 'drop'] as const, 'aucune', `${c}.coupure`, journal, 'la coupure'),
    };
    if (b.paroles !== undefined) section.paroles = lireTexte(b.paroles, '', `${c}.paroles`, journal, 4000);
    if (b.boucle !== undefined && b.boucle !== null) {
      const boucle = normaliserBoucle(b.boucle, idsSons, `${c}.boucle`, journal);
      if (boucle) section.boucle = boucle;
    }
    if (b.perf !== undefined && b.perf !== null) {
      const perf = normaliserPerf(b.perf, section.mesures * 16, pistes, idsPistes, `${c}.perf`, journal);
      if (perf.length > 0) section.perf = perf;
    }
    sections.push(section);
  });
  return { sections, ids };
}

function normaliserBoucle(v: unknown, idsSons: Ids, c: string, journal: Journal): Section['boucle'] | null {
  if (!estObjet(v)) {
    journal.ignore(c, 'La boucle devait être un objet : ignorée.');
    return null;
  }
  verifierCles(v, ['son', 'mesures', 'caler'], c, journal);
  const son = idsSons.trouver(v.son);
  if (!son) {
    journal.ignore(`${c}.son`, `La boucle utilise un son qui n'existe pas (« ${apercu(v.son)} ») : boucle retirée.`);
    return null;
  }
  const x = lireNombre(v.mesures, `${c}.mesures`, journal, { defaut: 4, min: 1, max: 8, nom: 'la longueur de la boucle' });
  const mesures = MESURES_BOUCLE.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  if (mesures !== x) journal.corrige(`${c}.mesures`, `Une boucle dure 1, 2, 4 ou 8 mesures : ramenée à ${mesures}.`);
  return { son, mesures, caler: lireBooleen(v.caler, true, `${c}.caler`, journal) };
}

export function normaliserOrdre(v: unknown, sections: Section[], idsSections: Ids, journal: Journal): string[] {
  const ordre: string[] = [];
  if (Array.isArray(v)) {
    if (v.length > PLAFONDS.ordre) journal.corrige('ordre', `L'arrangement est trop long : seules les ${PLAFONDS.ordre} premières entrées sont gardées.`);
    v.slice(0, PLAFONDS.ordre).forEach((ref, i) => {
      const id = idsSections.trouver(ref);
      if (id) ordre.push(id);
      else journal.ignore(`ordre[${i}]`, `La section « ${apercu(ref)} » n'existe pas : retirée de l'arrangement.`);
    });
  }
  if (ordre.length === 0 && sections.length > 0) {
    journal.corrige('ordre', "L'arrangement était vide : les sections sont jouées dans l'ordre de la liste.");
    return sections.map((s) => s.id);
  }
  return ordre;
}

function normaliserPrise(b: Objet, i: number, sections: Section[], idsSections: Ids, ids: Ids, journal: Journal): Prise | null {
  const c = `prises[${i}]`;
  const ancre = estObjet(b.ancre) ? b.ancre : {};
  const idSection = idsSections.trouver(ancre.section);
  const section = sections.find((s) => s.id === idSection);
  if (!section) {
    journal.ignore(`${c}.ancre`, `La prise « ${apercu(b.nom ?? b.id)} » est ancrée sur une section qui n'existe plus : ignorée.`);
    return null;
  }
  if (typeof b.fichier !== 'string' || !REGLE_CLE_PRISE.test(b.fichier)) {
    journal.ignore(`${c}.fichier`, `Le fichier de cette prise (« ${apercu(b.fichier)} ») n'est pas un fichier d'OCKA : prise ignorée.`);
    return null;
  }
  const duree = lireNombre(b.duree, `${c}.duree`, journal, { defaut: 0, min: 0, max: 3600, nom: 'la durée' });
  const debutCoupe = lireNombre(b.debutCoupe, `${c}.debutCoupe`, journal, { defaut: 0, min: 0, max: duree, nom: 'le début gardé' });
  const prise: Prise = {
    id: ids.donner(b.id, i, `${c}.id`, journal),
    ancre: {
      section: section.id,
      occurrence: lireNombre(ancre.occurrence, `${c}.ancre.occurrence`, journal, { defaut: 0, min: 0, max: 99, nom: "l'apparition", entier: true }),
      mesure: lireNombre(ancre.mesure, `${c}.ancre.mesure`, journal, { defaut: 0, min: 0, max: section.mesures - 1, nom: 'la mesure', entier: true }),
    },
    tempo: lireNombre(b.tempo, `${c}.tempo`, journal, { defaut: 120, min: 60, max: 200, nom: 'le tempo' }),
    fichier: b.fichier,
    frequence: lireNombre(b.frequence, `${c}.frequence`, journal, { defaut: 48000, min: 8000, max: 192000, nom: 'la fréquence', entier: true }),
    duree,
    debutCoupe,
    finCoupe: lireNombre(b.finCoupe, `${c}.finCoupe`, journal, { defaut: duree, min: debutCoupe, max: duree, nom: 'la fin gardée' }),
    decalage: lireNombre(b.decalage, `${c}.decalage`, journal, { defaut: 0, min: -1, max: 1, nom: 'le décalage' }),
    gain: lireNombre(b.gain, `${c}.gain`, journal, { defaut: 1, min: 0, max: 4, nom: 'le gain' }),
    choisie: lireBooleen(b.choisie, false, `${c}.choisie`, journal),
  };
  if (b.nom !== undefined) prise.nom = lireTexte(b.nom, '', `${c}.nom`, journal, 60);
  if (b.autotune !== undefined && b.autotune !== null) {
    const a = normaliserAutotune(b.autotune, duree, `${c}.autotune`, journal);
    if (a) prise.autotune = a;
  }
  return prise;
}

export function normaliserPrises(v: unknown, sections: Section[], idsSections: Ids, journal: Journal): Prise[] {
  const prises: Prise[] = [];
  const ids = new Ids('prise');
  const brutes = Array.isArray(v) ? v : [];
  if (brutes.length > PLAFONDS.prises) journal.corrige('prises', `Trop de prises : seules les ${PLAFONDS.prises} premières sont gardées.`);
  brutes.slice(0, PLAFONDS.prises).forEach((b, i) => {
    if (!estObjet(b)) return journal.ignore(`prises[${i}]`, 'Cette prise n’est pas un objet : ignorée.');
    const p = normaliserPrise(b, i, sections, idsSections, ids, journal);
    if (p) prises.push(p);
  });
  // Une seule prise choisie par section (et par apparition) en v1 : on garde la dernière.
  const vues = new Set<string>();
  for (let i = prises.length - 1; i >= 0; i--) {
    const p = prises[i]!;
    if (!p.choisie) continue;
    const cle = `${p.ancre.section}#${p.ancre.occurrence}`;
    if (vues.has(cle)) {
      p.choisie = false;
      journal.corrige(`prises[${i}].choisie`, 'Une seule prise choisie par section : celle-ci ne l’est plus.');
    }
    vues.add(cle);
  }
  return prises;
}

/** Master. `chaineParDefaut` : 1 pour un morceau lu en version 1 (son inchangé), 2 sinon. */
export function normaliserMaster(v: unknown, chaineParDefaut: 1 | 2, journal: Journal): Master {
  const b = estObjet(v) ? v : {};
  if (v !== undefined && !estObjet(v)) journal.corrige('master', 'Le master devait être un objet : réglages par défaut.');
  verifierCles(b, ['preset', 'niveau', 'chaine'], 'master', journal);
  let chaine: 1 | 2 = chaineParDefaut;
  if (b.chaine !== undefined) {
    if (b.chaine === 1 || b.chaine === 2) chaine = b.chaine;
    else journal.corrige('master.chaine', `La chaîne du master « ${apercu(b.chaine)} » est inconnue (1 ou 2) : ${chaineParDefaut}.`);
  }
  return {
    preset: lireChoix(b.preset, ['neutre', 'chaud', 'clair', 'lofi'] as const, 'neutre', 'master.preset', journal, 'le préréglage du master'),
    niveau: lireChoix(b.niveau, ['standard', 'fort'] as const, 'standard', 'master.niveau', journal, 'le niveau'),
    chaine,
  };
}
