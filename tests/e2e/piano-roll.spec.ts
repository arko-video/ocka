// Vue Pistes et piano roll (U1, vague C1) : « + Piste » Piano → 4 notes posées au piano roll « Complet » → un accord
// en un toucher → « Pistes séparées » : la piste « Piano » a son fichier, et il n'est pas vide.
// Puis captures 360×800 (tests/e2e/captures/u1-*.png) : vue Pistes, choix d'instrument, piano roll Complet et Simple.
import { join } from 'node:path';
import type { Morceau } from '../../src/morceau/types';
import { expect, test, type Page } from '@playwright/test';
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

/** Position (écran) du milieu de la case (pas, midi) de la grille, lue dans ses data-* (zoom et défilement). */
async function caseGrille(page: Page, pas: number, rang: number) {
  const g = page.getByTestId('pr-grille');
  const d = await g.evaluate((el) => ({ ...(el as HTMLElement).dataset }));
  const box = (await g.boundingBox())!;
  const lignes = d.lignes!.split(',').map(Number);
  const [w, h, debut, haut] = [d.w, d.h, d.debut, d.haut].map(Number) as [number, number, number, number];
  const ligne = Math.ceil(haut) + rang;
  return {
    x: box.x + (pas - debut) * w + w / 2,
    y: box.y + (ligne - haut) * h + h / 2,
    midi: lignes[ligne]!,
  };
}

async function ajouterPiano(page: Page) {
  await page.getByTestId('onglet-beat').click();
  await page.getByTestId('vue-instruments').click();
  await page.getByTestId('ajouter-piste').click();
  await expect(page.getByTestId('panneau-choix-instrument')).toBeVisible();
  await page.getByTestId('choisir-ocka-piano@1').click();
  await expect(page.getByTestId('pr-complet')).toBeVisible();
}

test('piste piano : 4 notes + un accord au piano roll → piste séparée « Piano » non vide', async ({
  page,
}) => {
  const dossier = dossierNeuf('piano-roll');
  await nouveauMorceau(page, 'trap');
  await ajouterPiano(page);

  const notes = page.getByTestId('pr-note');
  const poses: number[] = [];
  for (const [k, pas] of [0, 4, 8, 12].entries()) {
    const c = await caseGrille(page, pas, 8 - k * 2);
    await page.mouse.click(c.x, c.y);
    poses.push(c.midi);
    await expect(notes).toHaveCount(k + 1);
  }
  await page.getByTestId('pr-accord').click();
  await page.getByTestId('accord-majeur').click();
  const c = await caseGrille(page, 16, 10);
  await page.mouse.click(c.x, c.y);
  await expect(notes).toHaveCount(7);
  // Annuler retire l'accord en une seule étape, Rétablir… on le repose.
  await page.getByTestId('pr-annuler').click();
  await expect(notes).toHaveCount(4);
  await page.mouse.click(c.x, c.y);
  await expect(notes).toHaveCount(7);
  await page.getByTestId('pr-retour').click();
  await expect(page.getByTestId('panneau-piano-roll')).toBeHidden();

  const zip = await exporterVers(page, 'export-pistes', dossier);
  expect(zipSain(zip).ok).toBe(true);
  const { dossier: d, fichiers } = extraire(zip, 'piano-roll-x');
  const nom = fichiers.find((f) => f.endsWith('Piano.wav'));
  expect(nom, fichiers.join(', ')).toBeTruthy();
  expect(crete(lireWav(join(d, nom!)))).toBeGreaterThan(0.01);

  await page.getByTestId('retour').click();
  const m = (await morceauxIdb(page))[0]!.m as unknown as Morceau;
  const piste = m.pistes.find((p) => p.genre === 'instrument' && p.nom === 'Piano')!;
  const motif = m.motifs[m.sections.find((s) => s.id === m.ordre[0])!.motifs[piste.id]!]!;
  expect(motif.type).toBe('notes');
  if (motif.type === 'notes') {
    expect(motif.notes.filter((n) => n.pas === 16).map((n) => n.midi)).toEqual([
      c.midi,
      c.midi + 4,
      c.midi + 7,
    ]);
    expect(poses.every((x) => motif.notes.some((n) => n.midi === x))).toBe(true);
  }
});

test.describe('captures 360×800', () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  const DOSSIER = 'tests/e2e/captures';
  async function capturer(page: Page, nom: string) {
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DOSSIER}/u1-${nom}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), nom).toBeLessThanOrEqual(360);
  }

  test('vue Pistes, choix d’instrument, piano roll Complet et Simple', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await page.route(/^https:\/\//, (r) => r.abort());
    await page.goto('./');
    await page.evaluate(() => document.fonts.ready);
    const bienvenue = page.getByTestId('bienvenue-passer');
    if (await bienvenue.isVisible()) await bienvenue.click();
    await page.getByTestId('nouveau-morceau').click();
    await page.getByTestId('style-lofi').click();
    await page.getByTestId('vue-instruments').click();
    await page.getByTestId('ajouter-piste').click();
    await capturer(page, '02-choix-instrument');
    await page.getByTestId('choisir-ocka-piano@1').click();
    await expect(page.getByTestId('pr-complet')).toBeVisible();
    for (const [k, pas] of [0, 4, 8, 12, 20, 24].entries()) {
      const c = await caseGrille(page, pas, 9 - (k % 4) * 2);
      await page.touchscreen.tap(c.x, c.y);
    }
    await page.getByTestId('pr-accord').click();
    await page.getByTestId('accord-gamme').click();
    const c = await caseGrille(page, 16, 9);
    await page.touchscreen.tap(c.x, c.y);
    await expect(page.getByTestId('pr-poignee')).toHaveCount(0); // un accord = 3 notes choisies, pas de poignée
    const n = await caseGrille(page, 0, 9); // toucher une note la choisit : poignée de 24 px dessous
    await page.touchscreen.tap(n.x, n.y);
    await expect(page.getByTestId('pr-poignee')).toHaveCount(1);
    await page.getByTestId('pr-velocite').click();
    await page
      .getByTestId('toast')
      .waitFor({ state: 'hidden', timeout: 8000 })
      .catch(() => undefined);
    await capturer(page, '03-piano-roll-complet');
    await page.getByTestId('pr-accord').click();
    await capturer(page, '04-piano-roll-accord');
    await page.getByTestId('pr-accord').click();
    await page.getByTestId('pr-mode-simple').click();
    await expect(page.getByTestId('pr-simple')).toBeVisible();
    await capturer(page, '05-piano-roll-simple');
    await page.getByTestId('pr-retour').click();
    await page
      .getByTestId('toast')
      .waitFor({ state: 'hidden', timeout: 8000 })
      .catch(() => undefined);
    await capturer(page, '01-vue-pistes');
    expect(erreurs).toEqual([]);
  });
});
