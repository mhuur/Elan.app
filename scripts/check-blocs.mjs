// Vérifie les blocs muscu : découpage d'une séance en blocs avec tours
// indépendants (ex. Pompes seules, puis circuit du reste × 2 tours).
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

  // --- Couper Full body après le 1er exercice : bloc 2 = circuit × 2 tours
  await page.getByRole('link', { name: 'Séries' }).click()
  await page.waitForSelector('text=Bibliothèque')
  await page.click('p:has-text("Muscu — Full body")')
  await page.waitForSelector('text=Planification')
  await page.locator('button:has-text("nouveau bloc")').first().click()
  await page.waitForSelector('text=Bloc 2 — tours')
  await page.waitForSelector('text=Bloc 1 — tours')
  // Le bloc 2 fait 2 tours (saisie directe dans le stepper du séparateur)
  await page.locator('div[class*="bg-muscu"] input').nth(1).fill('2')
  await page.screenshot({ path: 'screenshots/27-blocs-form.png' })
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Bibliothèque')

  // --- Données : flags posés sur le 2e exercice
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('elan-data-v1')))
  const full = d.sessions.find((s) => s.name.includes('Full body'))
  if (!full.items[1].blockBreak || full.items[1].blockRounds !== 2)
    throw new Error('Le 2e exercice devrait démarrer un bloc × 2 tours')

  // --- Feuille : programme par blocs en lecture seule, saisie du résultat par tours
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.click('text=Séance libre')
  await page.locator('[role="dialog"] button:has-text("Full body")').click()
  await page.waitForSelector('text=Bloc 1')
  await page.waitForSelector('text=Bloc 2 · × 2 tours')
  await page.click('text=Entrer le résultat')
  await page.waitForSelector('text=Tour 2/2')
  await page.screenshot({ path: 'screenshots/28-blocs-completion.png' })
  await page.click('text=← Retour à la séance')

  // --- Minuteur guidé : série courante au centre, structure (blocs/tours/exos) dans la colonne programme
  await page.click('text=Lancer le minuteur')
  await page.waitForSelector("text=C'est parti")
  await page.click("text=C'est parti")
  await page.waitForSelector('text=Préparation')
  await page.click('[aria-label="Passer"]')
  await page.waitForSelector('text=Série 1/3')
  await page.click('[aria-label="Programme"]') // déplie le tiroir programme
  await page.waitForSelector('aside >> text=Bloc 1') // tiroir : bloc courant
  await page.waitForSelector('aside >> text=×2') // tiroir : tours du bloc 2 à venir
  await page.waitForSelector('aside >> text=Squats') // tiroir : exos du bloc à venir listés
  await page.waitForSelector('text=Série faite ✓')
  await page.click('[aria-label="Quitter"]')
  await page.waitForSelector('text=Séance libre')

  console.log('BLOCS OK — découpage, tours par bloc, complétion et minuteur guidé')
  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: 'screenshots/99-echec-blocs.png' })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
