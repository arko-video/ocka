// Contrat C2 : les 35 styles groupés par familles avec une recherche ; un style provisoire crée un morceau ;
// les panneaux de la vague C2 sont branchés (Beatbox depuis Batterie, Chanter depuis la vue Pistes et le piano roll,
// éditeur de notes de l'autotune depuis Voix en « Avancé ») et Retour les ferme.
import { expect, test } from '@playwright/test';
import { ecrireMorceauIdb, morceauxIdb, nouveauMorceau } from './outils-e2e';

test('choix du style : familles, recherche, style provisoire', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('nouveau-morceau').click();
  for (const f of ['rap', 'electro', 'monde', 'poprockjazz', 'cinema']) await expect(page.getByTestId(`famille-${f}`)).toBeVisible();
  await expect(page.locator('.carte-style')).toHaveCount(35);
  await page.getByTestId('recherche-style').fill('bossa');
  await expect(page.locator('.carte-style')).toHaveCount(1);
  await page.getByTestId('recherche-style').fill('zzz');
  await expect(page.locator('.carte-style')).toHaveCount(0);
  await page.getByTestId('recherche-style').fill('drill');
  await expect(page.locator('.carte-style')).toHaveCount(2); // Drill et UK drill
  await page.getByTestId('style-ukdrill').click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
});

test('panneaux C2 branchés : Beatbox, Chanter (Pistes et piano roll), éditeur de notes', async ({ page }) => {
  await nouveauMorceau(page, 'trap');
  // Beatbox depuis la vue Batterie.
  await page.getByTestId('beatbox').click();
  await expect(page.getByTestId('panneau-beatbox')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('panneau-beatbox')).toHaveCount(0);

  // Chanter depuis la vue Pistes.
  await page.getByTestId('vue-instruments').click();
  await page.getByTestId('pistes-chanter').click();
  await expect(page.getByTestId('panneau-chanter')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('panneau-chanter')).toHaveCount(0);

  // Chanter depuis le piano roll « Complet » : Retour ramène au piano roll.
  await page.getByTestId('ouvrir-piste-melodie').click();
  await page.getByTestId('pr-complet').click();
  await page.getByTestId('pr-chanter').click();
  await expect(page.getByTestId('panneau-chanter')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('pr-chanter')).toBeVisible();
  await page.goBack();

  // Éditeur de notes : bouton « Notes » d'une prise, en « Avancé » seulement. On ajoute une prise au morceau sauvé.
  await page.getByTestId('retour').click();
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  const [{ id, m }] = await morceauxIdb(page);
  const prise = { id: 'p1', ancre: { section: 'couplet', occurrence: 0, mesure: 0 }, tempo: m.tempo, fichier: 'prise-p1.f32', frequence: 48000, duree: 2, debutCoupe: 0, finCoupe: 2, decalage: 0, gain: 1, choisie: true };
  await ecrireMorceauIdb(page, id, { ...m, prises: [prise] });
  await page.reload();
  await page.getByTestId('ouvrir-morceau').first().click();
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await expect(page.getByTestId('prise')).toHaveCount(1);
  await expect(page.getByTestId('editer-notes-prise')).toHaveCount(0);
  await page.getByTestId('onglet-son').click();
  await page.getByTestId('ouvrir-avance').click();
  await page.getByTestId('mode-avance').check();
  await page.goBack();
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await page.getByTestId('editer-notes-prise').click();
  await expect(page.getByTestId('panneau-editeur-autotune')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('panneau-editeur-autotune')).toHaveCount(0);
});
