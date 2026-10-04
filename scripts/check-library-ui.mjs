// Vérifie l'écran « Exercices » (la liste des programmes, refonte sept. 2026) : cartes
// dépliables SUR PLACE — un tap montre les exercices et « Modifier », un seul programme
// déplié à la fois, un second tap replie, « Modifier » ouvre la fiche ; sur desktop la
// liste passe en deux colonnes. Prérequis : `npm run dev:demo` lancé.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
mkdirSync('screenshots', { recursive: true })

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
  await page.getByRole('link', { name: 'Exercices', exact: true }).click()
  await page.waitForSelector('text=Mes programmes')
  await page.waitForSelector('text=+ Programme')

  // Replié au chargement : aucun « Modifier » visible
  const modifier = page.getByRole('button', { name: 'Modifier', exact: true })
  if ((await modifier.count()) !== 0) throw new Error('Aucun programme ne devrait être déplié au chargement')
  // Les cartes tiennent dans l'écran : la 1re s'arrête avant la marge droite (libellés
  // `nowrap` + grille sans `grid-cols-1` = débordement silencieux, vu le 03/09/2026)
  const first = await page.locator('[aria-expanded]').first().boundingBox()
  if (!first || first.x + first.width > 390 - 19)
    throw new Error(`La carte déborde de l'écran : droite à ${first ? Math.round(first.x + first.width) : '?'} px pour 370 attendus`)
  await page.screenshot({ path: 'screenshots/exercices-01-replie.png' })

  // Un tap déplie sur place : exercices lisibles + Modifier
  await page.click('p:has-text("Muscu — Full body")')
  await page.waitForSelector('[aria-expanded="true"]:has-text("Muscu — Full body")')
  await page.waitForSelector('text=Pont fessier')
  await modifier.waitFor()
  await page.screenshot({ path: 'screenshots/exercices-02-deplie.png' })

  // Un seul déplié à la fois : ouvrir le HIIT replie le full body
  await page.click('p:has-text("HIIT — Cardio express")')
  await page.waitForSelector('[aria-expanded="true"]:has-text("HIIT — Cardio express")')
  await page.waitForSelector('text=Burpees')
  await page.waitForSelector('text=de repos')
  if ((await page.locator('[aria-expanded="true"]').count()) !== 1) throw new Error('Un seul programme doit être déplié à la fois')
  if ((await page.locator('text=Pont fessier').count()) !== 0) throw new Error('Le full body aurait dû se replier')

  // Un second tap replie
  await page.click('p:has-text("HIIT — Cardio express")')
  await page.waitForSelector('[aria-expanded="true"]', { state: 'detached' })

  // Modifier → fiche, Retour → liste
  await page.click('p:has-text("Muscu — Full body")')
  await modifier.click()
  await page.waitForSelector('text=Planification')
  await page.click('[aria-label="Retour"]')
  await page.waitForSelector('text=Mes programmes')

  // Desktop : les cartes se rangent sur deux colonnes
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  desk.on('pageerror', (e) => errors.push('desktop pageerror: ' + e.message))
  await desk.goto(BASE)
  await desk.waitForSelector('text=Routine matinale', { timeout: 20000 })
  await desk.getByRole('link', { name: 'Exercices', exact: true }).click()
  await desk.waitForSelector('text=Mes programmes')
  const cards = desk.locator('[aria-expanded]')
  const a = await cards.nth(0).boundingBox()
  const b = await cards.nth(1).boundingBox()
  if (!a || !b || Math.abs(a.y - b.y) > 2 || b.x <= a.x + a.width)
    throw new Error(`Sur desktop, les deux premières cartes devraient être côte à côte (${JSON.stringify(a)} / ${JSON.stringify(b)})`)
  await desk.screenshot({ path: 'screenshots/exercices-03-desktop.png' })

  console.log('LIBRARY-UI OK — cartes dépliables, un seul programme ouvert, Modifier → fiche, desktop en deux colonnes')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: 'screenshots/99-echec-library.png' })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
