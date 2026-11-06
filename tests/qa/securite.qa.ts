// Sécurité : CSP d'index.html intacte et active dans le build, aucune requête sortante, aucune erreur console.
// Vague B (phase 6) : connect-src permet SEULEMENT les 3 fournisseurs d'IA ; tout autre https: est interdit.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { nouveau, surveiller } from './outils';

const CSP = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/;
/** Les seuls sites extérieurs permis (connect-src), pour l'IA facultative avec la clé de l'utilisateur. */
const IA = ['https://api.anthropic.com', 'https://api.openai.com', 'https://generativelanguage.googleapis.com'];

test('la CSP du build est celle de la source, placée avant tout script, et elle bloque les scripts en ligne et les sites extérieurs', async ({ page, request }) => {
  const source = new TextDecoder().decode(readFileSync('index.html'));
  const servi = await (await request.get('./')).text();
  const cspSource = CSP.exec(source)?.[1];
  expect(cspSource).toBeTruthy();
  expect(CSP.exec(servi)?.[1]).toBe(cspSource);
  expect(servi.indexOf('Content-Security-Policy')).toBeLessThan(servi.indexOf('<script'));
  // Seules ouvertures permises (vague A) : 'wasm-unsafe-eval' (compiler le WebAssembly du secours AAC, ni eval ni
  // new Function) et blob: pour les Workers (celui de l'encodeur AAC). Jamais 'unsafe-eval', jamais de site extérieur.
  const directives = Object.fromEntries(cspSource!.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  expect(directives['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"]);
  expect(directives['worker-src']).toEqual(["'self'", 'blob:']);
  expect(directives['connect-src']).toEqual(["'self'", ...IA]);
  // Hors de ces 3 adresses exactes (sans joker), aucun site extérieur, dans aucune directive.
  let reste = cspSource!.replace("'wasm-unsafe-eval'", '');
  for (const a of IA) reste = reste.replace(` ${a}`, '');
  expect(reste).not.toMatch(/unsafe-eval|\*|https?:/);
  for (const [k, v] of Object.entries(directives)) if (k !== 'connect-src') expect(v.join(' ')).not.toMatch(/https?:/);
  // Aucun script en ligne dans la page servie (la CSP les refuserait).
  expect(servi).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
  // Pas d'en-tête qui affaiblirait la meta (le serveur d'aperçu n'en met pas ; GitHub Pages non plus).
  const r = await surveiller(page);
  await page.goto('./');
  await expect(page.getByTestId('ecran-accueil')).toBeVisible();
  const essais = await page.evaluate(async () => {
    const res: Record<string, string> = {};
    // Script en ligne ajouté au DOM (page.evaluate lui-même échappe à la CSP : on ne teste pas eval par lui).
    const sc = document.createElement('script');
    sc.textContent = 'window.__qaEnLigne = 1';
    document.head.append(sc);
    await new Promise((r) => setTimeout(r, 50));
    res.scriptEnLigne = (window as unknown as { __qaEnLigne?: number }).__qaEnLigne ? 'permis' : 'bloqué';
    try {
      await fetch('https://example.com/');
      res.fetch = 'permis';
    } catch {
      res.fetch = 'bloqué';
    }
    // Un faux sous-domaine d'un fournisseur et un autre chemin https : bloqués aussi (la CSP vise l'hôte exact).
    try {
      await fetch('https://evil.api.anthropic.com.example.com/');
      res.sousDomaine = 'permis';
    } catch {
      res.sousDomaine = 'bloqué';
    }
    const img = new Image();
    res.image = await new Promise<string>((ok) => {
      img.onload = () => ok('permis');
      img.onerror = () => ok('bloqué');
      img.src = 'https://example.com/x.png';
    });
    return res;
  });
  expect(essais).toEqual({ scriptEnLigne: 'bloqué', fetch: 'bloqué', sousDomaine: 'bloqué', image: 'bloqué' });
  // Les violations relevées viennent de nos 4 essais, et d'eux seuls.
  expect(r.csp.length).toBeGreaterThanOrEqual(3);
  expect(r.sortantes.filter((u) => !new URL(u).hostname.endsWith('example.com'))).toEqual([]);
});

test('parcours complet (lecture, pads, structure, son, export) : zéro requête sortante, zéro violation CSP, zéro erreur', async ({ page }) => {
  const r = await surveiller(page);
  await nouveau(page, 'lofi');
  await page.getByTestId('lecture').click();
  await expect(page.getByTestId('lecture')).toHaveAttribute('data-etat', 'lecture');
  await page.waitForTimeout(2500);
  await page.getByTestId('instrument-kick').click();
  await page.getByTestId('pad-7').click();
  await page.getByTestId('varier').click();
  await page.getByTestId('lecture').click();
  await page.getByTestId('onglet-structure').click();
  await page.getByTestId('ajouter-section').click();
  await page.getByTestId('nouvelle-Pont').click();
  await page.getByTestId('onglet-son').click();
  await page.getByTestId('master-chaud').click();
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('exporter-wav').click();
  await expect(page.getByTestId('export-resultat')).toBeVisible({ timeout: 200_000 });
  await page.getByTestId('retour').click();
  await page.reload();
  await expect(page.getByTestId('liste-morceaux')).toBeVisible();
  // Le service worker (PWA) ne doit rien aller chercher dehors non plus.
  await page.waitForTimeout(1500);
  expect(r.sortantes).toEqual([]);
  expect(r.csp).toEqual([]);
  expect(r.erreurs).toEqual([]);
});

// v2 (vague C1) : un instrument de la banque se télécharge depuis la MÊME origine (connect-src 'self'), sans rien
// d'extérieur ; il est rangé dans le Cache Storage « ocka-instruments » et jamais précaché par le service worker.
test('instrument de la banque : téléchargé depuis la même origine, rangé dans ocka-instruments, zéro violation', async ({ page }) => {
  const r = await surveiller(page);
  const banque: string[] = [];
  page.on('request', (q) => {
    if (q.url().includes('/instruments/')) banque.push(q.url());
  });
  await nouveau(page, 'trap');
  await page.getByTestId('onglet-beat').click();
  await page.getByTestId('vue-instruments').click();
  await page.getByTestId('ajouter-piste').click();
  await page.getByTestId('choisir-vcsl-marimba@1').click();
  await expect(page.getByTestId('pr-complet')).toBeVisible({ timeout: 60_000 });
  const rangees = await page.evaluate(async () => {
    const c = await caches.open('ocka-instruments');
    return (await c.keys()).map((q) => new URL(q.url).pathname);
  });
  const precache = await page.evaluate(async () => {
    const res: string[] = [];
    for (const n of await caches.keys()) if (n !== 'ocka-instruments') for (const q of await (await caches.open(n)).keys()) res.push(q.url);
    return res.filter((u) => u.includes('/instruments/'));
  });
  expect(banque.length).toBeGreaterThan(2);
  for (const u of banque) expect(new URL(u).origin).toBe('http://localhost:4194');
  expect(rangees).toContain('/ocka/instruments/vcsl-marimba/instrument.json');
  expect(rangees.filter((p) => p.endsWith('.ogg')).length).toBeGreaterThan(10);
  expect(precache).toEqual([]);
  expect(r.sortantes).toEqual([]);
  expect(r.csp).toEqual([]);
  expect(r.erreurs).toEqual([]);
});
