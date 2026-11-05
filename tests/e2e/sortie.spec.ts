// « Sortir sur Spotify » de bout en bout : 2 morceaux courts (≥ 30 s), l'assistant (vrai nom, gros mots, IA…),
// une pochette fabriquée, « Vérifier » sans problème bloquant, « Préparer le dossier », téléchargement, puis sur le
// disque : unzip -t, 2 FLAC décodés sans erreur (44,1 kHz, 16 bits, stéréo), pochette 3000 × 3000, fiches, noms sûrs.
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { dossierNeuf, ecrireMorceauIdb, erreursDecodage, extraire, morceauxIdb, nomsZip, nouveauMorceau, sonder, zipSain } from './outils-e2e';

/** Crée un morceau, lui donne un titre (étape Exporter) et revient à l'accueil. */
async function creer(page: Page, style: 'trap' | 'drill', titre: string) {
  await nouveauMorceau(page, style);
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('export-titre').fill(titre);
  await page.getByTestId('retour').click();
  await expect(page.getByTestId('liste-morceaux')).toContainText(titre.slice(0, 4));
}

/** Infos d'un titre ouvert dans l'assistant : pas de gros mots, pas d'IA, un crédit (vrai nom, pré-rempli ou tapé). */
async function remplirTitre(page: Page) {
  const p = page.getByTestId('panneau-titre');
  await p.getByTestId('explicite-non').click();
  await p.getByTestId('titre-langue').selectOption('instrumental');
  for (const partie of ['paroles', 'musique', 'voix']) await p.getByTestId(`ia-${partie}-aucune`).click();
  if ((await p.getByTestId('credit-nom').count()) === 0) await p.getByTestId('ajouter-credit').click();
  const nom = p.getByTestId('credit-nom').first();
  if (!(await nom.inputValue())) await nom.fill('Romain Testeur');
}

test('sortie Spotify : assistant complet, dossier ZIP, FLAC 16 bits, pochette 3000 px, fiches, noms sûrs', async ({ page }) => {
  const dossier = dossierNeuf('sortie');
  // Titres avec « : » et « \ » : ils ne doivent pas se retrouver dans les noms du ZIP.
  await creer(page, 'trap', 'Nuit: blanche');
  await creer(page, 'drill', 'Route\\Est');
  // 20 mesures chacun (Intro 4 + Couplet 8 + Refrain 8) : 34 s en trap, 33,8 s en drill.
  for (const { id, m } of await morceauxIdb(page)) await ecrireMorceauIdb(page, id, { ...m, ordre: m.ordre.slice(0, 3) });
  await page.reload();
  const premier = page.locator('li.morceau-ligne', { hasText: 'Nuit' }).getByTestId('ouvrir-morceau');
  await premier.click();

  // Exporter → « Sortir sur Spotify » : assistant, écran Infos.
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('sortir-spotify').click();
  await expect(page.getByTestId('ecran-sortie-infos')).toBeVisible();
  await page.getByTestId('vrai-nom').fill('Romain Testeur');
  await page.getByTestId('vrai-nom-valider').click();
  await expect(page.getByTestId('vrai-nom')).toHaveCount(0);
  await page.getByTestId('sortie-artiste').fill('Ocka Test');
  await page.getByTestId('sortie-titre').fill('Nuit blanche');
  await page.getByTestId('sortie-genre').selectOption({ index: 1 });
  await remplirTitre(page);
  // Second titre.
  await page.getByTestId('ajouter-titre').click();
  await page.getByTestId('ajout-morceau').first().click();
  await expect(page.getByTestId('sortie-titres').locator('li')).toHaveCount(2);
  await page.getByTestId('titre-ouvrir').nth(1).click();
  await remplirTitre(page);

  // Pochette fabriquée (modèle 1).
  await page.getByTestId('sortie-suivant').click();
  await expect(page.getByTestId('ecran-sortie-pochette')).toBeVisible();
  await page.getByTestId('pochette-fabriquer').click();
  await page.getByTestId('pochette-modele-0').click();
  await expect(page.getByTestId('pochette-apercu')).toBeVisible({ timeout: 60_000 });

  // Vérifier : aucun problème bloquant, puis le dossier.
  await page.getByTestId('sortie-suivant').click();
  await expect(page.getByTestId('ecran-sortie-verifier')).toBeVisible();
  const problemes = await page.getByTestId('verifier-problemes').innerText();
  await expect(page.getByTestId('sortie-prete'), problemes).toBeVisible();
  await expect(page.getByTestId('type-sortie')).toContainText(/single/i);
  await page.getByTestId('preparer-dossier').click();
  await expect(page.getByTestId('dossier-pret')).toBeVisible({ timeout: 300_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('telecharger-dossier').click()]);
  expect(dl.suggestedFilename()).toBe('Ocka Test - Nuit blanche (sortie).zip');
  const zip = join(dossier, dl.suggestedFilename());
  await dl.saveAs(zip);

  // Sur le disque.
  const t = zipSain(zip);
  expect(t.ok, t.sortie).toBe(true);
  const noms = nomsZip(zip);
  for (const n of noms) expect(n).toMatch(/^(\d\d - [^:\\/]+\.flac|pochette\.jpg|paroles\/\d\d - [^:\\/]+\.txt|fiche-de-sortie\.(html|txt))$/);
  for (const n of noms) expect(n).not.toMatch(/[:\\<>"|?*\u0000-\u001f]/);
  const flac = noms.filter((n) => n.endsWith('.flac'));
  expect(flac).toEqual(['01 - Nuit blanche.flac', '02 - Route-Est.flac']);
  expect(noms).toEqual(expect.arrayContaining(['pochette.jpg', 'fiche-de-sortie.html', 'fiche-de-sortie.txt']));

  const x = extraire(zip, 'sortie-x');
  for (const f of flac) {
    const chemin = join(x.dossier, f);
    expect(erreursDecodage(chemin), f).toBe('');
    const s = sonder(chemin);
    expect([s.codec_name, Number(s.sample_rate), Number(s.channels), s.sample_fmt, Number(s.bits_per_raw_sample)], f).toEqual(['flac', 44100, 2, 's16', 16]);
    expect(Number(s.duree), f).toBeGreaterThanOrEqual(30);
  }
  const p = sonder(join(x.dossier, 'pochette.jpg'));
  expect([p.codec_name, Number(p.width), Number(p.height)]).toEqual(['mjpeg', 3000, 3000]);
});
