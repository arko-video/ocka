// Normalisation des ajouts /3 des vagues C2 et C3 (types-ajouts.ts) : effets de performance, autotune réglable
// d'une prise, marqueurs, SoundFonts, recettes et découpes des sons, pads sur une découpe.
// Tous facultatifs : un champ absent reste absent ; une liste vide après correction est retirée par l'appelant.

import { listeBornee } from './normaliser-mixage';
import {
  apercu,
  dictionnaire,
  estObjet,
  Ids,
  Journal,
  lireChoix,
  lireNombre,
  lireNombreBrut,
  lirePas24,
  lireTexte,
  verifierCles,
} from './normaliser-outils';
import { lireTonique } from './theorie';
import {
  DIVISIONS_PERF,
  PADS_PERSO,
  PLAFONDS,
  PRESETS_AUTOTUNE,
  REGLE_CLE_SF2,
  TYPES_PERF,
  type AutotunePrise,
  type DecoupeSon,
  type EffetPerf,
  type Marqueur,
  type Morceau,
  type NoteAutotune,
  type PadPerso,
  type Piste,
  type RecetteSon,
  type Section,
  type SonImporte,
  type SoundFontMorceau,
} from './types';

export function normaliserPerf(v: unknown, longueur: number, pistes: Piste[], idsPistes: Ids, c: string, journal: Journal): EffetPerf[] {
  const out: EffetPerf[] = [];
  listeBornee(v, PLAFONDS.perfParSection, c, journal).forEach((b, i) => {
    const ci = `${c}[${i}]`;
    if (!estObjet(b)) return journal.ignore(ci, 'Cet effet n’est pas un objet : ignoré.');
    verifierCles(b, ['type', 'pas', 'duree', 'division', 'pistes'], ci, journal);
    if (typeof b.type !== 'string' || !(TYPES_PERF as readonly string[]).includes(b.type)) {
      return journal.ignore(`${ci}.type`, `L'effet « ${apercu(b.type)} » est inconnu (${TYPES_PERF.join(', ')}) : ignoré.`);
    }
    const pas = lirePas24(b.pas, `${ci}.pas`, journal, { defaut: 0, min: 0, max: longueur - 1, nom: 'le début' });
    const e: EffetPerf = { type: b.type as EffetPerf['type'], pas, duree: lirePas24(b.duree, `${ci}.duree`, journal, { defaut: 4, min: 1, max: longueur - pas, nom: 'la durée' }) };
    if (e.type === 'stutter' || e.type === 'gate') {
      const x = lireNombre(b.division, `${ci}.division`, journal, { defaut: 4, min: 1, max: 16, nom: 'la division' });
      e.division = DIVISIONS_PERF.reduce((a, d) => (Math.abs(d - x) < Math.abs(a - x) ? d : a));
    }
    if (Array.isArray(b.pistes)) {
      const ids = [...new Set(b.pistes.map((r) => idsPistes.trouver(r)).filter((id): id is string => !!id && pistes.some((p) => p.id === id)))];
      if (ids.length > 0) e.pistes = ids;
      else journal.corrige(`${ci}.pistes`, 'Aucune des pistes visées n’existe : l’effet touche toutes les pistes sauf la voix.');
    }
    out.push(e);
  });
  return out;
}

function lireGamme(v: unknown, c: string, journal: Journal): AutotunePrise['gamme'] {
  if (v === undefined || v === null || v === 'morceau') return 'morceau';
  if (v === 'chromatique') return v;
  if (estObjet(v)) {
    const tonique = typeof v.tonique === 'string' ? lireTonique(v.tonique) : null;
    if (tonique) return { tonique, mode: lireChoix(v.mode, ['majeur', 'mineur'] as const, 'mineur', `${c}.mode`, journal, 'le mode') };
  }
  journal.corrige(c, `La gamme « ${apercu(v)} » est illisible : celle du morceau.`);
  return 'morceau';
}

