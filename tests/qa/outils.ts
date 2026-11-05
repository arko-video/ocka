// Outils communs des scénarios QA : surveillance (console, réseau, CSP), parcours, export, analyse ffmpeg.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import type { Style } from '../../src/morceau/types';

export const SORTIES = join(dirname(fileURLToPath(import.meta.url)), 'sorties');

/** Erreurs console / page, requêtes sortantes et violations CSP, relevées pendant tout le test. */
export interface Releves {
  erreurs: string[];
  sortantes: string[];
  csp: string[];
}

export async function surveiller(page: Page): Promise<Releves> {
  const r: Releves = { erreurs: [], sortantes: [], csp: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') r.erreurs.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => r.erreurs.push(`page: ${e.message}`));
  page.on('request', (q) => {
    const u = new URL(q.url());
    if (!['blob:', 'data:'].includes(u.protocol) && u.host !== 'localhost:4194') r.sortantes.push(q.url());
  });
  await page.exposeFunction('__qaCsp', (t: string) => r.csp.push(t));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __qaCsp(t: string): void }).__qaCsp(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  return r;
}

export async function nouveau(page: Page, style: Style) {
  await page.goto('./');
  await page.getByTestId('nouveau-morceau').click();
  await page.getByTestId(`style-${style}`).click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
}

export interface MorceauIdb {
  id: string;
  m: {
    tempo: number;
    titre: string;
    ordre: string[];
    sections: { id: string; nom: string; mesures: number }[];
    pistes: { id: string; volume: number; muet: boolean; pan: number }[];
    prises: { id: string; fichier: string; choisie: boolean; debutCoupe: number; finCoupe: number; decalage: number; frequence: number; ancre: { section: string; occurrence: number; mesure: number } }[];
    master: { niveau: string };
  };
}

/** Stockage d'A2 (vague A) : base « ocka-morceaux », magasin « ocka », clé = id du morceau, index sous « #index ». */
export const BASE_MORCEAUX = 'ocka-morceaux';
export const MAGASIN = 'ocka';
export const CLE_INDEX = '#index';
/** Dossier OPFS des prises (vague A). */
export const DOSSIER_PRISES = 'ocka-prises';

/** Les morceaux sauvés dans IndexedDB (base ocka-morceaux, l'index « #index » est ignoré). */
export function morceauxIdb(page: Page): Promise<MorceauIdb[]> {
  return page.evaluate(
    ([base, mag, index]) =>
      new Promise<MorceauIdb[]>((ok, ko) => {
        const q = indexedDB.open(base);
        q.onerror = () => ko(q.error);
        q.onsuccess = () => {
          const db = q.result;
          if (!db.objectStoreNames.contains(mag)) {
            db.close();
            return ok([]);
          }
          const st = db.transaction(mag).objectStore(mag);
          const out: MorceauIdb[] = [];
          const c = st.openCursor();
          c.onsuccess = () => {
            const cur = c.result;
            if (!cur) {
              db.close();
              return ok(out);
            }
            const k = String(cur.key);
            if (k !== index) out.push({ id: k, m: cur.value });
            cur.continue();
          };
        };
      }),
    [BASE_MORCEAUX, MAGASIN, CLE_INDEX] as const,
  );
}

/** Remplace un morceau sauvé (même id) dans ocka-morceaux. À faire suivre d'un rechargement de la page. */
export function ecrireMorceauIdb(page: Page, id: string, valeur: unknown): Promise<void> {
  return page.evaluate(
    ([base, mag, cle, v]) =>
      new Promise<void>((ok, ko) => {
        const q = indexedDB.open(base);
        q.onerror = () => ko(q.error);
        q.onsuccess = () => {
          const tx = q.result.transaction(mag, 'readwrite');
          tx.objectStore(mag).put(v, cle);
          tx.oncomplete = () => (q.result.close(), ok());
          tx.onerror = () => ko(tx.error);
        };
      }),
    [BASE_MORCEAUX, MAGASIN, id, valeur] as const,
  );
}

