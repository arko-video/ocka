// Lecture DÉFENSIVE d'un .sf2 (RIFF « sfbk ») : le fichier vient de l'utilisateur, il n'est pas fiable.
// On parcourt les blocs par leurs en-têtes (lecture par morceaux : jamais tout le fichier), on garde la place du
// bloc « smpl » (16 bits, lu plus tard zone par zone) et on lit « pdta » (presets, instruments, échantillons).
// Tout est borné : tailles de blocs, multiples des enregistrements, index croissants, échantillons dans « smpl ».
// Refus (ErreurOcka « sf2_illisible ») : pas un sf2, .sf3 (échantillons compressés), bloc tronqué, index hors limites.

import { ErreurOcka } from '../moteur/erreur';

/** Lit les octets [debut, fin[ du fichier. */
export type Lecteur = (debut: number, fin: number) => Promise<Uint8Array>;

/** pdta lu au plus (les presets d'une SoundFont de 32 Mo tiennent en bien moins). */
const PDTA_MAX = 8 * 1024 * 1024;
const BLOCS_MAX = 4096;

export const refusSf2 = (detail: string) => new ErreurOcka(`Cette SoundFont est illisible (${detail}). Essaie un autre fichier .sf2.`, 'sf2_illisible');

export interface Generateurs {
  /** Numéro → valeur brute (16 bits non signés), le dernier gagne. */
  [oper: number]: number;
}
export interface EnteteSample {
  nom: string;
  debut: number;
  fin: number;
  boucleDebut: number;
  boucleFin: number;
  frequence: number;
  racine: number;
  correction: number;
  lien: number;
  type: number;
}
export interface Sf2Brut {
  nom: string;
  /** Bloc « smpl » : position (octets) dans le fichier et nombre d'échantillons 16 bits. */
  smpl: { debut: number; echantillons: number };
  presets: { nom: string; preset: number; banque: number; zones: Generateurs[] }[];
  instruments: { nom: string; zones: Generateurs[] }[];
  samples: EnteteSample[];
}

const texte = (o: Uint8Array, debut: number, n: number) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const c = o[debut + i]!;
    if (c === 0) break;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : c >= 160 ? String.fromCharCode(c) : '';
  }
  return s.trim();
};
const id4 = (o: Uint8Array, p: number) => String.fromCharCode(o[p]!, o[p + 1]!, o[p + 2]!, o[p + 3]!);

async function lireExact(lire: Lecteur, debut: number, fin: number, taille: number): Promise<Uint8Array> {
  if (debut < 0 || fin > taille || fin < debut) throw refusSf2('un bloc dépasse la fin du fichier');
  const o = await lire(debut, fin);
  if (o.length !== fin - debut) throw refusSf2('lecture incomplète');
  return o;
}

interface Bloc {
  id: string;
  debut: number; // données
  taille: number;
  liste?: string;
}

/** Les blocs d'un intervalle [debut, fin[ (LIST : leur type). */
async function blocs(lire: Lecteur, debut: number, fin: number, taille: number): Promise<Bloc[]> {
  const out: Bloc[] = [];
  let p = debut;
  while (p + 8 <= fin) {
    if (out.length >= BLOCS_MAX) throw refusSf2('trop de blocs');
    const t = await lireExact(lire, p, Math.min(p + 12, fin), taille);
    const v = new DataView(t.buffer, t.byteOffset, t.byteLength);
    const id = id4(t, 0);
    const n = v.getUint32(4, true);
    if (p + 8 + n > fin) throw refusSf2(`le bloc « ${id.replace(/[^ -~]/g, '?')} » est tronqué`);
    const b: Bloc = { id, debut: p + 8, taille: n };
    if (id === 'LIST') {
      if (n < 4 || t.length < 12) throw refusSf2('liste vide');
      b.liste = id4(t, 8);
    }
    out.push(b);
    p += 8 + n + (n & 1);
  }
  return out;
}

/** Enregistrements de taille fixe d'un bloc de pdta (au moins `min`, terminal compris). */
function enregistrements(pdta: Map<string, Uint8Array>, id: string, taille: number, min = 2): { o: Uint8Array; v: DataView; n: number } {
  const o = pdta.get(id);
  if (!o) throw refusSf2(`bloc « ${id} » absent`);
  if (o.length % taille !== 0) throw refusSf2(`bloc « ${id} » de taille incorrecte`);
  const n = o.length / taille;
  if (n < min) throw refusSf2(`bloc « ${id} » vide`);
  return { o, v: new DataView(o.buffer, o.byteOffset, o.byteLength), n };
}

/** Zones (listes de générateurs) d'une suite de « bags » : index croissants et dans les bornes. */
function zones(bag: ReturnType<typeof enregistrements>, gen: ReturnType<typeof enregistrements>, de: number, a: number): Generateurs[] {
  if (de > a || a > bag.n - 1) throw refusSf2('index de zone hors limites');
  const out: Generateurs[] = [];
  for (let b = de; b < a; b++) {
    const g0 = bag.v.getUint16(b * 4, true);
    const g1 = bag.v.getUint16((b + 1) * 4, true);
    if (g0 > g1 || g1 > gen.n) throw refusSf2('index de générateur hors limites');
    const z: Generateurs = Object.create(null);
    for (let g = g0; g < g1; g++) {
      const oper = gen.v.getUint16(g * 4, true);
      z[oper] = gen.v.getUint16(g * 4 + 2, true);
    }
    out.push(z);
  }
  return out;
}

