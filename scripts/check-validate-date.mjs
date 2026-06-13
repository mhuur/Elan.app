// Vérifie la confirmation/édition de date à la validation d'une séance du plan :
// valider la séance du mercredi « sur » un autre jour (lundi) → la séance s'affiche validée
// ce lundi-là, et le Planning montre le rond « fait » déplacé au bon jour.
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
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Aller sur la semaine du 15 juin (le plan a démarré cette semaine-ci avec la S1 de reprise,
  // la semaine des footings est donc la suivante)
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await page.waitForSelector('text=Cette semaine')
  await page.click('[aria-label="Semaine suivante"]')
  await page.waitForSelector('h2:has-text("Running")')
  await page.waitForSelector('text=Footing 5 km')

  // Ouvrir « Footing 5 km » (mercredi 17) et valider SANS sortie, sur le lundi 15
  await page.click('text=Footing 5 km')
  await page.click('[role="dialog"] >> text=Valider ma séance')
  await page.click('text=Valider sans associer de sortie')
  await page.waitForSelector('text=Quel jour as-tu fait cette séance')
  await page.fill('input[aria-label="Date de la séance"]', '2026-06-15')
  await page.click('text=Valider ✓')
  await page.waitForSelector('[role="dialog"]', { state: 'detached' })

  // Rouvrir la séance → elle est « Validée le 15 juin »
  await page.click('text=Footing 5 km')
  await page.waitForSelector('[role="dialog"] >> text=Validée le 15 juin')
  await page.screenshot({ path: `${DIR}/51-validee-autre-jour.png` })
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"]', { state: 'detached' }).catch(() => {})

  // Le Planning montre le rond « fait » déplacé (capture pour inspection)
  await page.screenshot({ path: `${DIR}/52-planning-rond-deplace.png`, fullPage: true })

  console.log('VALIDATE-DATE OK — validation avec confirmation de date (séance du mercredi pointée le lundi)')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-validate-date.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
