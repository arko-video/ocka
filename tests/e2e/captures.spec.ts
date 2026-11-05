// Captures 360×800 (téléphone) de chaque écran, pour relire l'interface à l'œil (tests/e2e/captures/*.png).
// Vague A : Beat Mélodie, Structure avec boucle, Voix avec effets, Son avec A/B, Exporter, les 3 écrans de
// l'assistant de sortie et l'onglet Sorties. Chaque capture vérifie aussi que rien ne déborde en largeur.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { dossierNeuf } from './outils-e2e';

test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });

const DOSSIER = 'tests/e2e/captures';
async function capturer(page: Page, nom: string) {
  await page.screenshot({ path: `${DOSSIER}/${nom}.png` });
  // Rien ne dépasse à droite (pas de défilement horizontal de la page).
  const large = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(large, nom).toBeLessThanOrEqual(360);
}

/** Un petit son (2 s, accord de 3 sinus) pour « Tes sons ». */
function sonDeTest(): string {
  const chemin = join(dossierNeuf('son'), 'boucle-test.wav');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'aevalsrc=0.2*sin(2*PI*220*t)+0.2*sin(2*PI*277*t)+0.2*sin(2*PI*330*t):s=44100:d=1.714', '-ac', '2', '-c:a', 'pcm_s16le', chemin]);
  return chemin;
}

test('captures de chaque écran', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await capturer(page, '01-accueil');

  await page.getByTestId('nouveau-morceau').click();
  await capturer(page, '02-styles');

  await page.getByTestId('style-trap').click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
  await page.getByTestId('motif-bat-refrain').click();
  await page.getByTestId('instrument-charley').click();
  await page.getByTestId('pad-6').dispatchEvent('contextmenu');
  await page.getByTestId('roulement-3').click();
  await page.waitForTimeout(300);
  await capturer(page, '03-beat');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(200);
  await capturer(page, '04-beat-reglages');
  await page.mouse.wheel(0, -2000);
  await page.getByTestId('pad-9').dispatchEvent('contextmenu');
  await page.waitForTimeout(250);
  await capturer(page, '05-roulement');
  await page.keyboard.press('Escape');

  // Beat → Mélodie : 4 notes dans la grille.
  await page.getByTestId('vue-melodie').click();
  await page.waitForTimeout(200);
  await capturer(page, '19-beat-melodie');
  for (const [l, p] of [[0, 0], [2, 4], [4, 8], [7, 12]] as const) await page.getByTestId(`case-${l}-${p}`).click();
  await page.getByTestId('grille-melodie').scrollIntoViewIfNeeded();
  await capturer(page, '20-beat-melodie-grille');
  await page.getByTestId('vue-batterie').click();

  await page.getByTestId('onglet-structure').click();
  await capturer(page, '06-structure');
  await page.getByTestId('section-tete').nth(1).click();
  await page.getByTestId('section-paroles').fill('Je pars de rien, j’avance au pouce\nChaque mesure, je la pousse');
  await page.waitForTimeout(200);
  await capturer(page, '07-structure-section');
  // Boucle de section : un son importé, calé sur 1 mesure.
  await page.getByTestId('section-boucle').click();
  await page.getByTestId('importer-son-fichier').setInputFiles(sonDeTest());
  await expect(page.getByTestId('boucle-caler')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(200);
  await capturer(page, '21-structure-boucle-panneau');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('section-boucle-resume').first()).toBeVisible();
  await capturer(page, '22-structure-boucle');
  await page.getByTestId('ajouter-section').click();
  await page.waitForTimeout(250);
  await capturer(page, '08-ajouter-section');
  await page.keyboard.press('Escape');

  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await capturer(page, '09-voix');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(200);
  await capturer(page, '10-voix-bas');

  // Gros bouton rouge : calque d'enregistrement (décompte, prompteur) ou message d'erreur si le son ne démarre pas.
  await page.mouse.wheel(0, -2000);
  await page.getByTestId('enregistrer').click();
  await page.waitForTimeout(900);
  await capturer(page, '16-enregistrement-decompte');
  await page.waitForTimeout(2600);
  await capturer(page, '17-enregistrement-prompteur');
  if (await page.getByTestId('arreter').isVisible()) await page.getByTestId('arreter').click();
  await page.waitForTimeout(800);
  await capturer(page, '18-voix-apres');

  // Voix : effets (Réverbe et Écho avec leur curseur, Radio).
  for (const e of ['reverbe', 'echo', 'radio']) await page.getByTestId(`effet-${e}`).click();
  await page.getByTestId('effets-voix').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await capturer(page, '23-voix-effets');

  await page.getByTestId('onglet-son').click();
  await capturer(page, '11-son');
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(200);
  await capturer(page, '12-son-master');
  // Son : A/B pendant la lecture.
  await page.getByTestId('lecture').click();
  await page.getByTestId('ab').scrollIntoViewIfNeeded();
  await page.getByTestId('ab').click();
  await page.waitForTimeout(600);
  await capturer(page, '24-son-ab');
  await page.getByTestId('lecture').click();

  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('export-artiste').fill('Romain');
  await capturer(page, '13-exporter');
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(200);
  await capturer(page, '25-exporter-bas');

  // Assistant de sortie : Infos (vrai nom demandé une fois), Pochette (modèles), Vérifier.
  await page.getByTestId('sortir-spotify').click();
  await expect(page.getByTestId('ecran-sortie-infos')).toBeVisible();
  await page.waitForTimeout(300);
  await capturer(page, '26-sortie-infos');
  await page.getByTestId('vrai-nom').fill('Romain Testeur');
  await page.getByTestId('vrai-nom-valider').click();
  await page.getByTestId('panneau-titre').scrollIntoViewIfNeeded();
  await capturer(page, '27-sortie-infos-titre');
  await page.getByTestId('sortie-suivant').click();
  await page.getByTestId('pochette-fabriquer').click();
  await page.getByTestId('pochette-modele-1').click();
  await expect(page.getByTestId('pochette-apercu')).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await capturer(page, '28-sortie-pochette');
  await page.getByTestId('modeles').scrollIntoViewIfNeeded();
  await capturer(page, '29-sortie-pochette-modeles');
  await page.getByTestId('sortie-suivant').click();
  await expect(page.getByTestId('ecran-sortie-verifier')).toBeVisible();
  await page.waitForTimeout(300);
  await capturer(page, '30-sortie-verifier');
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(300);
  await capturer(page, '31-sortie-verifier-bas');

  // Retour jusqu'à l'accueil (Vérifier → Pochette → Infos → Exporter → accueil, selon l'historique).
  for (let i = 0; i < 6 && !(await page.getByTestId('ecran-accueil').isVisible()); i++) {
    await page.getByTestId('retour').click();
    await page.waitForTimeout(200);
  }
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  await page.getByTestId('onglet-sorties').click();
  await expect(page.getByTestId('liste-sorties')).toBeVisible();
  await page.waitForTimeout(300);
  await capturer(page, '32-accueil-sorties');
  await page.getByTestId('onglet-morceaux').click();
  await expect(page.getByTestId('liste-morceaux')).toBeVisible();
  await capturer(page, '14-accueil-liste');
  await page.getByTestId('actions-morceau').first().click();
  await page.waitForTimeout(250);
  await capturer(page, '15-actions-morceau');
});
