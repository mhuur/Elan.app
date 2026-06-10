// Génère les icônes PNG de la PWA à partir de public/icon.svg
// Usage : node scripts/make-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url))

const targets = [
  { file: 'public/pwa-192.png', size: 192 },
  { file: 'public/pwa-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
]

for (const t of targets) {
  await sharp(svg).resize(t.size, t.size).png().toFile(t.file)
  console.log('OK', t.file)
}
