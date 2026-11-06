// Banc de l'échantillonneur (M1, C1) : Chrome, serveur de DEV de Vite (la page du banc n'est pas dans le build).
// Lancer depuis app/ : npx playwright test -c tests/banc-echantillonneur/playwright.config.ts
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const ICI = dirname(fileURLToPath(import.meta.url));
export const PORT_BANC_M1 = 5211;

export default defineConfig({
  testDir: ICI,
  testMatch: /.*\.spec\.ts$/,
  outputDir: join(ICI, 'sorties', 'resultats'),
  timeout: 300_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT_BANC_M1}/ocka/`,
    channel: 'chrome',
    headless: true,
    // Marqueur : retrouver les processus de CE Chrome pour mesurer sa mémoire (ps).
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--ocka-banc-m1'] },
  },
  webServer: {
    command: `npx vite --port ${PORT_BANC_M1} --strictPort`,
    cwd: join(ICI, '..', '..'),
    url: `http://localhost:${PORT_BANC_M1}/ocka/tests/banc-echantillonneur/index.html`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
