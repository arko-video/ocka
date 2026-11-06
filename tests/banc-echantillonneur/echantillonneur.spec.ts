// Échantillonneur (M1, C1) dans Chrome : justesse (YIN, ±5 cents), glissé, pas de clic au bouclage, écoute après un
// saut = export, instrument absent, mémoire de 8 vrais instruments de BQ, planification de 16 pistes (CPU ×4).
// Faux instruments : Opus fabriqués ici par ffmpeg, donnés à la page en mémoire (aucun réseau).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import type { PisteTest } from './outils';
import { fabriquerFaux } from './fabrique';

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIES = join(ICI, 'sorties');
const FAUX = fabriquerFaux(join(SORTIES, 'faux'));
/** Les 8 plus gros instruments de BQ (≈ 60 s décodées chacun ; deux batteries stéréo). */
const HUIT = ['vcsl-piano-queue@1', 'karoryfer-batterie@1', 'vsco-cordes@1', 'freepats-guitare-claire@1', 'karoryfer-basse@1', 'vcsl-marimba@1', 'vsco-violon@1', 'virtuosity-batterie-jazz@1'];
const bilan: Record<string, unknown> = {};

type M1 = Record<string, (...a: never[]) => Promise<unknown> | unknown>;
async function appeler<T>(page: Page, nom: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(([n, a]) => ((window as unknown as { m1: M1 }).m1[n as string] as (...x: unknown[]) => unknown)(...(a as unknown[])), [nom, args] as const) as Promise<T>;
}

/** Mémoire (Mo) de tous les processus de ce Chrome (marqué --ocka-banc-m1) et de leurs descendants. */
function memoireChrome(): number {
  const lignes = execFileSync('ps', ['-eo', 'pid=,ppid=,rss=,args='], { encoding: 'utf8' })
    .split('\n')
    .map((l) => /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(l))
    .filter((x): x is RegExpExecArray => !!x);
  const pids = new Set(lignes.filter((l) => l[4]!.includes('--ocka-banc-m1') && !l[4]!.includes('--type=')).map((l) => l[1]!));
  for (let avant = -1; pids.size !== avant; ) {
    avant = pids.size;
    for (const l of lignes) if (pids.has(l[2]!)) pids.add(l[1]!);
  }
  return Math.round(lignes.filter((l) => pids.has(l[1]!)).reduce((a, l) => a + Number(l[3]), 0) / 1024);
}

async function ouvrir(page: Page) {
  // Pas de rechargement à chaud : d'autres développeurs modifient le code pendant le banc (serveur de dev partagé).
  const client = 'const h = () => ({ accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {}, data: {} });\n'
    + 'export const createHotContext = h; export const updateStyle = () => {}; export const removeStyle = () => {};\n'
    + 'export const injectQuery = (u) => u; export class ErrorOverlay {}';
  await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'text/javascript', body: client }));
  await page.goto('tests/banc-echantillonneur/index.html');
  await page.waitForFunction(() => (window as unknown as { m1Pret?: boolean }).m1Pret === true);
}

test.describe.configure({ mode: 'serial' });
test.afterAll(() => {
  const fichier = join(SORTIES, 'bilan-echantillonneur.json');
  const avant = existsSync(fichier) ? (JSON.parse(readFileSync(fichier, 'utf8')) as Record<string, unknown>) : {};
  writeFileSync(fichier, JSON.stringify({ ...avant, ...bilan }, null, 2));
});

