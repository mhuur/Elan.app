import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
// Charte « bord de mer » : titres condensés + métadonnées interlettrées. On ne prend
// que les sous-ensembles `latin` et les 2 graisses réellement employées de chaque
// famille — les capitales accentuées (É, È, À) sont dans `latin`.
// ⚠ SANS l'extension `.css` : le champ `exports` de ces paquets mappe `./*` vers
// `./*.css`, donc l'écrire donnerait `latin-700.css.css` et le build échoue.
import '@fontsource/big-shoulders-display/latin-700'
import '@fontsource/big-shoulders-display/latin-900'
import '@fontsource/space-mono/latin-400'
import '@fontsource/space-mono/latin-700'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
