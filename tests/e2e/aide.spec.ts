// Aide (« ? ») et premier lancement, sur un téléphone 360 × 800 :
// - les 3 conseils du premier lancement se passent en un toucher et ne reviennent plus ;
// - le « ? » ouvre la bonne page depuis l'accueil, Beat (batterie et mélodie) et l'assistant de sortie ;
// - « Tout le guide », Retour (en-tête et téléphone), la croix ; liens externes sûrs ; aucun appel réseau externe.
// Captures dans tests/e2e/captures/aide-*.png (à relire à l'œil).
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });

const DOSSIER = 'tests/e2e/captures';
async function capturer(page: Page, nom: string) {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${DOSSIER}/aide-${nom}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth), nom).toBeLessThanOrEqual(360);
}

/** Ouvre l'aide par le « ? » et vérifie la page affichée. */
async function ouvrirAide(page: Page, attendue: string) {
  const bouton = page.getByTestId('aide-ouvrir');
  await expect(bouton, 'un seul « ? » à l’écran').toHaveCount(1);
  const boite = await bouton.boundingBox();
  expect(boite!.width).toBeGreaterThanOrEqual(44);
  expect(boite!.height).toBeGreaterThanOrEqual(44);
  await bouton.click();
  await expect(page.getByTestId('aide')).toHaveAttribute('data-page', attendue);
}

test('premier lancement, puis le « ? » de chaque écran', async ({ page }) => {
  // Aucun appel réseau vers un autre site pendant tout le parcours.
  const externes: string[] = [];
  page.on('request', (r) => {
    const h = new URL(r.url()).hostname;
    if (h !== 'localhost' && h !== '127.0.0.1' && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) externes.push(r.url());
  });

  // ---- premier lancement
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByTestId('bienvenue')).toBeVisible();
  await capturer(page, '01-premier-lancement');
  await page.getByTestId('bienvenue').locator('.bienvenue-carte').click({ position: { x: 30, y: 30 } });
  await expect(page.getByTestId('bienvenue')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  await expect(page.getByTestId('bienvenue')).toHaveCount(0);

  // ---- accueil
  await capturer(page, '02-accueil');
  await ouvrirAide(page, 'accueil');
  await capturer(page, '03-aide-accueil');
  await page.getByTestId('aide-fermer').click();
  await expect(page.getByTestId('aide')).toHaveCount(0);

  // ---- Beat (batterie), puis le guide
  await page.getByTestId('nouveau-morceau').click();
  await ouvrirAide(page, 'premier-morceau'); // choix du style : le « ? » est dans l'en-tête
  await page.getByTestId('aide-fermer').click();
  await page.getByTestId('style-trap').click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
  await capturer(page, '04-beat-entete');
  await ouvrirAide(page, 'beat');
  await capturer(page, '05-aide-beat');
  await page.getByTestId('aide-tout').click();
  await expect(page.getByTestId('aide')).toHaveAttribute('data-page', 'guide');
  await capturer(page, '06-guide');
  await page.getByTestId('aide-voir-spotify').click();
  await expect(page.getByTestId('aide')).toHaveAttribute('data-page', 'spotify');
  await capturer(page, '07-spotify');
  // Liens externes : nouvel onglet, sans fuite, vers des pages en https.
  const liens = page.getByTestId('aide-lien');
  expect(await liens.count()).toBeGreaterThan(5);
  for (const l of await liens.all()) {
    await expect(l).toHaveAttribute('target', '_blank');
    await expect(l).toHaveAttribute('rel', 'noopener noreferrer');
    expect(await l.getAttribute('href')).toMatch(/^https:\/\/\S+$/);
  }
  await page.mouse.wheel(0, 1400);
  await capturer(page, '08-spotify-suite');
  // Retour de l'en-tête : page d'avant (le guide) ; Retour du téléphone : l'aide de Beat ; encore : fermée.
  await page.getByTestId('aide-retour').click();
  await expect(page.getByTestId('aide')).toHaveAttribute('data-page', 'guide');
  await page.goBack();
  await expect(page.getByTestId('aide')).toHaveAttribute('data-page', 'beat');
  await page.goBack();
  await expect(page.getByTestId('aide')).toHaveCount(0);
  await expect(page.getByTestId('ecran-beat')).toBeVisible();

  // ---- FAQ et À propos
  await ouvrirAide(page, 'beat');
  await page.getByTestId('aide-tout').click();
  await page.getByTestId('aide-voir-faq').click();
  await page.locator('.guide-question summary').first().click();
  await capturer(page, '09-faq');
  await page.getByTestId('aide-retour').click();
  await page.getByTestId('aide-voir-a-propos').click();
  await expect(page.getByTestId('aide')).toContainText('Version');
  await expect(page.getByTestId('aide')).toContainText('MIT');
  await capturer(page, '10-a-propos');
  // La croix ferme toute l'aide d'un coup (3 pages empilées).
  await page.getByTestId('aide-fermer').click();
  await expect(page.getByTestId('aide')).toHaveCount(0);
  await expect(page.getByTestId('ecran-beat')).toBeVisible();

  // ---- Beat, vue Mélodie
  await page.getByTestId('vue-melodie').click();
  await ouvrirAide(page, 'melodie');
  await page.getByTestId('aide-fermer').click();

  // ---- assistant de sortie
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('sortir-spotify').click();
  await expect(page.getByTestId('ecran-sortie-infos')).toBeVisible();
  await capturer(page, '11-assistant');
  await ouvrirAide(page, 'assistant');
  await capturer(page, '12-aide-assistant');
  await page.goBack();
  await expect(page.getByTestId('aide')).toHaveCount(0);
  await expect(page.getByTestId('ecran-sortie-infos')).toBeVisible();

  expect(externes).toEqual([]);
});
