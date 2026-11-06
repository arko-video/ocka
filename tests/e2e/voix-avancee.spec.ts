// Voix avancée (C3, V) au faux micro : 2 prises, punch-in (pré-roll d'une mesure, arrêt seul), comping (une case de
// chaque prise), nettoyeur (Moyen), chaîne « Rap clair », gel de la basse, puis export WAV. Chaque outil ajoute une
// prise dérivée, choisie, l'ancienne restant non choisie ; une étape d'Annuler. Captures 360×800 du panneau.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { dossierNeuf, exporterVers, lireWav, nouveauMorceau } from './outils-e2e';

const CLICS = join(dossierNeuf('micro-voix-avancee'), 'clics.wav');
if (!existsSync(CLICS)) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*220*t)*(0.6+0.4*sin(2*PI*3*t))+0.01*random(0)':s=48000:d=20", '-ac', '1', '-c:a', 'pcm_s16le', CLICS]);
}
const CAPTURES = 'tests/e2e/captures';
mkdirSync(CAPTURES, { recursive: true });

test.use({
  viewport: { width: 360, height: 800 },
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${CLICS}`] },
});

/** Pas de défilement horizontal de la page. */
async function largeurOk(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
}

test('voix avancée : prise, punch-in, comping, nettoyeur, chaîne, gel, puis export', async ({ page }) => {
  test.setTimeout(420_000);
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await nouveauMorceau(page, 'trap');
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  for (let n = 1; n <= 2; n++) {
    await page.getByTestId('enregistrer').click();
    await expect(page.getByTestId('prise')).toHaveCount(n, { timeout: 90_000 });
  }

  await page.getByTestId('voix-avancee').click();
  await expect(page.getByTestId('panneau-voix-avancee')).toBeVisible();
  await expect(page.getByTestId('va-prise-1')).toBeVisible();
  await page.screenshot({ path: join(CAPTURES, 'c3-v-voix-avancee.png') });
  await largeurOk(page);

  // Punch-in : mesures 2 à 3, une mesure d'élan ; l'enregistrement s'arrête seul après le passage.
  await page.getByTestId('punch-de').selectOption('1');
  await page.getByTestId('punch-a').selectOption('3');
  await page.getByTestId('punch-preroll-1').click();
  await page.getByTestId('punch-lancer').click();
  await expect(page.getByTestId('punch-arreter')).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: join(CAPTURES, 'c3-v-punch.png') });
  await expect(page.getByTestId('va-prise-2')).toContainText('(punch)', { timeout: 60_000 });
  await expect(page.getByTestId('va-prise-2')).toContainText('gardée');

  // Comping : 1re mesure de la prise 1, 2e de la prise 2, le reste de la prise punchée.
  await page.getByTestId('comp-case-0-0').click();
  await page.getByTestId('comp-case-1-1').click();
  await page.getByTestId('va-comp').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(CAPTURES, 'c3-v-comping.png') });
  await largeurOk(page);
  await page.getByTestId('comp-creer').click();
  await expect(page.getByTestId('va-prise-3')).toContainText('(comp)', { timeout: 60_000 });

  // Nettoyeur (Moyen) sur la prise comp.
  await page.getByTestId('va-prise-3').click();
  await page.getByTestId('nettoyeur-moyen').click();
  await page.getByTestId('nettoyeur-appliquer').click();
  await expect(page.getByTestId('va-prise-4')).toContainText('(nettoyée)', { timeout: 90_000 });
  await expect(page.locator('[data-testid^="va-prise-"][aria-checked]')).toHaveCount(5);

  // Annuler ramène la prise d'avant (une seule étape) ; Rétablir la remet.
  await page.goBack();
  await page.getByTestId('annuler').click();
  await page.getByTestId('voix-avancee').click();
  await expect(page.getByTestId('va-prise-4')).toHaveCount(0);
  await page.goBack();
  await page.getByTestId('retablir').click();
  await page.getByTestId('voix-avancee').click();
  await expect(page.getByTestId('va-prise-4')).toBeVisible();

  // Chaîne prête et gel de la basse (badge « gelée »).
  await page.getByTestId('chaine-rap-clair').click();
  await page.getByTestId('gel-basse').click();
  await expect(page.getByTestId('gel-badge-basse')).toBeVisible({ timeout: 180_000 });
  await page.getByTestId('va-gel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(CAPTURES, 'c3-v-chaines-gel.png') });
  await largeurOk(page);

  // Les prises dérivées sont dans OPFS (fichier + description).
  const fichiers = await page.evaluate(async () => {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('ocka-prises');
    const noms: string[] = [];
    for await (const h of (d as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) noms.push(h.name);
    return noms.filter((n) => /^prise-.*\.f32$/.test(n)).length;
  });
  expect(fichiers).toBeGreaterThanOrEqual(5);

  // Référence : import d'un WAV (il reste sur l'appareil), sonie affichée, A/B au même volume perçu.
  await page.goBack();
  const ref = join(dossierNeuf('reference'), 'Ma reference.wav');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anoisesrc=color=pink:a=0.3:d=20', '-ac', '2', '-c:a', 'pcm_s16le', ref]);
  await page.getByTestId('onglet-son').click();
  await page.getByTestId('son-reference').click();
  await expect(page.getByTestId('reference-sur-appareil')).toBeVisible();
  await page.getByTestId('reference-fichier').setInputFiles(ref);
  await expect(page.getByTestId('reference-lufs')).toContainText('LUFS', { timeout: 60_000 });
  await page.getByTestId('reference-ab').click();
  await expect(page.getByTestId('reference-compensation')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('reference-ab')).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: join(CAPTURES, 'c3-v-reference.png') });
  await largeurOk(page);
  await page.getByTestId('reference-mix').click();
  await expect(page.getByTestId('reference-mix')).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  const chemin = await exporterVers(page, 'exporter-wav', dossierNeuf('voix-avancee'));
  const wav = lireWav(chemin);
  expect(wav.donnees[0]!.length).toBeGreaterThan(wav.frequence * 5);
  expect(erreurs).toEqual([]);
});
