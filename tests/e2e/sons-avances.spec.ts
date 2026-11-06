// S (vague C3) : un son importé (boucle de batterie à 92 BPM) → normalisé (nouveau son, l'original gardé) → découpé
// en 8 → découpes 5 à 8 sur les pads → jouées dans un motif → export WAV. Tempo/tonalité, puis une SoundFont
// fabriquée (2 zones, une boucle) → une piste avec son preset. Captures 360×800 (éditeur, découpe, SoundFont).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { sf2DeTest } from '../../src/sf2/fabrique-sf2';
import { boucleBatterie } from '../../src/sons/signaux-test';
import { cents, yin } from '../../src/sons/signaux-test';
import { crete, dossierNeuf, ecrireMorceauIdb, exporterVers, extraire, lireWav, morceauxIdb, nouveauMorceau } from './outils-e2e';

test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });

const DOSSIER = process.env.CAPTURES_S ?? 'tests/e2e/captures';
async function capturer(page: Page, nom: string) {
  await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 10_000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${DOSSIER}/c3-s-${nom}.png` });
  const large = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(large, nom).toBeLessThanOrEqual(360);
}

/** WAV 16 bits mono d'un PCM flottant. */
function wav16(x: Float32Array, sr: number): Uint8Array {
  const o = new Uint8Array(44 + x.length * 2);
  const v = new DataView(o.buffer);
  const texte = (p: number, t: string) => [...t].forEach((c, i) => v.setUint8(p + i, c.charCodeAt(0)));
  texte(0, 'RIFF');
  v.setUint32(4, 36 + x.length * 2, true);
  texte(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texte(36, 'data');
  v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, x[i]! * 0.5)) * 32767), true);
  return o;
}

test('son importé → éditeur → découpe en 8 → pads → motif → export ; tempo ; SoundFont', async ({ page }) => {
  const dossier = dossierNeuf('sons-avances');
  const fichierSon = join(dossier, 'boucle-92.wav');
  const boucle = boucleBatterie(92, 2);
  writeFileSync(fichierSon, wav16(boucle.canaux[0]!, boucle.frequence));
  const fichierSf2 = join(dossier, 'test.sf2');
  writeFileSync(fichierSf2, sf2DeTest());

  await nouveauMorceau(page, 'trap');
  await page.getByTestId('ton-son').click();
  await page.getByTestId('importer-son-fichier').setInputFiles(fichierSon);
  await expect(page.getByTestId('son-editer')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('son-editer').click();
  await expect(page.getByTestId('forme-onde')).toBeVisible({ timeout: 20_000 });

  // Éditeur : un passage choisi au doigt, puis Normaliser → un nouveau son (l'original reste).
  await page.getByTestId('editeur-onglet-modifier').click();
  const onde = page.getByTestId('forme-onde');
  const r = (await onde.boundingBox())!;
  await page.mouse.move(r.x + r.width * 0.1, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.4, r.y + r.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('editeur-selection')).toContainText('→');
  await capturer(page, 'editeur');
  await page.getByTestId('editeur-normaliser').click();
  await expect(page.getByTestId('panneau-editeur-son').locator('.feuille-titre')).toContainText('normalisé', { timeout: 30_000 });

  // Tempo et tonalité : 92 BPM (± 1), avec le double et la moitié.
  await page.getByTestId('editeur-onglet-tempo').click();
  await expect(page.getByTestId('tempo-bpm')).toBeVisible({ timeout: 20_000 });
  const bpm = Number((await page.getByTestId('tempo-choix-bpm').innerText()).replace(',', '.').replace(/[^0-9.]/g, ''));
  expect(Math.abs(bpm - 92)).toBeLessThanOrEqual(1);
  await expect(page.getByTestId('tempo-choix-moitie')).toBeVisible();
  await expect(page.getByTestId('tempo-choix-double')).toBeVisible();
  await capturer(page, 'tempo');

  // Découpe en 8 parts égales, écoute d'une découpe, puis découpes 5 à 8 sur les pads.
  await page.getByTestId('editeur-onglet-decouper').click();
  await page.getByTestId('decoupe-mode-egal').click();
  await page.getByTestId('decoupe-egal-8').click();
  await expect(page.getByTestId('decoupe-nombre')).toHaveText('8 découpes');
  await page.getByTestId('tranche-ecouter-3').click();
  await capturer(page, 'decoupe');
  await page.getByTestId('decoupe-vers-pads-5').click();

  // SoundFont : import (Worker), banque, preset, piste.
  await page.getByTestId('editeur-onglet-soundfonts').click();
  await expect(page.getByTestId('sf2-droits')).toBeVisible();
  await page.getByTestId('sf2-fichier').setInputFiles(fichierSf2);
  await expect(page.getByTestId('sf2-preset-5')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('sf2-preset-5').click();
  await capturer(page, 'soundfont');
  await page.getByTestId('sf2-ajouter-piste').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('panneau-editeur-son')).toHaveCount(0);
  for (let i = 0; i < 3 && (await page.locator('.voile').count()) > 0; i++) await page.keyboard.press('Escape');
  await expect(page.locator('.voile')).toHaveCount(0);

  // Les pads perso jouent les découpes dans le motif de batterie.
  await expect(page.getByTestId('instrument-perso1')).toBeVisible();
  for (const p of ['perso1', 'perso2', 'perso3', 'perso4']) {
    await page.getByTestId(`instrument-${p}`).click();
    await page.getByTestId(`pad-${['perso1', 'perso2', 'perso3', 'perso4'].indexOf(p) * 4 + 2}`).click();
  }

  const chemin = await exporterVers(page, 'exporter-wav', dossier);
  const w = lireWav(chemin);
  expect(crete(w)).toBeGreaterThan(0.05);

  // Le morceau sauvé : 2 sons (original + normalisé), 8 découpes, pads 5 à 8, la SoundFont et sa piste.
  await page.getByTestId('retour').click();
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  const m = ((await morceauxIdb(page)) as unknown as { m: Record<string, any> }[])[0]!.m; // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(m.sons).toHaveLength(2);
  const coupe = m.sons.find((s: { nom: string }) => s.nom.endsWith('(normalisé)'));
  expect(coupe.tranches).toHaveLength(8);
  expect(m.tranchesPads).toEqual({ perso1: 4, perso2: 5, perso3: 6, perso4: 7 });
  expect(Object.values(m.pads)).toEqual([coupe.id, coupe.id, coupe.id, coupe.id]);
  expect(m.soundfonts).toHaveLength(1);
  expect(m.pistes.some((p: { instrument?: string }) => p.instrument === `sf2-${m.soundfonts[0].id}-0-5@1`)).toBe(true);
});

test('SoundFont jouée par l’échantillonneur après rechargement : justesse à ±5 cents dans le stem exporté', async ({ page }) => {
  const dossier = dossierNeuf('sf2-justesse');
  const fichierSf2 = join(dossier, 'test.sf2');
  writeFileSync(fichierSf2, sf2DeTest());
  await nouveauMorceau(page, 'trap');
  // L'éditeur s'ouvre depuis un son choisi : un petit son, puis l'onglet SoundFonts.
  const wav = join(dossier, 'court.wav');
  const x = new Float32Array(44100).map((_, i) => 0.3 * Math.sin((2 * Math.PI * 330 * i) / 44100));
  writeFileSync(wav, wav16(x, 44100));
  await page.getByTestId('ton-son').click();
  await page.getByTestId('importer-son-fichier').setInputFiles(wav);
  await page.getByTestId('son-editer').click();
  await page.getByTestId('editeur-onglet-soundfonts').click();
  await page.getByTestId('sf2-fichier').setInputFiles(fichierSf2);
  await page.getByTestId('sf2-preset-5').click();
  await page.getByTestId('sf2-ajouter-piste').click();
  for (let i = 0; i < 3 && (await page.locator('.voile').count()) > 0; i++) await page.keyboard.press('Escape');

  // Deux notes écrites dans le morceau sauvé : la 440 (zone grave, bouclée) puis ré 5 (zone aiguë).
  await page.getByTestId('retour').click();
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  const [{ id, m }] = (await morceauxIdb(page)) as unknown as { id: string; m: Record<string, any> }[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const piste = m.pistes.find((p: { instrument?: string }) => p.instrument?.startsWith('sf2-'));
  m.motifs['sf2-test'] = { type: 'notes', pas: 16, notes: [{ pas: 0, duree: 8, midi: 69, vel: 0.9 }, { pas: 8, duree: 6, midi: 74, vel: 0.9 }] };
  m.ordre = m.ordre.slice(1, 2);
  for (const sec of m.sections) sec.motifs[piste.id] = 'sf2-test';
  await ecrireMorceauIdb(page, id, m);
  await page.reload();
  await page.getByTestId('ouvrir-morceau').first().click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();

  const zip = await exporterVers(page, 'export-pistes', dossier);
  const { dossier: d, fichiers } = extraire(zip, 'sf2-stems');
  const stem = fichiers.find((n) => n.endsWith(`${piste.nom}.wav`))!;
  expect(stem, fichiers.join(', ')).toBeTruthy();
  const w = lireWav(join(d, stem));
  const y = w.donnees[0]!;
  const debut = y.findIndex((v) => Math.abs(v) > 0.01);
  expect(debut).toBeGreaterThanOrEqual(0);
  const pas = 60 / m.tempo / 4;
  for (const [t, midi] of [[0.35, 69], [8 * pas + 0.25, 74]] as const) {
    const f = yin(y, w.frequence, 200, 1000, debut + Math.round(t * w.frequence));
    expect(Math.abs(cents(f, 440 * Math.pow(2, (midi - 69) / 12))), `midi ${midi}`).toBeLessThan(5);
  }
});
