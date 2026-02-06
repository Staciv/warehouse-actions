import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon-192.svg', 'icons/icon-512.svg'],
        manifest: {
          name: 'Идеи и Напоминания',
          short_name: 'Идеи',
          description: 'Локальный офлайн блокнот идей и быстрый экспорт напоминаний в календарь.',
          theme_color: '#0d1117',
          background_color: '#090c11',
          display: 'standalone',
          start_url: '.',
          icons: [
            {
              src: 'icons/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'icons/icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webp,ico}'],
          navigateFallback: 'index.html'
        }
      })
    ]
  };
});
