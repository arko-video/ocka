// Captures 360×800 des vues de la vague B (tests/e2e/captures/b-*.png, à relire à l'œil) : choix du style
// (6 styles), « Au hasard », Boucles OCKA, panneaux IA, autotune. Chaque capture vérifie : pas de défilement
// horizontal, et au plus UN bouton « ? » à l'écran (pas de doublon).
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { dossierNeuf } from './outils-e2e';

const CLICS = join(dossierNeuf('micro-captures'), 'clics.wav');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='0.7*lt(mod(t,0.5),0.01)*sin(2*PI*1000*t)':s=48000:d=8", '-ac', '1', '-c:a', 'pcm_s16le', CLICS]);
test.use({
  viewport: { width: 360, height: 800 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${CLICS}`] },
});

const DOSSIER = 'tests/e2e/captures';
async function capturer(page: Page, nom: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${DOSSIER}/b-${nom}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth), nom).toBeLessThanOrEqual(360);
  expect(await page.getByTestId('aide-ouvrir').count(), `${nom} : un seul « ? »`).toBeLessThanOrEqual(1);
}

test('captures des vues de la vague B', async ({ page }) => {
  test.setTimeout(240_000);
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => (m.type() === 'error' ? erreurs.push(m.text()) : undefined));
  await page.route(/^https:\/\//, (r) => r.abort());
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  const bienvenue = page.getByTestId('bienvenue');
  if (await bienvenue.isVisible()) await page.getByTestId('bienvenue-passer').click();
  await capturer(page, '01-accueil');

  // « Lance-moi un beat » et les réglages de l'IA (sans clé).
  await page.getByTestId('ia-beat').click();
  await expect(page.getByTestId('panneau-ia-beat')).toBeVisible();
  await page.getByTestId('ia-beat-phrase').fill('phonk sombre, cloche qui tourne');
  await capturer(page, '02-ia-beat');
  await page.getByTestId('ia-ouvrir-reglages').click();
  await expect(page.getByTestId('panneau-ia-reglages')).toBeVisible();
  await capturer(page, '03-ia-reglages');
  await page.goBack();
  await page.goBack();

  // Choix du style : 6 styles + Au hasard.
  await page.getByTestId('nouveau-morceau').click();
  await expect(page.locator('.carte-style')).toHaveCount(6);
  await capturer(page, '04-styles');
  await page.mouse.wheel(0, 1200);
  await capturer(page, '05-styles-bas');
  await page.mouse.wheel(0, -3000);
  await page.getByTestId('style-hasard').click();
  await page.getByTestId('hasard-autre').click();
  await expect(page.getByTestId('hasard-revenir')).toBeVisible();
  await capturer(page, '06-au-hasard');

  // Phonk : Beat, Mélodie, Boucles OCKA.
  await page.getByTestId('style-phonk').click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
  await page.getByTestId('varier').click();
  await capturer(page, '07-beat-autre-idee');
  await page.getByTestId('vue-melodie').click();
  await page.getByTestId('boucles-ocka').click();
  await expect(page.getByTestId('ecouter-cloche')).toBeEnabled({ timeout: 30_000 });
  await capturer(page, '08-boucles-ocka');
  await page.getByTestId('utiliser-arpege').click();
  await page.getByTestId('autre-idee-melodie').click();
  await capturer(page, '09-melodie-idee');

  // Structure : « Continue mon idée » et « Aide aux paroles ».
  await page.getByTestId('onglet-structure').click();
  const section = page.getByTestId('section').nth(1);
  await section.getByTestId('section-tete').click();
  await section.getByTestId('ia-suite').scrollIntoViewIfNeeded();
  await capturer(page, '10-structure-ia');
  await section.getByTestId('ia-suite').click();
  await expect(page.getByTestId('panneau-ia-suite')).toBeVisible();
  await capturer(page, '11-ia-suite');
  await page.goBack();
  await section.getByTestId('ia-paroles').click();
  await expect(page.getByTestId('panneau-ia-paroles')).toBeVisible();
  await capturer(page, '12-ia-paroles');
  await page.goBack();

  // Voix : une prise au faux micro, puis l'autotune (repli expliqué : ce ne sont pas des notes chantées).
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await page.getByTestId('enregistrer').click();
  await expect(page.getByTestId('prise')).toHaveCount(1, { timeout: 90_000 });
  await page.getByTestId('effet-autotune').click();
  await expect(page.getByTestId('autotune-repli')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('effets-voix').scrollIntoViewIfNeeded();
  await capturer(page, '13-autotune');

  // Aide : l'assistant de sortie (le « ? » est dans son en-tête).
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('sortir-spotify').click();
  await expect(page.getByTestId('ecran-sortie-infos')).toBeVisible();
  await capturer(page, '14-assistant-entete');
  await page.getByTestId('aide-ouvrir').click();
  await expect(page.getByTestId('aide')).toHaveAttribute('data-page', 'assistant');
  await capturer(page, '15-aide-assistant');
  expect(erreurs).toEqual([]);
});
