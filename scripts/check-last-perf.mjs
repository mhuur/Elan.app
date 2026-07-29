// Vérifie l'affichage des perfs de la dernière session : à la validation d'une séance on choisit
// un smiley de difficulté + une note ; à la ré-ouverture, un bloc « Dernière fois » montre le
// résultat, le smiley et la note. Le smiley apparaît aussi dans la liste « Terminées ».
// Prérequis : `npm run dev:demo` lancé.
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

try {
  await page.clock.setFixedTime(new Date('2026-06-17T12:00:00'))
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // --- Ouvrir la séance Vélo via « + Séance libre » et saisir des perfs + smiley + note
  await page.click('text=+ Séance libre')
  await page.locator('[role="dialog"] button:has-text("appartement")').click()
  await page.waitForSelector('text=Difficulté ressentie') // notre nouveau sélecteur de ressenti
  const nums = page.locator('[role="dialog"] input')
  await nums.nth(1).fill('45') // Durée (min)
  await nums.nth(2).fill('22') // Distance (km)
  await page.getByRole('button', { name: 'correct', exact: true }).click() // smiley 😐
  await page.locator('[role="dialog"] textarea').fill('facile, monter le niveau')
  await page.click('text=Valider la séance ✓')
  await page.waitForSelector('[role="dialog"]', { state: 'detached' })

  // --- La séance faite passe en « Terminées » avec le smiley affiché
  await page.waitForSelector('h2:has-text("Terminées")')
  await page.waitForSelector('section:has(h2:has-text("Terminées")) >> text=😐')
  await page.screenshot({ path: `${DIR}/50-terminee-smiley.png` })

  // --- Ré-ouvrir la séance → bloc « Dernière fois » : perf + smiley + note
  await page.click('text=+ Séance libre')
  await page.locator('[role="dialog"] button:has-text("appartement")').click()
  await page.waitForSelector('text=Dernière fois')
  await page.waitForSelector('[role="dialog"] >> text=45 min')
  await page.waitForSelector('[role="dialog"] >> text=22 km')
  await page.waitForSelector('[role="dialog"] >> text=😐')
  await page.waitForSelector('[role="dialog"] >> text=monter le niveau')
  await page.screenshot({ path: `${DIR}/51-derniere-fois.png` })

  console.log('LAST-PERF OK — smiley + note capturés, récap « Dernière fois », smiley en Terminées')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-last-perf.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
