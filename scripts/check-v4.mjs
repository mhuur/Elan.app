// Vérifie : sous-types multiples + « + » de section, onglet Objectifs + célébration,
// superset, heatmap, saisie rétroactive via la navigation de dates d'Aujourd'hui.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const yesterday = new Date(Date.now() - 86400000)
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

  // --- Pompes : 2e sous-type (Bras) → visible dans les deux groupes
  await page.click('text=Exercices')
  await page.getByRole('button', { name: "Banque d'exercices", exact: true }).click()
  await page.click('button:has-text("Pompes")')
  await page.waitForSelector("text=Modifier l'exercice")
  await page.getByRole('button', { name: 'Bras', exact: true }).click()
  await page.click('text=Enregistrer')
  await page.waitForSelector('button:has-text("Pompes")')
  const count = await page.locator('button:has-text("Pompes")').count()
  if (count < 2) throw new Error(`Pompes devrait apparaître dans 2 groupes, trouvé ${count}`)
  await page.screenshot({ path: 'screenshots/15-banque-multitags.png' })

  // --- « + » de sous-section : nouvel exercice prérempli Abdominaux
  await page.click('[aria-label="Nouvel exercice Abdominaux"]')
  await page.waitForSelector('text=Nouvel exercice')
  await page.getByPlaceholder('Ex. Pompes diamant').fill('Crunch inversé')
  await page.click('text=Enregistrer')
  await page.waitForSelector('button:has-text("Crunch inversé")')

  // --- Séance Full body : superset entre les 2 premiers exercices
  await page.getByRole('button', { name: 'Mes séances', exact: true }).click()
  await page.click('text=Full body')
  await page.waitForSelector('text=Tours du circuit')
  await page.locator('button:has-text("+ lier en superset")').first().click()
  await page.waitForSelector('text=Superset — enchaîné sans repos')
  await page.click('text=Enregistrer')

  // --- Onglet Objectifs : objectif Pompes à 2 paliers avec récompenses
  await page.click('text=Objectifs')
  await page.waitForSelector('text=Cap sur la progression')
  await page.click('text=+ Objectif')
  await page.waitForSelector('text=Nouvel objectif')
  await page.locator('select').first().selectOption({ label: '💪 Muscu — Full body' })
  await page.waitForSelector("text=Type d'objectif")
  await page.locator('input[type="number"]').first().fill('10')
  await page.getByPlaceholder('🎁 Récompense (ex. lunettes de soleil)').first().fill('Glace')
  await page.click('text=+ Ajouter un palier')
  await page.locator('input[type="number"]').nth(1).fill('20')
  await page.getByPlaceholder('🎁 Récompense (ex. lunettes de soleil)').nth(1).fill('Lunettes de soleil')
  await page.click("text=Créer l'objectif")
  await page.waitForSelector('text=💪 Pompes')
  await page.waitForSelector('text=2 paliers')
  await page.waitForSelector('text=0 / 10')
  await page.screenshot({ path: 'screenshots/21-objectifs.png' })

  // --- Compléter Full body : superset + palier 1 franchi (12 ≥ 10) → récompense
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.click('text=Séance libre')
  await page.click('text=Full body')
  await page.waitForSelector('text=Superset — enchaîner sans repos')
  await page.click('text=Enregistrer ✓')
  await page.waitForSelector('text=Récompense débloquée : Glace')
  await page.screenshot({ path: 'screenshots/17-celebration.png' })
  await page.click('text=Continuer')
  await page.waitForSelector('text=Terminées')

  // --- L'onglet montre le palier 1 débloqué et la progression vers le palier 2
  await page.click('text=Objectifs')
  await page.waitForSelector('text=Glace — débloquée !')
  await page.waitForSelector('text=12 / 20')
  await page.waitForSelector('text=Lunettes de soleil')

  // --- Objectif multi-mesures sur le vélo : durée ≥ 25 min ET bpm ≥ 120
  await page.click('text=+ Objectif')
  await page.waitForSelector('text=Nouvel objectif')
  await page.locator('select').first().selectOption({ label: '🚴 Vélo d’appartement' })
  await page.waitForSelector('text=remplissez une ou plusieurs mesures')
  const goalNums = page.locator('input[type="number"]')
  await goalNums.nth(1).fill('25') // durée
  await goalNums.nth(4).fill('120') // bpm
  await page.click("text=Créer l'objectif")
  await page.waitForSelector('text=à réussir dans une même séance')
  await page.screenshot({ path: 'screenshots/22-objectif-multi.png' })
  // Une séance vélo qui remplit les deux cibles déclenche la célébration
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.click('text=Séance libre')
  await page.click('text=appartement')
  await page.waitForSelector('text=Puissance')
  const veloNums = page.locator('input[type="number"]')
  await veloNums.nth(1).fill('30') // durée
  await veloNums.nth(4).fill('128') // bpm
  await page.click('text=Enregistrer ✓')
  await page.waitForSelector('text=Objectif atteint')
  await page.click('text=Continuer')
  await page.click('text=Objectifs')
  await page.waitForSelector('text=Tous les paliers atteints !')
  await page.screenshot({ path: 'screenshots/23-objectif-multi-atteint.png' })

  // --- Progrès : régularité + prochain palier (avec récompense) sur le graphique
  await page.click('text=Progrès')
  await page.waitForSelector('text=Régularité')
  await page.waitForSelector("text=d'affilée")
  await page.selectOption('select:has(option:text-is("Pompes"))', { label: 'Pompes' })
  await page.waitForSelector('text=Palier 20')
  await page.waitForSelector('text=🎁 Lunettes de soleil')
  await page.screenshot({ path: 'screenshots/18-progres-v4.png' })

  // --- Saisie rétroactive : naviguer à hier depuis Aujourd'hui et valider une sortie
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.waitForSelector('text=Séance libre')
  await page.click('[aria-label="Jour précédent"]')
  await page.waitForSelector('text=Saisie passée')
  await page.waitForSelector("text=Revenir à aujourd'hui")
  await page.click('text=Séance libre')
  await page.click('text=Sortie courte')
  await page.waitForSelector('text=Marquer comme faite')
  await page.click('text=Marquer comme faite')
  await page.waitForSelector('text=Terminées')
  await page.screenshot({ path: 'screenshots/19-retro.png' })
  // L'historique de Progrès montre bien la date d'hier
  await page.click('text=Progrès')
  await page.waitForSelector(`text=${yLabel}`)

  console.log('V5 OK — sous-types multiples, + de section, Objectifs, superset, heatmap, rétroactif par dates')
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
