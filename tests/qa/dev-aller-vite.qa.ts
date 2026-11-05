// Mode dev (npx vite) : le bug « Cycle detected » (@preact/signals) de la vague B. Un effet de idees.ts écrivait
// versionIdees en le lisant : il se relançait lui-même plus de 100 fois au chargement de la page (stack :
// effect() → endBatch → idees.ts). Désormais : plus d'effet, le fil des idées est oublié à chaque nouvelle séance.
// Parcours : nouveau phonk, Lecture, « Une autre idée » / « Revenir », Boucles OCKA (écouter, utiliser), puis
// « Au hasard ». Aucune erreur ni alerte dans la console. Besoin du serveur de dev : npx vite --port 5198 --strictPort.
import { expect, test } from '@playwright/test';

const DEV = 'http://localhost:5198/ocka/';

test('dev : phonk, Lecture, Boucles OCKA, Au hasard — console vide', async ({ page }) => {
  test.setTimeout(120_000);
  const erreurs: string[] = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning' ? erreurs.push(`${m.type()} : ${m.text()}`) : undefined));
  page.on('pageerror', (e) => erreurs.push(`page : ${e.message}`));
  await page.goto(DEV);
  const bienvenue = page.getByTestId('bienvenue');
  if (await bienvenue.isVisible().catch(() => false)) await page.getByTestId('bienvenue-passer').click();
  await page.getByTestId('nouveau-morceau').click();
  await page.getByTestId('style-phonk').click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
  await page.getByTestId('lecture').click();
  await page.waitForTimeout(1500);
  await page.getByTestId('varier').click();
  await page.getByTestId('varier').click();
  await page.getByTestId('revenir-batterie').click();
  await page.getByTestId('vue-melodie').click();
  await page.getByTestId('boucles-ocka').click();
  await expect(page.getByTestId('ecouter-cloche')).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId('ecouter-cloche').click();
  await page.waitForTimeout(1500);
  await page.getByTestId('utiliser-cloche').click();
  await page.getByTestId('autre-idee-melodie').click();
  await page.getByTestId('revenir-melodie').click();
  await page.waitForTimeout(1000);
  await page.getByTestId('lecture').click();
  await page.goto(DEV);
  await page.getByTestId('nouveau-morceau').click();
  await page.getByTestId('style-hasard').click();
  await page.getByTestId('hasard-autre').click();
  await page.getByTestId('hasard-revenir').click();
  await page.getByTestId('hasard-creer').click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
  await page.getByTestId('lecture').click();
  await page.waitForTimeout(2000);
  expect(erreurs).toEqual([]);
});
