// Annuler / Rétablir : pads, sections (ajout, déplacement, suppression, mesures) et mixage (volume, muet, pan).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { morceauxIdb, nouveau, surveiller } from './outils';

async function curseur(l: Locator, valeur: number) {
  await l.evaluate((el, v) => {
    const i = el as HTMLInputElement;
    i.value = String(v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }, valeur);
}
const noms = (page: Page) => page.getByTestId('section-nom').allTextContents();

test('Annuler / Rétablir sur les pads, les sections et le mixage', async ({ page }) => {
  const r = await surveiller(page);
  await nouveau(page, 'trap');
  const annuler = page.getByTestId('annuler');
  const retablir = page.getByTestId('retablir');

  // Pads : 3 appuis (fort → doux → vide…), 3 annulations, 3 rétablissements.
  await page.getByTestId('instrument-snare').click();
  const pad = page.getByTestId('pad-3');
  const e0 = (await pad.getAttribute('data-etat'))!;
  const suite = [e0];
  for (let k = 0; k < 3; k++) {
    await pad.click();
    suite.push((await pad.getAttribute('data-etat'))!);
  }
  expect(new Set(suite.slice(0, 3)).size).toBe(3);
  for (let k = 2; k >= 0; k--) {
    await annuler.click();
    await expect(pad).toHaveAttribute('data-etat', suite[k]!);
  }
  for (let k = 1; k <= 3; k++) {
    await retablir.click();
    await expect(pad).toHaveAttribute('data-etat', suite[k]!);
  }

  // Sections : ajout, déplacement, suppression, mesures.
  await page.getByTestId('onglet-structure').click();
  const n0 = await noms(page);
  await page.getByTestId('ajouter-section').click();
  await page.getByTestId('nouvelle-Pont').click();
  await expect(page.getByTestId('section')).toHaveCount(n0.length + 1);
  await annuler.click();
  await expect.poll(() => noms(page)).toEqual(n0);
  await retablir.click();
  await expect(page.getByTestId('section')).toHaveCount(n0.length + 1);
  await annuler.click();
  await expect.poll(() => noms(page)).toEqual(n0);

  await page.getByTestId('section-tete').first().click();
  await page.getByTestId('section-descendre').first().click();
  await expect.poll(async () => (await noms(page))[1]).toBe(n0[0]);
  await annuler.click();
  await expect.poll(() => noms(page)).toEqual(n0);
  await retablir.click();
  await expect.poll(async () => (await noms(page))[1]).toBe(n0[0]);
  await annuler.click();
  await expect.poll(() => noms(page)).toEqual(n0);

  const ouverte = page.locator('[data-testid=section][data-ouverte="1"]');
  if ((await ouverte.count()) === 0) await page.getByTestId('section-tete').first().click();
  await ouverte.first().getByTestId('section-supprimer').click();
  await expect(page.getByTestId('section')).toHaveCount(n0.length - 1);
  await annuler.click();
  await expect.poll(() => noms(page)).toEqual(n0);

  // Mixage : volume (plusieurs pas de curseur = une seule action), muet, pan.
  await page.getByTestId('onglet-son').click();
  const vol = page.getByTestId('volume-batterie');
  const v0 = Number(await vol.inputValue());
  for (const v of [0.7, 0.5, 0.3]) await curseur(vol, v);
  await expect(vol).toHaveValue('0.3');
  await annuler.click();
  await expect(vol).toHaveValue(String(v0));
  await retablir.click();
  await expect(vol).toHaveValue('0.3');
  await page.getByTestId('muet-basse').click();
  await expect(page.getByTestId('muet-basse')).toHaveAttribute('aria-pressed', 'true');
  await annuler.click();
  await expect(page.getByTestId('muet-basse')).toHaveAttribute('aria-pressed', 'false');
  const pan = page.getByTestId('pan-accords');
  const p0 = await pan.inputValue();
  await curseur(pan, -0.5);
  await annuler.click();
  await expect(pan).toHaveValue(p0);

  // Le morceau sauvé suit l'état annulé (volume 0,3 rétabli, basse non muette).
  await page.getByTestId('retour').click();
  const [{ m }] = await morceauxIdb(page);
  expect(m.pistes.find((p) => p.id === 'batterie')!.volume).toBeCloseTo(0.3, 5);
  expect(m.pistes.find((p) => p.id === 'basse')!.muet).toBe(false);
  expect(r.erreurs).toEqual([]);
});
