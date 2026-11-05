// Autotune dans l'interface : prise au faux micro (clics à 1 kHz : pas une voix chantée), pastille « Autotune » →
// curseur « Naturel ↔ Robot » ; la prise n'a pas assez de trames voisées : repli expliqué, rien n'est corrigé
// (description « auto-….json » seule dans OPFS) ; l'export WAV attend l'autotune et aboutit.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { dossierNeuf, exporterVers, nouveauMorceau } from './outils-e2e';

const CLICS = join(dossierNeuf('micro-autotune'), 'clics.wav');
if (!existsSync(CLICS)) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='0.7*lt(mod(t,0.5),0.01)*sin(2*PI*1000*t)':s=48000:d=8", '-ac', '1', '-c:a', 'pcm_s16le', CLICS]);
}
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${CLICS}`] },
});

test('autotune : pastille, curseur Naturel ↔ Robot, repli expliqué sur une prise sans voix, export qui aboutit', async ({ page }) => {
  await nouveauMorceau(page, 'trap');
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await page.getByTestId('enregistrer').click();
  await expect(page.getByTestId('prise')).toHaveCount(1, { timeout: 90_000 });

  await expect(page.getByTestId('reglage-autotune')).toHaveCount(0);
  await page.getByTestId('effet-autotune').click();
  await expect(page.getByTestId('effet-autotune')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('effet-autotune-niveau')).toHaveValue('0.5');
  await page.getByTestId('effet-autotune-niveau').fill('0.8');
  await expect(page.getByTestId('reglage-autotune')).toContainText('80 %');
  await expect(page.getByTestId('autotune-repli')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('autotune-preparation')).toHaveCount(0);

  const fichiers = await page.evaluate(async () => {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('ocka-prises');
    const noms: string[] = [];
    for await (const h of (d as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) noms.push(h.name);
    return noms.filter((n) => n.startsWith('auto-'));
  });
  expect(fichiers).toHaveLength(1);
  expect(fichiers[0]).toMatch(/^auto-prise-[\w-]+-0\.8-[A-Za-z]+-(majeur|mineur)\.json$/);

  const chemin = await exporterVers(page, 'exporter-wav', dossierNeuf('autotune'));
  expect(chemin).toMatch(/\.wav$/);
});
