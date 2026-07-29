// Régénère les icônes PNG de la PWA à partir de la marque « ogive » (charte bord de mer).
// Usage : node scripts/make-icons.mjs
//
// Les PNG livrés avec la charte sont déjà dans public/icons/ : ce script ne sert qu'à les
// refaire si la géométrie de l'ogive change. Il compose lui-même le SVG source pour garder
// les deux variantes exactes :
//   - « any »      : ogive à pleine taille sur pastille ardoise unie ;
//   - « maskable » : même pastille, motif réduit à 70 % pour survivre au rognage Android.
// La pastille est UNIE, jamais transparente : sur l'écran d'accueil iOS l'alpha est écrasé
// en noir, une icône transparente y apparaîtrait sur un carré noir sale.
import sharp from 'sharp'

const ARDOISE = '#071A26' // fond de pastille (= theme_color)
const OGIVE = 'M256 88 C 344 194, 344 318, 256 424 C 168 318, 168 194, 256 88 Z'

/** SVG de la pastille. `scale` = taille du motif (1 = pleine, 0.7 = maskable). `shadow` = ombre douce. */
const plate = (scale = 1, shadow = true) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="o" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#DCEEF8"/>
    </linearGradient>
    ${shadow ? '<filter id="s" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="18" stdDeviation="17" flood-color="#020A10" flood-opacity="0.55"/></filter>' : ''}
  </defs>
  <rect width="512" height="512" fill="${ARDOISE}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)"${shadow ? ' filter="url(#s)"' : ''}>
    <path d="${OGIVE}" fill="url(#o)"/>
  </g>
</svg>`

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, svg: plate() },
  { file: 'public/icons/icon-512.png', size: 512, svg: plate() },
  { file: 'public/icons/icon-512-maskable.png', size: 512, svg: plate(0.7) },
  { file: 'public/icons/apple-touch-icon-180.png', size: 180, svg: plate() },
  // Favicons : aplat sans ombre, l'ombre se salit en dessous de 64 px
  { file: 'public/icons/favicon-48.png', size: 48, svg: plate(1, false) },
  { file: 'public/icons/favicon-32.png', size: 32, svg: plate(1, false) },
]

for (const t of targets) {
  await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toFile(t.file)
  console.log('OK', t.file)
}