/** Analyse la structure d'un .sf2 de `taille` octets. */
export async function lireSf2(lire: Lecteur, taille: number): Promise<Sf2Brut> {
  if (taille < 12) throw refusSf2('fichier trop court');
  const tete = await lireExact(lire, 0, 12, taille);
  if (id4(tete, 0) !== 'RIFF' || id4(tete, 8) !== 'sfbk') throw refusSf2('ce n’est pas un fichier .sf2');
  const fin = Math.min(taille, 8 + new DataView(tete.buffer, tete.byteOffset).getUint32(4, true));
  const listes = await blocs(lire, 12, fin, taille);
  const liste = (t: string) => listes.find((b) => b.id === 'LIST' && b.liste === t);
  const info = liste('INFO');
  const sdta = liste('sdta');
  const pdtaL = liste('pdta');
  if (!sdta || !pdtaL) throw refusSf2('il manque les échantillons ou les presets');

  let nom = '';
  if (info) {
    for (const b of await blocs(lire, info.debut + 4, info.debut + info.taille, taille)) {
      if (b.id === 'ifil' && b.taille >= 4) {
        const o = await lireExact(lire, b.debut, b.debut + 4, taille);
        if (new DataView(o.buffer, o.byteOffset).getUint16(0, true) >= 3) throw refusSf2('les .sf3 (échantillons compressés) ne sont pas pris en charge');
      }
      if (b.id === 'INAM' && b.taille > 0) nom = texte(await lireExact(lire, b.debut, b.debut + Math.min(b.taille, 256), taille), 0, Math.min(b.taille, 256));
    }
  }
  const smplB = (await blocs(lire, sdta.debut + 4, sdta.debut + sdta.taille, taille)).find((b) => b.id === 'smpl');
  if (!smplB) throw refusSf2('pas d’échantillons 16 bits');
  const smpl = { debut: smplB.debut, echantillons: Math.floor(smplB.taille / 2) };

  if (pdtaL.taille > PDTA_MAX) throw refusSf2('liste des presets trop grande');
  const pdta = new Map<string, Uint8Array>();
  for (const b of await blocs(lire, pdtaL.debut + 4, pdtaL.debut + pdtaL.taille, taille)) {
    if (!pdta.has(b.id)) pdta.set(b.id, await lireExact(lire, b.debut, b.debut + b.taille, taille));
  }
  const phdr = enregistrements(pdta, 'phdr', 38);
  const pbag = enregistrements(pdta, 'pbag', 4, 1);
  const pgen = enregistrements(pdta, 'pgen', 4, 1);
  const inst = enregistrements(pdta, 'inst', 22);
  const ibag = enregistrements(pdta, 'ibag', 4, 1);
  const igen = enregistrements(pdta, 'igen', 4, 1);
  const shdr = enregistrements(pdta, 'shdr', 46);

  const samples: EnteteSample[] = [];
  for (let i = 0; i < shdr.n - 1; i++) {
    const p = i * 46;
    const v = shdr.v;
    const s: EnteteSample = {
      nom: texte(shdr.o, p, 20),
      debut: v.getUint32(p + 20, true),
      fin: v.getUint32(p + 24, true),
      boucleDebut: v.getUint32(p + 28, true),
      boucleFin: v.getUint32(p + 32, true),
      frequence: v.getUint32(p + 36, true),
      racine: v.getUint8(p + 40),
      correction: v.getInt8(p + 41),
      lien: v.getUint16(p + 42, true),
      type: v.getUint16(p + 44, true),
    };
    if (s.type & 0x10) throw refusSf2('les .sf3 (échantillons compressés) ne sont pas pris en charge');
    if (!(s.type & 0x8000) && (s.debut >= s.fin || s.fin > smpl.echantillons)) throw refusSf2(`l’échantillon ${i + 1} sort des données`);
    samples.push(s);
  }
  const instruments: Sf2Brut['instruments'] = [];
  for (let i = 0; i < inst.n - 1; i++) {
    const de = inst.v.getUint16(i * 22 + 20, true);
    const a = inst.v.getUint16((i + 1) * 22 + 20, true);
    instruments.push({ nom: texte(inst.o, i * 22, 20), zones: zones(ibag, igen, de, a) });
  }
  const presets: Sf2Brut['presets'] = [];
  for (let i = 0; i < phdr.n - 1; i++) {
    const p = i * 38;
    const de = phdr.v.getUint16(p + 24, true);
    const a = phdr.v.getUint16(p + 38 + 24, true);
    presets.push({ nom: texte(phdr.o, p, 20), preset: phdr.v.getUint16(p + 20, true), banque: phdr.v.getUint16(p + 22, true), zones: zones(pbag, pgen, de, a) });
  }
  return { nom, smpl, presets, instruments, samples };
}
