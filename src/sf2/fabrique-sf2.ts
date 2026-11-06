// Fabrique de petits .sf2 (tests Vitest et e2e de S) : échantillons 16 bits, instruments et presets décrits par leurs
// générateurs. `pieger` permet de casser un champ précis après coup (fichiers hostiles fabriqués dans les tests).

export interface SampleFab {
  nom: string;
  pcm: Int16Array;
  frequence: number;
  racine: number;
  correction?: number;
  boucle?: [number, number];
  type?: number;
  lien?: number;
}
/** Générateurs d'une zone : [numéro, valeur brute 16 bits]. */
export type GensFab = [number, number][];
export interface SoundFontFab {
  nom?: string;
  version?: number;
  samples: SampleFab[];
  instruments: { nom: string; zones: GensFab[] }[];
  presets: { nom: string; preset: number; banque: number; zones: GensFab[] }[];
}

/** Valeur d'une plage (lo, hi) de générateur. */
export const plageGen = (lo: number, hi: number) => (hi << 8) | lo;
/** Valeur 16 bits d'un entier signé. */
export const signe16 = (x: number) => x & 0xffff;

class Tampon {
  octets: number[] = [];
  u8(x: number) {
    this.octets.push(x & 0xff);
  }
  u16(x: number) {
    this.u8(x);
    this.u8(x >> 8);
  }
  u32(x: number) {
    this.u16(x & 0xffff);
    this.u16((x >>> 16) & 0xffff);
  }
  texte(s: string, n: number) {
    for (let i = 0; i < n; i++) this.u8(i < s.length ? s.charCodeAt(i) : 0);
  }
}

function bloc(id: string, donnees: number[]): number[] {
  const t = new Tampon();
  t.texte(id, 4);
  t.u32(donnees.length);
  const out = t.octets.concat(donnees);
  if (donnees.length & 1) out.push(0);
  return out;
}
const liste = (type: string, contenu: number[]) => bloc('LIST', [...[...type].map((c) => c.charCodeAt(0)), ...contenu]);

/** Les octets d'un .sf2. */
export function fabriquerSf2(sf: SoundFontFab): Uint8Array<ArrayBuffer> {
  // smpl : chaque échantillon suivi de 46 zéros (règle du format).
  const smpl = new Tampon();
  const positions: number[] = [];
  let pos = 0;
  for (const s of sf.samples) {
    positions.push(pos);
    for (const v of s.pcm) smpl.u16(v);
    for (let i = 0; i < 46; i++) smpl.u16(0);
    pos += s.pcm.length + 46;
  }
  const info = new Tampon();
  const ifil = new Tampon();
  ifil.u16(sf.version ?? 2);
  ifil.u16(1);
  info.octets = [...bloc('ifil', ifil.octets), ...bloc('INAM', [...(sf.nom ?? 'Test') + '\0'].map((c) => c.charCodeAt(0)))];

  const phdr = new Tampon();
  const pbag = new Tampon();
  const pgen = new Tampon();
  let nbag = 0;
  let ngen = 0;
  for (const p of [...sf.presets, { nom: 'EOP', preset: 0, banque: 0, zones: [] }]) {
    phdr.texte(p.nom, 20);
    phdr.u16(p.preset);
    phdr.u16(p.banque);
    phdr.u16(nbag);
    phdr.u32(0);
    phdr.u32(0);
    phdr.u32(0);
    for (const z of p.zones) {
      pbag.u16(ngen);
      pbag.u16(0);
      nbag++;
      for (const [o, v] of z) (pgen.u16(o), pgen.u16(v), ngen++);
    }
  }
  pbag.u16(ngen);
  pbag.u16(0);
  pgen.u32(0);
  const inst = new Tampon();
  const ibag = new Tampon();
  const igen = new Tampon();
  nbag = 0;
  ngen = 0;
  for (const i of [...sf.instruments, { nom: 'EOI', zones: [] }]) {
    inst.texte(i.nom, 20);
    inst.u16(nbag);
    for (const z of i.zones) {
      ibag.u16(ngen);
      ibag.u16(0);
      nbag++;
      for (const [o, v] of z) (igen.u16(o), igen.u16(v), ngen++);
    }
  }
  ibag.u16(ngen);
  ibag.u16(0);
  igen.u32(0);
  const shdr = new Tampon();
  sf.samples.forEach((s, k) => {
    const d = positions[k]!;
    shdr.texte(s.nom, 20);
    shdr.u32(d);
    shdr.u32(d + s.pcm.length);
    shdr.u32(d + (s.boucle?.[0] ?? 0));
    shdr.u32(d + (s.boucle?.[1] ?? 0));
    shdr.u32(s.frequence);
    shdr.u8(s.racine);
    shdr.u8(s.correction ?? 0);
    shdr.u16(s.lien ?? 0);
    shdr.u16(s.type ?? 1);
  });
  shdr.texte('EOS', 46);
  const pdta = [
    ...bloc('phdr', phdr.octets),
    ...bloc('pbag', pbag.octets),
    ...bloc('pmod', new Array(10).fill(0)),
    ...bloc('pgen', pgen.octets),
    ...bloc('inst', inst.octets),
    ...bloc('ibag', ibag.octets),
    ...bloc('imod', new Array(10).fill(0)),
    ...bloc('igen', igen.octets),
    ...bloc('shdr', shdr.octets),
  ];
  const corps = [...[...'sfbk'].map((c) => c.charCodeAt(0)), ...liste('INFO', info.octets), ...liste('sdta', bloc('smpl', smpl.octets)), ...liste('pdta', pdta)];
  return new Uint8Array(bloc('RIFF', corps));
}

