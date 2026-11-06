// Ta voix → instrument (Chanter) et Beatbox, dans Chrome avec un FAUX MICRO (--use-file-for-fake-audio-capture) :
// - une mélodie chantée (voix de synthèse, 2 mesures à 120 BPM, en boucle) est jouée en direct (roue des 12 notes),
//   puis enregistrée et retrouvée en notes dans le motif de la piste à ±1 pas (au décalage de boucle près) ;
// - un beat fait à la bouche (sons de synthèse) joue le kit et pose ses frappes dans le motif de batterie ;
// - captures 360 × 800 des panneaux.
import { chromium, expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SonBeatbox } from '../../src/dubler/api-dubler';
import { detecterAttaques } from '../../src/dubler/attaques';
import { mesuresAttaque } from '../../src/dubler/mesures';
import { NOTES_BATTERIE } from '../../src/dubler/notes';
import { sonBeatbox, suiteBeatbox, voixSegments } from '../../src/dubler/signaux-test';
import { dossierNeuf, ecrireMorceauIdb, morceauxIdb, nouveauMorceau } from './outils-e2e';

const FS = 48000;
const P = 0.125; // un pas (double-croche) à 120 BPM
const CAPTURES = join('tests', 'e2e', 'captures');
const EXEMPLES_PAR_SON = 5; // api-dubler.ts (non importé ici : il charge le worklet)

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

/** La mélodie chantée : (pas, durée en pas, MIDI), 32 pas = 4 s, puis la boucle recommence. */
const MELODIE = '0:4:57 4:4:60 8:4:64 12:4:62 16:8:60 24:6:57'
  .split(' ')
  .map((x) => x.split(':').map(Number) as [number, number, number]);
const dossier = dossierNeuf('dubler');
const fichierVoix = join(dossier, 'melodie.wav');
writeFileSync(
  fichierVoix,
  wav(
    voixSegments(
      [
        ...MELODIE.map(([, d, midi]) => ({ hz: 440 * Math.pow(2, (midi - 69) / 12), duree: d * P })),
        { hz: null, duree: 2 * P },
      ],
      FS,
      30,
    ),
  ) as unknown as string,
);
/** Le beat fait à la bouche (2 mesures) : kick, « ka », « ts ». */
const BEAT = 'boum:0 ts:2 ka:4 boum:6 ts:10 ka:12 boum:16 ts:18 ka:20 boum:22 ts:26 ka:28'
  .split(' ')
  .map((x) => [x.split(':')[0] as SonBeatbox, Number(x.split(':')[1])] as const);
const fichierBeat = join(dossier, 'beat.wav');
writeFileSync(
  fichierBeat,
  wav(
    suiteBeatbox(
      BEAT.map(([son, pas], i) => ({ son, t: pas * P - 0.01, graine: 300 + i })),
      32 * P,
    ),
  ) as unknown as string,
);

/** Un Chrome à part, dont le micro « entend » `fichier` en boucle (une option de lancement par test). */
async function avecFauxMicro(
  fichier: string,
  baseURL: string | undefined,
  corps: (page: Page) => Promise<void>,
): Promise<void> {
  const navigateur = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${fichier}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  try {
    const contexte = await navigateur.newContext({ baseURL, viewport: { width: 360, height: 800 } });
    await corps(await contexte.newPage());
  } finally {
    await navigateur.close();
  }
}

/** Un morceau simple : 120 BPM, la mineur, 1re section de 2 mesures, piste « melodie » jouée par le lead d'OCKA. */
async function morceauTest(page: Page): Promise<{ id: string; section: string }> {
  await nouveauMorceau(page, 'trap');
  await page.getByTestId('retour').click();
  const [{ id, m }] = await morceauxIdb(page);
  const x = m as unknown as Record<string, unknown> & {
    ordre: string[];
    sections: { id: string; mesures: number }[];
    pistes: { id: string; instrument?: string }[];
  };
  const section = x.ordre[0]!;
  const neuf = {
    ...x,
    tempo: 120,
    swing: 0,
    tonalite: { tonique: 'A', mode: 'mineur' },
    sections: x.sections.map((s) => (s.id === section ? { ...s, mesures: 2 } : s)),
    pistes: x.pistes.map((p) => (p.id === 'melodie' ? { ...p, instrument: 'ocka-lead@1' } : p)),
  };
  await ecrireMorceauIdb(page, id, neuf);
  await page.reload();
  await page.getByTestId('ouvrir-morceau').first().click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
  return { id, section };
}

