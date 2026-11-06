// Morceau complet v2 (intégration C1). Un trap avec 3 pistes instrument de la banque : Piano à queue (VCSL),
// Cordes (VSCO), Basse électrique (Karoryfer). Pistes et notes posées par les fonctions d'édition (edition/pistes.ts
// et notes.ts, celles d'api-edition ; mixage.ts tire le moteur audio, que Node ne charge pas). Effets, à l'écran :
// Saturation sur la basse, Pompe sur les cordes, automation du volume des cordes (3 points dessinés).
// Vérifié : export WAV à −14 ± 0,5 LUFS et crête vraie ≤ −1 dBTP, pistes séparées non vides.
// Puis hors ligne (réseau des instruments bloqué) avec un instrument jamais téléchargé : export refusé, message clair
// « instrument_absent » (jamais de piste muette).
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { IDS_BANQUE } from '../../src/instruments/ids-banque';
import { declarerInstruments, motifNotesDe } from '../../src/morceau/acces';
import { normaliserMorceau } from '../../src/morceau/normaliser';
import type { Morceau } from '../../src/morceau/types';
import * as notes from '../../src/ui/edition/notes';
import * as pistes from '../../src/ui/edition/pistes';
import { analyserWav, dureeAttendue, exporter } from '../qa/outils';
import { dossierNeuf, ecrireMorceauIdb, exporterVers, extraire, lireWav, morceauxIdb, nouveauMorceau } from './outils-e2e';

// Le service worker ne doit pas servir les requêtes à la place du réseau bloqué (route).
test.use({ serviceWorkers: 'block', viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });

const PIANO = 'vcsl-piano-queue@1';
const CORDES = 'vsco-cordes@1';
const BASSE = 'karoryfer-basse@1';

/** Le trap neuf, plus 3 pistes de la banque, jouées dans toutes les sections. */
function composer(depart: Morceau): { m: Morceau; ids: Record<'piano' | 'cordes' | 'basse', string> } {
  let m = depart;
  const piste = (instrument: string, nom: string) => {
    const r = pistes.ajouterPiste(m, instrument, nom);
    if (!r) throw new Error(`piste ${instrument} refusée`);
    m = r.m;
    return r.id;
  };
  const ids = { piano: piste(PIANO, 'Piano à queue'), cordes: piste(CORDES, 'Cordes'), basse: piste(BASSE, 'Basse électrique') };
  const degres = m.tonalite.mode === 'mineur' ? ['i', 'VI'] : ['I', 'vi'];
  for (const s of m.sections) {
    for (const debut of [0, 16]) {
      m = notes.poserAccord(m, ids.piano, s.id, debut, 7, degres[0]!);
      m = notes.poserAccord(m, ids.piano, s.id, debut + 8, 7, degres[1]!);
      m = notes.poserAccord(m, ids.cordes, s.id, debut, 16, degres[debut === 0 ? 0 : 1]!);
    }
    const fond = Math.min(...motifNotesDe(m, s.id, ids.piano)!.notes.map((n) => n.midi)) - 24;
    for (const debut of [0, 16]) {
      for (const [pas, midi, duree] of [[0, fond, 3], [6, fond, 2], [8, fond - 4, 3], [12, fond + 3, 2]] as const) {
        m = notes.ajouterNote(m, ids.basse, s.id, { pas: debut + pas, duree, midi, vel: 0.85 });
      }
    }
  }
  return { m, ids };
}

