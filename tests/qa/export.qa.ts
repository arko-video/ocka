// Export WAV des 3 styles (24 bits, standard) et d'un cas « fort » 16 bits, vérifiés par ffprobe et ffmpeg ebur128.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { analyserWav, dureeAttendue, exporter, morceauxIdb, nouveau, SORTIES, surveiller } from './outils';

const bilan: Record<string, unknown> = {};
test.afterAll(() => writeFileSync(join(SORTIES, 'bilan-export.json'), JSON.stringify(bilan, null, 2)));

for (const style of ['trap', 'drill', 'lofi'] as const) {
  test(`${style} : nouveau morceau → WAV 24 bits, durée, −14 LUFS, ≤ −1 dBTP`, async ({ page }) => {
    const r = await surveiller(page);
    await nouveau(page, style);
    const e = await exporter(page, `qa-${style}`);
    const [{ m }] = await morceauxIdb(page);
    const w = analyserWav(e.chemin);
    const attendu = dureeAttendue(m);
    bilan[style] = { ...w, attendu, msExport: e.ms, affiche: [e.lufsAffiche, e.creteAffichee], tempo: m.tempo };
    expect(w).toMatchObject({ codec: 'pcm_s24le', tag: '0x0001', frequence: 44100, canaux: 2, bits: 24, formatEntete: 1 });
    expect(Math.abs(w.duree - attendu)).toBeLessThan(0.01);
    expect(Math.abs(w.lufs + 14)).toBeLessThanOrEqual(0.5);
    expect(w.creteVraie).toBeLessThanOrEqual(-1);
    expect(r.erreurs).toEqual([]);
    expect(r.sortantes).toEqual([]);
    expect(r.csp).toEqual([]);
  });
}

test('trap en mode « fort » 16 bits : −11 LUFS, ≤ −2 dBTP', async ({ page }) => {
  const r = await surveiller(page);
  await nouveau(page, 'trap');
  await page.getByTestId('onglet-son').click();
  await page.getByTestId('niveau-fort').click();
  await expect(page.getByTestId('niveau-fort')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('option-16-bits').check();
  const e = await exporter(page, 'qa-trap-fort-16');
  const [{ m }] = await morceauxIdb(page);
  const w = analyserWav(e.chemin);
  bilan['fort16'] = { ...w, attendu: dureeAttendue(m), msExport: e.ms, affiche: [e.lufsAffiche, e.creteAffichee], niveau: m.master.niveau };
  expect(m.master.niveau).toBe('fort');
  expect(w).toMatchObject({ codec: 'pcm_s16le', tag: '0x0001', frequence: 44100, canaux: 2, bits: 16, formatEntete: 1 });
  expect(Math.abs(w.duree - dureeAttendue(m))).toBeLessThan(0.01);
  expect(Math.abs(w.lufs + 11)).toBeLessThanOrEqual(0.5);
  expect(w.creteVraie).toBeLessThanOrEqual(-2);
  expect(r.erreurs).toEqual([]);
});