/** Meilleur recalage circulaire (en pas) entre des notes attendues et trouvées ; nombre retrouvé à ±1 pas. */
function retrouvees(
  attendues: { pas: number; midi: number }[],
  trouvees: { pas: number; midi: number }[],
  longueur: number,
): number {
  let meilleur = 0;
  for (let r = 0; r < longueur; r += 0.5) {
    const n = attendues.filter((a) =>
      trouvees.some(
        (t) =>
          t.midi === a.midi &&
          Math.min(...[-longueur, 0, longueur].map((k) => Math.abs(t.pas - ((a.pas + r) % longueur) + k))) <=
            1,
      ),
    ).length;
    meilleur = Math.max(meilleur, n);
  }
  return meilleur;
}

test.describe('Chanter', () => {
  test('direct (roue des notes), puis la mélodie enregistrée est retrouvée en notes', async ({ baseURL }) => {
    await avecFauxMicro(fichierVoix, baseURL, async (page) => {
      const { id, section } = await morceauTest(page);
      await page.getByTestId('vue-instruments').click();
      await page.getByTestId('pistes-chanter').click();
      await expect(page.getByTestId('panneau-chanter')).toBeVisible();
      await expect(page.getByTestId('chanter-latence')).toContainText('ms');
      await page.getByTestId('chanter-direct').click();
      await expect(page.getByTestId('chanter-contenu')).toHaveAttribute('data-direct', 'oui');
      // La roue allume des notes de la mélodie (la, do, mi, ré).
      const vues = new Set<string>();
      for (let i = 0; i < 60 && vues.size < 3; i++) {
        const n = await page.getByTestId('roue-notes').getAttribute('data-note');
        if (n) vues.add(n);
        await page.waitForTimeout(100);
      }
      expect([...vues].every((n) => ['57', '60', '62', '64'].includes(n))).toBe(true);
      expect(vues.size).toBeGreaterThanOrEqual(3);
      await page.screenshot({ path: join(CAPTURES, 'dubler-chanter-360.png') });

      await page.getByTestId('chanter-onglet-enregistrer').click();
      await page.getByTestId(`dubler-section-${section}`).click();
      await page.getByTestId('dubler-enregistrer').click();
      await expect(page.getByTestId('dubler-phase')).toHaveAttribute('data-phase', 'enregistre', {
        timeout: 10_000,
      });
      await page.screenshot({ path: join(CAPTURES, 'dubler-chanter-enregistrer-360.png') });
      await page.waitForTimeout(8 * 1000 + 500); // deux tours de la section
      await page.getByTestId('dubler-poser').click();
      await page.getByTestId('chanter-direct').click();

      await expect
        .poll(
          async () => {
            const m = (await morceauxIdb(page)).find((x) => x.id === id)!.m as unknown as {
              sections: { id: string; motifs: Record<string, string> }[];
              motifs: Record<string, { notes?: { pas: number; midi: number }[] }>;
            };
            const idMotif = m.sections.find((s) => s.id === section)!.motifs['melodie']!;
            return m.motifs[idMotif]?.notes ?? [];
          },
          { timeout: 10_000 },
        )
        .not.toHaveLength(0);
      const m = (await morceauxIdb(page)).find((x) => x.id === id)!.m as unknown as {
        sections: { id: string; motifs: Record<string, string> }[];
        motifs: Record<string, { pas: number; notes: { pas: number; midi: number }[] }>;
      };
      const motif = m.motifs[m.sections.find((s) => s.id === section)!.motifs['melodie']!]!;
      console.info(`[dubler] notes retrouvées : ${JSON.stringify(motif.notes.map((n) => [n.pas, n.midi]))}`);
      expect(motif.pas).toBe(32);
      const n = retrouvees(
        MELODIE.map(([pas, , midi]) => ({ pas, midi })),
        motif.notes,
        32,
      );
      expect(n).toBe(MELODIE.length);
      expect(motif.notes.length).toBeLessThanOrEqual(MELODIE.length + 2);
    });
  });
});

