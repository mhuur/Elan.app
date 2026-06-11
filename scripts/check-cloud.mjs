// Vérifie que le mode cloud (Firebase) affiche bien l'écran de connexion Google
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

await page.goto('http://localhost:5173')
await page.waitForSelector('text=Continuer avec Google', { timeout: 20000 })
await page.screenshot({ path: 'screenshots/cloud-login.png' })

if (errors.length) {
  console.error('ERREURS :')
  for (const e of errors) console.error(' -', e)
  process.exitCode = 1
} else {
  console.log('CLOUD OK — écran de connexion Google affiché sans erreur')
}
await browser.close()
