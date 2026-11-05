// Enregistrement dans l'interface avec le faux micro (clics toutes les 0,5 s), puis export et persistance :
// rechargement, duplication (fichiers copiés), suppression (fichiers effacés).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { attaques, DOSSIER_PRISES, exporter, fichiersOpfs, lireGauche, morceauxIdb, nouveau, SORTIES, surveiller, type MorceauIdb } from './outils';

/** Débuts des clics dans le fichier brut de la prise (OPFS), en secondes dans le fichier. */
function clicsDuFichier(page: Page, fichier: string): Promise<number[]> {
  return page.evaluate(async ([nom, dossier]) => {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle(dossier);
    const x = new Float32Array(await (await (await d.getFileHandle(nom)).getFile()).arrayBuffer());
    const desc = JSON.parse(await (await (await d.getFileHandle(nom.replace(/\.f32$/, '.json'))).getFile()).text());
    let crete = 0;
    for (const v of x) crete = Math.max(crete, Math.abs(v));
    const out: number[] = [];
    let dernier = -Infinity;
    for (let i = 0; i < x.length; i++) {
      if (Math.abs(x[i]!) >= 0.3 * crete) {
        if (i - dernier > 0.2 * desc.frequence) out.push(i / desc.frequence);
        dernier = i;
      }
    }
    return out;
  }, [fichier, DOSSIER_PRISES] as const);
}

async function attendreMorceau(page: Page, condition: (m: MorceauIdb['m']) => boolean): Promise<MorceauIdb> {
  let trouve: MorceauIdb | undefined;
  await expect
    .poll(async () => {
      trouve = (await morceauxIdb(page)).find((x) => condition(x.m));
      return !!trouve;
    }, { timeout: 15_000 })
    .toBe(true);
  return trouve!;
}

