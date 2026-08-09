// Vérifie que l'écran « Planning » (Semaine) tient SANS DÉFILEMENT sur un écran de
// 844 px de haut, barre d'onglets comprise — c'est une contrainte de conception :
// la grille de la semaine doit se lire d'un coup d'œil, sans scroller.
// Capture aussi le rendu réel (viewport, pas fullPage) dans screenshots/semaine-*.png.
// Prérequis : `npm run dev:demo` lancé, puis `node scripts/check-semaine.mjs`
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
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await page.waitForSelector('text=Cette semaine')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/semaine-01.png` })

  const m = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    view: window.innerHeight,
    // Bas du dernier bloc de contenu, hors barre d'onglets fixe
    lastRow: (() => {
      const rows = [...document.querySelectorAll('main div[class*="rounded-md"]')]
      const last = rows[rows.length - 1]
      return last ? Math.round(last.getBoundingClientRect().bottom) : null
    })(),
    navTop: Math.round(document.querySelector('nav').getBoundingClientRect().top),
  }))
  const overflow = m.scroll - m.view
  console.log(`hauteur document ${m.scroll} / viewport ${m.view} → débordement ${overflow} px`)
  console.log(`bas de la dernière ligne ${m.lastRow} px · haut de la barre d'onglets ${m.navTop} px`)
  if (overflow > 0) errors.push(`l'écran déborde de ${overflow} px : défilement nécessaire`)
  if (m.lastRow && m.lastRow > m.navTop) errors.push('la dernière ligne passe sous la barre d\'onglets')

  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  } else {
    console.log('SEMAINE OK — tient sans défilement, capture dans ./screenshots/semaine-01.png')
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/semaine-99-echec.png` })
  console.error('ÉCHEC :', e.message)
  for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
