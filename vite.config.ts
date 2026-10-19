/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath, URL } from 'node:url';

// `base` is './' so the static build works from any sub-path (GitHub Pages, etc.).
// The app uses hash-based routing, so no server rewrite rules are needed.
export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' = a new service worker waits until the user taps "Reload" in the update toast.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        id: './',
        name: 'VentureXP',
        short_name: 'VentureXP',
        description: 'Bite-sized lessons for entrepreneurship and e-commerce. Works offline.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0F19',
        theme_color: '#0B0F19',
        categories: ['education', 'business'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the hashed app shell + bundled curriculum. Hashed filenames mean each
        // deploy gets new cache entries; old ones are cleaned up automatically.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
    // `ANALYZE=1 npm run build` writes a bundle report to stats.html
    ...(process.env.ANALYZE ? [visualizer({ filename: 'stats.html', gzipSize: true })] : []),
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Stable vendor chunks: a content-only update doesn't re-download the libraries.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return 'react';
          if (/[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/.test(id)) return 'motion';
          if (/[\\/](zod|dexie|dexie-react-hooks)[\\/]/.test(id)) return 'data';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
