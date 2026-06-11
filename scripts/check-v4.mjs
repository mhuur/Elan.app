// Vérifie : sous-types multiples, objectif + célébration, superset, tours, heatmap, saisie rétroactive
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const yesterday = new Date(Date.now() - 86400000)
const yISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
const yLabel = yesterday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

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

  // --- Pompes : 2e sous-type (Bras) + objectif meilleure série 10
  await page.click('text=Exercices')
  await page.getByRole('button', { name: "Banque d'exercices", exact: true }).click()
  await page.click('button:has-text("Pompes")')
  await page.waitForSelector("text=Modifier l'exercice")
  await page.getByRole('button', { name: 'Bras', exact: true }).click()
  await page.locator('input[type="number"]').first().fill('10') // objectif
  await page.click('text=Enregistrer')
  // Pompes doit apparaître dans Pectoraux ET Bras
  await page.waitForSelector('button:has-text("Pompes")')
  const count = await page.locator('button:has-text("Pompes")').count()
  if (count < 2) throw new Error(`Pompes devrait apparaître dans 2 groupes, trouvé ${count}`)
  await page.screenshot({ path: 'screenshots/15-banque-multitags.png' })

  // --- Séance Full body : tours du circuit + superset entre les 2 premiers exercices
  await page.getByRole('button', { name: 'Mes séances', exact: true }).click()
  await page.click('text=Full body')
  await page.waitForSelector('text=Tours du circuit')
  await page.locator('button:has-text("+ lier en superset")').first().click()
  await page.waitForSelector('text=Superset — enchaîné sans repos')
  await page.screenshot({ path: 'screenshots/16-seance-compacte.png' })
  await page.click('text=Enregistrer')

  // --- Compléter Full body : superset visible + célébration de l'objectif (12 ≥ 10)
  await page.click("text=Aujourd'hui")
  await page.click('text=Séance libre')
  await page.click('text=Full body')
  await page.waitForSelector('text=Superset — enchaîner sans repos')
  await page.click('text=Enregistrer ✓')
  await page.waitForSelector('text=Objectif atteint')
  await page.screenshot({ path: 'screenshots/17-celebration.png' })
  await page.click('text=Continuer')
  await page.waitForSelector('text=Terminées')

  // --- Progrès : régularité (heatmap + streak), objectif sur le graphique
  await page.click('text=Progrès')
  await page.waitForSelector('text=Régularité')
  await page.waitForSelector("text=d'affilée")
  await page.selectOption('select', { label: 'Pompes' }) // sélecteur « Par exercice »
  await page.waitForSelector('text=Objectif 10')
  await page.waitForSelector('text=atteint 🎉')
  await page.screenshot({ path: 'screenshots/18-progres-v4.png' })

  // --- Saisie rétroactive : Sortie courte hier
  await page.click('text=Saisir une séance passée')
  await page.waitForSelector('text=Date de la séance')
  await page.locator('input[type="date"]').fill(yISO)
  await page.click('text=Saisir les détails')
  await page.waitForSelector('text=Marquer comme faite')
  await page.click('text=Marquer comme faite')
  await page.waitForSelector(`text=${yLabel}`)
  await page.screenshot({ path: 'screenshots/19-retro.png' })

  console.log('V4 OK — sous-types multiples, objectif/célébration, superset, heatmap, rétroactif')
  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: 'screenshots/99-echec-v4.png' })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