/** Noms des fichiers du dossier OPFS « ocka-prises ». */
export function fichiersOpfs(page: Page): Promise<string[]> {
  return page.evaluate(async (nom) => {
    const r = await navigator.storage.getDirectory();
    let d: FileSystemDirectoryHandle;
    try {
      d = await r.getDirectoryHandle(nom);
    } catch {
      return [];
    }
    const noms: string[] = [];
    for await (const k of (d as unknown as { keys(): AsyncIterable<string> }).keys()) noms.push(k);
    return noms.sort();
  }, DOSSIER_PRISES);
}

/** Durée attendue : Σ mesures × 4 × 60 / tempo. */
export function dureeAttendue(m: MorceauIdb['m']): number {
  const mesures = m.ordre.reduce((s, id) => s + (m.sections.find((x) => x.id === id)?.mesures ?? 0), 0);
  return (mesures * 4 * 60) / m.tempo;
}

/** Lance l'export WAV depuis l'étape Exporter et enregistre le fichier. */
export async function exporter(page: Page, nom: string): Promise<{ chemin: string; ms: number; lufsAffiche: string; creteAffichee: string }> {
  await page.getByTestId('onglet-exporter').click();
  const t0 = Date.now();
  await page.getByTestId('exporter-wav').click();
  await expect(page.getByTestId('export-resultat')).toBeVisible({ timeout: 360_000 });
  const ms = Date.now() - t0;
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('telecharger').click()]);
  expect(dl.suggestedFilename()).toMatch(/\.wav$/);
  const chemin = join(SORTIES, `${nom}.wav`);
  await dl.saveAs(chemin);
  return {
    chemin,
    ms,
    lufsAffiche: (await page.getByTestId('export-lufs').textContent()) ?? '',
    creteAffichee: (await page.getByTestId('export-crete').textContent()) ?? '',
  };
}

export interface InfosWav {
  codec: string;
  tag: string;
  frequence: number;
  canaux: number;
  bits: number;
  duree: number;
  formatEntete: number;
  lufs: number;
  creteVraie: number;
}

/** ffprobe (en-tête) + ffmpeg ebur128 (sonie intégrée et crête vraie, résumé lu sur stderr). */
export function analyserWav(chemin: string): InfosWav {
  const sonde = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', chemin], { encoding: 'utf8' }));
  const s = sonde.streams[0] as Record<string, string>;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', chemin, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const resume = r.stderr.slice(r.stderr.lastIndexOf('Summary'));
  const b = readFileSync(chemin);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return {
    codec: s.codec_name!,
    tag: s.codec_tag!,
    frequence: Number(s.sample_rate),
    canaux: Number(s.channels),
    bits: Number(s.bits_per_sample),
    duree: Number(sonde.format.duration),
    formatEntete: v.getUint16(20, true),
    lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(resume)?.[1]),
    creteVraie: Number(/True peak:\s+Peak:\s+(-?[\d.]+) dBFS/.exec(resume)?.[1]),
  };
}

/** Lit un WAV PCM 16/24 bits stéréo (en-tête OCKA de 44 octets vérifié à part) : canal gauche en Float32. */
export function lireGauche(chemin: string): { g: Float32Array; frequence: number } {
  const b = readFileSync(chemin);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const txt = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  const canaux = v.getUint16(22, true);
  const frequence = v.getUint32(24, true);
  const bits = v.getUint16(34, true);
  let o = 12;
  while (txt(o) !== 'data') o += 8 + v.getUint32(o + 4, true);
  const taille = v.getUint32(o + 4, true);
  const debut = o + 8;
  const oct = bits / 8;
  const n = Math.floor(taille / (oct * canaux));
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = debut + i * oct * canaux;
    if (bits === 16) g[i] = v.getInt16(p, true) / 32768;
    else g[i] = (((b[p]! | (b[p + 1]! << 8) | (b[p + 2]! << 16)) << 8) >> 8) / 8388608;
  }
  return { g, frequence };
}

/** Débuts des clics (s) : passage au-dessus de `seuil` × crête après au moins 0,2 s sous ce seuil. */
export function attaques(x: Float32Array, frequence: number, seuilRelatif = 0.3): number[] {
  let crete = 0;
  for (const v of x) crete = Math.max(crete, Math.abs(v));
  const seuil = crete * seuilRelatif;
  const out: number[] = [];
  let dernier = -Infinity;
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]!) >= seuil) {
      if (i - dernier > 0.2 * frequence) out.push(i / frequence);
      dernier = i;
    }
  }
  return out;
}
