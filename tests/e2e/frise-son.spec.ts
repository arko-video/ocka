// U2 (vague C1) : frise, mélangeur, chaîne d'effets, pompe et automation dessinée au doigt, en 360×800.
// 1. Parcours à l'écran + captures (dossier CAPTURES_U2, sinon tests/e2e/captures) + morceau sauvé vérifié.
// 2. et 3. Le son : Saturation + Pompe changent le stem ; 3 points de volume → le stem suit la courbe.
//    M1 a branché M2 (inserts, sidechain, automation dans le graphe) : ils tournent toujours (intégration C1).
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { dossierNeuf, ecrireMorceauIdb, exporterVers, extraire, lireWav, morceauxIdb, nouveauMorceau } from './outils-e2e';

test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });

const DOSSIER = process.env.CAPTURES_U2 ?? 'tests/e2e/captures';
async function capturer(page: Page, nom: string) {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${DOSSIER}/c1-u2-${nom}.png` });
  const large = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(large, nom).toBeLessThanOrEqual(360);
}

type Brut = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Morceau trap avec une mélodie (couplet et refrain) ; `ordre` raccourci au besoin. Ouvert sur Beat. */
async function preparer(page: Page, ordre?: (o: string[]) => string[]) {
  await nouveauMorceau(page, 'trap');
  await page.getByTestId('retour').click();
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  const [{ id, m }] = (await morceauxIdb(page)) as unknown as { id: string; m: Brut }[];
  m.motifs['mel-a'] = {
    type: 'notes',
    pas: 16,
    notes: [
      { pas: 0, duree: 2, midi: 69, vel: 0.8 },
      { pas: 4, duree: 2, midi: 72, vel: 0.7 },
      { pas: 8, duree: 4, midi: 76, vel: 0.9 },
      { pas: 12, duree: 2, midi: 74, vel: 0.6 },
    ],
  };
  if (!m.pistes.some((p: Brut) => p.id === 'melodie')) {
    const i = m.pistes.findIndex((p: Brut) => p.id === 'sons');
    m.pistes.splice(i, 0, { id: 'melodie', genre: 'instrument', nom: 'Mélodie', instrument: 'ocka-piano@1', volume: 0.8, pan: 0, muet: false, solo: false });
  }
  for (const s of m.sections) if (s.nom === 'Couplet' || s.nom === 'Refrain') s.motifs.melodie = 'mel-a';
  if (ordre) m.ordre = ordre(m.ordre);
  await ecrireMorceauIdb(page, id, m);
  await page.reload();
  await page.getByTestId('ouvrir-morceau').first().click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
}

async function morceauSauve(page: Page): Promise<Brut> {
  await page.getByTestId('retour').click();
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  return ((await morceauxIdb(page)) as unknown as { m: Brut }[])[0]!.m;
}

/** Saturation puis Pompe sur une piste, par l'écran Son. */
async function saturerEtPomper(page: Page, piste: string) {
  await page.getByTestId('onglet-son').click();
  await page.getByTestId(`effets-${piste}`).click();
  await expect(page.getByTestId('panneau-effets')).toBeVisible();
  await page.getByTestId('ajouter-insert').click();
  await page.getByTestId('ajouter-saturation').click();
  await expect(page.getByTestId('insert-saturation')).toBeVisible();
  await page.getByTestId('panneau-pompe').check();
}

/** Active « Avancé » (Son → Réglages avancés). */
async function activerAvance(page: Page) {
  await page.getByTestId('onglet-son').click();
  await page.getByTestId('ouvrir-avance').click();
  await page.getByTestId('mode-avance').check();
  await page.keyboard.press('Escape');
}

/** Dessine des points (fractions de largeur, valeurs 0 à 1) dans le couloir d'un passage. */
async function dessiner(page: Page, piste: string, passage: number, points: [number, number][]) {
  const c = page.getByTestId(`couloir-${piste}-${passage}`);
  await c.scrollIntoViewIfNeeded();
  for (const [fx, v] of points) {
    const b = (await c.boundingBox())!;
    await page.mouse.click(b.x + fx * b.width, b.y + 6 + (1 - v) * (b.height - 12));
    await page.waitForTimeout(450); // pas de « double toucher » (qui enlève un point)
  }
  await expect(c).toHaveAttribute('data-points', String(points.length));
}

test('frise, mélangeur, effets et automation : écrans, captures, morceau sauvé', async ({ page }) => {
  await preparer(page);
  await page.evaluate(() => document.fonts.ready);

  // Structure → Frise : une ligne par piste, un clip par passage ; la mélodie est partagée (couplet et refrain).
  await page.getByTestId('onglet-structure').click();
  await page.getByTestId('vue-frise').click();
  await expect(page.getByTestId('frise')).toBeVisible();
  await expect(page.getByTestId('frise-piste-melodie')).toBeVisible();
  await capturer(page, '01-frise');

  const clip = page.locator('[data-testid^="clip-melodie-"][data-motif="mel-a"]').first();
  await clip.dispatchEvent('contextmenu');
  await expect(page.getByTestId('menu-clip')).toBeVisible();
  await expect(page.getByTestId('clip-rendre-unique')).toBeVisible();
  await capturer(page, '02-menu-clip');
  await page.getByTestId('clip-rendre-unique').click();
  await expect(page.getByTestId('menu-clip')).toHaveCount(0);
  await expect(page.locator('[data-testid^="clip-melodie-"][data-motif="mel-a"]').first()).toBeVisible();

  // Son : tranches compactes, puis la chaîne d'effets des accords.
  await page.getByTestId('onglet-son').click();
  await capturer(page, '03-melangeur');
  await saturerEtPomper(page, 'accords');
  await page.getByTestId('ajouter-insert').click();
  await page.getByTestId('ajouter-envoi-reverbe').click();
  await page.getByTestId('insert-monter-envoi-reverbe').click();
  await capturer(page, '04-effets');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('effets-accords')).toHaveText('Effets (2)');
  await expect(page.getByTestId('pompe-accords')).toHaveAttribute('aria-pressed', 'true');

  // Avancé : les réglages de chaque effet.
  await activerAvance(page);
  await page.getByTestId('effets-accords').click();
  await expect(page.getByTestId('params-saturation')).toBeVisible();
  await capturer(page, '05-effets-avance');
  await page.keyboard.press('Escape');

  // Frise : couloir d'automation du volume des accords, 3 points dessinés dans le 2e passage (couplet).
  await page.getByTestId('onglet-structure').click();
  await page.getByTestId('auto-accords').click();
  await dessiner(page, 'accords', 1, [[0.03, 0.9], [0.5, 0.2], [0.97, 0.8]]);
  await page.getByTestId('frise-defile').evaluate((d) => (d.scrollLeft = 0));
  await capturer(page, '06-automation');
  await page.getByTestId('auto-cible-accords').click();
  await page.getByTestId('lfo-ajouter').click();
  await page.getByTestId('lfo-forme-0-triangle').click();
  await capturer(page, '07-lfo');
  await page.getByTestId('lfo-retirer-0').click();
  await page.keyboard.press('Escape');

  const m = await morceauSauve(page);
  const acc = m.pistes.find((p: Brut) => p.id === 'accords');
  expect(acc.inserts.map((x: Brut) => x.type)).toEqual(['envoi-reverbe', 'saturation']);
  expect(acc.sidechain).toMatchObject({ source: 'kick', force: 0.5 });
  const couplet = m.ordre[1];
  const pts = acc.auto[0].sections[couplet] as { pas: number; valeur: number }[];
  expect(acc.auto[0].cible).toEqual({ type: 'volume' });
  expect(pts.map((p) => p.valeur)).toEqual([expect.closeTo(0.9, 1), expect.closeTo(0.2, 1), expect.closeTo(0.8, 1)]);
  expect(acc.lfo).toBeUndefined();
  // Rendre unique : la mélodie n'est plus partagée par tous.
  const motifsMel = new Set(m.sections.map((s: Brut) => s.motifs.melodie).filter(Boolean));
  expect(motifsMel.size).toBe(2);
});

/** RMS de `x` sur [de, a[ (s). */
function rms(x: Float32Array, f: number, de: number, a: number): number {
  let s = 0;
  const i0 = Math.max(0, Math.floor(de * f));
  const i1 = Math.min(x.length, Math.floor(a * f));
  for (let i = i0; i < i1; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, i1 - i0));
}

async function stemAccords(page: Page, nom: string): Promise<{ x: Float32Array; f: number }> {
  const zip = await exporterVers(page, 'export-pistes', dossierNeuf(nom));
  const { dossier, fichiers } = extraire(zip, `${nom}-x`);
  const f = fichiers.find((n) => / - Accords\.wav$/.test(n))!;
  const w = lireWav(join(dossier, f));
  return { x: w.donnees[0]!, f: w.frequence };
}

test('Saturation + Pompe sur les accords : le stem change de façon mesurable', async ({ page }) => {
  await preparer(page, (o) => o.slice(1, 2));
  const avant = await stemAccords(page, 'u2-sat-avant');
  await saturerEtPomper(page, 'accords');
  await page.keyboard.press('Escape');
  const apres = await stemAccords(page, 'u2-sat-apres');
  expect(apres.x.length).toBe(avant.x.length);
  let d = 0;
  let r = 0;
  for (let i = 0; i < avant.x.length; i++) {
    d += (apres.x[i]! - avant.x[i]!) ** 2;
    r += avant.x[i]! ** 2;
  }
  expect(Math.sqrt(d / r)).toBeGreaterThan(0.1);
});

test('3 points de volume dessinés : le stem suit la courbe', async ({ page }) => {
  await preparer(page, (o) => o.slice(1, 2));
  const avant = await stemAccords(page, 'u2-auto-avant');
  await activerAvance(page);
  await page.getByTestId('onglet-structure').click();
  await page.getByTestId('vue-frise').click();
  await page.getByTestId('auto-accords').click();
  await dessiner(page, 'accords', 0, [[0.02, 1], [0.5, 0.1], [0.98, 1]]);
  const apres = await stemAccords(page, 'u2-auto-apres');
  const m = await morceauSauve(page);
  const duree = avant.x.length / avant.f;
  const pts = m.pistes.find((p: Brut) => p.id === 'accords').auto[0].sections[m.ordre[0]] as { pas: number; valeur: number }[];
  const fin = pts.at(-1)!.pas;
  // Gain mesuré (stem avec / sans automation) autour de 5 instants : il suit la courbe dessinée (ligne droite).
  for (const k of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const t = k * duree;
    const pas = (k * fin) as number;
    const i = pts.findIndex((p) => p.pas >= pas);
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.max(0, i)]!;
    const attendu = b.pas === a.pas ? b.valeur : a.valeur + ((b.valeur - a.valeur) * (pas - a.pas)) / (b.pas - a.pas);
    const mesure = rms(apres.x, apres.f, t - 0.15, t + 0.15) / Math.max(1e-9, rms(avant.x, avant.f, t - 0.15, t + 0.15));
    expect(Math.abs(mesure - attendu), `t = ${t.toFixed(2)} s : ${mesure} au lieu de ${attendu}`).toBeLessThan(0.08);
  }
});
