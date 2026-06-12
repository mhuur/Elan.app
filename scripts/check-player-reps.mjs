// Vérifie la saisie du réalisé dans le minuteur guidé muscu (reps ajustables,
// enregistrement partiel à l'abandon) et l'affichage du programme étirements/HIIT
// dans la feuille de complétion.
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

  // --- Programme visible dans la feuille étirements (homogène avec vélo/muscu)
  await page.click('text=Routine matinale')
  await page.waitForSelector('text=Lancer le minuteur')
  await page.waitForSelector('text=Chat-vache') // une posture du seed listée avec sa durée
  await page.screenshot({ path: 'screenshots/40-sheet-etirements-programme.png' })
  await page.click('text=Fermer sans valider')

  // --- Minuteur muscu : ajuster les reps réelles (12 → 14) puis valider la série
  await page.click('text=Séance libre')
  await page.locator('[role="dialog"] button:has-text("Full body")').click()
  await page.waitForSelector('text=Lancer le minuteur')
  await page.click('text=Lancer le minuteur')
  await page.waitForSelector("text=C'est parti")
  await page.click("text=C'est parti")
  await page.waitForSelector('text=Préparation')
  await page.click('text=Passer ⏭')
  await page.waitForSelector('text=Série faite ✓')
  await page.click('[aria-label="Une répétition de plus"]')
  await page.click('[aria-label="Une répétition de plus"]')
  await page.waitForSelector('text=objectif 12')
  await page.screenshot({ path: 'screenshots/41-player-reps-ajustees.png' })
  await page.click('text=Série faite ✓')
  await page.waitForSelector('text=Repos')

  // --- Quitter en cours : le confirm annonce l'enregistrement, le log contient le réalisé
  await page.click('[aria-label="Quitter"]') // « Les séries déjà faites seront enregistrées » auto-accepté
  await page.waitForSelector('text=Séance libre')
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('elan-data-v1')))
  const log = d.logs.find((l) => l.sessionName.includes('Full body') && l.note === 'Séance interrompue')
  if (!log) throw new Error("Le log partiel « Séance interrompue » devrait exister")
  if (log.results.length !== 1) throw new Error(`Le log partiel ne devrait contenir que l'exercice commencé, trouvé ${log.results.length}`)
  if (log.results[0].sets.join(',') !== '14') throw new Error(`La série devrait valoir 14 reps (12 ajustées +2), trouvé ${log.results[0].sets.join(',')}`)

  console.log('PLAYER REPS OK — programme étirements affiché, reps ajustées journalisées, partiel enregistré à l’abandon')
  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: 'screenshots/99-echec-player-reps.png' })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
