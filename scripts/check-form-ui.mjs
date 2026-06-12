// Vérification visuelle des formulaires épurés : séance (liste compacte, combobox
// d'ajout, barre d'action fixe) et exercice (sous-types en combobox).
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

  // --- Fiche séance muscu : liste d'exercices compacte
  await page.getByRole('link', { name: 'Exercices' }).click()
  await page.waitForSelector('text=Bibliothèque')
  await page.click('p:has-text("Muscu — Full body")')
  await page.waitForSelector('text=Planification')
  await page.screenshot({ path: 'screenshots/30-form-seance-haut.png' })
  await page.locator('text=Exercices de la séance').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'screenshots/31-form-seance-exos.png' })

  // --- Combobox d'ajout : filtre puis création à la volée
  const addBox = page.getByPlaceholder('+ Ajouter ou créer un exercice…')
  await addBox.scrollIntoViewIfNeeded()
  await addBox.fill('pom')
  await page.waitForSelector('button:has-text("Pompes")')
  await page.screenshot({ path: 'screenshots/32-combobox-filtre.png' })
  await addBox.fill('Dips sur chaise')
  await page.waitForSelector('text=+ Créer « Dips sur chaise »')
  await page.screenshot({ path: 'screenshots/33-combobox-creer.png' })
  await page.click('text=+ Créer « Dips sur chaise »')
  await page.waitForSelector('select:has-text("Dips sur chaise")')

  // --- Séries variées : 3×12 devient 12/12/12 éditables, on passe la 1re à 30
  await page.locator('[aria-label="Varier les séries"]').first().click()
  await page.screenshot({ path: 'screenshots/38-series-variees.png' })
  const firstCard = page.locator('div.rounded-2xl.bg-surface').filter({ hasText: 'reps' }).first()
  await firstCard.locator('input[inputmode="numeric"]').nth(1).fill('30')

  // --- Section du planning : suggestions filtrées dans la combobox
  const groupBox = page.getByPlaceholder('Optionnel…')
  await groupBox.scrollIntoViewIfNeeded()
  await groupBox.click()
  await page.screenshot({ path: 'screenshots/34-combobox-section.png' })
  await page.keyboard.press('Escape')

  // --- Enregistrer via la barre d'action fixe
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Bibliothèque')
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('elan-data-v1')))
  const full = d.sessions.find((s) => s.name.includes('Full body'))
  if (!full.items.some((it) => d.exercises.find((e) => e.id === it.exerciseId)?.name === 'Dips sur chaise'))
    throw new Error("L'exercice créé à la volée devrait être dans la séance")
  // Les champs retirés du formulaire sont préservés tels quels
  if (full.notes === undefined || full.metrics === undefined || full.links === undefined)
    throw new Error('notes/metrics/links devraient être conservés à la sauvegarde')
  // Les séries variées sont enregistrées (1re série passée à 30)
  if ((full.items[0].targets ?? []).join(',') !== '30,12,12')
    throw new Error(`Les séries variées devraient être 30,12,12 — trouvé ${(full.items[0].targets ?? []).join(',')}`)
  if (full.items.some((it) => 'uid' in it)) throw new Error("L'uid transitoire ne devrait pas être sauvegardé")

  // --- Nouvelle séance : écran épuré
  await page.click('text=+ Séance')
  await page.waitForSelector('text=Nouvelle séance')
  await page.screenshot({ path: 'screenshots/35-form-nouvelle-seance.png' })
  await page.click('[aria-label="Retour"]')

  // --- Fiche exercice : combobox de sous-types
  await page.getByRole('button', { name: "Banque d'exercices", exact: true }).click()
  await page.click('button:has-text("Pompes")')
  await page.waitForSelector("text=Modifier l'exercice")
  await page.screenshot({ path: 'screenshots/36-form-exercice.png' })
  await page.getByPlaceholder('Ajouter un sous-type').fill('tri')
  await page.waitForSelector('text=+ Créer « tri »')
  await page.screenshot({ path: 'screenshots/37-form-exercice-combobox.png' })

  console.log('FORM UI OK — captures 30 à 37 dans ./screenshots')
  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: 'screenshots/99-echec-form-ui.png' })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
