// Vérif ciblée : à la validation d'une séance du plan, seules les courses de MOINS d'une
// semaine sont proposées dans le sélecteur. On injecte deux courses (une du jour, une de
// 12 jours avant) dans le localStorage, puis on ouvre le sélecteur depuis Aujourd'hui.
// Prérequis : `npm run dev:demo`, puis BASE_URL=http://localhost:5182 node scripts/check-validate-recent.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const DIR = 'screenshots'
mkdirSync(DIR, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

// Dates relatives à AUJOURD'HUI (horloge système) : une course du jour, une de 12 jours avant
const fmt = (d) => d.toISOString().slice(0, 10)
const today = new Date()
const old = new Date(today)
old.setDate(old.getDate() - 12)
const recentDate = fmt(today)
const oldDate = fmt(old)

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Injecter deux courses distinctes (distances non substrings l'une de l'autre)
  await page.evaluate(
    ({ recentDate, oldDate }) => {
      const KEY = 'elan-data-v1'
      const data = JSON.parse(localStorage.getItem(KEY) || '{}')
      data.activities = [
        { id: 'act-recent', date: recentDate, name: 'Sortie récente', distanceKm: 8.3, durationSec: 2920, paceSec: 352 },
        { id: 'act-old', date: oldDate, name: 'Vieille sortie', distanceKm: 5.7, durationSec: 2050, paceSec: 360 },
      ]
      localStorage.setItem(KEY, JSON.stringify(data))
    },
    { recentDate, oldDate },
  )
  await page.reload()
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Ouvrir une séance de course du plan due ce jour-là (sinon naviguer vers une date qui en a)
  const target = 'Sortie longue 8 km'
  let found = await page.locator(`button:has-text("${target}")`).first().isVisible().catch(() => false)
  for (let i = 0; i < 14 && !found; i++) {
    await page.click('[aria-label="Jour précédent"]')
    await page.waitForTimeout(120)
    found = await page.locator(`button:has-text("${target}")`).first().isVisible().catch(() => false)
  }
  if (!found) throw new Error(`Carte « ${target} » introuvable`)

  await page.click(`button:has-text("${target}")`)
  await page.click('[role="dialog"] >> text=Valider ma séance')
  await page.waitForSelector('text=Quelle sortie COROS correspond')

  const dialog = page.locator('[role="dialog"]')
  await dialog.locator('button:has-text("8.3 km")').first().waitFor({ timeout: 4000 })
  const oldCount = await dialog.locator('button:has-text("5.7 km")').count()
  await page.screenshot({ path: `${DIR}/validate-recent-only.png` })
  if (oldCount > 0) throw new Error(`La course de plus d'une semaine (${oldDate}) ne devrait pas être proposée`)

  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  } else {
    console.log('OK — seules les courses de moins d\'une semaine sont proposées à la validation.')
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/validate-recent-echec.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