/** Position (octets) d'un bloc dans un .sf2 fabriqué (pour le piéger). */
export function positionBloc(o: Uint8Array, id: string): number {
  for (let i = 0; i + 4 <= o.length; i++) if (String.fromCharCode(o[i]!, o[i + 1]!, o[i + 2]!, o[i + 3]!) === id) return i;
  return -1;
}

/** Un sinus 16 bits de `f` Hz, `n` échantillons (période entière conseillée pour une boucle propre). */
export function sinus16(f: number, frequence: number, n: number, amplitude = 0.5): Int16Array {
  return Int16Array.from({ length: n }, (_, i) => Math.round(32767 * amplitude * Math.sin((2 * Math.PI * f * i) / frequence)));
}

/** Le petit .sf2 valide des tests : 1 preset, 2 zones (graves : boucle ; aigus : sans boucle), accords fins. */
export function sf2DeTest(): Uint8Array<ArrayBuffer> {
  const sr = 44100;
  // Zone 1 : sinus de 441 Hz (100 échantillons par période), racine 69 (la 440) : correction +4 cents écrite… et
  // un sample un peu plus haut que la 440 : 441 Hz = +3,93 cents → correction −4 cents.
  const grave = sinus16(441, sr, sr, 0.5);
  // Zone 2 : sinus de 523,25 Hz (do 5, midi 72), racine 72, fineTune +10 et coarse 0 → joue 10 cents trop haut,
  // compensé par une correction de −10 cents du sample.
  const aigu = sinus16(523.2511, sr, sr, 0.5);
  return fabriquerSf2({
    nom: 'OCKA test',
    samples: [
      { nom: 'grave', pcm: grave, frequence: sr, racine: 69, correction: signe16(-4) & 0xff, boucle: [4410, 4410 + 100 * 300] },
      { nom: 'aigu', pcm: aigu, frequence: sr, racine: 72, correction: signe16(-10) & 0xff },
    ],
    instruments: [
      {
        nom: 'Sinus',
        zones: [
          [[38, signe16(-2400)]], // zone globale : relâchement 0,25 s
          [[43, plageGen(0, 70)], [54, 1], [53, 0]],
          [[43, plageGen(71, 127)], [52, 10], [53, 1]],
        ],
      },
    ],
    presets: [{ nom: 'Sinus test', preset: 5, banque: 0, zones: [[[41, 0]]] }],
  });
}
