// Session v2 (intégration C2), de bout en bout et à l'écran (360 × 800), avec un FAUX MICRO qui chante une mélodie :
//  1. un morceau phonk, puis une piste « Piano à queue » (banque) ajoutée par « + Piste » ;
//  2. « Chanter » sur le piano (piano roll Complet) : la mélodie chantée est enregistrée et posée en notes ;
//  3. une prise de voix (onglet Voix) ;
//  4. autotune « Pop » sur la prise (rendu attendu) ;
//  5. « Sortir sur Spotify » : dossier de sortie (FLAC) ;
//  6. sur le disque : unzip -t, FLAC à −14 ± 0,5 LUFS (ffmpeg ebur128), pochette 3000 × 3000.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { voixSegments } from '../../src/dubler/signaux-test';
import { analyserWav } from '../qa/outils';
import { dossierNeuf, erreursDecodage, extraire, morceauxIdb, nomsZip, nouveauMorceau, sonder, zipSain } from './outils-e2e';

const FS = 48000;
const PIANO = 'vcsl-piano-queue@1';
const CAPTURES = join('tests', 'e2e', 'captures');

/** WAV mono 16 bits (le faux micro de Chrome lit un WAV en boucle). */
function wav(pcm: Float32Array): Uint8Array {
  const b = new Uint8Array(44 + pcm.length * 2);
  const v = new DataView(b.buffer);
  const ecrire = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  ecrire(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  ecrire(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, FS, true);
  v.setUint32(28, FS * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ecrire(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  pcm.forEach((x, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, x)) * 32767), true));
  return b;
}

// La mélodie chantée (voix de synthèse, un peu fausse) : la, do, mi, ré, do, la — puis un souffle, en boucle.
const VOIX = join(dossierNeuf('session-v2-micro'), 'voix.wav');
const NOTES = [57, 60, 64, 62, 60, 57];
writeFileSync(VOIX, wav(voixSegments([...NOTES.map((midi) => ({ hz: 440 * 2 ** ((midi - 69 + 0.25) / 12), duree: 0.5 })), { hz: null, duree: 0.25 }], FS, 30)) as unknown as string);

