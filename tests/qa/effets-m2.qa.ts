// Effets de M2 (vague C1) mesurés dans Chrome : réponses des inserts, worklet = JS, sidechain, écoute = export
// après un saut au hasard (automation, LFO, sidechain), Σ pistes séparées = mélange avant master.
// Besoin du serveur de dev (modules sources) : npx vite --port 5212 --strictPort.
// Lancer : npx playwright test -c tests/qa/playwright.qa.config.ts effets-m2
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { SORTIES } from './outils';

const DEV = 'http://localhost:5212/ocka/';
type Banc = typeof import('./banc-effets');
const bilan = (nom: string, x: unknown) => writeFileSync(join(SORTIES, `bilan-effets-${nom}.json`), JSON.stringify(x, (_, v) => (v === -Infinity ? '-inf' : v), 2));

/** Client de Vite remplacé : les modifications des autres développeurs ne rechargent pas la page pendant les mesures. */
const CLIENT_MUET = `const h = { accept() {}, acceptExports() {}, dispose() {}, prune() {}, decline() {}, invalidate() {}, on() {}, off() {}, send() {}, data: {} };
export const createHotContext = () => h; export const injectQuery = (u) => u; export const updateStyle = () => {};
export const removeStyle = () => {}; export class ErrorOverlay {}`;

async function ouvrir(page: Page) {
  await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'text/javascript', body: CLIENT_MUET }));
  await page.goto(DEV);
  await page.waitForFunction(() => document.readyState === 'complete');
}

test('écoute = export après un saut au hasard (automation, LFO, sidechain) ≤ −70 dB', async ({ page }) => {
  test.setTimeout(240_000);
  await ouvrir(page);
  const r = await page.evaluate(async () => {
    const b = (await import(/* @vite-ignore */ String('/ocka/tests/qa/banc-effets.ts'))) as Banc;
    const { dureeMorceau } = await import(/* @vite-ignore */ String('/ocka/src/morceau/temps.ts'));
    const m = b.morceauTest();
    const total = Math.floor(dureeMorceau(m) * b.FS);
    const exp = await b.rendre(m, { debut: 0, n: total, ecoute: false });
    const sauts = [];
    for (const u of [0.23, 0.51, 0.77]) {
      const debutTrames = Math.round(u * (total - 7 * b.FS) / 128) * 128 + 37; // trame entière, pas sur un bloc
      const debut = debutTrames / b.FS;
      const n = 6 * b.FS;
      const ec = await b.rendre(m, { debut, n, ecoute: true });
      // Sans compresseur ni envois : comparable 0,2 s après le saut (mémoire des filtres et des lignes de retard).
      const sansEtat = { ...m, pistes: m.pistes.map((p) => (p.id === 'basse' ? { ...p, inserts: p.inserts!.filter((i) => i.type === 'eq') } : p.id === 'accords' ? { ...p, inserts: p.inserts!.filter((i) => i.type !== 'envoi-echo') } : p)) };
      sauts.push({ debut, toutDes4s: b.ecartDb(ec, exp, debutTrames, 4 * b.FS, n), crete: b.crete(ec), sansEtat: 0 });
      const expSans = await b.rendre(sansEtat, { debut: 0, n: debutTrames + n, ecoute: false });
      const ecSans = await b.rendre(sansEtat, { debut, n, ecoute: true });
      sauts[sauts.length - 1]!.sansEtat = b.ecartDb(ecSans, expSans, debutTrames, Math.round(0.2 * b.FS), n);
    }
    return { sauts };
  });
  bilan('ecoute-export', r);
  for (const s of r.sauts) {
    expect(s.crete).toBeGreaterThan(0.05);
    expect(s.sansEtat).toBeLessThanOrEqual(-70);
    expect(s.toutDes4s).toBeLessThanOrEqual(-70);
  }
});

test('Σ pistes séparées = mélange avant master ≤ −90 dBFS (inserts, envois, automation)', async ({ page }) => {
  test.setTimeout(180_000);
  await ouvrir(page);
  const r = await page.evaluate(async () => {
    const b = (await import(/* @vite-ignore */ String('/ocka/tests/qa/banc-effets.ts'))) as Banc;
    const m = b.morceauTest();
    const n = 12 * b.FS;
    const mix = await b.rendre(m, { debut: 0, n, ecoute: false });
    const st = await b.rendre(m, { debut: 0, n, ecoute: false, separees: true });
    const somme = [0, 1].map((c) => {
      const s = new Float32Array(n);
      for (let k = 0; k < st.length / 2; k++) for (let i = 0; i < n; i++) s[i] += st[2 * k + c]![i]!;
      return s;
    });
    return { ecart: b.ecartDb(somme, mix, 0, 0, n), crete: b.crete(mix) };
  });
  bilan('stems', r);
  expect(r.crete).toBeGreaterThan(0.05);
  expect(r.ecart).toBeLessThanOrEqual(-90);
});

