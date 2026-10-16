import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['clock.svg', 'favicon.svg'],
      manifest: {
        name: 'ZoneClock — Workplace Time Tracking',
        short_name: 'ZoneClock',
        description: 'HubStaff-style workplace time tracking when you are in the zone.',
        theme_color: '#6366f1',
        background_color: '#0f0f13',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/clock.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('react-router')) return 'router';
          if (id.includes('@vis.gl') || id.includes('google-maps')) return 'google-maps';
          if (id.includes('date-fns') || id.includes('lucide') || id.includes('leaflet')) return 'vendor';
        },
      },
    },
  },
})
