// C3 (R) — effets de performance d'une section : l'ÉCOUTE (gels calculés en tâche de fond, attendre = false) et
// l'EXPORT (attendre = true) jouent les MÊMES échantillons ; l'effet s'entend sur son passage et rien d'autre ne
// change avant lui. Besoin du serveur de dev (modules sources) : npx vite --port 5198 --strictPort.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SORTIES } from './outils';

const DEV = process.env.OCKA_DEV ?? 'http://localhost:5198/ocka/';

test('effets de fin : écoute = export (mêmes gels, au bit près), l’effet s’entend sur son passage seulement', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto(DEV);
  await page.waitForLoadState('networkidle');
  // Le serveur de dev peut recharger la page (dépendances optimisées au 1er passage) : on réessaie.
  const mesurer = () =>
    page.evaluate(async () => {
      const imp = (c: string) => import(/* @vite-ignore */ `/ocka/src/${c}.ts`);
      const { nouveauMorceau } = await imp('morceau/styles');
      const { pasVersSecondes } = await imp('morceau/temps');
      const { rendre } = await imp('moteur/export-rendu');
      const { outilsGels } = await imp('moteur/gels');
      const perf = await imp('moteur/performance');
      const FS = 44100;
      const base = nouveauMorceau('trap', 'QA perf');
      base.ordre = base.ordre.slice(0, 2);
      const s = base.sections.find((x: { id: string }) => x.id === base.ordre[0]);
      const fin = s.mesures * 16;
      const resultats: Record<string, unknown> = {};
      for (const type of ['reverse', 'tape-stop', 'stutter']) {
        const m = perf.ajouterEffetPerf(base, s.id, { type, pas: fin - 8, duree: 8, division: 4 });
        const de = pasVersSecondes(m, fin - 8);
        const a = pasVersSecondes(m, fin);
        // Écoute : rien de prêt → [] ; le calcul part en fond, puis prevenirGels().
        perf.viderCachePerf();
        const avant = await perf.gelsPerformance(m, { frequence: FS, attendre: false });
        // Le calcul de fond se termine par prevenirGels() ; on redemande jusqu'à ce que les gels soient prêts.
        let ecoute: { piste: string; cle: string; de: number; a: number; pcm: { canaux: Float32Array[] } }[] =
          [];
        for (let i = 0; i < 600 && ecoute.length === 0; i++) {
          await new Promise((ok) => setTimeout(ok, 100));
          ecoute = await perf.gelsPerformance(m, { frequence: FS, attendre: false });
        }
        // Export : le MÊME rendu (même clé, gardé en mémoire) → mêmes échantillons, au bit près.
        const exporte = await perf.gelsPerformance(m, { frequence: FS, attendre: true });
        let memes = ecoute.length === exporte.length && ecoute.length > 0;
        for (let i = 0; memes && i < ecoute.length; i++) {
          const x = ecoute[i];
          const y = exporte[i];
          memes =
            x.cle === y.cle &&
            x.de === y.de &&
            x.a === y.a &&
            x.pcm.canaux.every(
              (c: Float32Array, k: number) =>
                c.length === y.pcm.canaux[k].length &&
                c.every((v: number, j: number) => v === y.pcm.canaux[k][j]),
            );
        }
        // Recalcul depuis zéro (cache vidé) : au plancher de reproductibilité de Chrome.
        perf.viderCachePerf();
        const recalcul = await perf.gelsPerformance(m, { frequence: FS, attendre: true });
        let ecartRecalcul = 0;
        recalcul.forEach((g: { pcm: { canaux: Float32Array[] } }, i: number) =>
          g.pcm.canaux.forEach((c, k) =>
            c.forEach(
              (v, j) =>
                (ecartRecalcul = Math.max(ecartRecalcul, Math.abs(v - ecoute[i]!.pcm.canaux[k]![j]!))),
            ),
          ),
        );
        perf.viderCachePerf();
        // Rendus du mix : sans effet, avec effet (export), avec les gels de l'écoute.
        const sauve = outilsGels.fournisseurs;
        const sans = (await rendre(base, {})) as Float32Array[];
        const avec = (await rendre(m, {})) as Float32Array[];
        const avec2 = (await rendre(m, {})) as Float32Array[];
        outilsGels.fournisseurs = [async () => ecoute];
        const parEcoute = (await rendre(m, {})) as Float32Array[];
        outilsGels.fournisseurs = sauve;
        const ecart = (x: Float32Array[], y: Float32Array[], t0: number, t1: number) => {
          let e = 0;
          for (let k = 0; k < 2; k++)
            for (let i = Math.round(t0 * FS); i < Math.round(t1 * FS); i++)
              e = Math.max(e, Math.abs(x[k]![i]! - (y[k]![i] ?? 0)));
          return e > 0 ? 20 * Math.log10(e) : -999;
        };
        resultats[type] = {
          avant: avant.length,
          gels: ecoute.length,
          pistes: ecoute.map((g: { piste: string }) => g.piste),
          memes,
          recalcul: ecartRecalcul > 0 ? 20 * Math.log10(ecartRecalcul) : -999,
          avantPassage: ecart(sans, avec, 0, de - 0.05),
          dansPassage: ecart(sans, avec, de + 0.02, a - 0.02),
          ecouteExport: ecart(avec, parEcoute, 0, a + 1),
          plancher: ecart(avec, avec2, 0, a + 1),
        };
      }
      return resultats;
    });
  let bilan: Awaited<ReturnType<typeof mesurer>> | null = null;
  for (let essai = 0; !bilan; essai++) {
    try {
      bilan = await mesurer();
    } catch (e) {
      if (essai >= 2 || !String(e).includes('context was destroyed')) throw e;
      await page.waitForLoadState('networkidle');
    }
  }
  writeFileSync(join(SORTIES, 'bilan-perf-sections.json'), JSON.stringify(bilan, null, 2));
  for (const [type, r] of Object.entries(bilan) as [string, Record<string, number | boolean>][]) {
    expect(r.avant, type).toBe(0); // écoute : rien de prêt au premier passage
    expect(r.gels, type).toBeGreaterThan(1);
    expect(r.memes, type).toBe(true); // écoute = export, au bit près
    expect(r.recalcul as number, type).toBeLessThanOrEqual(-70); // un recalcul complet : plancher de Chrome
    // Le mix aussi : au plancher de Chrome (deux exports identiques diffèrent déjà de ~−80 dB), comme gels.qa.ts.
    expect(r.ecouteExport as number, type).toBeLessThanOrEqual(Math.max(r.plancher as number, -120) + 6);
    expect(r.ecouteExport as number, type).toBeLessThanOrEqual(-70);
    expect(r.avantPassage as number, type).toBeLessThanOrEqual(-80); // rien ne change avant le passage
    expect(r.dansPassage as number, type).toBeGreaterThan(-30); // l'effet s'entend
  }
});
