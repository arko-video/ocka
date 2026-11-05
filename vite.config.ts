// Configuration de Vite (serveur de dev, build) et de Vitest (tests).
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/ocka/',
  plugins: [
    // Prefresh (HMR) ne doit pas toucher aux modules des AudioWorklets : le code qu'il injecte (import.meta.hot,
    // $RefreshReg$…) n'existe pas dans un AudioWorkletGlobalScope, et le processeur ne s'enregistre jamais en dev.
    // crete.ts est importé par le worklet du master (master-flux.ts) : exclu aussi.
    preact({ exclude: [/node_modules/, /\/src\/moteur\/audio\//, /\.worklet\.ts(\?|$)/, /\/src\/moteur\/crete\.ts$/] }),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'OCKA',
        short_name: 'OCKA',
        description: 'Fais tes beats, pose ta voix, sors tes morceaux sur Spotify. Gratuit et open source.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0E0B14',
        background_color: '#0E0B14',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icones/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,woff2,png,svg}'], maximumFileSizeToCacheInBytes: 6 * 1024 * 1024 },
    }),
  ],
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