test.describe('Beatbox', () => {
  test('entraînement (affiché), beat à la bouche posé dans la batterie', async ({ baseURL }) => {
    await avecFauxMicro(fichierBeat, baseURL, async (page) => {
      const { id, section } = await morceauTest(page);
      await page.getByTestId('beatbox').click();
      await expect(page.getByTestId('beatbox-entrainement')).toBeVisible();
      await page.screenshot({ path: join(CAPTURES, 'dubler-beatbox-entrainement-360.png') });
      // L'entraînement (5 exemples de chaque son, mêmes sons de synthèse) est écrit dans la base ocka-dubler.
      const exemples = { boum: [], ka: [], ts: [], perso: [] } as Record<SonBeatbox, number[][]>;
      for (const s of ['boum', 'ka', 'ts'] as const) {
        for (let g = 1; g <= EXEMPLES_PAR_SON; g++) {
          const pcm = sonBeatbox(s, g, FS);
          exemples[s].push(mesuresAttaque(pcm, FS, detecterAttaques(pcm, FS)[0] ?? 480));
        }
      }
      const e = {
        version: 1,
        exemples,
        instruments: { boum: 'kick', ka: 'snare', ts: 'charley', perso: 'clap' },
      };
      await page.evaluate(
        (v) =>
          new Promise<void>((ok, ko) => {
            const q = indexedDB.open('ocka-dubler');
            q.onupgradeneeded = () => q.result.createObjectStore('ocka');
            q.onerror = () => ko(q.error);
            q.onsuccess = () => {
              const tx = q.result.transaction('ocka', 'readwrite');
              tx.objectStore('ocka').put(v, 'entrainement-beatbox');
              tx.oncomplete = () => (q.result.close(), ok());
            };
          }),
        e,
      );
      await page.goBack();
      await page.getByTestId('beatbox').click();
      await expect(page.getByTestId('beatbox-contenu')).toHaveAttribute('data-pret', 'oui');
      await page.getByTestId('beatbox-onglet-enregistrer').click();
      await page.getByTestId('beatbox-jouer').click();
      await expect(page.getByTestId('beatbox-jouer')).toHaveAttribute('aria-pressed', 'true');
      await page.getByTestId(`dubler-section-${section}`).click();
      await page.getByTestId('dubler-enregistrer').click();
      await expect(page.getByTestId('dubler-phase')).toHaveAttribute('data-phase', 'enregistre', {
        timeout: 10_000,
      });
      await page.screenshot({ path: join(CAPTURES, 'dubler-beatbox-360.png') });
      await page.waitForTimeout(8 * 1000 + 500);
      await page.getByTestId('dubler-poser').click();
      await page.getByTestId('beatbox-jouer').click();
      type M = {
        sections: { id: string; motifs: Record<string, string> }[];
        motifs: Record<string, { pas: number; pistes: Record<string, number[]> }>;
      };
      const lire = async () => {
        const m = (await morceauxIdb(page)).find((x) => x.id === id)!.m as unknown as M;
        return m.motifs[m.sections.find((s) => s.id === section)!.motifs['batterie']!]!;
      };
      const avant = await lire();
      await expect
        .poll(async () => JSON.stringify(await lire()), { timeout: 10_000 })
        .not.toBe(JSON.stringify(avant));
      const motif = await lire();
      const frappes: { pas: number; midi: number }[] = [];
      for (const [inst, midi] of [
        ['kick', NOTES_BATTERIE.kick],
        ['snare', NOTES_BATTERIE.snare],
        ['charley', NOTES_BATTERIE.charley],
      ] as const) {
        (motif.pistes[inst] ?? []).forEach((v, pas) => v > 0 && frappes.push({ pas, midi }));
      }
      console.info(`[dubler] frappes posées (${motif.pas} pas) : ${JSON.stringify(frappes)}`);
      const attendues = BEAT.map(([son, pas]) => ({
        pas: pas % motif.pas,
        midi: NOTES_BATTERIE[son === 'boum' ? 'kick' : son === 'ka' ? 'snare' : 'charley'],
      }));
      const uniques = attendues.filter(
        (a, i) => attendues.findIndex((b) => b.pas === a.pas && b.midi === a.midi) === i,
      );
      const n = retrouvees(uniques, frappes, motif.pas);
      console.info(`[dubler] beatbox : ${n}/${uniques.length} frappes retrouvées à ±1 pas`);
      expect(n / uniques.length).toBeGreaterThanOrEqual(0.85);
    });
  });
});
