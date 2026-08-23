// Vérifie le plan vélo d'appartement (segment « Vélo » de l'onglet 21K) : vue semaine,
// aperçu hebdo, cartes de séance, fiche + validation manuelle, et la surcharge des cibles
// vélo dans CompleteSheet les jours du plan (la durée/résistance de la semaine remplace
// les cibles fixes de la fiche). Prérequis : `npm run dev:demo` lancé.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const DIR = 'screenshots'
mkdirSync(DIR, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

try {
  // Date figée : samedi 29/08/2026 = 2e séance de la semaine 1 du plan vélo (50 min · R10)
  await page.clock.setFixedTime(new Date('2026-08-29T12:00:00'))
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // --- Segment « Vélo » de l'onglet Plan
  await page.getByRole('link', { name: '21K', exact: true }).click()
  await page.waitForSelector('text=Tout Rennes Court') // vue 21K par défaut (les checks existants la couvrent)
  await page.click('button:has-text("Vélo")')
  await page.waitForSelector('text=Plan vélo · endurance de base')
  await page.waitForSelector('text=Cette semaine')
  await page.waitForSelector('text=Adaptation')
  await page.waitForSelector('text=Endurance 45 min') // séance du lundi 24 (passée)
  await page.waitForSelector('text=Endurance 50 min') // séance du jour (samedi 29)
  await page.waitForSelector('text=Séance 2/2') // la séance du jour (samedi) est bien la 2e de la semaine
  await page.screenshot({ path: `${DIR}/60-plan-velo.png` })

  // --- Fiche d'une séance : détail + validation manuelle → « Terminées »
  await page.click('text=Endurance 50 min')
  await page.waitForSelector('[role="dialog"] >> text=FC guide')
  await page.waitForSelector('[role="dialog"] >> text=130–145')
  await page.click('[role="dialog"] >> text=Valider ma séance')
  await page.waitForSelector('text=Quel jour as-tu fait cette séance')
  await page.locator('[role="dialog"] input[type="number"]').nth(0).fill('138') // FC moyenne (optionnelle)
  await page.locator('[role="dialog"] input[type="number"]').nth(1).fill('805') // Calories (optionnelles)
  await page.click('[role="dialog"] >> text=Valider ✓')
  await page.waitForSelector('[role="dialog"]', { state: 'detached' })
  await page.waitForSelector('h2:has-text("Terminées")')
  await page.waitForSelector('section:has(h2:has-text("Terminées")) >> text=Endurance 50 min')
  // La FC et les calories saisies sont bien journalisées avec la séance du plan
  const vals = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('elan-data-v1'))
    const log = d.logs.find((l) => l.planRef === 'elan-velo-2026-08-29')
    const get = (k) => log?.metrics?.find((m) => m.key === k)?.value
    return { bpm: get('bpm'), calories: get('calories') }
  })
  if (vals.bpm !== 138) throw new Error(`FC moyenne attendue 138, journalisée : ${vals.bpm}`)
  if (vals.calories !== 805) throw new Error(`Calories attendues 805, journalisées : ${vals.calories}`)
  await page.screenshot({ path: `${DIR}/61-plan-velo-validee.png` })

  // --- Navigation : semaine du semi (S6) allégée, puis reprise de la progression (S9)
  for (let i = 0; i < 5; i++) await page.click('[aria-label="Semaine suivante"]')
  await page.waitForSelector('text=Semaine du semi')
  await page.waitForSelector('text=Endurance 30 min')
  for (let i = 0; i < 3; i++) await page.click('[aria-label="Semaine suivante"]')
  await page.waitForSelector('text=Endurance 60 min')

  // --- CompleteSheet : un jour du plan, la fiche vélo affiche les cibles DU PLAN
  // (50 min ce samedi, au lieu des cibles fixes de la séance)
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.click('text=Séance libre')
  await page.waitForSelector('text=Choisir une séance')
  await page.click('text=appartement')
  await page.waitForSelector('[role="dialog"] >> text=Durée 50 min')
  await page.screenshot({ path: `${DIR}/62-plan-velo-completesheet.png` })

  console.log('PLAN VÉLO OK — segment Vélo, semaines, validation, cibles surchargées dans la fiche')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-plan-velo.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
