// L (vague C3) : une piste « Basse acide 303 » (4 notes, préréglage « Squelch ») → un kick fabriqué (« Phonk saturé »)
// gardé dans « Tes sons » et posé sur un pad, joué dans la grille → export « Pistes séparées » : la 303 et la
// batterie ne sont pas vides. Puis l'onde dessinée au doigt et les bruitages. Captures 360×800 (c3-l-*.png).
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Morceau } from '../../src/morceau/types';
import {
  crete,
  dossierNeuf,
  exporterVers,
  extraire,
  lireWav,
  morceauxIdb,
  nouveauMorceau,
  zipSain,
} from './outils-e2e';

test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });

const DOSSIER = process.env.CAPTURES_L ?? 'tests/e2e/captures';
async function capturer(page: Page, nom: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${DOSSIER}/c3-l-${nom}.png` });
  const large = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(large, nom).toBeLessThanOrEqual(360);
}

/** Milieu de la case (pas, rang) du piano roll, lu dans les data-* de la grille. */
async function caseGrille(page: Page, pas: number, rang: number) {
  const g = page.getByTestId('pr-grille');
  const d = await g.evaluate((el) => ({ ...(el as HTMLElement).dataset }));
  const box = (await g.boundingBox())!;
  const [w, h, debut, haut] = [d.w, d.h, d.debut, d.haut].map(Number) as [number, number, number, number];
  const ligne = Math.ceil(haut) + rang;
  return { x: box.x + (pas - debut) * w + w / 2, y: box.y + (ligne - haut) * h + h / 2 };
}

async function ajouterPiste(page: Page, instrument: string) {
  await page.getByTestId('onglet-beat').click();
  await page.getByTestId('vue-instruments').click();
  await page.getByTestId('ajouter-piste').click();
  await expect(page.getByTestId('panneau-choix-instrument')).toBeVisible();
  await page.getByTestId(`choisir-${instrument}`).click();
  await expect(page.getByTestId('pr-complet')).toBeVisible();
}

async function ouvrirSynthe(page: Page) {
  await page.getByTestId('pr-outils').click();
  await page.getByTestId('pr-synthe').click();
  await expect(page.getByTestId('panneau-synthe')).toBeVisible();
}

test('303 + kick fabriqué sur un pad → pistes séparées non vides', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  const dossier = dossierNeuf('synthes');
  await nouveauMorceau(page, 'trap');

  // Piste 303 : 4 notes, puis le préréglage « Squelch ».
  await ajouterPiste(page, 'ocka-303@1');
  const notes = page.getByTestId('pr-note');
  for (const [k, pas] of [0, 4, 8, 12].entries()) {
    const c = await caseGrille(page, pas, 6 - k);
    await page.mouse.click(c.x, c.y);
    await expect(notes).toHaveCount(k + 1);
  }
  await ouvrirSynthe(page);
  await page.getByTestId('synthe-preset-squelch').click();
  await expect(page.getByTestId('synthe-preset-squelch')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('synthe-onde-1')).toHaveAttribute('aria-checked', 'true');
  await capturer(page, 'synthe-303');
  await page.goBack();
  await page.getByTestId('pr-retour').click();

  // Kick fabriqué : « Phonk saturé », gardé, posé sur le pad 1, joué sur 4 pas.
  await page.getByTestId('vue-batterie').click();
  await page.getByTestId('ton-son').click();
  await page.getByTestId('sons-fabriquer').click();
  await expect(page.getByTestId('panneau-sons-courts')).toBeVisible();
  await page.getByTestId('kick-preset-phonk').click();
  await expect(page.getByTestId('kick-preset-phonk')).toHaveAttribute('aria-checked', 'true');
  await capturer(page, 'kick');
  await page.getByTestId('sons-courts-garder').click();
  await expect(page.getByTestId('sons-courts-pads')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('sons-courts-pad-1').click();
  await expect(page.getByTestId('sons-courts-pad-1')).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await page.goBack();
  await expect(page.getByTestId('panneau-sons-courts')).toHaveCount(0);
  for (const pas of [2, 6, 10, 14]) await page.getByTestId(`pad-${pas}`).click();

  const zip = await exporterVers(page, 'export-pistes', dossier);
  expect(zipSain(zip).ok).toBe(true);
  const { dossier: d, fichiers } = extraire(zip, 'synthes-x');
  const acide = fichiers.find((f) => f.endsWith('303.wav'));
  const batterie = fichiers.find((f) => f.endsWith('Batterie.wav'));
  expect(acide, fichiers.join(', ')).toBeTruthy();
  expect(crete(lireWav(join(d, acide!)))).toBeGreaterThan(0.01);
  expect(crete(lireWav(join(d, batterie!)))).toBeGreaterThan(0.01);

  await page.getByTestId('retour').click();
  const m = (await morceauxIdb(page))[0]!.m as unknown as Morceau;
  const piste = m.pistes.find((p) => p.genre === 'instrument' && p.instrument === 'ocka-303@1');
  expect(piste?.genre === 'instrument' && piste.synthe?.params?.resonance).toBe(0.95);
  const kick = m.sons?.find((s) => s.recette?.type === 'kick');
  expect(kick?.recette).toMatchObject({ type: 'kick', saturation: 0.85 });
  expect(m.pads?.perso1).toBe(kick?.id);
  expect(erreurs).toEqual([]);
});

test('onde dessinée au doigt, chiptune et bruitages : captures', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await nouveauMorceau(page, 'lofi');
  await ajouterPiste(page, 'ocka-onde@1');
  await ouvrirSynthe(page);
  const cadre = page.getByTestId('synthe-onde');
  await cadre.scrollIntoViewIfNeeded();
  const b = (await cadre.boundingBox())!;
  await page.mouse.move(b.x + 4, b.y + b.height * 0.1);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(b.x + (b.width * i) / 12 - 4, b.y + b.height * (i % 2 ? 0.85 : 0.15));
  await page.mouse.up();
  await page.getByTestId('synthe-attaque').fill('600');
  await capturer(page, 'onde');
  await page.goBack();
  await page.getByTestId('pr-retour').click();

  await ajouterPiste(page, 'ocka-nes@1');
  await ouvrirSynthe(page);
  await page.getByTestId('synthe-preset-boss').click();
  await expect(page.getByTestId('synthe-arpege-2')).toHaveAttribute('aria-checked', 'true');
  await capturer(page, 'chiptune');
  await page.goBack();
  await page.getByTestId('pr-retour').click();

  await page.getByTestId('vue-batterie').click();
  await page.getByTestId('ton-son').click();
  await page.getByTestId('sons-fabriquer').click();
  await page.getByTestId('sons-courts-onglet-sfxr').click();
  await page.getByTestId('sfxr-piece').click();
  await page.getByTestId('sfxr-muter').click();
  await expect(page.getByTestId('sons-courts-nom')).toHaveValue('Pièce');
  await capturer(page, 'bruitages');

  await page.goBack();
  await page.goBack();
  await page.getByTestId('retour').click();
  const m = (await morceauxIdb(page))[0]!.m as unknown as Morceau;
  const onde = m.pistes.find((p) => p.genre === 'instrument' && p.instrument === 'ocka-onde@1');
  const o = onde?.genre === 'instrument' ? onde.synthe?.onde : undefined;
  expect(o).toHaveLength(64);
  expect(Math.max(...o!) - Math.min(...o!)).toBeGreaterThan(1);
  expect(erreurs).toEqual([]);
});