test('voix : calibrage, prise sur le Couplet, placée au bon endroit dans le WAV (±20 ms), puis persistance', async ({ page }) => {
  const r = await surveiller(page);
  const bilan: Record<string, unknown> = {};
  await nouveau(page, 'trap');
  await page.getByTestId('onglet-voix').click();
  await expect(page.getByTestId('ecran-voix')).toBeVisible();

  // 1. Calibrage (le faux micro n'entend pas le chirp : on note le résultat affiché).
  await page.getByTestId('calibrer').click();
  await expect(page.getByTestId('calibrer')).toBeEnabled({ timeout: 60_000 });
  bilan.calibrage = {
    latence: await page.getByTestId('latence').textContent(),
    erreur: (await page.getByTestId('erreur-voix').count()) ? await page.getByTestId('erreur-voix').getAttribute('data-code') : null,
    avertissements: await page.getByTestId('avertissement-micro').allTextContents(),
  };

  // 2. Section Couplet (2e position de l'ordre), gros bouton rouge, arrêt automatique en fin de section.
  await page.getByTestId('voix-section-1').click();
  await expect(page.getByTestId('voix-section-1')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('voix-section-1')).toContainText('Couplet');
  await page.getByTestId('enregistrer').click();
  await expect(page.getByTestId('calque-enregistrement')).toBeVisible();
  await expect(page.getByTestId('prise')).toHaveCount(1, { timeout: 60_000 });
  await expect(page.getByTestId('calque-enregistrement')).toBeHidden();
  await expect(page.getByTestId('prise')).toHaveAttribute('data-choisie', '1');
  if ((await page.getByTestId('erreur-voix').count()) > 0) bilan.erreurApres = await page.getByTestId('erreur-voix').textContent();

  const { id, m } = await attendreMorceau(page, (x) => x.prises.length === 1);
  const p = m.prises[0]!;
  bilan.prise = p;
  expect(p.choisie).toBe(true);
  expect(p.ancre).toEqual({ section: m.ordre[1], occurrence: 0, mesure: 0 });
  expect(m.sections.find((s) => s.id === p.ancre.section)?.nom).toBe('Couplet');
  const clicsBruts = await clicsDuFichier(page, p.fichier);

  // 3. Voix seule (les 3 autres pistes en muet), export WAV, position des clics.
  await page.getByTestId('onglet-son').click();
  for (const piste of ['batterie', 'basse', 'accords']) await page.getByTestId(`muet-${piste}`).click();
  const e = await exporter(page, 'qa-voix');
  const { g, frequence } = lireGauche(e.chemin);
  const exportes = attaques(g, frequence);
  const mesure = 240 / m.tempo;
  const ta = (m.sections.find((s) => s.id === m.ordre[0])!.mesures) * mesure;
  const finSection = ta + m.sections.find((s) => s.id === p.ancre.section)!.mesures * mesure;
  const depuis = p.debutCoupe + Math.max(0, p.decalage);
  const attendus = clicsBruts.filter((x) => x >= depuis + 0.005 && x <= p.finCoupe - 0.05).map((x) => ta + (x - p.debutCoupe) - p.decalage);
  const ecarts = attendus.map((t) => Math.min(...exportes.map((u) => Math.abs(u - t))));
  bilan.alignement = { ta, finSection, clicsBruts: clicsBruts.length, attendus: attendus.slice(0, 6), exportes: exportes.slice(0, 6), ecartMaxMs: Math.max(...ecarts) * 1000, msExport: e.ms };
  writeFileSync(join(SORTIES, 'bilan-enregistrement.json'), JSON.stringify(bilan, null, 2));
  expect(attendus.length).toBeGreaterThanOrEqual(10);
  for (const ec of ecarts) expect(ec).toBeLessThanOrEqual(0.02);
  // Rien avant le début du Couplet, ni loin après sa fin.
  expect(exportes[0]!).toBeGreaterThanOrEqual(ta - 0.02);
  expect(exportes.at(-1)!).toBeLessThanOrEqual(finSection + 0.5);

  // 4. Persistance : retour, rechargement, la prise revient.
  await page.getByTestId('retour').click();
  await expect(page.getByTestId('liste-morceaux')).toContainText('Trap');
  await page.reload();
  await expect(page.getByTestId('liste-morceaux')).toContainText('Trap');
  await page.getByTestId('ouvrir-morceau').first().click();
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await expect(page.getByTestId('prise')).toHaveCount(1);
  await page.getByTestId('retour').click();
  const avant = await fichiersOpfs(page);
  expect(avant).toEqual(expect.arrayContaining([p.fichier, p.fichier.replace('.f32', '.json')]));

  // 5. Dupliquer : 2 morceaux, fichiers de prise copiés.
  const ligne = (titre: RegExp) => page.locator('li.morceau-ligne', { has: page.locator('.morceau-titre', { hasText: titre }) });
  await ligne(/^Trap$/).getByTestId('actions-morceau').click();
  await page.getByTestId('dupliquer').click();
  await expect(page.getByTestId('ouvrir-morceau')).toHaveCount(2);
  const tous = await morceauxIdb(page);
  const copie = tous.find((x) => x.id !== id)!;
  expect(copie.m.prises[0]!.fichier).not.toBe(p.fichier);
  const apresCopie = await fichiersOpfs(page);
  expect(apresCopie).toContain(copie.m.prises[0]!.fichier);

  // 6. Supprimer l'original : les fichiers de la copie restent (ceux de l'original seront nettoyés plus tard). Puis la copie.
  await ligne(/^Trap$/).getByTestId('actions-morceau').click();
  await page.getByTestId('supprimer').click();
  await page.getByTestId('confirmer-suppression').click();
  await expect(page.getByTestId('ouvrir-morceau')).toHaveCount(1);
  const apresSup = await fichiersOpfs(page);
  // Voulu (correction QA #2) : le fichier n'est plus effacé tout de suite, pour qu'Annuler ramène toujours la voix.
  // Le ramasse-miettes l'efface plus tard (fichier d'une séance précédente, ou orphelin depuis plus d'1 h).
  void apresSup;
  expect(apresSup).toContain(copie.m.prises[0]!.fichier);
  await ligne(/copie/).getByTestId('actions-morceau').click();
  await page.getByTestId('supprimer').click();
  await page.getByTestId('confirmer-suppression').click();
  await expect(page.getByTestId('ouvrir-morceau')).toHaveCount(0);
  // Les fichiers des prises ne sont plus référencés : ils seront effacés par le ramasse-miettes (voir plus haut).
  await page.reload();
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  await expect(page.getByTestId('ouvrir-morceau')).toHaveCount(0);

  bilan.consoleErreurs = r.erreurs;
  writeFileSync(join(SORTIES, 'bilan-enregistrement.json'), JSON.stringify(bilan, null, 2));
  expect(r.sortantes).toEqual([]);
  expect(r.csp).toEqual([]);
  // Les erreurs console attendues du calibrage raté (signal_faible) sont filtrées.
  expect(r.erreurs.filter((x) => !/signal|ErreurOcka|calibr/i.test(x))).toEqual([]);
});
