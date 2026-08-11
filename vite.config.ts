import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Qwark',
        short_name: 'Qwark',
        description: 'Treenipäiväkirja',
        lang: 'fi',
        start_url: '/',
        display: 'standalone',
        background_color: '#12131a',
        theme_color: '#12131a',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      workbox: {
        // The library must survive a cold launch with no network.
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
    }),
  ],
})
