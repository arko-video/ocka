// Piano roll malin et MIDI (P, vague C3) : arpège puis strum sur des accords → export .mid → réimport → les mêmes
// notes, piste par piste ; clavier Web MIDI simulé (faux navigator.requestMIDIAccess) : jeu en direct et
// enregistrement ; message clair sans Web MIDI ; captures 360×800 de la barre Outils et du panneau MIDI.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { lireSmf } from '../../src/midi/smf-lecture';
import { dossierNeuf, nouveauMorceau } from './outils-e2e';

const CAPTURES = '/tmp/claude-0/-home-claude/327ea8c0-317a-5474-83a2-dbe668eff1bf/scratchpad/c3-p';

/** Position (écran) du milieu de la case (pas, rang) de la grille du piano roll. */
async function caseGrille(page: Page, pas: number, rang: number) {
  const g = page.getByTestId('pr-grille');
  const d = await g.evaluate((el) => ({ ...(el as HTMLElement).dataset }));
  const box = (await g.boundingBox())!;
  const [w, h, debut, haut] = [d.w, d.h, d.debut, d.haut].map(Number) as [number, number, number, number];
  const ligne = Math.ceil(haut) + rang;
  return { x: box.x + (pas - debut) * w + w / 2, y: box.y + (ligne - haut) * h + h / 2 };
}

/** Piste Piano + deux accords majeurs (pas 0 et 16) au piano roll Complet. */
async function pianoAvecAccords(page: Page, toucher = false) {
  await page.getByTestId('vue-instruments').click();
  await page.getByTestId('ajouter-piste').click();
  await page.getByTestId('choisir-ocka-piano@1').click();
  await expect(page.getByTestId('pr-complet')).toBeVisible();
  await page.getByTestId('pr-accord').click();
  await page.getByTestId('accord-majeur').click();
  for (const pas of [0, 16]) {
    const c = await caseGrille(page, pas, 8);
    if (toucher) await page.touchscreen.tap(c.x, c.y);
    else await page.mouse.click(c.x, c.y);
  }
  await expect(page.getByTestId('pr-note')).toHaveCount(6);
}

async function ouvrirDepuisOutils(page: Page, entree: 'pr-outils-malins' | 'pr-midi') {
  await page.getByTestId('pr-outils').click();
  await page.getByTestId(entree).click();
}

/** Notes de chaque piste d'un .mid : [début, fin, midi, vélocité], par nom de piste. */
function notesParPiste(octets: Uint8Array): Record<string, number[][]> {
  const smf = lireSmf(octets);
  const r: Record<string, number[][]> = {};
  for (const n of smf.notes) (r[smf.noms[n.piste]!] ??= []).push([n.debut, n.fin, n.midi, n.vel]);
  for (const k in r) r[k]!.sort((a, b) => a[0]! - b[0]! || a[2]! - b[2]!);
  return r;
}

async function telechargerMidi(page: Page, dossier: string, nom: string): Promise<{ chemin: string; octets: Uint8Array }> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('midi-exporter').click()]);
  expect(dl.suggestedFilename()).toMatch(/\.mid$/);
  const chemin = join(dossier, nom);
  await dl.saveAs(chemin);
  return { chemin, octets: new Uint8Array(readFileSync(chemin)) };
}

/** Faux clavier Web MIDI injecté avant le chargement : window.__envoyerMidi([0x90, 60, 100]). */
async function fauxClavier(page: Page) {
  await page.addInitScript(() => {
    const ecouteurs = new Set<(e: unknown) => void>();
    const entree = {
      id: 'faux-1',
      name: 'Clavier de test',
      manufacturer: 'OCKA',
      addEventListener: (_t: string, f: (e: unknown) => void) => ecouteurs.add(f),
      removeEventListener: (_t: string, f: (e: unknown) => void) => ecouteurs.delete(f),
    };
    const acces = { inputs: new Map([['faux-1', entree]]), outputs: new Map(), onstatechange: null };
    Object.defineProperty(Navigator.prototype, 'requestMIDIAccess', { configurable: true, value: () => Promise.resolve(acces) });
    const w = window as unknown as Record<string, unknown>;
    w.__envoyerMidi = (o: number[]) => {
      const e = { data: new Uint8Array(o), timeStamp: performance.now() };
      for (const f of ecouteurs) f(e);
    };
    w.__ecouteursMidi = () => ecouteurs.size;
  });
}