test('faux instruments : amorce Opus retirée, justesse ±5 cents entre deux racines, glissé, boucle sans clic', async ({ page }) => {
  await ouvrir(page);
  await appeler(page, 'installerFaux', FAUX);
  const notes = [56, 57, 58, 59, 60, 61, 62, 63, 64];
  for (const fs of [48000, 44100]) {
    const r = await appeler<{ midi: number; ecart: number; detune: number }[]>(page, 'justesse', 'faux-orgue@1', notes, fs);
    bilan[`justesse-faux-${fs}`] = r.map((x) => ({ midi: x.midi, detune: Math.round(x.detune), ecart: +x.ecart.toFixed(2) }));
    for (const x of r) expect(Math.abs(x.ecart), `note ${x.midi} à ${fs} Hz`).toBeLessThanOrEqual(5);
  }
  // Chrome retire l'amorce de 312 échantillons : longueur décodée = `fin` (2 s = 96 000).
  const longueurs = await appeler<Record<string, number>>(page, 'longueurs');
  bilan.longueursFaux = longueurs;
  for (const [cle, n] of Object.entries(longueurs)) if (cle.startsWith('faux-orgue')) expect(n, cle).toBe(96000);
  const g = await appeler<{ debut: number; fin: number }>(page, 'glisse', 'faux-orgue@1', 60, 63, 48000);
  bilan.glisse = g;
  expect(Math.abs(g.debut - 6000)).toBeLessThanOrEqual(5);
  expect(Math.abs(g.fin - 6300)).toBeLessThanOrEqual(10);
  // Bouclage : sans perte, aucun saut au raccord (rapport ≈ 1) ; en Opus, seul le bruit de codage reste (≤ 3).
  for (const [id, seuil] of [['faux-orgue-pcm@1', 1.1], ['faux-orgue@1', 3]] as const) {
    for (const midi of [57, 58, 61, 62]) {
      const b = await appeler<{ raccords: number; rapport: number }>(page, 'bouclage', id, midi, 4, 48000);
      bilan[`bouclage-${id}-${midi}`] = b;
      expect(b.raccords).toBeGreaterThanOrEqual(5);
      expect(b.rapport, `boucle de la note ${midi} (${id})`).toBeLessThanOrEqual(seuil);
    }
  }
});

