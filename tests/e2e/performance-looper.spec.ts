// C3 (R) : effets de fin (pastilles), looper (« Jouer en direct » → « Garder dans le morceau » en UNE étape
// d'Annuler), confort (tap tempo, métronome, historique, repères, raccourcis « ? »). Captures 360×800 de chaque panneau.
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { nouveauMorceau } from './outils-e2e';

const CAPTURES = 'tests/e2e/captures/c3-r';
test.use({ viewport: { width: 360, height: 800 }, hasTouch: true });

async function capture(page: Page, nom: string) {
  mkdirSync(CAPTURES, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${CAPTURES}/${nom}.png` });
}

test('effets de fin, looper, confort : au pouce, sans erreur, un Annuler par geste', async ({ page }) => {
  test.setTimeout(240_000);
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await nouveauMorceau(page, 'trap');
  await page.getByTestId('onglet-structure').click();

  // Effets de fin : une pastille pose l'effet (allumée), la retoucher le retire ; Annuler revient.
  await page.getByTestId('structure-perf').click();
  await expect(page.getByTestId('panneau-performance')).toBeVisible();
  await page.getByTestId('perf-longueur-8').click();
  await page.getByTestId('perf-stutter').click();
  await expect(page.getByTestId('perf-stutter')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('perf-liste').locator('li')).toHaveCount(1);
  await page.getByTestId('perf-tape-stop').click(); // remplace le stutter (même fin de section)
  await expect(page.getByTestId('perf-stutter')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('perf-liste').locator('li')).toHaveCount(1);
  await capture(page, '01-effets-de-fin');
  await page.goBack();

  // Looper : lancer une case, enregistrer, garder → sections « Direct » ajoutées ; Annuler les retire d'un coup.
  const avant = await page.getByTestId('section').count();
  await page.getByTestId('structure-looper').click();
  await expect(page.getByTestId('panneau-looper')).toBeVisible();
  const cases = page.locator('[data-testid^="looper-case-"]');
  expect(await cases.count()).toBeGreaterThan(2);
  await capture(page, '02-looper');
  await page.getByTestId('looper-enregistrer').click();
  await cases.first().click();
  await expect(cases.first()).toHaveAttribute('data-etat', /joue|attente/);
  await page.waitForTimeout(4500); // un peu plus de deux mesures
  await capture(page, '03-looper-enregistre');
  await page.getByTestId('looper-enregistrer').click(); // « Garder dans le morceau »
  await expect(page.getByTestId('looper-enregistrer')).toHaveAttribute('aria-pressed', 'false');
  await page.goBack();
  await expect(page.getByTestId('panneau-looper')).toHaveCount(0);

  // Confort : historique visible (le looper = une étape), tap tempo, métronome, raccourcis.
  await page.getByTestId('ouvrir-confort').click();
  await expect(page.getByTestId('panneau-confort')).toBeVisible();
  const historique = page.getByTestId('confort-historique');
  await expect(historique.locator('li[data-position="0"]')).toContainText(/Sections? ajoutées?/);
  for (let i = 0; i < 4; i++) await page.getByTestId('confort-tap').dispatchEvent('pointerdown');
  await expect(page.getByTestId('confort-tap')).toContainText('BPM');
  await page.getByTestId('confort-metronome-bois').click();
  await expect(page.getByTestId('confort-metronome-bois')).toHaveAttribute('aria-checked', 'true');
  await capture(page, '04-confort');
  // Revenir à l'étape d'avant le looper : un toucher.
  await historique.getByTestId('confort-etape--1').click();
  await expect(historique.locator('li[data-position="0"]')).not.toContainText(/Sections? ajoutées?/);
  await expect(historique.locator('li[data-position="1"]')).toContainText(/Sections? ajoutées?/);
  await page.getByTestId('confort-raccourcis').scrollIntoViewIfNeeded();
  await capture(page, '05-confort-bas');
  await page.goBack();
  expect(await page.getByTestId('section').count()).toBeGreaterThanOrEqual(avant);

  // Raccourci « ? » : ouvre la liste.
  await page.keyboard.press('?');
  await expect(page.getByTestId('confort-raccourcis')).toBeVisible();
  await page.goBack();
  expect(erreurs).toEqual([]);
});
