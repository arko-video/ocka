// Normalisation des pistes (format /3) : les 5 pistes fixes (toujours là) et les pistes instrument (16 au plus).
// Ordre écrit : batterie, basse, accords, pistes instrument (dans leur ordre), sons, voix.
// Un id de piste instrument n'est JAMAIS un id fixe ni un nom réservé (« __proto__ ») : il est renommé, et les
// références (sections, effets de performance) suivent par `ids`. Instrument inconnu mais bien écrit : gardé, avec
// un conseil ; mal écrit : remplacé par ocka-piano@1.

import { instrumentConnu } from './acces';
import { normaliserCourbes, normaliserTranche } from './normaliser-mixage';
import {
  apercu,
  arrondir,
  borner,
  dictionnaire,
  estObjet,
  Ids,
  Journal,
  lireBooleen,
  lireChoix,
  lireNombre,
  lireNombreBrut,
  lireTexte,
  verifierCles,
  type Objet,
} from './normaliser-outils';
import { pistesParDefaut } from './styles';
import {
  IDS_FIXES,
  INSTRUMENT_DEFAUT,
  PLAFONDS,
  REGLE_INSTRUMENT,
  type EffetsVoix,
  type IdFixe,
  type Piste,
  type PisteFixe,
  type PisteInstrument,
  type ReglagesSynthe,
  type Section,
} from './types';

const CLES_TRANCHE = ['volume', 'pan', 'muet', 'solo', 'inserts', 'sidechain', 'auto', 'lfo'];
const REGLE_PARAM = /^[a-z][A-Za-z0-9]{0,23}$/;

export function normaliserEffetsVoix(v: unknown, c: string, journal: Journal): EffetsVoix | null {
  if (!estObjet(v)) {
    journal.ignore(c, 'Les effets devaient être un objet : ignorés.');
    return null;
  }
  verifierCles(v, ['reverbe', 'echo', 'radio', 'doubler', 'autotune'], c, journal);
  const e: EffetsVoix = {};
  if (v.reverbe !== undefined) e.reverbe = lireNombre(v.reverbe, `${c}.reverbe`, journal, { defaut: 0, min: 0, max: 1, nom: 'la réverbe' });
  if (v.echo !== undefined) e.echo = lireNombre(v.echo, `${c}.echo`, journal, { defaut: 0, min: 0, max: 1, nom: "l'écho" });
  if (v.radio !== undefined) e.radio = lireBooleen(v.radio, false, `${c}.radio`, journal);
  if (v.doubler !== undefined) e.doubler = lireBooleen(v.doubler, false, `${c}.doubler`, journal);
  if (v.autotune !== undefined) {
    const a = lireNombre(v.autotune, `${c}.autotune`, journal, { defaut: 0, min: 0, max: 1, nom: "l'autotune" });
    e.autotune = arrondir(Math.round(a * 10) / 10);
    if (e.autotune !== a) journal.corrige(`${c}.autotune`, `L'autotune est réglé au dixième : ${e.autotune}.`);
  }
  return e;
}

function normaliserSynthe(v: unknown, c: string, journal: Journal): ReglagesSynthe | null {
  if (!estObjet(v)) return (journal.ignore(c, 'Les réglages du synthé devaient être un objet : ignorés.'), null);
  verifierCles(v, ['params', 'onde'], c, journal);
  const s: ReglagesSynthe = {};
  if (estObjet(v.params)) {
    const params = dictionnaire<number>();
    let n = 0;
    for (const [k, x] of Object.entries(v.params)) {
      if (!REGLE_PARAM.test(k) || n >= PLAFONDS.paramsSynthe) {
        journal.ignore(`${c}.params.${apercu(k)}`, `Le réglage « ${apercu(k)} » est mal écrit ou en trop : ignoré.`);
        continue;
      }
      params[k] = lireNombre(x, `${c}.params.${k}`, journal, { defaut: 0.5, min: 0, max: 1, nom: `le réglage ${k}` });
      n++;
    }
    s.params = params;
  }
  if (Array.isArray(v.onde)) {
    const onde = v.onde.slice(0, PLAFONDS.ondeSynthe).map((x) => arrondir(borner(lireNombreBrut(x) ?? 0, -1, 1)));
    if (onde.length >= 16) s.onde = onde;
    else journal.ignore(`${c}.onde`, 'L’onde dessinée doit avoir au moins 16 valeurs : ignorée.');
  }
  return s;
}

function pisteFixe(id: IdFixe, b: Objet | undefined, d: Piste, v: unknown, journal: Journal): PisteFixe {
  const c = `pistes.${id}`;
  if (!b) {
    // Les vieux morceaux (version 1) n'ont pas « sons » : c'est normal, pas de message.
    if (v !== undefined && id !== 'sons') journal.corrige(c, `La piste ${id} manquait : ajoutée avec les réglages par défaut.`);
    return d as PisteFixe;
  }
  verifierCles(b, ['id', 'genre', 'preset', 'effets', ...CLES_TRANCHE], c, journal);
  const p: PisteFixe = { id, ...normaliserTranche(b, d.volume, false, c, journal) };
  if (id === 'voix') {
    p.preset = lireChoix(b.preset, ['naturel', 'rap', 'chant'] as const, 'naturel', `${c}.preset`, journal, 'le réglage de voix');
    if (b.effets !== undefined && b.effets !== null) {
      const e = normaliserEffetsVoix(b.effets, `${c}.effets`, journal);
      if (e) p.effets = e;
    }
  } else if (b.effets !== undefined) journal.ignore(`${c}.effets`, 'Les effets de voix ne servent que pour la voix : ignorés.');
  return p;
}

