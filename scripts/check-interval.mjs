// Vérifie la planification par intervalle + alternance dans l'UI réelle (mode démo)
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const todayName = DAY_NAMES[(new Date().getDay() + 6) % 7]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})
page.on('dialog', (d) => d.accept())

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Passer « Vélo d'appartement » en intervalle (tous les 2 jours, départ aujourd'hui)
  await page.click('text=Exercices')
  await page.waitForSelector('text=Bibliothèque')
  await page.click('text=appartement')
  await page.waitForSelector('text=Planification')
  await page.getByRole('button', { name: 'Tous les X jours', exact: true }).click()
  await page.waitForSelector('text=À partir du')
  // Alternance avec le HIIT
  await page.selectOption('select', { label: '🔥 HIIT — Cardio express' })
  await page.click('text=Enregistrer')

  // La carte de la séance doit décrire la planification
  await page.waitForSelector('text=Tous les 2 jours, alterné avec HIIT')

  // Le planning doit montrer un anneau sur la colonne du jour (occurrence 0 = vélo)
  await page.click('text=Planning')
  await page.waitForSelector(`[aria-label="Vélo d’appartement — ${todayName}"][aria-pressed="true"]`)
  await page.waitForSelector('text=↻ Tous les 2 jours')
  await page.screenshot({ path: 'screenshots/14-planning-intervalle.png' })

  // Et la séance doit apparaître dans Aujourd'hui
  await page.click("text=Aujourd'hui")
  await page.waitForSelector('text=appartement')
  console.log('INTERVALLE OK — occurrence du jour visible dans Planning et Aujourd\'hui')

  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: 'screenshots/99-echec-intervalle.png' })
  console.error('ÉCHEC :', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