/** Saturation (basse), Pompe (cordes) par l'écran Son ; 3 points de volume des cordes dans la frise (Avancé). */
async function effetsALEcran(page: Page, ids: Record<'piano' | 'cordes' | 'basse', string>) {
  await page.getByTestId('onglet-son').click();
  await page.getByTestId(`effets-${ids.basse}`).click();
  await page.getByTestId('ajouter-insert').click();
  await page.getByTestId('ajouter-saturation').click();
  await expect(page.getByTestId('insert-saturation')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId(`effets-${ids.cordes}`).click();
  await page.getByTestId('panneau-pompe').check();
  await page.keyboard.press('Escape');
  await page.getByTestId('ouvrir-avance').click();
  await page.getByTestId('mode-avance').check();
  await page.keyboard.press('Escape');
  await page.getByTestId('onglet-structure').click();
  await page.getByTestId('vue-frise').click();
  await page.getByTestId(`auto-${ids.cordes}`).click();
  const c = page.getByTestId(`couloir-${ids.cordes}-1`);
  await c.scrollIntoViewIfNeeded();
  for (const [fx, v] of [[0.03, 0.3], [0.5, 0.9], [0.97, 0.5]] as const) {
    const b = (await c.boundingBox())!;
    await page.mouse.click(b.x + fx * b.width, b.y + 6 + (1 - v) * (b.height - 12));
    await page.waitForTimeout(450);
  }
  await expect(c).toHaveAttribute('data-points', '3');
}

async function ouvrirAvec(page: Page, id: string, m: Morceau) {
  await ecrireMorceauIdb(page, id, m);
  await page.reload();
  await page.getByTestId('ouvrir-morceau').first().click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
}

function rmsDb(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * x[i]!;
  return 10 * Math.log10(s / Math.max(1, x.length) + 1e-30);
}

test('morceau complet v2 : 3 instruments de la banque, effets, automation, export, pistes, hors ligne', async ({ page }) => {
  test.setTimeout(600_000);
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await nouveauMorceau(page, 'trap');
  await page.getByTestId('retour').click();
  const [{ id, m: brut }] = await morceauxIdb(page);
  const { m, ids } = composer(brut as unknown as Morceau);
  declarerInstruments(IDS_BANQUE); // comme api-banque.ts dans l'appli
  expect(normaliserMorceau(m).problemes).toEqual([]);
  await ouvrirAvec(page, id, m);
  await effetsALEcran(page, ids);
  await page.getByTestId('retour').click();
  const [{ m: sauve }] = await morceauxIdb(page);
  const tranche = (x: string) => (sauve as unknown as Morceau).pistes.find((p) => p.id === x)!;
  expect(tranche(ids.basse).inserts?.map((x) => x.type)).toEqual(['saturation']);
  expect(tranche(ids.cordes).sidechain?.source).toBe('kick');
  expect(tranche(ids.cordes).auto?.[0]?.cible).toEqual({ type: 'volume' });
  await page.getByTestId('ouvrir-morceau').first().click();

  // Export WAV : les 3 instruments sont téléchargés avant le rendu (même origine), puis le master à −14 LUFS.
  const { chemin } = await exporter(page, 'e2e-morceau-complet-v2');
  const w = analyserWav(chemin);
  console.log(`morceau complet v2 : ${w.lufs} LUFS, ${w.creteVraie} dBTP, ${w.duree.toFixed(3)} s`);
  expect(w.lufs).toBeGreaterThanOrEqual(-14.5);
  expect(w.lufs).toBeLessThanOrEqual(-13.5);
  expect(w.creteVraie).toBeLessThanOrEqual(-1);
  expect(Math.abs(w.duree - dureeAttendue(m as never))).toBeLessThan(0.05);

  // Pistes séparées : une par piste, celles des 3 instruments non vides.
  const zip = await exporterVers(page, 'export-pistes', dossierNeuf('morceau-v2'));
  const { dossier, fichiers } = extraire(zip, 'morceau-v2-x');
  console.log('pistes :', fichiers.join(' | '));
  for (const idPiste of Object.values(ids)) {
    const nom = (m.pistes.find((p) => p.id === idPiste) as { nom: string }).nom;
    const f = fichiers.find((x) => x.endsWith(` - ${nom}.wav`));
    expect(f, nom).toBeTruthy();
    const niveau = rmsDb(lireWav(join(dossier, f!)).donnees[0]!);
    console.log(`stem ${nom} : ${niveau.toFixed(1)} dB RMS`);
    expect(niveau, nom).toBeGreaterThan(-60);
  }

  // Hors ligne : un instrument jamais téléchargé (Flûte) → l'export est refusé avec un message clair.
  await page.context().route('**/instruments/**', (r) => r.abort('internetdisconnected'));
  const [{ m: actuel }] = await morceauxIdb(page);
  const avecFlute = pistes.ajouterPiste(actuel as unknown as Morceau, 'vsco-flute@1')!;
  let m2 = avecFlute.m;
  for (const s of m2.sections) m2 = notes.ajouterNote(m2, avecFlute.id, s.id, { pas: 0, duree: 8, midi: 72, vel: 0.8 });
  await page.getByTestId('retour').click();
  await ouvrirAvec(page, id, m2);
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('exporter-wav').click();
  const alerte = page.getByTestId('erreur-export');
  await expect(alerte).toBeVisible({ timeout: 120_000 });
  await expect(alerte).toContainText('n’est pas sur ce téléphone');
  await expect(alerte).toContainText('Flûte');
  await expect(alerte).toContainText('reconnecte-toi');
  await expect(page.getByTestId('export-resultat')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});