test('réponses : égaliseur et filtres ±0,5 dB, saturation (repliement, gain), worklet = JS (compresseur, bitcrusher)', async ({ page }) => {
  test.setTimeout(180_000);
  await ouvrir(page);
  const r = await page.evaluate(async () => {
    const b = (await import(/* @vite-ignore */ String('/ocka/tests/qa/banc-effets.ts'))) as Banc;
    const N = 16384;
    // Passe-bande RBJ (gain 0 dB au centre), avec la déformation de la transformée bilinéaire.
    const passeBande = (f: number, f0: number, q: number) => {
      const w = Math.tan((Math.PI * f) / b.FS) / Math.tan((Math.PI * f0) / b.FS);
      return 20 * Math.log10(w / q / Math.hypot(1 - w * w, w / q));
    };
    const ecarts: { cas: string; mesure: number; attendu: number }[] = [];
    const mesurer = async (cas: string, i: Parameters<Banc['ins']>, points: [number, number][]) => {
      const [h] = await b.traverser([b.ins(...i)], b.impulsion(N), false);
      for (const [f, attendu] of points) ecarts.push({ cas: `${cas} ${f} Hz`, mesure: b.gainDb(h!, f), attendu });
    };
    // Égaliseur : chaque bande à sa fréquence (cloche : gain plein ; plateaux : moitié du gain en dB à f0 ; coupe-bas
    // et coupe-haut Butterworth : −3 dB à leur fréquence), et loin des bandes : 0 dB.
    await mesurer('eq cloche', ['eq', 'e', { medium: -6, freqMedium: 1000, qMedium: 2 }], [[1000, -6], [100, 0], [12000, 0]]);
    await mesurer('eq grave', ['eq', 'e', { grave: 8, freqGrave: 120 }], [[120, 4], [8000, 0]]);
    await mesurer('eq aigu', ['eq', 'e', { aigu: -10, freqAigu: 6000 }], [[6000, -5], [100, 0]]);
    await mesurer('eq coupe-bas', ['eq', 'e', { passeHaut: 200 }], [[200, -3.01], [5000, 0]]);
    await mesurer('eq coupe-haut', ['eq', 'e', { passeBas: 5000 }], [[5000, -3.01], [100, 0]]);
    await mesurer('filtre passe-bas Q4', ['filtre', 'f', { mode: 0, frequence: 2000, resonance: 4 }], [[2000, 12.04], [100, 0]]);
    await mesurer('filtre passe-haut', ['filtre', 'f', { mode: 1, frequence: 500, resonance: 0.707 }], [[500, -3.01], [10000, 0]]);
    await mesurer('filtre passe-bande', ['filtre', 'f', { mode: 2, frequence: 1000, resonance: 2 }], [[1000, 0], [4000, passeBande(4000, 1000, 2)]]);

    // Saturation : repliement (tout ce qui n'est pas une harmonique) d'un sinus à −6 dBFS de 1 kHz (testé) et de
    // 2,5 kHz (relevé seulement : ses harmoniques tombent juste au-dessus de 22 kHz, mal coupées par le 4x de Chrome),
    // et gain compensé (−12 dBFS, 200 Hz).
    const repliement: Record<string, number> = {};
    const gains: Record<string, number> = {};
    for (const [force, f] of [[0, 1000], [0.5, 1000], [1, 1000], [0.5, 2500], [1, 2500]] as const) {
      const [y] = await b.traverser([b.ins('saturation', 's', { force, mix: 1 })], b.sinus(65536 + 8192, 0.5, f), false);
      const sp = b.spectre(y!.subarray(8192));
      const bin = (fr: number) => (fr * 65536) / b.FS;
      const fond = Math.max(...Array.from(sp.subarray(Math.round(bin(f)) - 3, Math.round(bin(f)) + 4)));
      let pire = -Infinity;
      for (let k = 8; k < sp.length; k++) {
        const fr = (k * b.FS) / 65536;
        const h = Math.round(fr / f);
        if (h >= 1 && Math.abs(k - bin(h * f)) < 8) continue;
        pire = Math.max(pire, sp[k]!);
      }
      repliement[`force ${force}, ${f} Hz`] = pire - fond;
      const x = b.sinus(44100, 0.25, 200);
      const [z] = await b.traverser([b.ins('saturation', 's', { force, mix: 1 })], x, false);
      const rms = (a: Float32Array) => Math.sqrt(a.subarray(4410).reduce((s, v) => s + v * v, 0) / (a.length - 4410));
      gains[`force ${force}`] = 20 * Math.log10(rms(z!) / rms(x[0]!));
    }

    // Worklet (écoute) = JS (export) : bruit + sinus avec des sauts de niveau.
    const n = 3 * b.FS;
    const x = [0, 1].map((c) => Float32Array.from({ length: n }, (_, i) => (i % 30000 < 15000 ? 0.9 : 0.05) * (Math.sin(i / 7 + c) * 0.7 + 0.3 * Math.sin(i * 1.37))));
    const jsWorklet: Record<string, number> = {};
    for (const [nom, liste] of Object.entries({
      compresseur: [b.ins('compresseur', 'c', { seuil: -30, ratio: 6, attaque: 3, relache: 80 })],
      bitcrusher: [b.ins('bitcrusher', 'k', { bits: 6, reduction: 5, mix: 0.8 })],
      'eq + compresseur + bitcrusher': [b.ins('eq', 'e', { grave: 5 }), b.ins('compresseur', 'c'), b.ins('bitcrusher', 'k')],
    })) {
      const w = await b.traverser(liste, x, true);
      const j = await b.traverser(liste, x, false);
      jsWorklet[nom] = b.ecartDb(w, j, 0, 0, n);
    }
    return { ecarts, repliement, gains, jsWorklet };
  });
  bilan('reponses', r);
  for (const e of r.ecarts) expect(Math.abs(e.mesure - e.attendu), e.cas).toBeLessThanOrEqual(0.5);
  for (const [k, v] of Object.entries(r.repliement)) if (k.endsWith('1000 Hz')) expect(v, k).toBeLessThanOrEqual(-60);
  for (const v of Object.values(r.gains)) expect(Math.abs(v)).toBeLessThanOrEqual(0.5);
  for (const v of Object.values(r.jsWorklet)) expect(v).toBeLessThanOrEqual(-120);
});

