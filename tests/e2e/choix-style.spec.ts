// Choix du style par familles (C2, S2) : puces de familles, recherche sans accents, « Au hasard » dans une
// famille, écoute rapide de 4 mesures ; puis un style de chaque famille créé et exporté à −14 LUFS
// (± 0,5), crête vraie ≤ −1 dBTP, à la bonne durée (les instruments de la banque se téléchargent avant).
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { analyserWav, dureeAttendue, exporter } from '../qa/outils';
import { morceauxIdb, nouveauMorceau } from './outils-e2e';

test.use({ viewport: { width: 360, height: 800 } });
const CAPTURE = (nom: string) => join('tests', 'e2e', 'captures', `c2-styles-${nom}.png`);

test('écran des styles : familles, recherche, hasard de famille, écoute rapide', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('./');
  await page.getByTestId('nouveau-morceau').click();
  await expect(page.locator('.carte-style')).toHaveCount(35);
  for (const f of ['rap', 'electro', 'monde', 'poprockjazz', 'cinema']) await expect(page.getByTestId(`aller-famille-${f}`)).toBeVisible();
  // Pas de défilement horizontal de la page sur 360 px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: CAPTURE('familles') });
  // Les puces mènent à la famille.
  await page.getByTestId('aller-famille-cinema').click();
  await expect(page.getByTestId('style-ambient')).toBeInViewport();
  await page.screenshot({ path: CAPTURE('cinema') });
  // Recherche : sans accents, par nom ou par id.
  await page.getByTestId('recherche-style').fill('electro');
  await expect(page.locator('.carte-style')).toHaveCount(0);
  await page.getByTestId('recherche-style').fill('Bossa');
  await expect(page.locator('.carte-style')).toHaveCount(1);
  await page.screenshot({ path: CAPTURE('recherche') });
  await page.getByTestId('recherche-style').fill('drum');
  await expect(page.locator('.carte-style')).toHaveCount(1);
  await page.getByTestId('recherche-style').fill('');
  // Écoute rapide (synthés OCKA : rien à télécharger) puis arrêt.
  const ecoute = page.getByTestId('ecouter-house');
  await ecoute.click();
  await expect(ecoute).toHaveAttribute('aria-pressed', 'true');
  await expect(ecoute.locator('.ecoute-attente')).toHaveCount(0, { timeout: 30_000 });
  await ecoute.click();
  await expect(ecoute).toHaveAttribute('aria-pressed', 'false');
  // « Au hasard » dans la famille Électro : un morceau d'un style électro, au tempo de sa plage.
  await page.getByTestId('hasard-famille-electro').click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
  await expect.poll(async () => (await morceauxIdb(page)).length).toBe(1);
  const [{ m }] = await morceauxIdb(page);
  expect(['hyperpop', 'house', 'techno', 'dnb', 'ukgarage', 'synthwave']).toContain((m as unknown as { style: string }).style);
  expect(erreurs).toEqual([]);
});

// Un style de chaque famille : rap (trap), électro (house), monde (bossa nova, banque), pop/rock/jazz (rock,
// batterie enregistrée), cinéma (orchestral, cordes et cuivres) ; et les 2 styles avec des effets de départ :
// cloud (envois vers la réverbe) et jazz rap (compresseur sur la contrebasse).
for (const style of ['trap', 'house', 'bossanova', 'rock', 'orchestral', 'cloud', 'jazzrap'] as const) {
  test(`${style} : créé puis exporté à −14 LUFS, crête vraie ≤ −1 dBTP`, async ({ page }) => {
    test.setTimeout(420_000);
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await nouveauMorceau(page, style);
    await expect.poll(async () => (await morceauxIdb(page)).length).toBe(1);
    const [{ m }] = await morceauxIdb(page);
    expect((m as unknown as { style: string }).style).toBe(style);
    const { chemin } = await exporter(page, `e2e-choix-style-${style}`);
    const w = analyserWav(chemin);
    console.log(`${style} : ${w.lufs} LUFS, ${w.creteVraie} dBTP, ${w.duree.toFixed(3)} s`);
    expect(w.lufs).toBeGreaterThanOrEqual(-14.5);
    expect(w.lufs).toBeLessThanOrEqual(-13.5);
    expect(w.creteVraie).toBeLessThanOrEqual(-1);
    expect(Math.abs(w.duree - dureeAttendue(m))).toBeLessThan(0.05);
    expect(erreurs).toEqual([]);
  });
}
