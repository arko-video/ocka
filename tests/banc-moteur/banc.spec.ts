// Banc du moteur son dans Chrome : export WAV d'un morceau trap, puis vérifications avec ffmpeg / ffprobe.
// Lancer : npx playwright test -c playwright.moteur.local.ts
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const SORTIE = 'tests/banc-moteur/sorties';

interface Dernier { nom: string; lufs: number; creteVraie: number; duree: number; ms: number; taille: number }

async function exporter(page: Page, bouton: string, attendus = 1): Promise<string[]> {
  const chemins: string[] = [];
  const fini = new Promise<void>((ok) => {
    page.on('download', async (d) => {
      const chemin = `${SORTIE}/${d.suggestedFilename()}`;
      await d.saveAs(chemin);
      chemins.push(chemin);
      if (chemins.length === attendus) ok();
    });
  });
  await page.click(bouton);
  await fini;
  return chemins;
}

/** Spectrogramme PNG (à regarder) d'un WAV. */
function spectrogramme(wav: string) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-lavfi', 'showspectrumpic=s=1200x500:legend=1:scale=log:fscale=lin', wav.replace('.wav', '.png')]);
}

/** Mesures ffmpeg ebur128 : sonie intégrée et crête vraie. */
function ebur128(wav: string): { lufs: number; tp: number } {
  const texte = execFileSync('bash', ['-c', `ffmpeg -nostats -i "${wav}" -filter_complex ebur128=peak=true -f null - 2>&1`], { encoding: 'utf8' });
  const resume = texte.slice(texte.lastIndexOf('Summary:'));
  return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(resume)![1]), tp: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(resume)![1]) };
}

test.beforeAll(() => mkdirSync(SORTIE, { recursive: true }));

test('export trap : en-tête, durée, −14 LUFS, crête vraie ≤ −1 dBTP', async ({ page }) => {
  page.on('console', (m) => console.log('[page]', m.text()));
  await page.goto('tests/banc-moteur/index.html');
  await page.waitForFunction(() => (window as unknown as { bancPret?: boolean }).bancPret === true);
  const [wav] = await exporter(page, '#trap');
  const infos = (await page.evaluate(() => (window as unknown as { dernier: Dernier }).dernier)) as Dernier;
  console.log('moteur :', JSON.stringify(infos));

  const octets = readFileSync(wav!);
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  expect(v.getUint16(20, true)).toBe(1); // code de format PCM 0x0001
  expect(v.getUint16(22, true)).toBe(2);
  expect(v.getUint32(24, true)).toBe(44100);
  expect(v.getUint16(34, true)).toBe(24);
  const sonde = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', wav!], { encoding: 'utf8' })) as { streams: { codec_name: string; sample_rate: string; channels: number; duration: string }[] };
  const flux = sonde.streams[0]!;
  expect(flux.codec_name).toBe('pcm_s24le');
  expect(flux.sample_rate).toBe('44100');
  expect(flux.channels).toBe(2);
  const attendue = (40 * 4 * 60) / 140;
  expect(Math.abs(Number(flux.duration) - attendue)).toBeLessThan(0.01);
  const m = ebur128(wav!);
  console.log('ffmpeg ebur128 :', JSON.stringify(m));
  expect(Math.abs(m.lufs + 14)).toBeLessThanOrEqual(0.5);
  expect(m.tp).toBeLessThanOrEqual(-1);
  spectrogramme(wav!);
});

test('écoute : le lecteur joue (worklet chargé malgré la CSP)', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.goto('tests/banc-moteur/index.html');
  await page.waitForFunction(() => (window as unknown as { bancPret?: boolean }).bancPret === true);
  await page.click('#ecoute');
  await page.waitForFunction(() => (window as unknown as { resultatEcoute?: unknown }).resultatEcoute !== undefined, null, { timeout: 30_000 });
  const r = (await page.evaluate(() => JSON.stringify((window as unknown as { resultatEcoute: unknown }).resultatEcoute)).then((t) => JSON.parse(t))) as { ok: boolean; temps: number; pasVus: number };
  console.log('écoute :', JSON.stringify(r), erreurs);
  expect(r.ok).toBe(true);
  expect(r.temps).toBeGreaterThan(1.5);
  expect(r.pasVus).toBeGreaterThan(8);
  expect(erreurs.filter((e) => /worklet|Content Security|CSP/i.test(e))).toEqual([]);
});

test('démo des sons', async ({ page }) => {
  await page.goto('tests/banc-moteur/index.html');
  await page.waitForFunction(() => (window as unknown as { bancPret?: boolean }).bancPret === true);
  for (const wav of await exporter(page, '#kit', 3)) spectrogramme(wav);
});

test('export de 3 min (temps par étape)', async ({ page }) => {
  test.setTimeout(400_000);
  await page.goto('tests/banc-moteur/index.html');
  await page.waitForFunction(() => (window as unknown as { bancPret?: boolean }).bancPret === true);
  const [long] = await exporter(page, '#long');
  const infos = (await page.evaluate(() => (window as unknown as { dernier: Dernier }).dernier)) as Dernier;
  console.log('3 min :', JSON.stringify(infos), 'ffmpeg :', JSON.stringify(ebur128(long!)));
});

test('diagnostic : pistes en solo', async ({ page }) => {
  await page.goto('tests/banc-moteur/index.html');
  await page.waitForFunction(() => (window as unknown as { bancPret?: boolean }).bancPret === true);
  for (const wav of await exporter(page, '#solos', 3)) spectrogramme(wav);
});

test('export fort en 16 bits : −11 LUFS, crête vraie ≤ −2 dBTP', async ({ page }) => {
  await page.goto('tests/banc-moteur/index.html');
  await page.waitForFunction(() => (window as unknown as { bancPret?: boolean }).bancPret === true);
  const [wav] = await exporter(page, '#fort16');
  const octets = readFileSync(wav!);
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  expect(v.getUint16(20, true)).toBe(1);
  expect(v.getUint16(34, true)).toBe(16);
  const sonde = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', wav!], { encoding: 'utf8' })) as { streams: { codec_name: string; duration: string }[] };
  expect(sonde.streams[0]!.codec_name).toBe('pcm_s16le');
  expect(Math.abs(Number(sonde.streams[0]!.duration) - (40 * 4 * 60) / 140)).toBeLessThan(0.01);
  const m = ebur128(wav!);
  console.log('fort 16 bits ffmpeg :', JSON.stringify(m));
  expect(Math.abs(m.lufs + 11)).toBeLessThanOrEqual(0.5);
  expect(m.tp).toBeLessThanOrEqual(-2);
});

test('annulation : le rendu est relâché et un nouvel export marche', async ({ page }) => {
  await page.goto('tests/banc-moteur/index.html');
  await page.waitForFunction(() => (window as unknown as { bancPret?: boolean }).bancPret === true);
  await page.click('#annuler');
  await page.waitForFunction(() => (window as unknown as { annulation?: unknown }).annulation !== undefined, null, { timeout: 120_000 });
  const r = JSON.parse(await page.evaluate(() => JSON.stringify((window as unknown as { annulation: unknown }).annulation))) as { code: string; msAnnulation: number; ensuite: number; taille: number };
  console.log('annulation :', JSON.stringify(r));
  expect(r.code).toBe('annule');
  expect(r.msAnnulation).toBeLessThan(3000);
  expect(r.ensuite).toBe(-14);
  expect(r.taille).toBe(44 + Math.round((40 * 4 * 60 * 44100) / 140) * 6);
});
