import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Charte 21KM : Archivo seule, sous-ensemble `latin` (lettres accentuées comprises), les
// cinq graisses de la planche Typographie. ⚠ SANS l'extension `.css` : le champ
// `exports` du paquet mappe `./*` vers `./*.css`, l'écrire ferait échouer le build.
import '@fontsource/archivo/latin-400'
import '@fontsource/archivo/latin-500'
import '@fontsource/archivo/latin-600'
import '@fontsource/archivo/latin-700'
import '@fontsource/archivo/latin-800'
import './index.css'
import App from './App'
import { registerSW } from './lib/registerSW'

registerSW()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
