// Contrat C3 : les panneaux de P, S, L, R et V sont branchés depuis les écrans (une entrée chacun), s'ouvrent sans
// erreur avec leur contenu et Retour les ferme (en revenant au piano roll ou au panneau d'où ils ont été ouverts).
// Intégration C3 : les anciens data-testid « <panneau>-bientot » (bouchons) sont devenus « <panneau>-intro » ;
// outils malins et MIDI montrent leur contenu (« outils-notes », « midi »), le synthé d'un son v1 « synthe-sans-reglages ».
import { expect, test, type Page } from '@playwright/test';
import { nouveauMorceau } from './outils-e2e';

/** Ce qui montre le contenu de chaque panneau. */
const CONTENU: Record<string, string> = { 'outils-notes': 'outils-notes', midi: 'midi', synthe: 'synthe-sans-reglages' };

/** Ouvre un panneau par son entrée, vérifie son contenu, puis le ferme par Retour. */
async function ouvrirFermer(page: Page, entree: string, panneau: string) {
  await page.getByTestId(entree).click();
  await expect(page.getByTestId(`panneau-${panneau}`)).toBeVisible();
  await expect(page.getByTestId(CONTENU[panneau] ?? `${panneau}-intro`)).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId(`panneau-${panneau}`)).toHaveCount(0);
}

test('panneaux C3 branchés : piano roll (P, L), Pistes (P), Tes sons (S, L), Structure (R), Voix et Son (V), en-tête (R)', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await nouveauMorceau(page, 'trap');

  // Tes sons (Batterie) : fabriquer un son (L) ; découper / modifier n'apparaît qu'avec un son choisi (S).
  await page.getByTestId('ton-son').click();
  await expect(page.getByTestId('son-editer')).toHaveCount(0);
  await page.getByTestId('sons-fabriquer').click();
  await expect(page.getByTestId('panneau-sons-courts')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('sons-fabriquer')).toBeVisible();
  await page.goBack();

  // Vue Pistes : MIDI (P).
  await page.getByTestId('vue-instruments').click();
  await ouvrirFermer(page, 'pistes-midi', 'midi');

  // Piano roll Complet, menu Outils : outils malins (P), MIDI (P), synthé (L) ; Retour ramène au piano roll.
  await page.getByTestId('ouvrir-piste-melodie').click();
  await page.getByTestId('pr-complet').click();
  for (const [entree, panneau] of [['pr-outils-malins', 'outils-notes'], ['pr-midi', 'midi'], ['pr-synthe', 'synthe']] as const) {
    await page.getByTestId('pr-outils').click();
    await ouvrirFermer(page, entree, panneau);
    await expect(page.getByTestId('pr-outils')).toBeVisible();
  }
  await page.goBack();

  // Structure : looper et effets de performance (R).
  await page.getByTestId('onglet-structure').click();
  await ouvrirFermer(page, 'structure-looper', 'looper');
  await ouvrirFermer(page, 'structure-perf', 'performance');
  // Intégration C3 : « Effets de fin » aussi sur la carte de section.
  if ((await page.getByTestId('section-perf').count()) === 0) await page.getByTestId('section-tete').first().click();
  await expect(page.getByTestId('section-perf')).toHaveCount(1);
  await ouvrirFermer(page, 'section-perf', 'performance');

  // Voix : voix avancée (V) ; Son : référence (V) ; en-tête : confort (R).
  await page.getByTestId('onglet-voix').click();
  await ouvrirFermer(page, 'voix-avancee', 'voix-avancee');
  await page.getByTestId('onglet-son').click();
  await ouvrirFermer(page, 'son-reference', 'reference');
  await ouvrirFermer(page, 'ouvrir-confort', 'confort');

  // Les data-testid d'avant sont toujours là.
  for (const id of ['ouvrir-avance', 'annuler', 'retablir', 'onglet-beat']) await expect(page.getByTestId(id)).toBeVisible();
  expect(erreurs).toEqual([]);
});
