// Projet « .ocka » : un morceau avec une prise (faux micro : clics à 1 kHz toutes les 0,5 s), exporté puis réimporté.
// Le morceau réimporté est identique (sauf ids et clés de fichiers), sa prise est lisible et a le même PCM,
// et sa durée est la même.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { dossierNeuf, exporterVers, morceauxIdb, nouveauMorceau, type MorceauIdb } from './outils-e2e';

const CLICS = join(dossierNeuf('micro'), 'clics.wav');
if (!existsSync(CLICS)) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='0.7*lt(mod(t,0.5),0.01)*sin(2*PI*1000*t)':s=48000:d=8", '-ac', '1', '-c:a', 'pcm_s16le', CLICS]);
}
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${CLICS}`] },
});

/** Le PCM d'une prise (OPFS ocka-prises) : nombre d'échantillons, somme des |x|, empreinte, et sa description. */
function lirePrise(page: Page, fichier: string) {
  return page.evaluate(async (nom) => {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('ocka-prises');
    const x = new Float32Array(await (await (await d.getFileHandle(nom)).getFile()).arrayBuffer());
    const desc = JSON.parse(await (await (await d.getFileHandle(nom.replace(/\.f32$/, '.json'))).getFile()).text());
    let somme = 0;
    let h = 0;
    const u = new Uint32Array(x.buffer);
    for (let i = 0; i < x.length; i++) {
      somme += Math.abs(x[i]!);
      h = (Math.imul(h, 31) + u[i]!) | 0;
    }
    return { n: x.length, somme, h, frequence: desc.frequence as number, echantillons: desc.echantillons as number };
  }, fichier);
}

/**
 * Le morceau sans ce qui change forcément à l'import : ids et clés des prises et des sons. Les nombres sont arrondis
 * au millième comme le fait le normaliseur (depuis la phase 1) à chaque ouverture : la prise sauvée juste après
 * l'enregistrement garde ses temps exacts (ex. debutCoupe 1,769274), le morceau rouvert ou importé a 1,769.
 */
function sansIds(m: MorceauIdb['m']): unknown {
  const arrondir = (_: string, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);
  const c = JSON.parse(JSON.stringify(m), arrondir) as { prises: { id?: string; fichier?: string }[]; sons?: { id?: string; fichier?: string }[] };
  for (const p of c.prises) (p.id = '·'), (p.fichier = '·');
  for (const s of c.sons ?? []) (s.id = '·'), (s.fichier = '·');
  return c;
}

/** Durée (s) du résumé dans l'index de « Mes morceaux » (ocka-morceaux, clé « #index »). */
function dureesIndex(page: Page): Promise<Record<string, number>> {
  return page.evaluate(
    () =>
      new Promise<Record<string, number>>((ok) => {
        const q = indexedDB.open('ocka-morceaux');
        q.onsuccess = () => {
          const r = q.result.transaction('ocka').objectStore('ocka').get('#index');
          r.onsuccess = () => {
            q.result.close();
            const l = (Array.isArray(r.result) ? r.result : (r.result?.morceaux ?? [])) as { id: string; duree: number }[];
            ok(Object.fromEntries(l.map((x) => [x.id, x.duree])));
          };
        };
      }),
  );
}

test('projet .ocka : morceau avec une prise exporté, réimporté identique, prise lisible, même durée', async ({ page }) => {
  const dossier = dossierNeuf('projet');
  await nouveauMorceau(page, 'trap');
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await page.getByTestId('enregistrer').click();
  await expect(page.getByTestId('prise')).toHaveCount(1, { timeout: 90_000 });
  await expect(page.getByTestId('prise')).toHaveAttribute('data-choisie', '1');

  const chemin = await exporterVers(page, 'exporter-projet', dossier);
  expect(chemin).toMatch(/\.ocka$/);
  await page.getByTestId('retour').click();
  await expect(page.getByTestId('ouvrir-morceau')).toHaveCount(1);
  const [origine] = await morceauxIdb(page);
  expect(origine!.m.prises).toHaveLength(1);

  await page.getByTestId('importer-fichier').setInputFiles(chemin);
  await expect(page.getByTestId('ouvrir-morceau')).toHaveCount(2, { timeout: 60_000 });
  const tous = await morceauxIdb(page);
  const copie = tous.find((x) => x.id !== origine!.id)!;
  expect(copie).toBeTruthy();
  expect(sansIds(copie.m)).toEqual(sansIds(origine!.m));
  const p0 = origine!.m.prises[0]!;
  const p1 = copie.m.prises[0]!;
  expect(p1.fichier).not.toBe(p0.fichier);
  // (l'id de la prise peut rester : il est propre au morceau ; seule la clé du fichier doit être neuve)

  const a = await lirePrise(page, p0.fichier);
  const b = await lirePrise(page, p1.fichier);
  expect(a.n).toBeGreaterThan(48000);
  expect(b).toEqual(a);

  const durees = await dureesIndex(page);
  expect(durees[copie.id]).toBeGreaterThan(30);
  expect(durees[copie.id]).toBe(durees[origine!.id]);

  // Un morceau s'ouvre (les deux ont la prise), et sa prise est là.
  await page.getByTestId('ouvrir-morceau').first().click();
  await page.getByTestId('onglet-voix').click();
  await page.getByTestId('voix-section-1').click();
  await expect(page.getByTestId('prise')).toHaveCount(1);
});