export function normaliserAutotune(v: unknown, duree: number, c: string, journal: Journal): AutotunePrise | null {
  if (!estObjet(v)) return (journal.ignore(c, 'L’autotune devait être un objet : ignoré.'), null);
  verifierCles(v, ['gamme', 'vitesse', 'force', 'humaniser', 'formants', 'preset', 'notes'], c, journal);
  const a: AutotunePrise = {
    gamme: lireGamme(v.gamme, `${c}.gamme`, journal),
    vitesse: lireNombre(v.vitesse, `${c}.vitesse`, journal, { defaut: 20, min: 0, max: 400, nom: 'la vitesse' }),
    force: lireNombre(v.force, `${c}.force`, journal, { defaut: 1, min: 0, max: 1, nom: 'la force' }),
    humaniser: lireNombre(v.humaniser, `${c}.humaniser`, journal, { defaut: 0, min: 0, max: 1, nom: 'humaniser' }),
    formants: lireNombre(v.formants, `${c}.formants`, journal, { defaut: 0, min: -12, max: 12, nom: 'les formants' }),
    preset: lireChoix(v.preset, PRESETS_AUTOTUNE, 'perso', `${c}.preset`, journal, 'le préréglage'),
  };
  if (v.notes !== undefined && v.notes !== null) {
    const notes: NoteAutotune[] = [];
    listeBornee(v.notes, PLAFONDS.notesAutotune, `${c}.notes`, journal).forEach((b, i) => {
      const ci = `${c}.notes[${i}]`;
      if (!estObjet(b)) return journal.ignore(ci, 'Cette note n’est pas un objet : ignorée.');
      verifierCles(b, ['debut', 'fin', 'midi', 'cents', 'vibrato'], ci, journal);
      const debut = lireNombre(b.debut, `${ci}.debut`, journal, { defaut: 0, min: 0, max: duree, nom: 'le début' });
      notes.push({
        debut,
        fin: lireNombre(b.fin, `${ci}.fin`, journal, { defaut: debut, min: debut, max: duree, nom: 'la fin' }),
        midi: lireNombre(b.midi, `${ci}.midi`, journal, { defaut: 60, min: 24, max: 96, nom: 'la note', entier: true }),
        cents: lireNombre(b.cents, `${ci}.cents`, journal, { defaut: 0, min: -100, max: 100, nom: 'la justesse' }),
        vibrato: lireNombre(b.vibrato, `${ci}.vibrato`, journal, { defaut: 1, min: 0, max: 2, nom: 'le vibrato' }),
      });
    });
    notes.sort((x, y) => x.debut - y.debut);
    const gardees = notes.filter((n, i) => n.fin > n.debut && (i === 0 || n.debut >= notes[i - 1]!.fin));
    if (gardees.length !== notes.length) journal.corrige(`${c}.notes`, 'Des notes vides ou qui se chevauchent ont été retirées.');
    a.notes = gardees;
  }
  return a;
}

export function normaliserMarqueurs(v: unknown, sections: Section[], idsSections: Ids, journal: Journal): Marqueur[] {
  const ids = new Ids('marqueur');
  const out: Marqueur[] = [];
  listeBornee(v, PLAFONDS.marqueurs, 'marqueurs', journal).forEach((b, i) => {
    const c = `marqueurs[${i}]`;
    if (!estObjet(b)) return journal.ignore(c, 'Ce marqueur n’est pas un objet : ignoré.');
    verifierCles(b, ['id', 'nom', 'ancre'], c, journal);
    const ancre = estObjet(b.ancre) ? b.ancre : {};
    const section = sections.find((s) => s.id === idsSections.trouver(ancre.section));
    if (!section) return journal.ignore(`${c}.ancre`, 'Ce marqueur est ancré sur une section qui n’existe pas : ignoré.');
    out.push({
      id: ids.donner(b.id, i, `${c}.id`, journal),
      nom: lireTexte(b.nom, `Marqueur ${i + 1}`, `${c}.nom`, journal, 40),
      ancre: {
        section: section.id,
        occurrence: lireNombre(ancre.occurrence, `${c}.ancre.occurrence`, journal, { defaut: 0, min: 0, max: 99, nom: "l'apparition", entier: true }),
        mesure: lireNombre(ancre.mesure, `${c}.ancre.mesure`, journal, { defaut: 0, min: 0, max: section.mesures - 1, nom: 'la mesure', entier: true }),
      },
    });
  });
  return out;
}

export function normaliserSoundfonts(v: unknown, journal: Journal): SoundFontMorceau[] {
  const ids = new Ids('sf2');
  const out: SoundFontMorceau[] = [];
  listeBornee(v, PLAFONDS.soundfonts, 'soundfonts', journal).forEach((b, i) => {
    const c = `soundfonts[${i}]`;
    if (!estObjet(b)) return journal.ignore(c, 'Cette SoundFont n’est pas un objet : ignorée.');
    verifierCles(b, ['id', 'nom', 'fichier', 'taille', 'sha256'], c, journal);
    if (typeof b.fichier !== 'string' || !REGLE_CLE_SF2.test(b.fichier)) return journal.ignore(`${c}.fichier`, `Le fichier « ${apercu(b.fichier)} » n'est pas une SoundFont d'OCKA : ignorée.`);
    const sf: SoundFontMorceau = {
      id: ids.donner(b.id, i, `${c}.id`, journal),
      nom: lireTexte(b.nom, `SoundFont ${i + 1}`, `${c}.nom`, journal, 60),
      fichier: b.fichier,
      taille: lireNombre(b.taille, `${c}.taille`, journal, { defaut: 0, min: 0, max: PLAFONDS.tailleSoundfont, nom: 'la taille', entier: true }),
    };
    if (typeof b.sha256 === 'string' && /^[0-9a-f]{64}$/.test(b.sha256)) sf.sha256 = b.sha256;
    else if (b.sha256 !== undefined) journal.ignore(`${c}.sha256`, 'L’empreinte SHA-256 est illisible : retirée.');
    out.push(sf);
  });
  return out;
}

