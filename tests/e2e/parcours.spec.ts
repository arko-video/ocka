// Parcours complet au pouce : nouveau morceau trap, une frappe, une section, export WAV, rechargement.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function nouveauTrap(page: Page) {
  await page.goto('./');
  await page.getByTestId('nouveau-morceau').click();
  await page.getByTestId('style-trap').click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
}

/**
 * Lit l'en-tête du WAV téléchargé (RIFF / fmt), depuis le disque.
 * (Pas de fetch dans la page : la CSP d'OCKA interdit même fetch(blob:), connect-src 'self'.)
 */
function enteteWav(chemin: string) {
  const b = readFileSync(chemin) as Uint8Array;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const txt = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  return {
    riff: txt(0),
    wave: txt(8),
    fmt: txt(12),
    format: v.getUint16(20, true),
    canaux: v.getUint16(22, true),
    frequence: v.getUint32(24, true),
    bits: v.getUint16(34, true),
  };
}

test('nouveau morceau trap → frappe → section → export WAV → retrouvé après rechargement', async ({ page }) => {
  await nouveauTrap(page);

  // Une frappe de kick sur le pas 6 (vide dans le motif trap), puis Annuler / Rétablir.
  await page.getByTestId('instrument-kick').click();
  const pad = page.getByTestId('pad-5');
  const avant = (await pad.getAttribute('data-etat'))!;
  const apres = { vide: 'fort', fort: 'doux', doux: 'vide' }[avant]!;
  await pad.click();
  await expect(pad).toHaveAttribute('data-etat', apres);
  await page.getByTestId('annuler').click();
  await expect(pad).toHaveAttribute('data-etat', avant);
  await page.getByTestId('retablir').click();
  await expect(pad).toHaveAttribute('data-etat', apres);

  // Une section de plus (Pont) dans Structure.
  await page.getByTestId('onglet-structure').click();
  const sections = page.getByTestId('section');
  const n = await sections.count();
  await page.getByTestId('ajouter-section').click();
  await page.getByTestId('nouvelle-Pont').click();
  await expect(sections).toHaveCount(n + 1);
  await expect(sections.last().getByTestId('section-nom')).toContainText('Pont');

  // Export WAV pour Spotify (24 bits par défaut).
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('exporter-wav').click();
  await expect(page.getByTestId('export-resultat')).toBeVisible({ timeout: 150_000 });
  await expect(page.getByTestId('export-lufs')).toContainText('LUFS');
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByTestId('telecharger').click()]);
  expect(telechargement.suggestedFilename()).toMatch(/\.wav$/);
  expect(enteteWav((await telechargement.path())!)).toEqual({ riff: 'RIFF', wave: 'WAVE', fmt: 'fmt ', format: 1, canaux: 2, frequence: 44100, bits: 24 });

  // Retour à « Mes morceaux » (la sauvegarde est écrite), puis rechargement : le morceau est toujours là.
  await page.getByTestId('retour').click();
  await expect(page.getByTestId('liste-morceaux')).toContainText('Trap');
  await page.reload();
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  await expect(page.getByTestId('liste-morceaux')).toContainText('Trap');
  await page.getByTestId('ouvrir-morceau').first().click();
  await page.getByTestId('onglet-structure').click();
  await expect(page.getByTestId('section')).toHaveCount(n + 1);
});
