// Sonie des 3 styles de la vague B : un nouveau morceau phonk, pop et boom bap, exporté en WAV au niveau
// « standard », doit sortir à −14 ± 0,5 LUFS (ffmpeg ebur128) avec une crête vraie ≤ −1 dBTP, à la bonne durée.
import { expect, test } from '@playwright/test';
import { analyserWav, dureeAttendue, exporter, morceauxIdb } from '../qa/outils';
import { nouveauMorceau } from './outils-e2e';

for (const style of ['phonk', 'pop', 'boombap'] as const) {
  test(`${style} : −14 ± 0,5 LUFS, crête vraie ≤ −1 dBTP`, async ({ page }) => {
    test.setTimeout(300_000);
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await nouveauMorceau(page, style);
    await expect.poll(async () => (await morceauxIdb(page)).length).toBe(1);
    const [{ m }] = await morceauxIdb(page);
    const { chemin } = await exporter(page, `e2e-sonie-${style}`);
    const w = analyserWav(chemin);
    console.log(`${style} : ${w.lufs} LUFS, ${w.creteVraie} dBTP, ${w.duree.toFixed(3)} s`);
    expect(w.lufs).toBeGreaterThanOrEqual(-14.5);
    expect(w.lufs).toBeLessThanOrEqual(-13.5);
    expect(w.creteVraie).toBeLessThanOrEqual(-1);
    expect(Math.abs(w.duree - dureeAttendue(m))).toBeLessThan(0.05);
    expect(erreurs).toEqual([]);
  });
}