export function normaliserRecette(v: unknown, c: string, journal: Journal): RecetteSon | null {
  if (!estObjet(v)) return (journal.ignore(c, 'La recette devait être un objet : ignorée.'), null);
  const n = (k: string, defaut: number, min: number, max: number, entier = false) => lireNombre(v[k], `${c}.${k}`, journal, { defaut, min, max, nom: k, entier });
  if (v.type === 'kick') {
    verifierCles(v, ['type', 'hauteur', 'depart', 'chute', 'duree', 'claquement', 'saturation'], c, journal);
    return { type: 'kick', hauteur: n('hauteur', 50, 30, 150), depart: n('depart', 200, 60, 800), chute: n('chute', 0.08, 0.005, 1), duree: n('duree', 0.6, 0.05, 2), claquement: n('claquement', 0.5, 0, 1), saturation: n('saturation', 0, 0, 1) };
  }
  if (v.type === 'sfxr') {
    verifierCles(v, ['type', 'graine', 'params'], c, journal);
    const params = dictionnaire<number>();
    let k = 0;
    for (const [cle, x] of Object.entries(estObjet(v.params) ? v.params : {})) {
      if (!/^[a-z][A-Za-z0-9]{0,23}$/.test(cle) || k++ >= PLAFONDS.paramsSynthe) continue;
      params[cle] = Math.min(1, Math.max(-1, Math.round((lireNombreBrut(x) ?? 0) * 1000) / 1000));
    }
    return { type: 'sfxr', graine: n('graine', 0, 0, 2 ** 31 - 1, true), params };
  }
  journal.ignore(`${c}.type`, `Recette « ${apercu(v.type)} » inconnue (kick, sfxr) : ignorée.`);
  return null;
}

export function normaliserDecoupes(v: unknown, duree: number, c: string, journal: Journal): DecoupeSon[] {
  const out: DecoupeSon[] = [];
  listeBornee(v, PLAFONDS.decoupesParSon, c, journal).forEach((b, i) => {
    const ci = `${c}[${i}]`;
    if (!estObjet(b)) return journal.ignore(ci, 'Cette découpe n’est pas un objet : ignorée.');
    verifierCles(b, ['debut', 'fin'], ci, journal);
    const debut = lireNombre(b.debut, `${ci}.debut`, journal, { defaut: 0, min: 0, max: duree, nom: 'le début' });
    const fin = lireNombre(b.fin, `${ci}.fin`, journal, { defaut: duree, min: 0, max: duree, nom: 'la fin' });
    if (fin - debut < 0.005) return journal.ignore(ci, 'Découpe vide (moins de 5 ms) : retirée.');
    out.push({ debut, fin });
  });
  return out.sort((a, b) => a.debut - b.debut);
}

/** Pad → n° de découpe : le pad doit jouer un son qui a cette découpe. */
export function normaliserTranchesPads(v: unknown, pads: Morceau['pads'], sons: SonImporte[] | undefined, journal: Journal): Morceau['tranchesPads'] {
  if (!estObjet(v)) return (journal.ignore('tranchesPads', 'Les découpes des pads devaient être un objet : ignorées.'), undefined);
  const out: Partial<Record<PadPerso, number>> = {};
  for (const [pad, x] of Object.entries(v)) {
    const son = (PADS_PERSO as readonly string[]).includes(pad) ? sons?.find((s) => s.id === pads?.[pad as PadPerso]) : undefined;
    const n = lireNombreBrut(x);
    if (!son || n === null || !Number.isInteger(n) || n < 0 || n >= (son.tranches?.length ?? 0)) {
      journal.ignore(`tranchesPads.${apercu(pad)}`, `Le pad « ${apercu(pad)} » ne peut pas jouer cette découpe : il joue le son entier.`);
      continue;
    }
    out[pad as PadPerso] = n;
  }
  return out;
}
