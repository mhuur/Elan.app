// Test de fumée : parcourt les écrans principaux en mode local et prend des captures.
// Prérequis : `npm run dev` lancé, puis `node scripts/smoke.mjs`
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const DIR = 'screenshots'
mkdirSync(DIR, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})
page.on('dialog', (d) => d.accept())

const shot = (name) => page.screenshot({ path: `${DIR}/${name}.png` })

try {
  // --- Aujourd'hui : le seed crée la routine matinale planifiée tous les jours
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })
  await shot('01-aujourdhui')

  // --- Compléter la routine d'étirements sans minuteur
  await page.click('text=Routine matinale')
  await page.waitForSelector('text=Lancer le minuteur')
  await shot('02-sheet-etirements')
  await page.click('text=Marquer comme faite')
  await page.waitForSelector('text=Terminées')

  // --- Séance libre : vélo avec saisie des perfs
  await page.click('text=Séance libre')
  await page.waitForSelector('text=Choisir une séance')
  await page.click('text=appartement')
  await page.waitForSelector('text=Puissance')
  const nums = page.locator('input[type="number"]')
  await nums.nth(2).fill('12.5') // distance
  await nums.nth(4).fill('128') // bpm
  await shot('03-sheet-velo')
  await page.click('text=Enregistrer ✓')
  await page.waitForSelector('text=12.5 km')

  // --- Séance libre : muscu (steppers préremplis)
  await page.click('text=Séance libre')
  await page.click('text=Full body')
  await page.waitForSelector('text=Série 1')
  await shot('04-sheet-muscu')
  await page.click('text=Enregistrer ✓')
  await page.waitForSelector('text=5 exercices · 15 séries')
  await shot('05-aujourdhui-complet')

  // --- Minuteur HIIT
  await page.click('text=Séance libre')
  await page.click('text=Cardio express')
  await page.waitForSelector('text=Lancer le minuteur')
  await page.click('text=Lancer le minuteur')
  await page.waitForSelector("text=C'est parti")
  await shot('06-player-pret')
  await page.click("text=C'est parti")
  await page.waitForSelector('text=Préparation')
  await page.waitForTimeout(1500)
  await shot('07-player-en-cours')
  await page.click('[aria-label="Quitter"]') // confirm auto-accepté
  await page.waitForSelector('text=Séance libre')

  // --- Planning : ajouter le HIIT au lundi
  await page.click('text=Planning')
  await page.waitForSelector('text=Semaine type')
  await page.locator('button:has-text("+ Ajouter")').first().click()
  await page.waitForSelector('text=Ajouter au lundi')
  await page.click('text=Cardio express')
  await page.waitForSelector('text=🔥 HIIT — Cardio express')
  await shot('08-planning')

  // --- Bibliothèque : séances et exercices
  await page.click('text=Exercices')
  await page.waitForSelector('text=Bibliothèque')
  await shot('09-bibliotheque-seances')
  await page.getByRole('button', { name: 'Exercices', exact: true }).click() // segment "Exercices"
  await page.waitForSelector('button:has-text("Pompes")')
  await shot('10-bibliotheque-exos')

  // --- Fiche exercice (lien vidéo)
  await page.click('text=Pompes')
  await page.waitForSelector("text=Modifier l'exercice")
  await shot('11-fiche-exercice')
  await page.click('[aria-label="Retour"]')

  // --- Progrès
  await page.click('text=Progrès')
  await page.waitForSelector('text=Séances complétées par semaine')
  await page.waitForTimeout(800)
  await shot('12-progres')

  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  } else {
    console.log('SMOKE OK — aucune erreur console, captures dans ./screenshots')
  }
} catch (e) {
  await shot('99-echec')
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