test('écoute après un saut au hasard = export (glissé, mono, groupe exclusif, son v1, sidechain, automation, LFO)', async ({ page }) => {
  await ouvrir(page);
  await appeler(page, 'installerFaux', FAUX);
  const pistes: PisteTest[] = [
    { id: 'orgue', instrument: 'faux-orgue@1', pas: 32, notes: [{ pas: 0, duree: 6, midi: 57, vel: 0.8, glisse: true }, { pas: 6, duree: 10, midi: 61, vel: 1 }, { pas: 16, duree: 16, midi: 64, vel: 0.5, glisse: true }] },
    { id: 'mono', instrument: 'faux-mono@1', pas: 16, notes: [{ pas: 0, duree: 12, midi: 59, vel: 0.7 }, { pas: 5, duree: 9, midi: 62, vel: 0.9 }, { pas: 9, duree: 5, midi: 56, vel: 0.6 }] },
    { id: 'hh', instrument: 'faux-batterie@1', pas: 16, notes: [0, 2, 4, 6, 8, 10, 12, 14].map((pas) => ({ pas, duree: 1, midi: pas % 8 === 6 ? 46 : 42, vel: 0.5 + pas / 40 })) },
    { id: 'piano', instrument: 'ocka-piano@1', pas: 16, notes: [{ pas: 2, duree: 6, midi: 67, vel: 0.7 }, { pas: 10, duree: 4, midi: 71, vel: 0.6 }] },
  ];
  // Sauts « au hasard » (graine fixe : le test reste reproductible), en plein milieu de notes tenues et de glissés.
  let graine = 12345;
  const hasard = () => ((graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ecarts: { t0: number; fs: number; effets: string[]; ecartDb: number }[] = [];
  for (let k = 0; k < 8; k++) {
    const t0 = +(0.2 + hasard() * 7.3).toFixed(4);
    const fs = k % 2 ? 44100 : 48000;
    const effets = k >= 4 ? ['sidechain', 'hauteur', 'pan', 'volume'] : []; // sidechain, LFO (hauteur, pan) et automation de volume (tranches de M2)
    const r = await appeler<{ ecartDb: number; crete: number }>(page, 'ecouteExport', pistes, t0, fs, effets);
    ecarts.push({ t0, fs, effets, ecartDb: +r.ecartDb.toFixed(1) });
    expect(r.crete).toBeGreaterThan(0.05);
    expect(r.ecartDb, `saut à ${t0} s (${fs} Hz)`).toBeLessThanOrEqual(-60);
  }
  bilan.ecouteExport = ecarts;
});

test('instrument absent : muet et compté à l’écoute, « instrument_absent » à l’export', async ({ page }) => {
  await ouvrir(page);
  await appeler(page, 'installerFaux', FAUX);
  const r = await appeler<{ ecoute: { muettes: number; manquants: string[] }; erreur: { code: string; message: string } | null }>(page, 'absent');
  bilan.absent = r;
  expect(r.ecoute.muettes).toBeGreaterThan(0);
  expect(r.ecoute.manquants).toEqual(['absent-instrument@1']);
  expect(r.erreur?.code).toBe('instrument_absent');
  expect(r.erreur?.message).toContain('absent-instrument@1');
});

test('vrais instruments de BQ : justesse, bouclage, mémoire de 8 pistes (toutes les zones)', async ({ page }) => {
  await ouvrir(page);
  await appeler(page, 'installerBanque');
  const justesse: Record<string, unknown> = {};
  for (const [id, notes] of [['vsco-flute@1', [61, 62, 64, 66, 70, 73]], ['freepats-orgue-electrique@1', [49, 50, 55, 56, 62, 68]], ['vcsl-piano-queue@1', [49, 50, 56, 61, 62, 68]]] as const) {
    const r = await appeler<{ midi: number; ecart: number; detune: number }[]>(page, 'justesse', id, notes, 48000);
    justesse[id] = r.map((x) => ({ midi: x.midi, detune: Math.round(x.detune), ecart: +x.ecart.toFixed(2) }));
  }
  bilan.justesseBQ = justesse;
  // Intégration C1 : `cents` = accord du fichier (retiré par l'échantillonneur), orgue électrique à −12 : ±5 cents.
  for (const [id, r] of Object.entries(justesse)) for (const x of r as { midi: number; ecart: number }[]) expect(Math.abs(x.ecart), `${id} ${x.midi}`).toBeLessThanOrEqual(5);
  const boucles: Record<string, unknown> = {};
  for (const [id, midi] of [['vsco-cordes@1', 60], ['vcsl-orgue@1', 60], ['freepats-accordeon@1', 60], ['vsco-violon@1', 67]] as const) {
    boucles[id] = await appeler(page, 'bouclage', id, midi, 4, 48000);
  }
  bilan.bouclageBQ = boucles;

  const rssAvant = memoireChrome();
  const m = await appeler<Record<string, unknown> & { apresLecture: { zones: number }; muettes: number; decodagesExport: number }>(page, 'memoire8', HUIT);
  const rssPendant = memoireChrome();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const tas = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
  const fin = await appeler<{ zones: number }>(page, 'finirMemoire');
  bilan.memoire8 = { ...m, rssAvantMo: rssAvant, rssPendantMo: rssPendant, rssEnPlusMo: rssPendant - rssAvant, tasApresGcMo: Math.round(tas.usedSize / 1e6), zonesMio: +(m.apresLecture.zones / 2 ** 20).toFixed(1), apresDestruction: fin };
  bilan.longueursBQ = await appeler<Record<string, number>>(page, 'longueurs');
  expect(m.muettes).toBe(0);
  expect(m.apresLecture.zones).toBeLessThanOrEqual(128 * 2 ** 20);
  expect(m.decodagesExport).toBe(0); // l'export réutilise les zones décodées pour l'écoute
});

test('planifier 16 pistes denses, processeur ralenti ×4 : aucune note en retard ni sautée', async ({ page }) => {
  // Espion : chaque source démarrée en retard (heure, retard), pour le bilan.
  await page.addInitScript(() => {
    const w = window as unknown as { __retards: number[][] };
    w.__retards = [];
    const start = AudioBufferSourceNode.prototype.start as (this: AudioBufferSourceNode, ...a: number[]) => void;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, quand = 0, ...reste: number[]) {
      const c = this.context;
      if (c instanceof AudioContext && quand > 0 && quand < c.currentTime - 0.001) w.__retards.push([+quand.toFixed(3), +(c.currentTime - quand).toFixed(4)]);
      return start.call(this, quand, ...reste);
    };
  });
  await ouvrir(page);
  await appeler(page, 'installerFaux', FAUX);
  const instruments = ['faux-orgue@1', 'faux-mono@1', 'faux-batterie@1', 'ocka-pluck@1'];
  const pistes: PisteTest[] = Array.from({ length: 16 }, (_, i) => ({
    id: `p${i}`,
    instrument: instruments[i % 4]!,
    pas: 16,
    notes: Array.from({ length: 16 }, (_, k) => ({ pas: k, duree: 1, midi: instruments[i % 4] === 'faux-batterie@1' ? (k % 4 === 2 ? 46 : 42) : 56 + ((i + k) % 9), vel: 0.4 + (k % 4) / 8 })),
  }));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const r = await appeler<{ retards: number; sautees: number; muettes: number; planifierMoyenMs: number; planifierMaxMs: number; notes: number }>(page, 'seizePistes', pistes, 8000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  bilan.seizePistes = { ...r, detailRetards: await page.evaluate(() => (window as unknown as { __retards: number[][] }).__retards) };
  expect(r.retards).toBe(0);
  expect(r.sautees).toBe(0);
  expect(r.muettes).toBe(0);
});
