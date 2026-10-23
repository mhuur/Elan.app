// Vérif Playwright (oct. 2026) : au minuteur, « Valider maintenant » termine une série
// chronométrée avant la fin du chrono, enchaîne sur l'étape suivante et journalise la durée
// PRÉVUE de la série (choix de Romain, 23/10/2026), pas le temps tenu. Prérequis : `npm run dev:demo` (port 5174).
import { chromium } from 'playwright'

const BASE = 'http://localhost:5174'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('dialog', (d) => d.accept())

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Séance libre', { timeout: 20000 })
  await page.getByRole('button', { name: 'Séance libre' }).click()
  await page.locator('[role="dialog"] button:has-text("Cardio express")').click()
  await page.click('text=Démarrer')
  await page.click("text=C'est parti")
  await page.waitForSelector('text=Préparez-vous')
  await page.click('[aria-label="Passer"]') // fin de la préparation : 1er intervalle chronométré
  const btn = page.getByRole('button', { name: 'Valider maintenant' })
  await btn.waitFor()
  await page.waitForTimeout(3000)
  await btn.click()
  // Enchaînement : on passe à l'étape suivante (récupération entre intervalles)
  await page.waitForSelector('text=2/')
  await page.click('[aria-label="Arrêter et enregistrer"]') // confirm + prompt acceptés
  await page.waitForSelector('text=Séance libre')

  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('elan-data-v1')))
  const log = [...data.logs].sort((a, b) => b.createdAt - a.createdAt)[0]
  const first = log?.results?.[0]?.sets?.[0]
  const hiit = data.sessions.find((s) => s.name.includes('Cardio express'))
  const planned = hiit.items[0].durationSec ?? hiit.workSec ?? 45
  if (first !== planned)
    throw new Error(`La durée prévue (${planned} s) devrait être journalisée, pas le temps tenu (≈ 3 s) ; trouvé : ${JSON.stringify(log?.results)}`)
  if (errors.length) throw new Error(errors.join(' | '))
  console.log(`PLAYER-EARLY OK — série validée avant la fin du chrono, ${first} s journalisées (durée prévue), étape suivante enchaînée`)
} catch (e) {
  await page.screenshot({ path: 'screenshots/99-echec-player-early.png' })
  console.error('ÉCHEC :', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
