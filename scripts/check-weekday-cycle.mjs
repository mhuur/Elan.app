// Vérifie le flux UI de l'option « alternance sur jours choisis » : depuis la fiche d'une
// séance cardio, basculer la cadence sur « Jours de semaine », choisir lun/jeu/sam,
// enregistrer, et retrouver « Lun · Jeu · Sam » dans le Planning.
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

  // Ouvre la fiche de la séance Vélo depuis la Bibliothèque (depuis sept. 2026 la
  // grille du Planning masque les séances non planifiées, le vélo du seed en est une)
  await page.getByRole('link', { name: 'Exercices', exact: true }).click()
  await page.waitForSelector('text=Mes programmes')
  await page.click('text=appartement')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.waitForSelector('text=Planification')

  // Jours choisis (défaut) + « En alternance avec » = cycle sur jours de semaine (repeat.onDays)

  // Choisit lun / jeu / sam
  await page.click('[title="Lundi"]')
  await page.click('[title="Jeudi"]')
  await page.click('[title="Samedi"]')
  // En alternance avec le HIIT : sélecteur « Aucune » → pastille avec sa croix
  await page.locator('select[aria-label="En alternance avec"]').selectOption({ label: 'HIIT — Cardio express' })
  await page.waitForSelector("[aria-label=\"Retirer l'alternance\"]")
  // L'aperçu dit quand tombe la prochaine fois
  await page.waitForSelector('text=Prochaine fois')
  await page.screenshot({ path: `${DIR}/49-form-jours-semaine.png` })

  // Enregistre, puis va au Planning : le libellé reflète les jours choisis
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await page.waitForSelector('text=Cette semaine')
  await page.waitForSelector('text=Lun · Jeu · Sam')
  await page.screenshot({ path: `${DIR}/50-planning-jours-semaine.png`, fullPage: true })

  console.log('WEEKDAY-CYCLE OK — cadence « Jours de semaine » enregistrée, « Lun · Jeu · Sam » dans le Planning')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-weekday-cycle.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
