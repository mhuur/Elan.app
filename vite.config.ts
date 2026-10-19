import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Enregistrement fait par src/lib/registerSW.ts (recharge la page à chaque nouvelle version)
      injectRegister: false,
      // Service worker écrit à la main (src/sw.ts) : le pré-cache généré ne suffisait plus,
      // il lui faut un gestionnaire `push` pour les rappels de séance.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // Le bundle (Firebase + Recharts) dépasse la limite par défaut de 2 Mio par fichier.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: '21KM — entraînement',
        short_name: '21KM',
        description: 'Planifiez vos séances, enregistrez vos performances, suivez vos progrès.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        // Charte « bord de mer » : ardoise en barre système, abysse au démarrage.
        theme_color: '#F4F5F7',
        background_color: '#F4F5F7',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Motif réduit à 70 % : survit au rognage des icônes adaptatives Android.
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
