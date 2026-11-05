// Performance : export d'un morceau de 3 min (105 mesures à 140 BPM) et régularité du pas courant en lecture.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { analyserWav, ecrireMorceauIdb, exporter, morceauxIdb, nouveau, SORTIES, surveiller } from './outils';

test('export d\'un morceau de 3 min : durée, sonie, temps', async ({ page }) => {
  const r = await surveiller(page);
  await nouveau(page, 'trap');
  await page.getByTestId('retour').click();
  const [{ id, m }] = await morceauxIdb(page);
  // Intro 9 + 6 × 16 mesures = 105 mesures × 240 / 140 = 180 s.
  const [intro, couplet, refrain, ...autres] = m.ordre;
  const outro = autres.at(-1)!;
  const sections = m.sections.map((s) => ({ ...s, mesures: s.id === intro ? 9 : 16 }));
  const long = { ...m, sections, ordre: [intro, couplet, refrain, couplet, refrain, refrain, outro] };
  await ecrireMorceauIdb(page, id, long);
  await page.reload();
  await page.getByTestId('ouvrir-morceau').first().click();
  const memoireAvant = await page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
  const e = await exporter(page, 'qa-trap-3min');
  const w = analyserWav(e.chemin);
  const bilan = { msExport: e.ms, duree: w.duree, lufs: w.lufs, crete: w.creteVraie, tasAvantMo: Math.round(memoireAvant / 1e6) };
  writeFileSync(join(SORTIES, 'bilan-performance-export.json'), JSON.stringify(bilan, null, 2));
  expect(Math.abs(w.duree - 180)).toBeLessThan(0.01);
  expect(Math.abs(w.lufs + 14)).toBeLessThanOrEqual(0.5);
  expect(w.creteVraie).toBeLessThanOrEqual(-1);
  expect(e.ms).toBeLessThan(60_000);
  expect(r.erreurs).toEqual([]);
});

test('lecture : le pas courant avance régulièrement (trap 140 BPM, 107 ms par pas)', async ({ page }) => {
  await nouveau(page, 'trap');
  await page.evaluate(() => {
    const w = window as unknown as { __pas: [number, number][] };
    w.__pas = [];
    const pads = document.querySelector('[data-testid=pads]')!;
    new MutationObserver(() => {
      const c = pads.querySelector('[data-courant="1"]');
      const k = c ? Number(c.getAttribute('data-testid')!.slice(4)) : -1;
      const der = w.__pas.at(-1);
      if (!der || der[1] !== k) w.__pas.push([performance.now(), k]);
    }).observe(pads, { subtree: true, attributes: true, attributeFilter: ['data-courant'] });
  });
  await page.getByTestId('lecture').click();
  await page.waitForTimeout(8000);
  await page.getByTestId('lecture').click();
  const pas = (await page.evaluate(() => (window as unknown as { __pas: [number, number][] }).__pas)).filter(([, k]) => k >= 0);
  const intervalles = pas.slice(1).map(([t], i) => t - pas[i]![0]);
  const sauts = pas.slice(1).filter(([, k], i) => k !== (pas[i]![1] + 1) % 16).length;
  const tri = [...intervalles].sort((a, b) => a - b);
  const moy = intervalles.reduce((s, x) => s + x, 0) / intervalles.length;
  const bilan = {
    pas: pas.length,
    sauts,
    moyenneMs: Math.round(moy * 10) / 10,
    medianeMs: Math.round(tri[tri.length >> 1]! * 10) / 10,
    p95Ms: Math.round(tri[Math.floor(tri.length * 0.95)]! * 10) / 10,
    maxMs: Math.round(tri.at(-1)! * 10) / 10,
    derive: Math.round(((pas.at(-1)![0] - pas[0]![0]) / (pas.length - 1 + sauts) - 60000 / 140 / 4) * 100) / 100,
  };
  writeFileSync(join(SORTIES, 'bilan-performance-lecture.json'), JSON.stringify(bilan, null, 2));
  expect(pas.length).toBeGreaterThan(60);
  expect(Math.abs(moy - 60000 / 140 / 4)).toBeLessThan(5);
  expect(bilan.p95Ms).toBeLessThan(140);
  expect(sauts).toBeLessThanOrEqual(2);
});
