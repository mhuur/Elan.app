// Vérifie la page Plan (semi 17 semaines, S1 = reprise) en vue semaine par semaine : navigation par
// flèches, aperçu hebdo, cartes de séance, et viewer type Campus à l'ouverture d'une séance.
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

  // --- Onglet Plan : en-tête, navigateur de semaines, aperçu hebdo, cartes de séance
  await page.getByRole('link', { name: 'Plan', exact: true }).click()
  await page.waitForSelector('text=Tout Rennes Court')
  await page.waitForSelector('text=Ton aperçu hebdomadaire')
  await page.waitForSelector('text=Cette semaine') // S1 = reprise = la semaine en cours (départ 14 juin)
  await page.waitForSelector('text=1 sur 17')
  await page.waitForSelector('text=Séance 1/1') // S1 = reprise : une seule sortie longue
  await page.waitForSelector('text=Sortie longue 8 km')
  await page.waitForSelector('text=Allure semi')
  await page.screenshot({ path: `${DIR}/40-plan.png` })

  // --- Navigation par flèches jusqu'à la semaine 14 (pic de volume)
  for (let i = 0; i < 13; i++) {
    await page.click('[aria-label="Semaine suivante"]')
  }
  await page.waitForSelector('text=Semaine 14')
  await page.waitForSelector('text=pic de volume')
  await page.waitForSelector('text=VMA 4×1200 m')

  // --- Affichage type Campus : ouvrir la séance VMA → séquences détaillées
  await page.click('text=VMA 4×1200 m')
  await page.waitForSelector('[role="dialog"] >> text=Échauffement')
  await page.waitForSelector('[role="dialog"] >> text=1200 m')
  await page.waitForSelector('[role="dialog"] >> text=4:48')
  await page.waitForSelector('[role="dialog"] >> text=Récupération')
  await page.screenshot({ path: `${DIR}/42-plan-seance.png` })

  // --- Validation manuelle : « Valider ma séance » → sans course → confirmer la date → « Validée »
  await page.click('[role="dialog"] >> text=Valider ma séance')
  await page.waitForSelector('text=Quelle sortie COROS')
  await page.click('text=Valider sans associer de sortie')
  await page.waitForSelector('text=Quel jour as-tu fait cette séance')
  await page.click('[role="dialog"] >> text=Valider ✓')
  await page.waitForSelector('[role="dialog"]', { state: 'detached' })
  await page.waitForSelector('text=Validée')
  await page.screenshot({ path: `${DIR}/43-plan-validee.png` })

  // --- Dernière semaine : le semi est bien là
  for (let i = 0; i < 3; i++) {
    await page.click('[aria-label="Semaine suivante"]')
  }
  await page.waitForSelector('text=Semaine 17')
  await page.waitForSelector('text=Semi-marathon — 21,1 km')
  await page.screenshot({ path: `${DIR}/41-plan-course.png` })

  console.log('PLAN OK — vue semaine par semaine, navigation, aperçu hebdo, cartes, viewer type Campus')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-plan.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
