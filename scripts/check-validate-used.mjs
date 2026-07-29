// Vérif ciblée : une course Strava déjà utilisée pour valider une séance ne réapparaît plus
// dans le sélecteur de validation d'une autre séance (une course = une séance). On injecte UNE
// course récente, on valide « Footing 5 km » avec, puis on ouvre « Sortie longue 9 km » : la
// course ne doit plus être proposée. Horloge figée (mer. 17/06/2026, semaine des footings).
// Prérequis : `npm run dev:demo` lancé.
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

try {
  await page.clock.setFixedTime(new Date('2026-06-17T12:00:00'))
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Une seule course récente, du 16/06
  await page.evaluate(() => {
    const KEY = 'elan-data-v1'
    const data = JSON.parse(localStorage.getItem(KEY) || '{}')
    data.activities = [{ id: 'act-x', date: '2026-06-16', name: 'Sortie', distanceKm: 8.3, durationSec: 2920, paceSec: 352 }]
    localStorage.setItem(KEY, JSON.stringify(data))
  })
  await page.reload()
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Onglet 21K (plan semi), semaine des footings (semaine en cours avec l'horloge figée)
  await page.getByRole('link', { name: '21K', exact: true }).click()
  await page.waitForSelector('text=Tout Rennes Court')
  await page.waitForSelector('text=Footing 5 km')

  // Valider « Footing 5 km » AVEC la course act-x
  await page.click('text=Footing 5 km')
  await page.click('[role="dialog"] >> text=Valider ma séance')
  await page.waitForSelector('text=Quelle sortie correspond')
  await page.locator('[role="dialog"] button:has-text("8.3 km")').first().click()
  await page.waitForSelector('text=Quel jour as-tu fait cette séance')
  await page.click('[role="dialog"] >> text=Valider ✓')
  await page.waitForSelector('[role="dialog"]', { state: 'detached' })

  // « Footing 5 km » est passée en Terminées ; ouvrir « Sortie longue 9 km » (encore à faire)
  await page.waitForSelector('h2:has-text("Terminées")')
  await page.click('text=Sortie longue 9 km')
  await page.click('[role="dialog"] >> text=Valider ma séance')
  await page.waitForSelector('text=Quelle sortie correspond')

  // La course act-x a déjà servi → elle ne doit plus être proposée
  const stillThere = await page.locator('[role="dialog"] button:has-text("8.3 km")').count()
  await page.screenshot({ path: `${DIR}/validate-used.png` })
  if (stillThere > 0) throw new Error('Une course déjà utilisée pour valider une séance ne devrait plus être proposée')

  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  } else {
    console.log('OK — une course déjà utilisée ne réapparaît plus dans le sélecteur de validation.')
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/validate-used-echec.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