/** Un preset « sf2-<id>-<banque>-<preset>@1 » d'une SoundFont de CE morceau : connu (son fichier est lu à la lecture). */
const presetDuMorceau = (instrument: string, soundfonts: ReadonlySet<string>) => {
  const r = /^sf2-([A-Za-z0-9_-]{1,40})-\d{1,3}-\d{1,3}@1$/.exec(instrument);
  return !!r && soundfonts.has(r[1]!);
};

function pisteInstrument(b: Objet, i: number, n: number, ids: Ids, journal: Journal, soundfonts: ReadonlySet<string>): PisteInstrument {
  const c = `pistes[${i}]`;
  verifierCles(b, ['id', 'genre', 'nom', 'instrument', 'synthe', 'swing', ...CLES_TRANCHE], c, journal);
  const id = ids.donner(b.id, n, `${c}.id`, journal);
  let instrument = typeof b.instrument === 'string' ? b.instrument.trim() : '';
  if (!REGLE_INSTRUMENT.test(instrument)) {
    journal.corrige(`${c}.instrument`, `L'instrument « ${apercu(b.instrument)} » est mal écrit : remplacé par le piano (${INSTRUMENT_DEFAUT}).`);
    instrument = INSTRUMENT_DEFAUT;
  } else if (!instrumentConnu(instrument) && !presetDuMorceau(instrument, soundfonts)) {
    journal.conseil(`${c}.instrument`, `L'instrument « ${instrument} » n'est pas encore disponible ici : la piste reste muette (mets OCKA à jour ou télécharge l'instrument).`);
  }
  const nom = lireTexte(b.nom, `Piste ${n + 1}`, `${c}.nom`, journal, 40).trim() || `Piste ${n + 1}`;
  const p: PisteInstrument = { id, genre: 'instrument', nom, instrument, ...normaliserTranche(b, 0.8, true, c, journal) };
  if (b.synthe !== undefined && b.synthe !== null) {
    const s = normaliserSynthe(b.synthe, `${c}.synthe`, journal);
    if (s) p.synthe = s;
  }
  if (b.swing !== undefined && b.swing !== null) p.swing = lireNombre(b.swing, `${c}.swing`, journal, { defaut: 0, min: 0, max: 0.6, nom: 'le swing de la piste' });
  return p;
}

export interface PistesLues {
  pistes: Piste[];
  /** Id écrit dans le fichier → id de piste (les ids fixes se trouvent eux-mêmes). */
  ids: Ids;
  /** Courbes brutes de chaque piste (lues après les sections par finirPistes). */
  courbes: Map<Piste, unknown>;
}

/** Les pistes (sans leurs courbes d'automation, ajoutées par finirPistes une fois les sections lues). */
export function normaliserPistes(v: unknown, journal: Journal, soundfonts: ReadonlySet<string> = new Set()): PistesLues {
  if (v !== undefined && !Array.isArray(v)) journal.corrige('pistes', 'Les pistes devaient être une liste : réglages par défaut.');
  const brutes = Array.isArray(v) ? v : [];
  const ids = new Ids('piste').reserver(IDS_FIXES);
  const courbes = new Map<Piste, unknown>();
  const defauts = new Map(pistesParDefaut().map((p) => [p.id, p]));
  const fixes = new Map<IdFixe, Objet>();
  const instruments: PisteInstrument[] = [];
  brutes.forEach((b, i) => {
    if (!estObjet(b)) return journal.ignore(`pistes[${i}]`, 'Cette piste n’est pas un objet : ignorée.');
    const fixe = b.genre !== 'instrument' && typeof b.id === 'string' && (IDS_FIXES as readonly string[]).includes(b.id) ? (b.id as IdFixe) : null;
    if (fixe) {
      if (fixes.has(fixe)) journal.ignore(`pistes[${i}]`, `La piste ${fixe} est en double : la seconde est ignorée.`);
      else fixes.set(fixe, b);
    } else if (b.genre === 'instrument') {
      if (instruments.length >= PLAFONDS.pistesInstrument) return journal.corrige(`pistes[${i}]`, `${PLAFONDS.pistesInstrument} pistes instrument au plus : celle-ci est retirée.`);
      const p = pisteInstrument(b, i, instruments.length, ids, journal, soundfonts);
      instruments.push(p);
      if (b.auto !== undefined && b.auto !== null) courbes.set(p, b.auto);
    } else journal.ignore(`pistes[${i}]`, `La piste « ${apercu(b.id)} » est inconnue (ni fixe, ni instrument) : ignorée.`);
  });
  const fixe = (id: IdFixe) => {
    const b = fixes.get(id);
    const p = pisteFixe(id, b, defauts.get(id)!, v, journal);
    if (b && b.auto !== undefined && b.auto !== null) courbes.set(p, b.auto);
    return p;
  };
  const debut = (['batterie', 'basse', 'accords'] as const).map(fixe);
  const fin = (['sons', 'voix'] as const).map(fixe);
  return { pistes: [...debut, ...instruments, ...fin], ids, courbes };
}

/** Ajoute les courbes d'automation (elles visent des sections, normalisées entre-temps). */
export function finirPistes(lues: PistesLues, sections: Section[], idsSections: Ids, journal: Journal): void {
  for (const [p, brut] of lues.courbes) {
    const auto = normaliserCourbes(brut, p, p.genre === 'instrument', sections, idsSections, `pistes.${p.id}.auto`, journal);
    if (auto.length > 0) p.auto = auto;
  }
}
