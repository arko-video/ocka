// Export du morceau en .mid de type 1 (P) : une piste MIDI par piste OCKA, avec son nom. Batterie (canal 10, notes
// GM, roulements, fill et coupures comme à l'écoute), 808 et accords (notes calculées par le planning, sans swing),
// puis les pistes instrument (programme GM proche). 96 ticks par noire : 1 pas = 24 ticks = la grille du 1/24.
// Le swing n'est pas écrit (les logiciels de musique ont le leur) : les notes sont droites. Pur.

import { fillStyle } from '../morceau/styles/index';
import { motifBatterieDe, motifNotesDe, pistesInstrument } from '../morceau/acces';
import { arrangement, dureePas } from '../morceau/temps';
import { INSTRUMENTS_BATTERIE, type Morceau } from '../morceau/types';
import { calculerPlanning } from '../moteur/planning';
import { CANAL_BATTERIE, NOTE_PAD, programmeDe } from './gm';
import { ecrireSmf, type NoteEcrite, type PisteEcrite } from './smf-ecriture';

export const TICKS_PAR_NOIRE = 96;
export const TICKS_PAR_PAS = TICKS_PAR_NOIRE / 4;

const tick = (pas: number) => Math.round(pas * TICKS_PAR_PAS);
const vel127 = (v: number) => Math.min(127, Math.max(1, Math.round(v * 127)));
/** Longueur d'une frappe de batterie : une triple-croche. */
const FRAPPE = TICKS_PAR_PAS / 2;

function notesBatterie(m: Morceau): NoteEcrite[] {
  const notes: NoteEcrite[] = [];
  const frappe = (pas: number, inst: (typeof INSTRUMENTS_BATTERIE)[number], vel: number, roul: number) => {
    const n = roul >= 2 ? roul : 1;
    for (let k = 0; k < n; k++) {
      const debut = tick(pas + k / n);
      // Frappes suivantes d'un roulement : 80 % de la 1re, calculé sur l'entier MIDI (relu à l'identique).
      const v = vel127(vel);
      notes.push({ debut, fin: debut + Math.max(1, Math.round(FRAPPE / n)), midi: NOTE_PAD[inst], vel: k === 0 ? v : Math.max(1, Math.round(v * 0.8)) });
    }
  };
  for (const o of arrangement(m)) {
    const motif = motifBatterieDe(m, o.section) ?? (o.section.fill ? { type: 'batterie' as const, pas: 16, pistes: {} } : null);
    if (!motif || motif.pas <= 0) continue;
    const derniere = (o.section.mesures - 1) * 16;
    const coupure = o.section.coupure ?? 'aucune';
    for (let p = 0; p < o.pas; p++) {
      if (coupure === 'break' && p >= derniere) break;
      if (coupure === 'drop' && p < 16) continue;
      const enFill = o.section.fill === true && p >= derniere + 8;
      const i = p % motif.pas;
      for (const inst of INSTRUMENTS_BATTERIE) {
        if (enFill && (inst === 'snare' || inst === 'clap')) continue;
        const v = motif.pistes[inst]?.[i] ?? 0;
        if (v > 0) frappe(o.debutPas + p, inst, v, motif.roulements?.[inst]?.[i] ?? 0);
      }
      if (enFill) for (const f of fillStyle(m.style)) if (f.pas === p - derniere) frappe(o.debutPas + p, 'snare', f.vel, f.roul);
    }
  }
  return notes;
}

/** 808 et accords : les notes que le planning joue (morceau sans swing), remises en ticks. */
function notesFixes(m: Morceau): { basse: NoteEcrite[]; accords: NoteEcrite[] } {
  const d = dureePas(m.tempo);
  const enTick = (t: number) => Math.round((t / d) * TICKS_PAR_PAS);
  const basse: NoteEcrite[] = [];
  const accords: NoteEcrite[] = [];
  for (const e of calculerPlanning({ ...m, swing: 0 })) {
    if (e.type === 'basse') basse.push({ debut: enTick(e.t), fin: enTick(e.t + e.duree), midi: e.midi, vel: vel127(e.vel) });
    else if (e.type === 'accord')
      for (const midi of e.notes) accords.push({ debut: enTick(e.t), fin: enTick(e.t + e.duree), midi, vel: vel127(e.vel) });
  }
  return { basse, accords };
}

/** Les notes d'une piste instrument sur tout l'arrangement (le motif boucle, coupé à la fin de la section). */
export function notesPisteInstrument(m: Morceau, piste: string): NoteEcrite[] {
  const notes: NoteEcrite[] = [];
  for (const o of arrangement(m)) {
    const motif = motifNotesDe(m, o.section, piste);
    if (!motif || motif.pas <= 0) continue;
    for (let cycle = 0; cycle * motif.pas < o.pas; cycle++) {
      for (const n of motif.notes) {
        const debut = cycle * motif.pas + n.pas;
        if (debut >= o.pas) break;
        const fin = Math.min(debut + Math.max(1 / 24, n.duree), cycle * motif.pas + motif.pas, o.pas);
        notes.push({ debut: tick(o.debutPas + debut), fin: tick(o.debutPas + fin), midi: n.midi, vel: vel127(n.vel) });
      }
    }
  }
  return notes;
}

/** Les pistes MIDI du morceau (pistes muettes comprises ; pistes vides retirées). */
export function pistesMidi(m: Morceau): PisteEcrite[] {
  const nomFixe = (id: string, secours: string) => {
    const p = m.pistes.find((x) => x.id === id);
    return p && 'nom' in p && typeof p.nom === 'string' ? p.nom : secours;
  };
  const fixes = notesFixes(m);
  const pistes: PisteEcrite[] = [
    { nom: nomFixe('batterie', 'Batterie'), canal: CANAL_BATTERIE, notes: notesBatterie(m) },
    { nom: nomFixe('basse', '808'), canal: 0, programme: 38, notes: fixes.basse },
    { nom: nomFixe('accords', 'Accords'), canal: 1, programme: 4, notes: fixes.accords },
  ];
  // Canaux des pistes instrument : 3 à 16 sans le 10 (batterie), puis on recommence (16 pistes au plus).
  const canaux = [2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
  pistesInstrument(m).forEach((p, k) => {
    pistes.push({ nom: p.nom, canal: canaux[k % canaux.length]!, programme: programmeDe(p.instrument), notes: notesPisteInstrument(m, p.id) });
  });
  return pistes.filter((p) => p.notes.length > 0);
}

export function exporterMidi(m: Morceau): Uint8Array {
  return ecrireSmf(pistesMidi(m), { division: TICKS_PAR_NOIRE, tempo: m.tempo, format: 1 });
}
