// Reproductibilité : le même morceau exporté plusieurs fois (WAV 24 bits, sans dither) donne-t-il le même PCM ?
// 2 exports de suite dans la même page, puis un 3e après rechargement (caches et Worker de synthèse neufs).
// Au bit près, tant mieux ; sinon on mesure l'écart. Chrome varie déjà de −78 à −84 dB sur des kicks qui se
// chevauchent (constat de M1) : le seuil est donc −70 dB, sans décalage.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { comparerWav } from './comparer';
import { exporter, nouveau, SORTIES, surveiller } from './outils';

test('reproductibilité : 3 exports WAV 24 bits du même morceau, écart ≤ −70 dB et aucun décalage', async ({ page }) => {
  const r = await surveiller(page);
  await nouveau(page, 'trap');
  const e1 = await exporter(page, 'qa-repro-1');
  const e2 = await exporter(page, 'qa-repro-2');
  await page.getByTestId('retour').click();
  await page.reload();
  await page.getByTestId('ouvrir-morceau').first().click();
  const e3 = await exporter(page, 'qa-repro-3');

  const c12 = comparerWav(e1.chemin, e2.chemin);
  const c13 = comparerWav(e1.chemin, e3.chemin);
  const bilan = { memePage: c12, apresRechargement: c13, lufsAffiches: [e1.lufsAffiche, e2.lufsAffiche, e3.lufsAffiche] };
  writeFileSync(join(SORTIES, 'bilan-reproductibilite.json'), JSON.stringify(bilan, null, 2));
  for (const c of [c12, c13]) {
    expect(c.trames[0]).toBe(c.trames[1]);
    expect(c.decalage).toBe(0);
    expect(c.ecartDb).toBeLessThanOrEqual(-70);
  }
  expect(r.erreurs).toEqual([]);
});
