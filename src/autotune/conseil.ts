// « Corriger tout seul » (sans IA, sans réseau) et l'application d'un conseil (règles ou IA) à une prise.
// Règles :
//  1. Gamme : celle du morceau, sauf si la voix chante nettement dans une autre (Krumhansl : la meilleure gamme
//     dépasse celle du morceau de 0,15 de corrélation au moins).
//  2. Chaque note d'au moins 100 ms est visée sur la note de la gamme la plus proche ; une note hors gamme chantée
//     juste (à 15 cents près) est voulue : on la garde. Les notes plus courtes (ornements, glissés) sont laissées
//     telles qu'elles sont chantées.
//  3. Préréglage : selon le style du morceau s'il est connu (presetDuStyle) ; sinon selon le chant (notes longues
//     avec du vibrato → Naturel ; sinon Pop).
// Fonctions pures.

import { PLAFONDS, type AutotunePrise, type Morceau, type NoteAutotune, type PresetAutotune, type Style } from '../morceau/types';
import type { AnalyseNotes, ConseilAutotune, PresetFixe } from './api-autotune';
import { detecterGamme, scoresTonalites } from './detection-gamme';
import { gamme, noteProche } from './gamme';
import { classesGamme, nomGamme, presetDuStyle, reglagesPreset } from './reglages';

const NOTE_COURTE_S = 0.1;
const HORS_GAMME_VOULUE = 15;
const ECART_GAMME = 0.15;
const PRESETS_FIXES: readonly PresetFixe[] = ['naturel', 'pop', 'robot', 'hyperpop'];

/** Vibrato gardé sur les notes visées, selon le préréglage. */
const VIBRATO: Record<PresetFixe, number> = { naturel: 1, pop: 0.7, robot: 0, hyperpop: 0 };

/** Préréglage d'après le chant : notes longues et vibrées → Naturel, sinon Pop. */
function presetDuChant(a: AnalyseNotes): PresetFixe {
  const longues = a.notes.filter((n) => n.fin - n.debut >= 0.3);
  if (longues.length < 3) return 'pop';
  const vib = longues.filter((n) => n.vibrato >= 20 && n.vitesseVibrato > 0).length / longues.length;
  return vib >= 0.5 ? 'naturel' : 'pop';
}

export function corrigerToutSeul(analyse: AnalyseNotes, tonalite: Morceau['tonalite'], style?: Style): ConseilAutotune {
  // 1. Gamme.
  let g: AutotunePrise['gamme'] = 'morceau';
  const scores = scoresTonalites(analyse.notes);
  const meilleure = detecterGamme(analyse.notes, tonalite)[0];
  if (meilleure && tonalite) {
    const duMorceau = scores.find((s) => s.tonique === tonalite.tonique && s.mode === tonalite.mode)?.r ?? 0;
    const autre = gamme(meilleure).join(',') !== gamme(tonalite).join(',');
    if (autre && meilleure.confiance - duMorceau >= ECART_GAMME) g = { tonique: meilleure.tonique, mode: meilleure.mode };
  } else if (meilleure && !tonalite) g = { tonique: meilleure.tonique, mode: meilleure.mode };
  const classes = classesGamme(g, tonalite);
  // 3. Préréglage.
  const preset = style ? presetDuStyle(style) : presetDuChant(analyse);
  // 2. Notes.
  let recalees = 0;
  let courtes = 0;
  const corrections: NoteAutotune[] = [];
  for (const n of analyse.notes.slice(0, PLAFONDS.notesAutotune)) {
    const chante = n.midi * 100 + n.justesse;
    if (n.fin - n.debut < NOTE_COURTE_S) {
      courtes++;
      corrections.push({ debut: n.debut, fin: n.fin, midi: n.midi, cents: Math.round(n.justesse), vibrato: 1 });
      continue;
    }
    const voulue = !classes.includes(((n.midi % 12) + 12) % 12) && Math.abs(n.justesse) <= HORS_GAMME_VOULUE;
    const vise = voulue ? n.midi * 100 : noteProche(chante, classes);
    if (Math.abs(vise - chante) >= 10) recalees++;
    corrections.push({ debut: n.debut, fin: n.fin, midi: Math.min(96, Math.max(24, Math.round(vise / 100))), cents: 0, vibrato: VIBRATO[preset] });
  }
  const ou = typeof g === 'object' ? ` en ${nomGamme(g)}` : '';
  const explication = `${recalees} note${recalees > 1 ? 's' : ''} recalée${recalees > 1 ? 's' : ''}${ou}, ${courtes} trop courte${courtes > 1 ? 's' : ''} laissée${courtes > 1 ? 's' : ''} telle${courtes > 1 ? 's' : ''} quelle${courtes > 1 ? 's' : ''}.`;
  return { gamme: g, corrections, preset, explication };
}

const borne = (v: unknown, min: number, max: number, defaut: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : defaut);

/** Notes sûres pour Prise.autotune.notes : bornées à la prise, triées, sans chevauchement, 1024 au plus. */
export function nettoyerNotes(notes: readonly NoteAutotune[], duree: number): NoteAutotune[] {
  const propres = notes
    .filter((n) => n && typeof n === 'object')
    .map((n) => {
      const debut = borne(n.debut, 0, duree, 0);
      return {
        debut,
        fin: borne(n.fin, debut, duree, debut),
        midi: Math.round(borne(n.midi, 24, 96, 60)),
        cents: borne(n.cents, -100, 100, 0),
        vibrato: borne(n.vibrato, 0, 2, 1),
      };
    })
    .sort((a, b) => a.debut - b.debut);
  const out: NoteAutotune[] = [];
  for (const n of propres) {
    if (n.fin <= n.debut || (out.length && n.debut < out[out.length - 1]!.fin)) continue;
    out.push(n);
    if (out.length >= PLAFONDS.notesAutotune) break;
  }
  return out;
}

/** Applique un conseil à la prise `idPrise` (un seul `modifier` côté interface = un seul Annuler). */
export function appliquerConseil(m: Morceau, idPrise: string, conseil: ConseilAutotune): Morceau {
  const prise = m.prises.find((p) => p.id === idPrise);
  if (!prise) return m;
  const fixe = PRESETS_FIXES.includes(conseil.preset as PresetFixe);
  const base: AutotunePrise = fixe ? reglagesPreset(conseil.preset as PresetFixe) : { ...(prise.autotune ?? reglagesPreset('pop')), preset: 'perso' as PresetAutotune };
  const notes = nettoyerNotes(conseil.corrections ?? [], prise.duree);
  const autotune: AutotunePrise = { ...base, gamme: conseil.gamme ?? 'morceau' };
  delete autotune.notes;
  if (notes.length) autotune.notes = notes;
  return { ...m, prises: m.prises.map((p) => (p.id === idPrise ? { ...p, autotune } : p)) };
}
