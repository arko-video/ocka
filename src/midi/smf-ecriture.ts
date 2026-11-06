// Écrivain de fichiers MIDI standard (SMF type 0 ou 1), écrit à la main. Une piste MIDI par piste donnée, avec son
// nom (meta 0x03), son canal et son programme ; la 1re piste porte le tempo et la mesure (4/4). Notes en ticks.

export interface NoteEcrite {
  debut: number;
  fin: number;
  midi: number;
  /** Vélocité 1 à 127. */
  vel: number;
}

export interface PisteEcrite {
  nom: string;
  canal: number;
  /** Programme General MIDI (0 à 127) ; absent pour la batterie. */
  programme?: number;
  notes: NoteEcrite[];
}

export interface OptionsSmf {
  /** Ticks par noire. */
  division: number;
  /** Battements par minute. */
  tempo: number;
  /** 0 : tout dans une seule piste ; 1 (défaut) : une piste de tempo puis une piste par PisteEcrite. */
  format?: 0 | 1;
}

class Octets {
  private t: number[] = [];
  push(...b: number[]) {
    for (const x of b) this.t.push(x & 0xff);
  }
  vlq(v: number) {
    let x = Math.max(0, Math.floor(v));
    const pile = [x & 0x7f];
    while ((x = Math.floor(x / 128)) > 0) pile.unshift((x & 0x7f) | 0x80);
    this.push(...pile);
  }
  texte(s: string) {
    // ASCII seulement (les accents deviennent des lettres simples) : lu partout.
    const a = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?').slice(0, 40);
    this.vlq(a.length);
    for (let i = 0; i < a.length; i++) this.push(a.charCodeAt(i));
  }
  get liste() {
    return this.t;
  }
}

interface Ev {
  tick: number;
  /** Ordre au même tick : fins avant débuts, réglages avant tout. */
  rang: number;
  octets: number[];
}

function bloc(type: string, corps: number[]): number[] {
  const n = corps.length;
  return [...[...type].map((c) => c.charCodeAt(0)), (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff, ...corps];
}

function corpsPiste(evs: Ev[], nom: string | null, metaTempo: number[] | null): number[] {
  const o = new Octets();
  if (nom !== null) {
    o.push(0, 0xff, 0x03);
    o.texte(nom);
  }
  if (metaTempo) o.push(...metaTempo);
  evs.sort((a, b) => a.tick - b.tick || a.rang - b.rang);
  let avant = 0;
  for (const e of evs) {
    o.vlq(e.tick - avant);
    avant = e.tick;
    o.push(...e.octets);
  }
  o.push(0, 0xff, 0x2f, 0);
  return o.liste;
}

function evenements(p: PisteEcrite): Ev[] {
  const c = p.canal & 0x0f;
  const evs: Ev[] = [];
  if (p.programme !== undefined) evs.push({ tick: 0, rang: 0, octets: [0xc0 | c, p.programme & 0x7f] });
  for (const n of p.notes) {
    const vel = Math.min(127, Math.max(1, Math.round(n.vel)));
    evs.push({ tick: n.debut, rang: 2, octets: [0x90 | c, n.midi & 0x7f, vel] });
    evs.push({ tick: Math.max(n.fin, n.debut + 1), rang: 1, octets: [0x80 | c, n.midi & 0x7f, 0] });
  }
  return evs;
}

/** Fichier .mid (octets) des pistes données. */
export function ecrireSmf(pistes: readonly PisteEcrite[], o: OptionsSmf): Uint8Array {
  const division = Math.min(0x7fff, Math.max(24, Math.round(o.division)));
  const us = Math.round(60_000_000 / Math.max(1, o.tempo));
  // Tempo (FF 51) et mesure 4/4 (FF 58 : 4, 2 = noire, 24 clocks, 8 triples-croches).
  const meta = [0, 0xff, 0x51, 3, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff, 0, 0xff, 0x58, 4, 4, 2, 24, 8];
  const morceaux: number[][] = [];
  if (o.format === 0) {
    const tous = pistes.flatMap(evenements);
    morceaux.push(bloc('MTrk', corpsPiste(tous, pistes[0]?.nom ?? 'OCKA', meta)));
  } else {
    morceaux.push(bloc('MTrk', corpsPiste([], 'OCKA', meta)));
    for (const p of pistes) morceaux.push(bloc('MTrk', corpsPiste(evenements(p), p.nom, null)));
  }
  const n = morceaux.length;
  const entete = bloc('MThd', [0, o.format === 0 ? 0 : 1, (n >> 8) & 0xff, n & 0xff, (division >> 8) & 0xff, division & 0xff]);
  const total = entete.length + morceaux.reduce((s, x) => s + x.length, 0);
  const sortie = new Uint8Array(total);
  let i = 0;
  for (const x of [entete, ...morceaux]) {
    sortie.set(x, i);
    i += x.length;
  }
  return sortie;
}
