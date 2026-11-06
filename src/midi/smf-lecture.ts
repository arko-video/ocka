// Lecteur de fichiers MIDI standard (SMF, types 0, 1 et 2), écrit à la main. Le fichier vient d'ailleurs : il n'est
// PAS fiable. Tailles plafonnées (fichier, pistes, évènements), longueurs vérifiées avant chaque lecture, nombres à
// longueur variable de 4 octets au plus, statut courant sans statut d'avant refusé : toute faute → ErreurOcka
// « midi_illisible » (jamais une exception JS, jamais une boucle sans fin). Ne garde que ce qui sert à OCKA.

import { ErreurOcka } from '../moteur/erreur';

export const PLAFONDS_MIDI = {
  /** Taille d'un fichier .mid (octets). */
  taille: 4 * 1024 * 1024,
  /** Blocs « MTrk ». */
  pistes: 256,
  /** Évènements lus en tout. */
  evenements: 1_000_000,
  /** Notes gardées en tout. */
  notes: 100_000,
} as const;

export interface NoteSmf {
  /** Piste du fichier (bloc MTrk), canal 0 à 15. */
  piste: number;
  canal: number;
  midi: number;
  /** Vélocité 1 à 127. */
  vel: number;
  debut: number;
  /** Fin (ticks) ; une note jamais relâchée finit à la fin de sa piste. */
  fin: number;
}

export interface Smf {
  format: number;
  /** Ticks par noire. */
  division: number;
  notes: NoteSmf[];
  /** Changements de tempo (µs par noire), dans l'ordre. */
  tempos: { tick: number; usParNoire: number }[];
  /** Chiffrages de mesure. */
  mesures: { tick: number; num: number; den: number }[];
  /** Nom de chaque piste (meta 0x03), '' sinon. */
  noms: string[];
  /** Premier programme de chaque canal par piste : clé `${piste}:${canal}`. */
  programmes: Map<string, number>;
  /** Tick de la dernière fin de note ou de piste. */
  fin: number;
}

const illisible = (pourquoi: string) => new ErreurOcka(`Fichier MIDI illisible : ${pourquoi}.`, 'midi_illisible');

class Curseur {
  constructor(
    private o: Uint8Array,
    public i: number,
    private fin: number,
  ) {}
  get reste() {
    return this.fin - this.i;
  }
  octet(): number {
    if (this.i >= this.fin) throw illisible('piste coupée');
    return this.o[this.i++]!;
  }
  vlq(): number {
    let v = 0;
    for (let k = 0; k < 4; k++) {
      const b = this.octet();
      v = v * 128 + (b & 0x7f);
      if ((b & 0x80) === 0) return v;
    }
    throw illisible('nombre trop long');
  }
  octets(n: number): Uint8Array {
    if (n < 0 || n > this.reste) throw illisible('longueur impossible');
    const r = this.o.subarray(this.i, this.i + n);
    this.i += n;
    return r;
  }
}

const u32 = (o: Uint8Array, i: number) => ((o[i]! << 24) >>> 0) + (o[i + 1]! << 16) + (o[i + 2]! << 8) + o[i + 3]!;
const u16 = (o: Uint8Array, i: number) => (o[i]! << 8) + o[i + 1]!;
const etiquette = (o: Uint8Array, i: number) => String.fromCharCode(o[i]!, o[i + 1]!, o[i + 2]!, o[i + 3]!);

/** Texte d'une meta (latin-1 lisible), 40 caractères au plus, sans caractères de contrôle. */
function texte(o: Uint8Array): string {
  let s = '';
  for (const b of o.subarray(0, 80)) s += b >= 32 && b !== 127 ? String.fromCharCode(b) : ' ';
  return s.replace(/\s+/g, ' ').trim().slice(0, 40);
}

