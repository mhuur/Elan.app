// Vérifie la page Plan (plan semi 16 semaines) : allures repères, phases, semaines
// dépliables, séance cochée via un log running du jour.
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

  // --- Onglet Plan : en-tête, compte à rebours, allures, phases
  await page.getByRole('link', { name: 'Plan', exact: true }).click()
  await page.waitForSelector('text=Tout Rennes Court')
  await page.waitForSelector('text=Allures repères')
  await page.waitForSelector('text=Allure semi')
  await page.waitForSelector('text=Base · 4 semaines')
  await page.waitForSelector('text=Affûtage · 2 semaines')
  await page.screenshot({ path: `${DIR}/40-plan.png` })

  // --- Déplier la semaine de course : le semi est bien là
  await page.click('text=semaine de course')
  await page.waitForSelector('text=Semi-marathon — 21,1 km')
  await page.screenshot({ path: `${DIR}/41-plan-course.png` })

  // --- Une seule semaine ouverte à la fois (accordéon)
  await page.click('text=pic de volume')
  await page.waitForSelector('text=6 km continu allure semi')
  const stillOpen = await page.locator('text=Semi-marathon — 21,1 km').count()
  if (stillOpen) throw new Error('accordéon : la semaine de course est restée ouverte')

  // --- Volume hebdo affiché sur les semaines repliées
  await page.waitForSelector('text=31 km')

  console.log('PLAN OK — allures, phases, accordéon des semaines, séance de course affichée')
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
