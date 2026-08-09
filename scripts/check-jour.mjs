// Vérif visuelle de l'écran « Jour » (Aujourd'hui) refondu à la charte bord de mer :
// photo de fond + scrim, titre condensé sur deux lignes, pilules de comptage, cartes
// en verre dépoli, tuiles de code catégorie, barre d'onglets en mono.
// Contrôle aussi que les DEUX webfonts sont réellement appliquées (on lit le style
// calculé, pas l'apparence) — un repli silencieux sur Arial Narrow passerait sinon
// inaperçu sur une capture.
// Prérequis : `npm run dev:demo` lancé, puis `node scripts/check-jour.mjs`
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const DIR = 'screenshots'
mkdirSync(DIR, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 30000 })
  // Les webfonts doivent être posées avant la capture, sinon on photographie le repli
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${DIR}/jour-01.png` })

  const styles = await page.evaluate(() => {
    const f = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const s = getComputedStyle(el)
      return { family: s.fontFamily.split(',')[0].replace(/["']/g, ''), size: s.fontSize, transform: s.textTransform }
    }
    return { titre: f('h1'), eyebrow: f('header p'), nav: f('nav a') }
  })
  console.log('titre   :', JSON.stringify(styles.titre))
  console.log('eyebrow :', JSON.stringify(styles.eyebrow))
  console.log('onglets :', JSON.stringify(styles.nav))
  if (styles.titre?.family !== 'Big Shoulders Display') errors.push('titre : police display non appliquée')
  if (styles.eyebrow?.family !== 'Space Mono') errors.push('eyebrow : police mono non appliquée')

  // Jour suivant : le titre change de longueur (« 1er août ») et l'état passe « À venir »
  await page.click('[aria-label="Jour suivant"]')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${DIR}/jour-02-futur.png` })

  // Séance validée : fait apparaître la section « — TERMINÉES » et la pilule « 1 FAITE »
  await page.click('[aria-label="Jour précédent"]')
  await page.waitForSelector('text=Routine matinale')
  await page.locator('button:has-text("Routine matinale")').first().click()
  // Le libellé dépend de la discipline : une séance chronométrée propose « Marquer
  // comme faite ✓ (sans minuteur) », une séance à formulaire « Valider la séance ✓ ».
  const valider = page.locator('button').filter({ hasText: /Marquer comme faite|Valider la séance/ }).first()
  await valider.waitFor({ timeout: 15000 })
  await valider.click()
  await page.waitForSelector('h2:has-text("Terminées")', { timeout: 10000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${DIR}/jour-03-journal.png` })

  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  } else {
    console.log('JOUR OK — captures dans ./screenshots/jour-*.png')
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/jour-99-echec.png` })
  console.error('ÉCHEC :', e.message)
  for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
