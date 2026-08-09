// Génère la photo de fond « bord de mer » (src/assets/bord-de-mer.webp) depuis le
// master JPEG livré avec la charte, qui vit HORS de l'app (racine du dossier SPORT,
// comme Plan-Semi-Rennes-2026.md). Idempotent : relancer écrase la sortie.
//
//   node scripts/make-photo.mjs [--quality 58] [--width 780]
//
// Pourquoi un recadrage : la photo est affichée en `cover` sur un cadre de ratio
// ~390/844, et le master est nettement plus large que ce qui reste visible. On
// recadre donc à 1000 px de large centrés sur 64 % du dépassement (le
// `background-position: 64% 30%` de la maquette) pour ne pas embarquer des pixels
// jamais peints. Le scrim couvre l'image jusqu'à 88 % d'opacité en bas, d'où une
// qualité volontairement basse : l'artefact ne se voit pas, et la PWA précache le
// fichier.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(here, '../../decoration-murale-finistere-le-phare-dar-men-bretagne.jpg')
const OUT = resolve(here, '../src/assets/bord-de-mer.webp')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : Number(process.argv[i + 1])
}
const quality = arg('quality', 58)
const width = arg('width', 780)

const { width: srcW, height: srcH } = await sharp(SRC).metadata()
const cropW = Math.min(srcW, 1000)
const info = await sharp(SRC)
  .extract({ left: Math.round(0.64 * (srcW - cropW)), top: 0, width: cropW, height: srcH })
  .resize({ width })
  .webp({ quality, effort: 6 })
  .toFile(OUT)

console.log(`bord-de-mer.webp — ${info.width}×${info.height}, ${Math.round(info.size / 1024)} ko (q${quality})`)
