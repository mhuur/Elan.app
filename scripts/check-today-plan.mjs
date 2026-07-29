// Vérif ciblée : une séance de course du plan semi due ce jour-là s'affiche bien dans
// la to-do d'« Aujourd'hui » (avant validation), et taper la carte ouvre la fiche Campus.
// Prérequis : `npm run dev:demo`, puis BASE_URL=http://localhost:5182 node scripts/check-today-plan.mjs
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
  // Date figée (dim. 14/06/2026, jour de la « Sortie longue 8 km » de reprise) → test
  // déterministe : la séance est due ce jour-là quelle que soit la date d'exécution réelle.
  await page.clock.setFixedTime(new Date('2026-06-14T12:00:00'))
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Le plan a une « Sortie longue 8 km » le dim. 14/06. Si on est ce jour-là, la carte
  // doit apparaître en à-faire ; sinon on navigue jusqu'au 14/06 via la flèche « précédent ».
  const target = 'Sortie longue 8 km'
  let found = await page.locator(`button:has-text("${target}")`).first().isVisible().catch(() => false)
  for (let i = 0; i < 14 && !found; i++) {
    await page.click('[aria-label="Jour précédent"]')
    await page.waitForTimeout(120)
    found = await page.locator(`button:has-text("${target}")`).first().isVisible().catch(() => false)
  }
  if (!found) throw new Error(`Carte « ${target} » introuvable dans la to-do d'Aujourd'hui`)
  await page.screenshot({ path: `${DIR}/today-plan-todo.png` })

  // Taper la carte ouvre la fiche Campus avec le bouton de validation
  await page.click(`button:has-text("${target}")`)
  await page.waitForSelector('text=Valider ma séance ✓', { timeout: 5000 })
  await page.screenshot({ path: `${DIR}/today-plan-sheet.png` })

  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  } else {
    console.log('OK — la course du plan apparaît dans Aujourd\'hui et ouvre la fiche Campus.')
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/today-plan-echec.png` })
  console.error('ÉCHEC :', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
