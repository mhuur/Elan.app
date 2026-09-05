// Vérifie le mode de planification « Avant une autre » (jumelage / warmupFor, sept. 2026) :
// depuis la fiche d'une séance, choisir « Avant une autre », prendre une catégorie cible,
// enregistrer → `warmupFor` écrit, badge « Avant chaque X » dans la Bibliothèque, et la
// fiche rouverte re-sélectionne le mode et la cible. Repasser en « Jours fixes » nettoie.
// Prérequis : `npm run dev:demo` lancé, puis `node scripts/check-warmup-ui.mjs`
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

const warmupForOf = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('elan-data-v1')).sessions.find((s) => s.name === 'Sortie courte').warmupFor)

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Fiche de « Sortie courte » (running) depuis la Bibliothèque
  await page.getByRole('link', { name: 'Exercices', exact: true }).click()
  await page.waitForSelector('text=Mes programmes')
  await page.click('p:has-text("Sortie courte")')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.waitForSelector('text=Planification')

  // Mode « Avant une autre » : la cible se présélectionne (1re catégorie ≠ running)
  await page.getByRole('button', { name: 'Avant une autre', exact: true }).click()
  await page.waitForSelector('text=Avant chaque')
  // ⚠ Les tuiles de catégorie affichent les mêmes textes (HIIT, VÉLO) avec aria-pressed :
  // toute interaction avec les chips se scope à la rangée « Avant chaque ».
  const chipRow = page.locator('div:has(> span:text-is("Avant chaque séance de"))')
  await chipRow.locator('button[aria-pressed="true"]:has-text("Vélo")').waitFor()
  // Choisir HIIT explicitement, les jours fixes ne doivent plus être proposés
  await chipRow.locator('button:has-text("HIIT")').click()
  if ((await page.locator('button[title="Lundi"]').count()) > 0) {
    throw new Error('Les cases de jour ne devraient pas s’afficher en mode « Avant une autre »')
  }
  await page.screenshot({ path: `${DIR}/54-form-avant-une-autre.png` })
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')

  const wf = await warmupForOf()
  if (wf !== 'hiit') throw new Error(`warmupFor devrait valoir « hiit », trouvé : ${JSON.stringify(wf)}`)
  await page.waitForSelector('text=Avant chaque HIIT') // badge de la Bibliothèque
  await page.screenshot({ path: `${DIR}/55-bibliotheque-avant-chaque.png` })

  // Rouvrir : mode et cible re-sélectionnés
  await page.click('p:has-text("Sortie courte")')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.waitForSelector('text=Planification')
  await chipRow.locator('button[aria-pressed="true"]:has-text("HIIT")').waitFor()

  // Repasser en « Jours fixes » nettoie le jumelage à l'enregistrement
  await page.getByRole('button', { name: 'Jours fixes', exact: true }).click()
  await page.waitForSelector('button[title="Lundi"]')
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')
  const wf2 = await warmupForOf()
  if (wf2 != null) throw new Error(`warmupFor devrait être nettoyé, trouvé : ${JSON.stringify(wf2)}`)

  console.log('WARMUP-UI OK — mode « Avant une autre » : cible enregistrée, badge Bibliothèque, nettoyage au retour en jours fixes')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-warmup-ui.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
