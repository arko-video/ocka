// Build du banc moteur : l'appli + la page du banc, avec la même config que l'appli (base /ocka/, CSP, workers).
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  root: new URL('../..', import.meta.url).pathname,
  base: '/ocka/',
  plugins: [preact()],
  worker: { format: 'es' },
  build: {
    outDir: 'dist-banc',
    emptyOutDir: true,
    rollupOptions: { input: { appli: 'index.html', banc: 'tests/banc-moteur/index.html' } },
  },
});
