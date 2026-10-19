// Régénère les icônes PNG de la PWA à partir du logo 21KM (charte 21KM, oct. 2026).
// Usage : node scripts/make-icons.mjs
//
// Logo : anneau Volt aux trois quarts autour de « 21 », sur carré encre (planche Main du
// canevas, docs/maquettes/21km/). Variantes :
//   - « any »      : logo à pleine taille, fond encre plein cadre ;
//   - « maskable » : motif réduit à 70 % pour survivre au rognage des icônes Android.
// Le fond est UNI, jamais transparent : sur l'écran d'accueil iOS l'alpha est écrasé en noir.
// « 21 » est du texte SVG : sharp le rend avec la police système disponible (Archivo si
// elle est installée, Arial sinon) — non vérifié sur une autre machine que celle d'origine.
import sharp from 'sharp'

const ENCRE = '#0E1116'
const logo = (scale = 1) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="512" height="512">
  <rect width="36" height="36" fill="${ENCRE}"/>
  <g transform="translate(18 18) scale(${scale}) translate(-18 -18)">
    <circle cx="18" cy="18" r="11" fill="none" stroke="#C5F23A" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="52 69.1" transform="rotate(-90 18 18)"/>
    <text x="18" y="22" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-size="11" font-weight="800" fill="#FFFFFF">21</text>
  </g>
</svg>`

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, svg: logo() },
  { file: 'public/icons/icon-512.png', size: 512, svg: logo() },
  { file: 'public/icons/icon-512-maskable.png', size: 512, svg: logo(0.7) },
  { file: 'public/icons/apple-touch-icon-180.png', size: 180, svg: logo() },
  { file: 'public/icons/favicon-48.png', size: 48, svg: logo() },
  { file: 'public/icons/favicon-32.png', size: 32, svg: logo() },
]

for (const t of targets) {
  await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toFile(t.file)
  console.log('OK', t.file)
}