test('sidechain : réduction mesurée sur chaque kick = 20·log10(1 − force) ±0,5 dB', async ({ page }) => {
  test.setTimeout(120_000);
  await ouvrir(page);
  const r = await page.evaluate(async () => {
    const b = (await import(/* @vite-ignore */ String('/ocka/tests/qa/banc-effets.ts'))) as Banc;
    const { nouveauMorceau } = await import(/* @vite-ignore */ String('/ocka/src/morceau/styles.ts'));
    const { tempsKicks } = await import(/* @vite-ignore */ String('/ocka/src/moteur/sidechain.ts'));
    const m0 = nouveauMorceau('trap', 'Pompe');
    m0.ordre = m0.ordre.slice(0, 2);
    const m = { ...m0, pistes: m0.pistes.map((p: { id: string }) => (p.id === 'basse' ? { ...p, sidechain: { source: 'kick' as const, force: 0.75, relache: 0.15 } } : p)) };
    const n = 12 * b.FS;
    const y = await b.tranche(m, 'basse', n, 0.5, 4000);
    const crete = (t0: number, t1: number) => {
      let c = 0;
      for (let i = Math.round(t0 * b.FS); i < Math.round(t1 * b.FS); i++) c = Math.max(c, Math.abs(y[i]!));
      return c;
    };
    const kicks: number[] = tempsKicks(m).filter((t: number) => t < 11.5);
    const mesures = kicks.map((t: number) => 20 * Math.log10(crete(t + 0.0021, t + 0.0026) / crete(t - 0.0012, t - 0.0002)));
    // Avant un kick, le gain doit être remonté (sinon on compare à un niveau déjà baissé) : kicks espacés > relâchement.
    const libres = mesures.filter((_, k) => k === 0 || kicks[k]! - kicks[k - 1]! > 0.16);
    return { kicks: kicks.length, mesures: libres, attendu: 20 * Math.log10(0.25) };
  });
  bilan('sidechain', r);
  expect(r.mesures.length).toBeGreaterThan(8);
  for (const v of r.mesures) expect(Math.abs(v - r.attendu)).toBeLessThanOrEqual(0.5);
});

test('CPU : 8 pistes × 3 inserts en écoute, processeur ralenti ×4 : aucune coupure', async ({ page }) => {
  test.setTimeout(180_000);
  await ouvrir(page);
  const cdp = await page.context().newCDPSession(page);
  const mesurer = async () =>
    page.evaluate(async () => {
      const c = await import(/* @vite-ignore */ String('/ocka/tests/qa/banc-cpu.ts'));
      return c.ecouter(20);
    });
  const normal = await mesurer();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const ralenti = await mesurer();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const charge = await page.evaluate(async () => (await import(/* @vite-ignore */ String('/ocka/tests/qa/banc-cpu.ts'))).chargeRendu(10));
  const r = { normal, ralenti, chargeRendu: charge, chargeRenduX4: 4 * charge };
  bilan('cpu', r);
  expect(normal.coupures).toBe(0);
  expect(ralenti.coupures).toBe(0);
  expect(ralenti.fenetresEnRetard).toBe(0);
  expect(4 * charge).toBeLessThan(1);
});
