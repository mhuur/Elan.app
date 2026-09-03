// Vérifie la planification par intervalle + alternance multiple bidirectionnelle (mode démo)
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

  // Passer « Vélo d'appartement » en intervalle (tous les 2 jours) + alternance avec HIIT
  await page.getByRole('link', { name: 'Exercices', exact: true }).click()
  await page.waitForSelector('text=Mes programmes')
  await page.click('text=appartement')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.waitForSelector('text=Planification')
  await page.getByRole('button', { name: 'Tous les X jours', exact: true }).click()
  await page.waitForSelector('text=à partir du')
  // Le HIIT sur un nouveau jour de la rotation (jour 2) : « + jour » ouvre le sélecteur
  await page.getByRole('button', { name: 'jour', exact: true }).click()
  await page.locator('select:has-text("Choisir une séance")').selectOption({ label: 'HIIT — Cardio express' })
  await page.waitForSelector('button:has-text("HIIT — Cardio express")') // chip ajoutée au jour 2
  await page.click('text=Enregistrer')

  // La carte de la séance décrit l'alternance
  await page.waitForSelector('text=en alternance avec HIIT')

  // Bidirectionnel : la fiche du HIIT montre la même planification (chip Vélo)
  await page.click('p:has-text("HIIT — Cardio express")') // titre de la carte HIIT (pas le badge du vélo)
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.waitForSelector('text=Planification')
  await page.waitForSelector('button:has-text("Vélo d’appartement")')
  await page.screenshot({ path: 'screenshots/20-alternance-bidirectionnelle.png' })
  await page.click('[aria-label="Retour"]')

  // Le planning montre un anneau sur la colonne du jour (occurrence 0 = vélo)
  await page.click('text=Planning')
  await page.waitForSelector(`[aria-label="Vélo d’appartement — ${todayName}"][aria-pressed="true"]`)
  await page.waitForSelector('text=↻ Tous les 2 jours')
  await page.screenshot({ path: 'screenshots/14-planning-intervalle.png' })

  // Et la séance apparaît dans Aujourd'hui
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.waitForSelector('text=appartement')
  console.log("INTERVALLE OK — alternance multiple bidirectionnelle, planning et Aujourd'hui")

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