export function lireSmf(octets: Uint8Array): Smf {
  if (!(octets instanceof Uint8Array)) throw illisible('ce n’est pas un fichier');
  if (octets.length > PLAFONDS_MIDI.taille) throw illisible('fichier trop gros (4 Mo au plus)');
  if (octets.length < 14 || etiquette(octets, 0) !== 'MThd') throw illisible('ce n’est pas un fichier .mid');
  const lh = u32(octets, 4);
  if (lh < 6 || 8 + lh > octets.length) throw illisible('en-tête abîmé');
  const format = u16(octets, 8);
  const division = u16(octets, 12);
  if (format > 2) throw illisible('format inconnu');
  if (division & 0x8000) throw illisible('temps SMPTE non pris en charge');
  if (division === 0) throw illisible('résolution nulle');
  const smf: Smf = { format, division, notes: [], tempos: [], mesures: [], noms: [], programmes: new Map(), fin: 0 };
  let i = 8 + lh;
  let nPistes = 0;
  const compte = { evenements: 0 };
  while (i + 8 <= octets.length) {
    const id = etiquette(octets, i);
    const longueur = u32(octets, i + 4);
    const debut = i + 8;
    if (longueur > octets.length - debut) throw illisible('bloc plus long que le fichier');
    if (id === 'MTrk') {
      if (++nPistes > PLAFONDS_MIDI.pistes) throw illisible('trop de pistes');
      lirePiste(new Curseur(octets, debut, debut + longueur), nPistes - 1, smf, compte);
    }
    i = debut + longueur;
  }
  if (nPistes === 0) throw illisible('aucune piste');
  smf.tempos.sort((a, b) => a.tick - b.tick);
  return smf;
}

function lirePiste(c: Curseur, piste: number, smf: Smf, compte: { evenements: number }) {
  let tick = 0;
  let statut = 0;
  const ouvertes = new Map<number, NoteSmf[]>();
  smf.noms[piste] = '';
  const fermer = (canal: number, midi: number, t: number) => {
    const pile = ouvertes.get(canal * 128 + midi);
    const n = pile?.shift();
    if (n) n.fin = Math.max(t, n.debut);
  };
  // Les notes jamais relâchées finissent à la fin de la piste (≥ leur début) : smf.fin les couvre toutes.
  while (c.reste > 0) {
    if (++compte.evenements > PLAFONDS_MIDI.evenements) throw illisible('trop d’évènements');
    tick += c.vlq();
    if (tick > 2 ** 40) throw illisible('temps démesuré');
    let b = c.octet();
    if (b < 0x80) {
      if (statut === 0) throw illisible('évènement sans statut');
      c.i--; // statut courant : l'octet lu est la 1re donnée
      b = statut;
    }
    if (b === 0xff) {
      const type = c.octet();
      const donnees = c.octets(c.vlq());
      if (type === 0x2f) break;
      if (type === 0x51 && donnees.length === 3) {
        const us = (donnees[0]! << 16) | (donnees[1]! << 8) | donnees[2]!;
        if (us > 0) smf.tempos.push({ tick, usParNoire: us });
      } else if (type === 0x58 && donnees.length >= 2) {
        smf.mesures.push({ tick, num: donnees[0]!, den: 2 ** Math.min(donnees[1]!, 6) });
      } else if (type === 0x03 && !smf.noms[piste]) smf.noms[piste] = texte(donnees);
      statut = 0;
      continue;
    }
    if (b === 0xf0 || b === 0xf7) {
      c.octets(c.vlq()); // sysex : sauté
      statut = 0;
      continue;
    }
    if (b >= 0xf1) throw illisible('évènement système inattendu');
    statut = b;
    const type = b & 0xf0;
    const canal = b & 0x0f;
    const d1 = c.octet() & 0x7f;
    const d2 = type === 0xc0 || type === 0xd0 ? 0 : c.octet() & 0x7f;
    if (type === 0x90 && d2 > 0) {
      if (smf.notes.length >= PLAFONDS_MIDI.notes) throw illisible('trop de notes');
      const n: NoteSmf = { piste, canal, midi: d1, vel: d2, debut: tick, fin: -1 };
      smf.notes.push(n);
      const cle = canal * 128 + d1;
      const pile = ouvertes.get(cle);
      if (pile) pile.push(n);
      else ouvertes.set(cle, [n]);
    } else if (type === 0x80 || type === 0x90) fermer(canal, d1, tick);
    else if (type === 0xc0) {
      const cle = `${piste}:${canal}`;
      if (!smf.programmes.has(cle)) smf.programmes.set(cle, d1);
    }
  }
  for (const pile of ouvertes.values()) for (const n of pile) n.fin = Math.max(tick, n.debut);
  smf.fin = Math.max(smf.fin, tick);
}
