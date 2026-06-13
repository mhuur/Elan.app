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

  // Ouvre la fiche de la séance Vélo depuis le Planning
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await page.waitForSelector('text=Cette semaine')
  await page.click('button:has-text("appartement")')
  await page.waitForSelector('text=Planification')

  // Passe en mode intervalle si besoin, puis cadence « Jours de semaine »
  if ((await page.locator('text=Jours de semaine').count()) === 0) {
    await page.click('text=Tous les X jours')
  }
  await page.click('text=Jours de semaine')

  // Choisit lun / jeu / sam
  await page.click('[title="Lundi"]')
  await page.click('[title="Jeudi"]')
  await page.click('[title="Samedi"]')
  await page.screenshot({ path: `${DIR}/49-form-jours-semaine.png` })

  // Enregistre → retour au Planning, le libellé reflète les jours choisis
  await page.click('text=Enregistrer')
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
