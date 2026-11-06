// Contrat C3 — test nul des GELS (moteur/gels.ts : effets de performance de R, gel d'une piste de V) : on gèle la
// basse EN ENTIER et les accords de 2 s à 6 s avec leur propre rendu (rendrePistesSeparees), sans rien y changer ;
// l'export doit rester le même, au plancher de reproductibilité de Chrome. Seuil (intégration C3) : deux exports SANS
// gel diffèrent déjà de −79,2 à −84 dB selon la charge de la machine (mesuré pendant C3) ; un seuil fixe de −80 dB
// échouait donc sur le plancher lui-même. On exige : pas plus de 6 dB au-dessus du plancher MESURÉ dans ce test, et
// jamais au-dessus de −75 dB (≈ 1/5600 de la pleine échelle, inaudible ; décisions v2 §1 : −80 dB « au plancher »).
// Puis un gel MODIFIÉ (silence) doit s'entendre.
// Besoin du serveur de dev (modules sources) : npx vite --port 5198 --strictPort.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SORTIES } from './outils';

const DEV = 'http://localhost:5198/ocka/';

test('gels : piste gelée en entier + passage gelé = même export (plancher de Chrome) ; un gel modifié s’entend', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(DEV);
  const bilan = await page.evaluate(async () => {
    const imp = (c: string) => import(/* @vite-ignore */ `/ocka/src/${c}.ts`);
    const { nouveauMorceau } = await imp('morceau/styles');
    const { dureeMorceau } = await imp('morceau/temps');
    const { rendre } = await imp('moteur/export-rendu');
    const { outilsGels, rendrePistesSeparees } = await imp('moteur/gels');
    const FS = 44100;
    const m = nouveauMorceau('trap', 'QA gels');
    m.ordre = m.ordre.slice(0, 2);
    const duree = dureeMorceau(m);
    const ecart = (a: Float32Array[], b: Float32Array[]) => {
      let e = 0;
      let crete = 0;
      for (let k = 0; k < 2; k++) for (let i = 0; i < a[k]!.length; i++) (e = Math.max(e, Math.abs(a[k]![i]! - (b[k]![i] ?? 0)))), (crete = Math.max(crete, Math.abs(a[k]![i]!)));
      return { db: e > 0 ? 20 * Math.log10(e) : -999, crete };
    };
    const avant = outilsGels.fournisseurs;
    try {
      outilsGels.fournisseurs = [];
      const reference = (await rendre(m, {})) as Float32Array[];
      const plancher = ecart(reference, (await rendre(m, {})) as Float32Array[]);
      const basse = (await rendrePistesSeparees(m, ['basse'], 0, duree + 2, FS)).get('basse');
      const accords = (await rendrePistesSeparees(m, ['accords'], 2, 6, FS)).get('accords');
      const gels = [
        { piste: 'basse', de: 0, a: duree + 2, pcm: basse, cle: 'qa-basse' },
        { piste: 'accords', de: 2, a: 6, pcm: accords, cle: 'qa-accords' },
      ];
      outilsGels.fournisseurs = [async () => gels.slice(0, 1)];
      const seuleBasse = ecart(reference, (await rendre(m, {})) as Float32Array[]);
      outilsGels.fournisseurs = [async () => gels];
      const gele = (await rendre(m, {})) as Float32Array[];
      const silence = { frequence: FS, canaux: [new Float32Array(4 * FS), new Float32Array(4 * FS)] };
      outilsGels.fournisseurs = [async () => [{ piste: 'accords', de: 2, a: 6, pcm: silence, cle: 'qa-silence' }]];
      const modifie = (await rendre(m, {})) as Float32Array[];
      return { duree, plancher, seuleBasse, nul: ecart(reference, gele), modifie: ecart(reference, modifie) };
    } finally {
      outilsGels.fournisseurs = avant;
    }
  });
  writeFileSync(join(SORTIES, 'bilan-gels.json'), JSON.stringify(bilan, null, 2));
  expect(bilan.nul.crete).toBeGreaterThan(0.1); // un vrai mix
  expect(bilan.nul.db).toBeLessThanOrEqual(-75);
  expect(bilan.nul.db).toBeLessThanOrEqual(Math.max(bilan.plancher.db, -120) + 6);
  expect(bilan.seuleBasse.db).toBeLessThanOrEqual(-75);
  expect(bilan.seuleBasse.db).toBeLessThanOrEqual(Math.max(bilan.plancher.db, -120) + 6);
  expect(bilan.modifie.db).toBeGreaterThan(-40); // les accords coupés de 2 à 6 s s'entendent
});