test.use({
  viewport: { width: 360, height: 800 },
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${VOIX}`, '--autoplay-policy=no-user-gesture-required'] },
});

type M = {
  pistes: { id: string; instrument?: string }[];
  sections: { id: string; motifs: Record<string, string> }[];
  motifs: Record<string, { type: string; notes?: { pas: number; midi: number }[] }>;
  prises: { id: string; autotune?: { preset: string } }[];
};
const lire = async (page: Page) => (await morceauxIdb(page))[0]!.m as unknown as M;

/** Les notes de la piste `id` dans la section `section` du morceau sauvé. */
async function notesPiste(page: Page, id: string, section: string) {
  const m = await lire(page);
  const idMotif = m.sections.find((s) => s.id === section)?.motifs[id];
  return (idMotif && m.motifs[idMotif]?.notes) || [];
}

test('session v2 : phonk + piano chanté, voix, autotune Pop, dossier de sortie FLAC', async ({ page }) => {
  test.setTimeout(600_000);
  // 1. Phonk, puis « + Piste » : Piano à queue (téléchargé depuis la même origine).
  await nouveauMorceau(page, 'phonk');
  await page.getByTestId('vue-instruments').click();
  await page.getByTestId('ajouter-piste').click();
  await expect(page.getByTestId('panneau-choix-instrument')).toBeVisible();
  await page.getByTestId('recherche-instrument').fill('piano');
  await page.getByTestId(`choisir-${PIANO}`).click();
  await expect.poll(async () => (await lire(page)).pistes.find((p) => p.instrument === PIANO)?.id, { timeout: 60_000 }).toBeTruthy();
  const piano = (await lire(page)).pistes.find((p) => p.instrument === PIANO)!.id;

  // 2. Chanter sur le piano (le piano roll s'ouvre en Complet sur la nouvelle piste) : direct, puis la section
  //    enregistrée et posée en notes.
  await expect(page.getByTestId('panneau-piano-roll')).toBeVisible();
  await expect(page.getByTestId('pr-complet')).toBeVisible();
  await page.getByTestId('pr-chanter').click();
  await expect(page.getByTestId('panneau-chanter')).toBeVisible();
  await page.getByTestId('chanter-direct').click();
  await expect(page.getByTestId('chanter-contenu')).toHaveAttribute('data-direct', 'oui', { timeout: 20_000 });
  await expect.poll(async () => page.getByTestId('roue-notes').getAttribute('data-note'), { timeout: 10_000 }).toBeTruthy();
  await page.screenshot({ path: join(CAPTURES, 'c2-session-chanter-piano.png') });
  await page.getByTestId('chanter-onglet-enregistrer').click();
  const section = 'couplet';
  const avant = await notesPiste(page, piano, section);
  await page.getByTestId(`dubler-section-${section}`).click();
  await page.getByTestId('dubler-enregistrer').click();
  await expect(page.getByTestId('dubler-phase')).toHaveAttribute('data-phase', 'enregistre', { timeout: 15_000 });
  await page.waitForTimeout(9_000);
  await page.getByTestId('dubler-poser').click();
  await page.getByTestId('chanter-direct').click();
  await expect.poll(async () => (await notesPiste(page, piano, section)).length, { timeout: 15_000 }).toBeGreaterThan(avant.length);
  const chantees = await notesPiste(page, piano, section);
  console.info(`[session v2] notes chantées posées sur le piano : ${chantees.length}`);
  // Mélodie de la, do, ré, mi (la piste reste dans sa gamme : à un demi-ton au plus de ce qui est chanté).
  for (const n of chantees) expect(NOTES.some((x) => Math.abs(((n.midi - x) % 12 + 18) % 12 - 6) <= 1), String(n.midi)).toBe(true);
  await page.goBack();
  await page.goBack();
  await expect(page.getByTestId('panneau-chanter')).toHaveCount(0);

  // 3. Prise de voix au faux micro.
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await page.getByTestId('enregistrer').click();
  await expect(page.getByTestId('prise')).toHaveCount(1, { timeout: 90_000 });

  // 4. Autotune « Pop » (rendu en tâche de fond, attendu).
  await page.getByTestId('autotune-preset-pop').click();
  await expect(page.getByTestId('autotune-preset-pop')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('autotune-avance-preparation')).toHaveCount(0, { timeout: 120_000 });
  await expect.poll(async () => (await lire(page)).prises[0]?.autotune?.preset, { timeout: 15_000 }).toBe('pop');
  await page.getByTestId('carte-autotune').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(CAPTURES, 'c2-session-autotune-pop.png') });

  // 5. Dossier de sortie : assistant (1 titre), pochette fabriquée, Vérifier, Préparer, télécharger.
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('export-titre').fill('Session phonk');
  await page.getByTestId('sortir-spotify').click();
  await expect(page.getByTestId('ecran-sortie-infos')).toBeVisible();
  await page.getByTestId('vrai-nom').fill('Romain Testeur');
  await page.getByTestId('vrai-nom-valider').click();
  await page.getByTestId('sortie-artiste').fill('Ocka Test');
  await page.getByTestId('sortie-titre').fill('Session phonk');
  await page.getByTestId('sortie-genre').selectOption({ index: 1 });
  const t = page.getByTestId('panneau-titre');
  await t.getByTestId('explicite-non').click();
  await t.getByTestId('titre-langue').selectOption('instrumental');
  for (const partie of ['paroles', 'musique', 'voix']) await t.getByTestId(`ia-${partie}-aucune`).click();
  if ((await t.getByTestId('credit-nom').count()) === 0) await t.getByTestId('ajouter-credit').click();
  if (!(await t.getByTestId('credit-nom').first().inputValue())) await t.getByTestId('credit-nom').first().fill('Romain Testeur');
  await page.getByTestId('sortie-suivant').click();
  await page.getByTestId('pochette-fabriquer').click();
  await page.getByTestId('pochette-modele-0').click();
  await expect(page.getByTestId('pochette-apercu')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('sortie-suivant').click();
  await expect(page.getByTestId('ecran-sortie-verifier')).toBeVisible();
  await expect(page.getByTestId('sortie-prete'), await page.getByTestId('verifier-problemes').innerText()).toBeVisible();
  await page.getByTestId('preparer-dossier').click();
  await expect(page.getByTestId('dossier-pret')).toBeVisible({ timeout: 300_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('telecharger-dossier').click()]);
  const zip = join(dossierNeuf('session-v2'), dl.suggestedFilename());
  await dl.saveAs(zip);

  // 6. Sur le disque.
  const z = zipSain(zip);
  expect(z.ok, z.sortie).toBe(true);
  const noms = nomsZip(zip);
  const flac = noms.filter((n) => n.endsWith('.flac'));
  expect(flac).toEqual(['01 - Session phonk.flac']);
  expect(noms).toContain('pochette.jpg');
  const x = extraire(zip, 'session-v2-x');
  for (const f of flac) {
    const chemin = join(x.dossier, f);
    expect(erreursDecodage(chemin), f).toBe('');
    const s = sonder(chemin);
    expect([s.codec_name, Number(s.sample_rate), Number(s.channels)], f).toEqual(['flac', 44100, 2]);
    const w = analyserWav(chemin);
    console.info(`[session v2] ${f} : ${w.lufs} LUFS, ${w.creteVraie} dBTP, ${w.duree.toFixed(3)} s`);
    expect(Math.abs(w.lufs + 14), `${w.lufs} LUFS`).toBeLessThanOrEqual(0.5);
    expect(w.creteVraie).toBeLessThanOrEqual(-1);
  }
  const p = sonder(join(x.dossier, 'pochette.jpg'));
  expect([p.codec_name, Number(p.width), Number(p.height)]).toEqual(['mjpeg', 3000, 3000]);
});