test('arpège puis strum sur des accords → .mid → réimport : les mêmes notes', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  const dossier = dossierNeuf('midi');
  await nouveauMorceau(page, 'trap');
  await pianoAvecAccords(page);

  // Outils malins : sans Avancé, seul le riff machine ; on active Avancé depuis le panneau.
  await ouvrirDepuisOutils(page, 'pr-outils-malins');
  await expect(page.getByTestId('outils-onglet-arpege')).toHaveCount(0);
  await page.getByTestId('outils-avance').click();
  // L'accord posé en dernier (pas 16) est choisi : l'arpège ne touche que lui.
  await expect(page.getByTestId('outils-sur')).toContainText('3 notes');
  await page.getByTestId('outils-onglet-arpege').click();
  await page.getByTestId('arpege-vitesse-0').click(); // 1/16
  await page.getByTestId('outils-appliquer-arpege').click();
  // Puis le strum sur toutes les notes : seul l'accord du pas 0 est encore un accord.
  await expect(page.getByTestId('outils-sur')).toContainText('toutes');
  await page.getByTestId('outils-onglet-strum').click();
  await page.getByTestId('outils-appliquer-strum').click();
  await page.goBack();
  await expect(page.getByTestId('pr-complet')).toBeVisible();
  // Export .mid, puis réimport dans le même morceau, puis nouvel export : mêmes notes, piste par piste.
  await ouvrirDepuisOutils(page, 'pr-midi');
  const premier = await telechargerMidi(page, dossier, 'premier.mid');
  const avant = notesParPiste(premier.octets);
  const piano = avant.Piano!;
  // Strum : 3 départs régulièrement écartés ; arpège (accord de 2 pas) : 2 notes en double-croches qui montent.
  const strum = piano.filter((n) => n[0]! < 96).map((n) => n[0]!);
  expect(strum).toHaveLength(3);
  expect(strum[0]).toBe(0);
  expect(strum[1]).toBeGreaterThan(0);
  expect(strum[2]).toBe(2 * strum[1]!);
  const arp = piano.filter((n) => n[0]! >= 384 && n[0]! < 480);
  expect(arp.map((n) => n[0])).toEqual([384, 408]);
  expect(arp[1]![2]).toBeGreaterThan(arp[0]![2]!);
  await page.getByTestId('midi-fichier').setInputFiles(premier.chemin);
  await expect(page.getByTestId('toast')).toContainText('importée');
  const second = await telechargerMidi(page, dossier, 'second.mid');
  const apres = notesParPiste(second.octets);
  // Les pistes importées gardent leur nom (« Piano 2 » si « Piano » existe déjà) ; la batterie revient sur la batterie.
  expect(apres['Piano 2']).toEqual(piano);
  expect(apres.Batterie).toEqual(avant.Batterie);
  for (const nom of Object.keys(avant)) expect(apres[nom] ?? apres[`${nom} 2`], nom).toEqual(avant[nom]);
  expect(erreurs).toEqual([]);
});

test('clavier MIDI simulé : liste, jeu en direct, enregistrement calé ; sans Web MIDI : message clair', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await fauxClavier(page);
  await nouveauMorceau(page, 'lofi');
  await pianoAvecAccords(page);
  await ouvrirDepuisOutils(page, 'pr-midi');
  await expect(page.getByTestId('midi-clavier')).toHaveCount(0);
  await page.getByTestId('midi-avance').click();
  await page.getByTestId('midi-chercher').click();
  await expect(page.getByTestId('midi-appareil-faux-1')).toHaveText('Clavier de test');
  await page.getByTestId('midi-direct').check();
  await expect(page.getByTestId('midi-direct-etat')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __ecouteursMidi: () => number }).__ecouteursMidi())).toBe(1);
  await page.evaluate(() => (window as unknown as { __envoyerMidi: (o: number[]) => void }).__envoyerMidi([0x90, 72, 100]));

  await page.getByTestId('midi-enregistrer').click();
  await expect(page.getByTestId('midi-enregistrer')).toHaveAttribute('data-actif', '1');
  await page.evaluate(async () => {
    const envoyer = (window as unknown as { __envoyerMidi: (o: number[]) => void }).__envoyerMidi;
    const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (const midi of [74, 77, 79]) {
      await attendre(250);
      envoyer([0x90, midi, 90]);
      await attendre(120);
      envoyer([0x80, midi, 0]);
    }
  });
  await expect(page.getByTestId('midi-enregistrer')).toContainText('3 notes');
  await page.getByTestId('midi-enregistrer').click();
  await expect(page.getByTestId('toast')).toContainText('3 notes enregistrées');
  await page.getByTestId('midi-direct').uncheck();
  expect(await page.evaluate(() => (window as unknown as { __ecouteursMidi: () => number }).__ecouteursMidi())).toBe(0);
  await page.goBack();
  await expect(page.getByTestId('pr-note')).toHaveCount(9);
  expect(erreurs).toEqual([]);

  // Sans Web MIDI (iPhone…) : message clair, pas de plantage.
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'requestMIDIAccess', { configurable: true, value: undefined }));
  await nouveauMorceau(page, 'trap');
  await page.getByTestId('vue-instruments').click();
  await page.getByTestId('pistes-midi').click();
  await page.getByTestId('midi-chercher').click();
  await expect(page.getByTestId('midi-erreur')).toContainText('ne gère pas les claviers MIDI');
});

test.describe('captures 360×800', () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  async function capturer(page: Page, nom: string) {
    await page.getByTestId('toast').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${CAPTURES}/p-${nom}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), nom).toBeLessThanOrEqual(360);
  }

  test('barre Outils et panneau MIDI', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await page.route(/^https:\/\//, (r) => r.abort());
    await fauxClavier(page);
    await nouveauMorceau(page, 'lofi');
    await pianoAvecAccords(page, true);
    // Une 2e piste avec des notes : ses notes fantômes apparaissent en gris.
    await page.getByTestId('pr-retour').click();
    await page.getByTestId('ajouter-piste').click();
    await page.getByTestId('choisir-ocka-lead@1').click();
    await expect(page.getByTestId('pr-complet')).toBeVisible();
    await ouvrirDepuisOutils(page, 'pr-outils-malins');
    await capturer(page, '01-outils-simple');
    await page.getByTestId('outils-onglet-riff').click();
    await page.getByTestId('outils-appliquer-riff').click();
    await page.getByTestId('outils-avance').click();
    await expect(page.getByTestId('fantome-note').first()).toBeVisible();
    await capturer(page, '02-outils-riff-fantomes');
    await page.getByTestId('outils-onglet-arpege').click();
    await capturer(page, '03-outils-arpege');
    await page.getByTestId('outils-onglet-swing').click();
    await page.getByTestId('swing-morceau').uncheck();
    await capturer(page, '04-outils-swing');
    await page.goBack();
    await ouvrirDepuisOutils(page, 'pr-midi');
    await page.getByTestId('midi-chercher').click();
    await page.getByTestId('midi-direct').check();
    await capturer(page, '05-midi');
    expect(erreurs).toEqual([]);
  });
});
