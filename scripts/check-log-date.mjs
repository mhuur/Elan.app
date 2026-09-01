// Vérifie l'édition de la date de validation pour les autres disciplines : valider une séance
// aujourd'hui, ouvrir sa fiche (LogSheet), changer la date → la séance migre à la nouvelle date.
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
  // Date figée (samedi 13/06/2026, dans la S1 de reprise) → test déterministe : on valide la
  // séance du samedi « aujourd'hui » quelle que soit la date d'exécution réelle.
  await page.clock.setFixedTime(new Date('2026-06-13T12:00:00'))
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Depuis sept. 2026, une séance non planifiée n'apparaît pas dans la grille du
  // Planning : on planifie « Sortie courte » le samedi pour pouvoir taper son rond.
  await page.evaluate(() => {
    const raw = localStorage.getItem('elan-data-v1')
    if (!raw) return
    const data = JSON.parse(raw)
    const s = data.sessions.find((x) => x.name === 'Sortie courte')
    if (s) s.days = [5]
    localStorage.setItem('elan-data-v1', JSON.stringify(data))
  })
  await page.reload()
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Valider « Sortie courte » aujourd'hui (samedi 13) via le rond du Planning
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await page.waitForSelector('text=Cette semaine')
  await page.click('[aria-label="Sortie courte — Samedi"]')

  // Aller dans Aujourd'hui → fiche de la séance terminée
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.waitForSelector('h2:has-text("Terminées")')
  await page.click('section:has(h2:has-text("Terminées")) button:has-text("Sortie courte")')
  await page.waitForSelector('[role="dialog"] input[aria-label="Date de la séance"]')
  const before = await page.inputValue('[role="dialog"] input[aria-label="Date de la séance"]')
  if (before !== '2026-06-13') throw new Error('Date initiale inattendue : ' + before)
  await page.screenshot({ path: `${DIR}/53-logsheet-date.png` })

  // Changer la date au 12 juin et enregistrer
  await page.fill('[role="dialog"] input[aria-label="Date de la séance"]', '2026-06-12')
  await page.click('[role="dialog"] >> text=Enregistrer')
  await page.waitForSelector('[role="dialog"]', { state: 'detached' })

  // La séance a migré : plus de section « Terminées » le 13, mais bien présente le 12
  await page.click('[aria-label="Jour précédent"]')
  await page.waitForSelector('h2:has-text("Terminées")')
  await page.click('section:has(h2:has-text("Terminées")) button:has-text("Sortie courte")')
  await page.waitForSelector('[role="dialog"] input[aria-label="Date de la séance"]')
  const after = await page.inputValue('[role="dialog"] input[aria-label="Date de la séance"]')
  if (after !== '2026-06-12') throw new Error('Date non persistée : ' + after)

  console.log('LOG-DATE OK — date de validation éditable (Sortie courte déplacée du 13 au 12 juin)')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-log-date.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
