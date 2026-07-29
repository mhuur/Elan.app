// Vérif ciblée : le bouton « Synchroniser depuis Strava » importe les courses du Worker et
// les rend disponibles dans le sélecteur de validation. Le Worker est mocké via page.route
// (aucun appel réseau réel). Prérequis : serveur en mode test (`vite --mode test`).
// Usage : BASE_URL=http://localhost:5190 node scripts/check-strava-sync.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5190'
const DIR = 'screenshots'
mkdirSync(DIR, { recursive: true })

// Horloge figée au dim. 14/06/2026 (jour de la « Sortie longue 8 km » de reprise) → la carte du
// plan est visible sans dépendre de la date réelle, et la course mockée tombe dans la fenêtre < 1 sem.
const today = '2026-06-14'
const MOCK = {
  activities: [
    { externalId: 'strava-111', date: today, name: 'Sortie test Strava', distanceKm: 7.7, durationSec: 2700, paceSec: 350, avgHr: 150, source: 'strava' },
  ],
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

// Intercepte le Worker Strava (GET + préflight OPTIONS) avec en-têtes CORS
await page.route('**strava-elan.test.workers.dev**', async (route) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(MOCK) })
})

try {
  await page.clock.setFixedTime(new Date('2026-06-14T12:00:00'))
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Ouvrir une séance de course du plan due ce jour-là (sinon naviguer en arrière)
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
  await page.waitForSelector('text=Synchroniser depuis Strava')
  await page.click('text=Synchroniser depuis Strava')

  // La course mockée doit apparaître dans la liste du sélecteur
  await page.locator('[role="dialog"] button:has-text("7.7 km")').first().waitFor({ timeout: 6000 })
  await page.screenshot({ path: `${DIR}/strava-sync-picker.png` })

  // Fermer le volet (clic sur le fond, en haut hors du panneau) puis ouvrir les Réglages
  await page.locator('div.bg-ink\\/35').first().click({ position: { x: 10, y: 10 } })
  await page.waitForSelector('[role="dialog"]', { state: 'detached' }).catch(() => {})
  await page.click('[aria-label="Réglages"]')
  await page.waitForSelector('text=Courses Strava')
  await page.click('text=Synchroniser mes courses')
  await page.waitForSelector('text=/Déjà à jour|course/', { timeout: 6000 })
  await page.screenshot({ path: `${DIR}/strava-sync-settings.png` })

  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  } else {
    console.log('OK — le bouton Synchroniser importe les courses Strava (mock) dans le sélecteur et les Réglages.')
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/strava-sync-echec.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
