// Outils des e2e de la vague A : téléchargements, ZIP (lu sur le disque, par unzip), WAV (PCM et flottant), ffprobe,
// attaques. Les morceaux sauvés se lisent et s'écrivent avec tests/qa/outils.ts (base ocka-morceaux).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { expect, type Page } from '@playwright/test';
import type { Style } from '../../src/morceau/types';

export { ecrireMorceauIdb, morceauxIdb, type MorceauIdb } from '../qa/outils';

/** Dossier de travail neuf pour un test (fichiers téléchargés, ZIP extraits). */
export function dossierNeuf(nom: string): string {
  mkdirSync(join(tmpdir(), 'ocka-e2e'), { recursive: true });
  return mkdtempSync(join(tmpdir(), 'ocka-e2e', `${nom}-`));
}

export async function nouveauMorceau(page: Page, style: Style) {
  await page.goto('./');
  await page.getByTestId('nouveau-morceau').click();
  await page.getByTestId(`style-${style}`).click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
}

/** Lance un export de l'étape Exporter (bouton `testid`), attend le résultat et enregistre le fichier. */
export async function exporterVers(page: Page, testid: string, dossier: string, delai = 240_000): Promise<string> {
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId(testid).click();
  await expect(page.getByTestId('export-resultat')).toBeVisible({ timeout: delai });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('telecharger').click()]);
  const chemin = join(dossier, dl.suggestedFilename());
  await dl.saveAs(chemin);
  return chemin;
}

/** `unzip -t` : true si toutes les entrées sont saines (CRC compris). */
export function zipSain(chemin: string): { ok: boolean; sortie: string } {
  const r = spawnSync('unzip', ['-t', chemin], { encoding: 'utf8' });
  return { ok: r.status === 0 && /No errors detected/.test(r.stdout), sortie: r.stdout + r.stderr };
}

/** Extrait un ZIP dans un dossier neuf ; renvoie les chemins relatifs des fichiers (triés). */
export function extraire(chemin: string, nom: string): { dossier: string; fichiers: string[] } {
  const dossier = dossierNeuf(nom);
  execFileSync('unzip', ['-q', '-o', chemin, '-d', dossier]);
  const fichiers: string[] = [];
  const parcourir = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) parcourir(p);
      else fichiers.push(relative(dossier, p));
    }
  };
  parcourir(dossier);
  return { dossier, fichiers: fichiers.sort() };
}

/** Noms des entrées du ZIP, lus dans le répertoire central (octets UTF-8 d'origine, sans passer par unzip). */
export function nomsZip(chemin: string): string[] {
  const b = readFileSync(chemin);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let fin = b.length - 22;
  while (fin >= 0 && v.getUint32(fin, true) !== 0x06054b50) fin--;
  const n = v.getUint16(fin + 10, true);
  let o = v.getUint32(fin + 16, true);
  const noms: string[] = [];
  for (let i = 0; i < n; i++) {
    const l = v.getUint16(o + 28, true);
    const extra = v.getUint16(o + 30, true);
    const com = v.getUint16(o + 32, true);
    noms.push(new TextDecoder().decode(b.subarray(o + 46, o + 46 + l)));
    o += 46 + l + extra + com;
  }
  return noms;
}

export interface Wav {
  format: number;
  canaux: number;
  frequence: number;
  bits: number;
  /** Échantillons par canal, en flottants. */
  donnees: Float32Array[];
}

/** Lit un WAV PCM 16/24 bits ou flottant 32 bits (code 1, 3 ou 0xFFFE), chunk par chunk. */
export function lireWav(chemin: string): Wav {
  const b = readFileSync(chemin);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const txt = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  expect(txt(0)).toBe('RIFF');
  expect(txt(8)).toBe('WAVE');
  let o = 12;
  let format = 0;
  let canaux = 0;
  let frequence = 0;
  let bits = 0;
  while (o + 8 <= b.length) {
    const id = txt(o);
    const taille = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      format = v.getUint16(o + 8, true);
      canaux = v.getUint16(o + 10, true);
      frequence = v.getUint32(o + 12, true);
      bits = v.getUint16(o + 22, true);
    } else if (id === 'data') {
      const oct = bits / 8;
      const n = Math.floor(Math.min(taille, b.length - o - 8) / (oct * canaux));
      const donnees = Array.from({ length: canaux }, () => new Float32Array(n));
      const d = o + 8;
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < canaux; c++) {
          const p = d + (i * canaux + c) * oct;
          donnees[c]![i] =
            bits === 32 ? v.getFloat32(p, true) : bits === 16 ? v.getInt16(p, true) / 32768 : (((b[p]! | (b[p + 1]! << 8) | (b[p + 2]! << 16)) << 8) >> 8) / 8388608;
        }
      }
      return { format, canaux, frequence, bits, donnees };
    }
    o += 8 + taille + (taille & 1);
  }
  throw new Error(`pas de données dans ${chemin}`);
}

/** Flux audio vu par ffprobe (premier flux). */
export function sonder(chemin: string): Record<string, string | number> {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', chemin], { encoding: 'utf8' }));
  return { ...j.streams[0], duree: Number(j.format.duration), format_name: j.format.format_name };
}

/** Décodage complet par ffmpeg : '' si aucune erreur. */
export function erreursDecodage(chemin: string): string {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', chemin, '-f', 'null', '-'], { encoding: 'utf8' });
  return (r.status === 0 ? '' : `code ${r.status} `) + r.stderr.trim();
}

/** Crête absolue sur tous les canaux. */
export function crete(w: Wav): number {
  let c = 0;
  for (const x of w.donnees) for (const v of x) c = Math.max(c, Math.abs(v));
  return c;
}

/**
 * Débuts des sons (s) : premier échantillon au-dessus de `seuil` (absolu) après au moins `silence` s en dessous.
 * Pour une piste séparée (pas de bruit, pas de dither), un seuil très bas donne l'attaque à l'échantillon près.
 */
export function attaquesNettes(x: Float32Array, frequence: number, seuil: number, silence = 0.05): number[] {
  const out: number[] = [];
  let dernier = -Infinity;
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]!) >= seuil) {
      if (i - dernier > silence * frequence) out.push(i / frequence);
      dernier = i;
    }
  }
  return out;
}
