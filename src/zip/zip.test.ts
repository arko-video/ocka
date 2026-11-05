import { crc32 as crc32Zlib } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installerNavigateur, type RacineFactice } from '../projets/test-factices';
import { corrigerCrc, crc32 } from './crc32';
import { creerZip, creerZipLimite, estCorrigeable } from './ecrire';
import { lireZip } from './lire';
import type { ReglesLectureZip } from './types';

let racine: RacineFactice;
beforeEach(() => {
  racine = installerNavigateur(vi.stubGlobal);
});
afterEach(() => vi.unstubAllGlobals());

const txt = (s: string) => new TextEncoder().encode(s);
const REGLES: ReglesLectureZip = {
  tailleMax: 1e9,
  noms: ['ocka.json', 'morceau.json', /^prises\/prise-[A-Za-z0-9_-]{1,40}\.wav$/],
  deflate: ['morceau.json'],
  maxDeflate: 2 * 1024 * 1024,
  maxEntrees: 10,
};

async function deflate(o: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([o as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
}

interface Brute {
  nom: string;
  donnees: Uint8Array;
  methode?: number;
  taille?: number; // taille décompressée annoncée
  nomLocal?: string;
  drapeaux?: number;
  position?: number; // position forcée de l'en-tête local dans le répertoire central
  crc?: number; // CRC des données décompressées (deflate)
}

/** Fabrique un ZIP « à la main » (pour les archives piégées). */
function zipBrut(entrees: Brute[]): File {
  const parties: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let pos = 0;
  for (const e of entrees) {
    const nom = txt(e.nom);
    const nomLocal = txt(e.nomLocal ?? e.nom);
    const l = new Uint8Array(30 + nomLocal.length);
    const v = new DataView(l.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, (e.drapeaux ?? 0) | 0x800, true);
    v.setUint16(8, e.methode ?? 0, true);
    const crc = e.crc ?? crc32(e.donnees);
    v.setUint32(14, crc, true);
    v.setUint32(18, e.donnees.length, true);
    v.setUint32(22, e.taille ?? e.donnees.length, true);
    v.setUint16(26, nomLocal.length, true);
    l.set(nomLocal, 30);
    const c = new Uint8Array(46 + nom.length);
    const w = new DataView(c.buffer);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(8, (e.drapeaux ?? 0) | 0x800, true);
    w.setUint16(10, e.methode ?? 0, true);
    w.setUint32(16, crc, true);
    w.setUint32(20, e.donnees.length, true);
    w.setUint32(24, e.taille ?? e.donnees.length, true);
    w.setUint16(28, nom.length, true);
    w.setUint32(42, e.position ?? pos, true);
    c.set(nom, 46);
    parties.push(l, e.donnees);
    central.push(c);
    pos += l.length + e.donnees.length;
  }
  const tailleRep = central.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, entrees.length, true);
  f.setUint16(10, entrees.length, true);
  f.setUint32(12, tailleRep, true);
  f.setUint32(16, pos, true);
  return new File([...parties, ...central, fin] as Uint8Array<ArrayBuffer>[], 'piege.ocka');
}

describe('CRC32', () => {
  it('identique à zlib, en un bloc ou en plusieurs', () => {
    const o = new Uint8Array(100_003).map((_, i) => (i * 7919) & 0xff);
    expect(crc32(o)).toBe(crc32Zlib(o));
    expect(crc32(o.subarray(50_001), crc32(o.subarray(0, 50_001)))).toBe(crc32Zlib(o));
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('correction sans relire : même résultat que recalculer', () => {
    const o = new Uint8Array(70_000).map((_, i) => (i * 31) & 0xff);
    const nouveaux = txt('STREAMINFO corrigé');
    const avant = crc32(o);
    const anciens = o.slice(8, 8 + nouveaux.length);
    o.set(nouveaux, 8);
    expect(corrigerCrc(avant, o.length, 8, anciens, nouveaux)).toBe(crc32(o));
  });
});

describe('écriture en flux', () => {
  it('un ZIP écrit se relit : noms UTF-8, CRC, tailles, données', async () => {
    const z = await creerZip('sorties', 'Artiste - Été (sortie).zip');
    await z.ajouter('ocka.json', txt('{"type":"morceau","version":1}'));
    const e = await z.entree('prises/prise-abc.wav');
    const gros = new Uint8Array(3_000_000).map((_, i) => i & 0xff);
    await e.ecrire(gros.subarray(0, 1_000_000));
    await e.ecrire(gros.subarray(1_000_000));
    expect(e.position).toBe(3_000_000);
    await e.fermer();
    await z.ajouter('morceau.json', new Blob(['{"titre":"Été"}']));
    const f = await z.terminer();
    expect(f.name).toBe('Artiste - Été (sortie).zip');
    expect(racine.noms('ocka-sorties')).toEqual(['Artiste - _c9t_e9 (sortie).zip']); // nom sûr sur le disque
    const l = await lireZip(f, REGLES);
    expect(l.entrees.map((x) => x.nom)).toEqual(['ocka.json', 'prises/prise-abc.wav', 'morceau.json']);
    expect(await l.texte('morceau.json')).toBe('{"titre":"Été"}');
    expect(new Uint8Array(await l.blob('prises/prise-abc.wav').arrayBuffer())).toEqual(gros);
    expect(l.entrees[1]!.crc32).toBe(crc32(gros));
  });

  it('corriger le début d’une entrée : le CRC suit (relu juste)', async () => {
    const z = await creerZip('sorties', 'a.zip');
    const e = await z.entree('morceau.json');
    expect(estCorrigeable(e)).toBe(true);
    await e.ecrire(txt('{"titre":"XXXX"}'));
    if (estCorrigeable(e)) await e.corriger(10, txt('Nuit'));
    await e.fermer();
    const l = await lireZip(await z.terminer(), REGLES);
    expect(await l.texte('morceau.json')).toBe('{"titre":"Nuit"}');
  });

  it('noms en double ou dangereux refusés ; les AUTRES fichiers du dossier restent', async () => {
    racine.poser('ocka-sorties', 'autre.zip', txt('à garder'));
    const z = await creerZip('sorties', 'b.zip');
    await z.ajouter('ocka.json', txt('{}'));
    await expect(z.ajouter('ocka.json', txt('{}'))).rejects.toMatchObject({ code: 'projet_illisible' });
    expect(racine.noms('ocka-sorties')).toEqual(['autre.zip']);
    const z2 = await creerZip('sorties', 'c.zip');
    await expect(z2.entree('../evasion.txt')).rejects.toMatchObject({ code: 'projet_illisible' });
  });

  it('au-delà de la limite : « trop_gros » et fichier effacé', async () => {
    const z = await creerZipLimite('sorties', 'd.zip', 10_000);
    await expect(z.ajouter('ocka.json', new Uint8Array(20_000))).rejects.toMatchObject({ code: 'trop_gros' });
    expect(racine.noms('ocka-sorties')).toEqual([]);
  });

  it('disque plein : « disque_plein » et fichier partiel effacé', async () => {
    racine.quota = 2_500_000;
    const z = await creerZip('sorties', 'e.zip');
    const e = await z.entree('ocka.json');
    let erreur: unknown = null;
    try {
      for (let i = 0; i < 10; i++) await e.ecrire(new Uint8Array(500_000));
      await e.fermer();
      await z.terminer();
    } catch (x) {
      erreur = x;
    }
    expect(erreur).toMatchObject({ code: 'disque_plein' });
    expect(racine.noms('ocka-sorties')).toEqual([]);
  });

  it('annuler efface le fichier partiel, sans erreur la 2e fois', async () => {
    const z = await creerZip('sorties', 'f.zip');
    await z.ajouter('ocka.json', txt('{}'));
    await z.annuler();
    await z.annuler();
    expect(racine.noms('ocka-sorties')).toEqual([]);
  });
});

describe('lecture sûre (archives piégées)', () => {
  const ok = { nom: 'ocka.json', donnees: txt('{}') };
  const refuse = (f: File, r: ReglesLectureZip = REGLES) => expect(lireZip(f, r)).rejects.toMatchObject({ code: 'projet_illisible' });

  it('archive propre fabriquée à la main : lue', async () => {
    const l = await lireZip(zipBrut([ok, { nom: 'morceau.json', donnees: await deflate(txt('{"a":1}')), methode: 8, taille: 7, crc: crc32(txt('{"a":1}')) }]), REGLES);
    expect(await l.texte('morceau.json')).toBe('{"a":1}');
  });

  it('chemins « ../ », absolus ou hors liste blanche', async () => {
    await refuse(zipBrut([ok, { nom: '../prises/prise-a.wav', donnees: txt('x') }]));
    await refuse(zipBrut([ok, { nom: '/etc/passwd', donnees: txt('x') }]));
    await refuse(zipBrut([ok, { nom: 'prises/../../a.wav', donnees: txt('x') }]));
    await refuse(zipBrut([ok, { nom: 'prises\\prise-a.wav', donnees: txt('x') }]));
    await refuse(zipBrut([ok, { nom: 'prises/prise-a.wav.exe', donnees: txt('x') }]));
    await refuse(zipBrut([ok, { nom: 'Prises/prise-a.wav', donnees: txt('x') }]));
  });

  it('bombe deflate : coupée (taille annoncée petite, ou au-delà de 2 Mo)', async () => {
    const bombe = await deflate(new Uint8Array(50 * 1024 * 1024));
    expect(bombe.length).toBeLessThan(100_000);
    const menteur = await lireZip(zipBrut([ok, { nom: 'morceau.json', donnees: bombe, methode: 8, taille: 1000 }]), REGLES);
    await expect(menteur.texte('morceau.json')).rejects.toMatchObject({ code: 'projet_illisible' });
    await refuse(zipBrut([ok, { nom: 'morceau.json', donnees: bombe, methode: 8, taille: 50 * 1024 * 1024 }]));
  });

  it('deflate hors JSON, méthode inconnue, chiffré', async () => {
    await refuse(zipBrut([ok, { nom: 'prises/prise-a.wav', donnees: await deflate(txt('x')), methode: 8, taille: 1 }]));
    await refuse(zipBrut([ok, { nom: 'morceau.json', donnees: txt('x'), methode: 12 }]));
    await refuse(zipBrut([ok, { nom: 'morceau.json', donnees: txt('x'), drapeaux: 1 }]));
  });

  it('doublons, nom local ≠ nom central, chevauchement, débordement', async () => {
    await refuse(zipBrut([ok, ok]));
    await refuse(zipBrut([ok, { nom: 'morceau.json', nomLocal: 'morceau.jsoX', donnees: txt('{}') }]));
    await refuse(zipBrut([ok, { nom: 'morceau.json', donnees: txt('{}'), position: 0 }]));
    await refuse(zipBrut([ok, { nom: 'morceau.json', donnees: txt('{}'), position: 5 }]));
  });

  it('trop gros, trop d’entrées, fichier tronqué', async () => {
    await expect(lireZip(zipBrut([ok]), { ...REGLES, tailleMax: 10 })).rejects.toMatchObject({ code: 'projet_trop_gros' });
    await refuse(zipBrut([ok, { nom: 'morceau.json', donnees: txt('{}') }]), { ...REGLES, maxEntrees: 1 });
    const f = zipBrut([ok]);
    await refuse(new File([f.slice(0, f.size - 3)], 'x.ocka'));
    await refuse(new File([txt('PK pas un zip du tout, vraiment pas') as Uint8Array<ArrayBuffer>], 'x.ocka'));
  });

  it('CRC faux : texte refusé', async () => {
    const f = zipBrut([ok]);
    const o = new Uint8Array(await f.arrayBuffer());
    o[30 + 'ocka.json'.length] = '['.charCodeAt(0); // on change « { » en « [ » sans corriger le CRC
    const l = await lireZip(new File([o], 'x.ocka'), REGLES);
    await expect(l.texte('ocka.json')).rejects.toMatchObject({ code: 'projet_illisible' });
  });
});
