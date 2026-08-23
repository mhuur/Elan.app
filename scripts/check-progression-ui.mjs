// Vérifie la progression automatique des objectifs de bout en bout : on fait 14 reps au minuteur
// là où l'objectif était 12 ; à la réouverture de la séance, le programme affiche 14 (les séries
// non faites gardent 12) et la fiche de séance en base n'a PAS été réécrite.
// Prérequis : `npm run dev:demo` lancé.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'

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

  // --- Minuteur muscu « Full body » (Pompes 3 × 12) : première série poussée à 14 reps
  await page.click('text=Séance libre')
  await page.locator('[role="dialog"] button:has-text("Full body")').click()
  await page.waitForSelector('text=Démarrer')
  await page.waitForSelector('[role="dialog"] >> text=3 × 12 reps') // objectif d'origine
  await page.click('text=Démarrer')
  await page.waitForSelector("text=C'est parti")
  await page.click("text=C'est parti")
  await page.waitForSelector('text=Préparation')
  await page.click('[aria-label="Passer"]')
  await page.waitForSelector('text=Série faite ✓')
  await page.click('[aria-label="Une répétition de plus"]')
  await page.click('[aria-label="Une répétition de plus"]')
  await page.click('text=Série faite ✓')
  await page.waitForSelector('text=Repos')
  await page.click('[aria-label="Arrêter et enregistrer"]')
  await page.waitForSelector('text=Séance libre')

  // --- Réouverture : la série faite vaut 14, les deux non faites gardent 12
  await page.click('text=Séance libre')
  await page.locator('[role="dialog"] button:has-text("Full body")').click()
  // Le bandeau « Objectifs relevés » a été retiré (refonte août 2026) : la progression
  // se lit directement dans les cibles affichées
  await page.waitForSelector('[role="dialog"] >> text=14 / 12 / 12 reps')
  await page.screenshot({ path: 'screenshots/52-objectifs-releves.png' })

  // --- Le minuteur part sur la nouvelle cible
  await page.click('text=Démarrer')
  await page.waitForSelector("text=C'est parti")
  await page.click("text=C'est parti")
  await page.waitForSelector('text=Préparation')
  await page.click('[aria-label="Passer"]')
  await page.waitForSelector('text=Série faite ✓')
  // Le compteur part de la nouvelle cible : un « + » de plus fait apparaître « objectif 14 »
  await page.click('[aria-label="Une répétition de plus"]')
  await page.waitForSelector('text=objectif 14')
  await page.click('[aria-label="Quitter"]')
  await page.waitForSelector('text=Séance libre')

  // --- Rien n'a été réécrit en base : la fiche de séance garde 3 × 12
  const s = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('elan-data-v1'))
    return d.sessions.find((x) => x.name.includes('Full body'))
  })
  if (s.items[0].target !== 12 || s.items[0].targets) {
    throw new Error(`La fiche de séance ne doit pas être réécrite, trouvé ${JSON.stringify(s.items[0])}`)
  }

  console.log('PROGRESSION UI OK — objectif relevé à 14, séries non faites à 12, fiche de séance intacte')
  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: 'screenshots/99-echec-progression-ui.png' })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
