// « Pistes séparées » : un ZIP sain (unzip -t), un WAV 44,1 kHz 32 bits flottants par piste qui joue, aucune piste vide.
// Morceau trap par défaut : batterie, basse et accords jouent ; mélodie, sons et voix sont muettes (pas de fichier).
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { crete, dossierNeuf, exporterVers, extraire, lireWav, morceauxIdb, nomsZip, nouveauMorceau, sonder, zipSain } from './outils-e2e';

test('pistes séparées : ZIP sain, WAV 32 bits flottants, une entrée par piste non vide', async ({ page }) => {
  const dossier = dossierNeuf('pistes');
  await nouveauMorceau(page, 'trap');
  const zip = await exporterVers(page, 'export-pistes', dossier);
  expect(zip).toMatch(/\(pistes\)\.zip$/);
  const test = zipSain(zip);
  expect(test.ok, test.sortie).toBe(true);

  const noms = nomsZip(zip);
  expect(noms).toEqual(['Trap - Batterie.wav', 'Trap - Basse.wav', 'Trap - Accords.wav']);
  for (const n of noms) expect(n).not.toMatch(/[:\\/]/);

  await page.getByTestId('retour').click();
  const [{ m }] = await morceauxIdb(page);
  const mesures = m.ordre.reduce((s, id) => s + m.sections.find((x) => x.id === id)!.mesures, 0);
  const trames = Math.round(((mesures * 240) / m.tempo) * 44100);

  const { dossier: d, fichiers } = extraire(zip, 'pistes-x');
  expect(fichiers).toEqual([...noms].sort());
  for (const f of fichiers) {
    const w = lireWav(join(d, f));
    expect([w.format, w.bits, w.frequence, w.canaux], f).toEqual([3, 32, 44100, 2]);
    expect(w.donnees[0]!.length, f).toBe(trames);
    expect(crete(w), f).toBeGreaterThan(0.01);
    expect(statSync(join(d, f)).size).toBeGreaterThan(trames * 8);
    // ffprobe lit bien du flottant 32 bits.
    const s = sonder(join(d, f));
    expect([s.codec_name, Number(s.sample_rate), Number(s.channels)]).toEqual(['pcm_f32le', 44100, 2]);
  }
});
