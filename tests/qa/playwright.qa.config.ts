// Config Playwright de la relecture QA indépendante (tests/qa/*.qa.ts).
// Lancer depuis app/ : npx playwright test -c tests/qa/playwright.qa.config.ts
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const ICI = dirname(fileURLToPath(import.meta.url));
const APP = join(ICI, '..', '..');
export const PORT = 4194;

// Faux micro : un clic de 10 ms (1 kHz) toutes les 0,5 s, 8 s pile (la boucle de Chrome garde le rythme).
export const CLICS = join(ICI, 'sorties', 'clics-qa.wav');
if (!existsSync(CLICS)) {
  mkdirSync(dirname(CLICS), { recursive: true });
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', "aevalsrc='0.7*lt(mod(t,0.5),0.01)*sin(2*PI*1000*t)':s=48000:d=8",
    '-ac', '1', '-c:a', 'pcm_s16le', CLICS,
  ]);
}

export default defineConfig({
  testDir: ICI,
  testMatch: /.*\.qa\.ts$/,
  outputDir: join(ICI, 'sorties', 'resultats'),
  timeout: 420_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/ocka/`,
    channel: 'chrome',
    headless: true,
    viewport: { width: 360, height: 740 },
    hasTouch: false,
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-audio-capture=${CLICS}`,
      ],
    },
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    cwd: APP,
    url: `http://localhost:${PORT}/ocka/`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
