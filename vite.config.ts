import { notices } from './scripts/notices'
import { csp } from './scripts/csp'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/',
  plugins: [
    csp(),
    notices(),
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Cult of the Lamb Save Editor', short_name: 'CotL Saves', description: 'Edit Cult of the Lamb saves in your browser. Nothing is uploaded.',
        theme_color: '#0D0E10', background_color: '#0D0E10', display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        sourcemap: true,
        navigateFallbackDenylist: [/^\/third-party-licenses\.txt$/],
        globPatterns: ['**/*.{js,css,html,svg,woff2,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // game data and pictures: shown from cache at once, refreshed in the background
        runtimeCaching: [{ urlPattern: /^https:\/\/api\.cotl\.info\/v1\//, handler: 'StaleWhileRevalidate',
          options: { cacheName: 'cotl-api', expiration: { maxEntries: 2000 }, cacheableResponse: { statuses: [0, 200] } } }],
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'] },
})
