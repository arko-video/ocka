// Build du banc (pour vérifier que le worklet est bien chargé APRÈS le build, pas seulement en dev).
import { defineConfig, mergeConfig } from 'vite';
import base from '../../vite.config';

export default mergeConfig(
  base,
  defineConfig({
    build: {
      outDir: 'dist-banc',
      emptyOutDir: true,
      rollupOptions: { input: { banc: decodeURIComponent(new URL('./banc.html', import.meta.url).pathname) } },
    },
  }),
);
