// Vérif visuelle de la charte « bord de mer » : traverse les écrans que `smoke.mjs` ne
// couvre pas (Réglages, onglet Plan, fiche COROS) et capture dans screenshots/charte-*.png.
// C'est là que se joue l'empilement des fonds (page → carte → inset → champ) : un élément
// qui reprend la couleur de son parent devient invisible en sombre.
// Prérequis : `npm run dev:demo` lancé, puis `node scripts/check-charte.mjs`
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
const shot = (name) => page.screenshot({ path: `${DIR}/charte-${name}.png` })

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Réglages : blocs posés sur un inset — le cas le plus exigeant pour les niveaux de fond
  await page.click('[aria-label="Réglages"]')
  await page.waitForSelector('text=Mode local')
  await shot('reglages')
  await page.mouse.click(195, 60) // hors de la feuille : referme

  // Onglet Plan, zones d'allure (couleurs par type d'effort) et fiche COROS
  await page.goto(BASE + '/plan')
  await page.waitForSelector('text=Ton aperçu hebdomadaire')
  await shot('plan')
  await page.click('text=Mes allures & zones')
  await page.waitForSelector('text=VO2max')
  await shot('plan-zones')
  await page.locator('button:has-text("Séance")').first().click()
  await page.waitForSelector('text=Valider ma séance')
  await shot('workout-sheet')

  // Objectifs : route conservée mais onglet masqué, donc jamais traversée par le smoke
  await page.goto(BASE + '/goals')
  await page.waitForSelector('text=Objectifs')
  await shot('objectifs')

  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  } else {
    console.log('CHARTE OK — captures dans ./screenshots/charte-*.png')
  }
} catch (e) {
  await shot('99-echec')
  console.error('ÉCHEC :', e.message)
  for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
