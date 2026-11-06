// Autotune avancé (C2, A2) : prise chantée au faux micro (notes la, do, ré, mi un peu fausses, harmoniques), carte
// « Autotune » de la prise gardée → « Corriger tout seul », « Avec l'IA », puis « Robot » ; en « Avancé », l'éditeur de notes s'ouvre en plein écran : on choisit
// une note, on la glisse d'une ligne vers le haut (aimantée à la gamme), Annuler la remet, on la redéplace ; puis
// l'export WAV aboutit avec le rendu de la prise, et le morceau sauvé garde Prise.autotune (Robot + notes).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { enveloppeAnthropic } from '../../src/ia/reponses-test';
import { dossierNeuf, exporterVers, morceauxIdb, nouveauMorceau } from './outils-e2e';

const VOIX = join(dossierNeuf('micro-autotune-avance'), 'voix.wav');
if (!existsSync(VOIX)) {
  const demiTons = 'if(lt(mod(t,2),0.5),0,if(lt(mod(t,2),1),3,if(lt(mod(t,2),1.5),5,7)))';
  const f = `220*pow(2,(${demiTons}+0.3)/12)`;
  const onde = `lt(mod(t,0.5),0.44)*0.3*(sin(2*PI*${f}*t)+0.5*sin(4*PI*${f}*t)+0.25*sin(6*PI*${f}*t))`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `aevalsrc='${onde}':s=48000:d=8`, '-ac', '1', '-c:a', 'pcm_s16le', VOIX]);
}
test.use({
  viewport: { width: 360, height: 800 },
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${VOIX}`] },
});

/** Prises du morceau sauvé (avec leur autotune). */
const prisesSauvees = async (page: Page) => (await morceauxIdb(page))[0]?.m.prises ?? [];

/** La note d'indice `i` (dans Prise.autotune.notes) dans l'éditeur. */
const noteI = (page: Page, i: number) => page.locator(`.an-note[data-i="${i}"]`);

/** Glisse la note `i` de l'éditeur de `lignes` lignes vers le haut (souris : mêmes Pointer Events qu'un doigt). */
async function glisserNote(page: Page, i: number, lignes: number) {
  const note = noteI(page, i);
  const b = (await note.boundingBox())!;
  const h = Number(await page.getByTestId('an-grille').getAttribute('data-h'));
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - h * 0.5, { steps: 3 });
  await page.mouse.move(x, y - h * lignes, { steps: 3 });
  await page.mouse.up();
}

test('autotune avancé : Robot, éditeur de notes (choisir, glisser, Annuler), export', async ({ page }) => {
  test.setTimeout(300_000);
  await nouveauMorceau(page, 'trap');
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await page.getByTestId('enregistrer').click();
  await expect(page.getByTestId('prise')).toHaveCount(1, { timeout: 90_000 });

  // Carte de la prise gardée : préréglage Robot (une étape d'Annuler), gamme détectée.
  const carte = page.getByTestId('carte-autotune');
  await expect(carte).toBeVisible();
  await expect(page.getByTestId('autotune-avant')).toHaveCount(0); // Avant / Après : une fois l'autotune choisi
  // « Corriger tout seul » (règles, sans réseau) pose un préréglage, une gamme et des notes en une étape.
  await page.getByTestId('autotune-corriger').click();
  await expect(page.locator('[data-testid^="autotune-preset-"][aria-checked="true"]')).toHaveCount(1, { timeout: 60_000 });
  // « Avec l'IA » : coût et « Voir ce qui est envoyé » (ou « bientôt » tant que l'IA de l'autotune n'est pas livrée).
  await page.getByTestId('autotune-ia').click();
  await expect(page.getByTestId('autotune-ia-bloc')).toBeVisible();
  await expect(page.getByTestId('ia-cout').or(page.getByTestId('autotune-ia-bientot'))).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('autotune-ia').click();
  await page.getByTestId('autotune-preset-robot').click();
  await expect(page.getByTestId('autotune-preset-robot')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('autotune-avant')).toBeVisible();
  await expect(page.getByTestId('autotune-gamme')).toBeVisible();
  await expect(page.getByTestId('autotune-gamme-detectee-0')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('autotune-avance-preparation')).toHaveCount(0, { timeout: 120_000 });
  await expect(page.getByTestId('autotune-ouvrir-editeur')).toHaveCount(0); // seulement en « Avancé »
  await carte.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join('tests', 'e2e', 'captures', 'c2-autotune-carte.png') });

  // Réglage « Avancé » : réglages fins et éditeur.
  await page.getByTestId('onglet-son').click();
  await page.getByTestId('ouvrir-avance').click();
  await page.getByTestId('mode-avance').check();
  await page.goBack();
  await page.getByTestId('onglet-voix').click();
  await expect(page.getByTestId('autotune-vitesse')).toHaveValue('0');
  await page.getByTestId('autotune-vitesse').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join('tests', 'e2e', 'captures', 'c2-autotune-avance.png') });
  await page.getByTestId('autotune-ouvrir-editeur').click();
  await expect(page.getByTestId('panneau-editeur-autotune')).toBeVisible();
  await expect(page.getByTestId('an-editeur')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('an-courbe')).toBeVisible();
  const notes = page.getByTestId('an-note');
  expect(await notes.count()).toBeGreaterThan(1);

  // Choisir une note (la 2e affichée) : poignées de justesse et de vibrato.
  const i = Number(await notes.nth(1).getAttribute('data-i'));
  const note = noteI(page, i);
  await note.click();
  await expect(note).toHaveAttribute('data-choisie', '1');
  await expect(page.getByTestId('poignee-justesse')).toBeVisible();
  await expect(page.getByTestId('poignee-vibrato')).toBeVisible();
  await page.screenshot({ path: join('tests', 'e2e', 'captures', 'c2-editeur-notes.png') });
  const avant = Number(await note.getAttribute('data-midi'));

  // Glisser d'une ligne vers le haut : la note monte (aimantée à la gamme : 1 ou 2 demi-tons) ; Annuler la remet.
  await glisserNote(page, i, 1.2);
  await expect(note).not.toHaveAttribute('data-midi', String(avant));
  const apres = Number(await note.getAttribute('data-midi'));
  expect(apres - avant).toBeGreaterThanOrEqual(1);
  expect(apres - avant).toBeLessThanOrEqual(2);
  await page.getByTestId('an-annuler').click();
  await expect(note).toHaveAttribute('data-midi', String(avant));
  await glisserNote(page, i, 1.2);
  await expect(note).toHaveAttribute('data-midi', String(apres));

  // Couper puis Fusionner : une note de plus, puis de moins.
  const n = await notes.count();
  await note.click();
  await page.getByTestId('an-couper').click();
  await expect(notes).toHaveCount(n + 1);
  await page.getByTestId('an-fusionner').click();
  await expect(notes).toHaveCount(n);

  await page.getByTestId('an-retour').click();
  await expect(page.getByTestId('panneau-editeur-autotune')).toHaveCount(0);

  // Export : il attend le rendu de la prise et aboutit.
  const chemin = await exporterVers(page, 'exporter-wav', dossierNeuf('autotune-avance'));
  expect(chemin).toMatch(/\.wav$/);
  const rendus = await page.evaluate(async () => {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('ocka-prises');
    const noms: string[] = [];
    for await (const h of (d as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) noms.push(h.name);
    return noms.filter((x) => x.startsWith('auto-'));
  });
  expect(rendus.length).toBeGreaterThan(0);

  // Le morceau sauvé garde l'autotune de la prise : Robot et la note déplacée.
  await expect
    .poll(async () => (await prisesSauvees(page))[0]?.autotune?.notes?.[i]?.midi, { timeout: 15_000 })
    .toBe(apres);
  expect((await prisesSauvees(page))[0]!.autotune!.preset).toBe('robot');
});

// « Avec l'IA » (faux Anthropic, fausse clé) : seule la liste des notes part ; le conseil (Hyperpop) est appliqué en
// UNE étape d'Annuler, et la déclaration de l'IA passe à voix « aide » (la musique et les paroles ne bougent pas).
test('autotune avec l’IA : notes seulement, conseil appliqué, voix déclarée « aide », un seul Annuler', async ({ page }) => {
  test.setTimeout(300_000);
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
  const envois: string[] = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const q = route.request();
    if (q.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (q.url().includes('/v1/models')) return route.fulfill({ headers: CORS, json: { data: [{ id: 'claude-haiku-5-5' }] } });
    envois.push(q.postData() ?? '');
    const conseil = { gamme: 'morceau', preset: 'hyperpop', corrections: [], explication: 'Voix nette, façon hyperpop.' };
    return route.fulfill({ headers: CORS, json: enveloppeAnthropic(JSON.stringify(conseil)) });
  });
  await nouveauMorceau(page, 'trap');
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await page.getByTestId('enregistrer').click();
  await expect(page.getByTestId('prise')).toHaveCount(1, { timeout: 90_000 });
  await page.getByTestId('autotune-ia').click();
  await page.getByTestId('ia-ouvrir-reglages').click();
  await page.getByTestId('ia-cle').fill('sk-ant-faux-0000000000-e2e-a1B2');
  await page.getByTestId('ia-tester').click();
  await expect(page.getByTestId('ia-test')).toHaveAttribute('data-etat', 'ok');
  await page.goBack();
  await expect(page.getByTestId('ia-cout')).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: join('tests', 'e2e', 'captures', 'c2-autotune-ia.png') });
  await page.getByTestId('ia-envoyer').click();
  await expect.poll(async () => (await prisesSauvees(page))[0]?.autotune?.preset, { timeout: 30_000 }).toBe('hyperpop');
  expect(envois).toHaveLength(1);
  expect(envois[0]).toContain('notes');
  expect(envois[0]!.length).toBeLessThan(60_000); // jamais l'audio
  const ia = async () => ((await morceauxIdb(page))[0]!.m as unknown as { infos?: { ia?: Record<string, string> } }).infos?.ia;
  await expect.poll(ia).toEqual({ paroles: 'aucune', musique: 'aucune', voix: 'aide' });
  // Un seul Annuler retire le conseil ET la déclaration.
  await page.getByTestId('annuler').first().click();
  await expect.poll(async () => (await prisesSauvees(page))[0]?.autotune?.preset ?? null, { timeout: 15_000 }).not.toBe('hyperpop');
  expect((await ia())?.voix ?? 'aucune').toBe('aucune');
});
