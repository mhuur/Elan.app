// Vérifie la page Plan en vue semaine par semaine : navigation par flèches, aperçu hebdo, cartes
// de séance, et viewer type Campus à l'ouverture d'une séance. Plan recalé : la numérotation
// « Semaine 1..13 » part de la reprise (6 juil.) ; les semaines de juin sont marquées « historique ».
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
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

try {
  // Date figée (dim. 14/06/2026, fin de la S1 de reprise) → test déterministe quelle que soit
  // la date d'exécution réelle (le plan semi est calé sur des dates fixes).
  await page.clock.setFixedTime(new Date('2026-06-14T12:00:00'))
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // --- Onglet Plan : en-tête, navigateur de semaines, aperçu hebdo, cartes de séance
  await page.getByRole('link', { name: '21K', exact: true }).click()
  await page.waitForSelector('text=Tout Rennes Court')
  await page.waitForSelector('text=Ton aperçu hebdomadaire')
  await page.waitForSelector('text=Cette semaine') // 14 juin = semaine en cours (départ 14 juin)
  await page.waitForSelector('text=historique') // juin = conservé comme historique (avant la reprise du 6 juil.)
  await page.waitForSelector('text=Séance 1/1') // S1 = reprise : une seule sortie longue
  await page.waitForSelector('text=Sortie longue 8 km')
  // Panneau « Mes allures & zones » : replié par défaut, déplié au tap (constantes + 5 zones)
  await page.waitForSelector('text=Mes allures & zones')
  await page.click('text=Mes allures & zones')
  await page.waitForSelector('text=VO2max')
  await page.waitForSelector('text=Endurance fondamentale')
  await page.screenshot({ path: `${DIR}/40-plan.png` })

  // --- Navigation par flèches jusqu'au pic de volume (7 sept.) = Semaine 10 depuis la reprise
  for (let i = 0; i < 13; i++) {
    await page.click('[aria-label="Semaine suivante"]')
  }
  await page.waitForSelector('text=Semaine 10')
  await page.waitForSelector('text=pic de volume')
  await page.waitForSelector('text=VMA 4×1200 m')

  // --- Affichage type Campus : ouvrir la séance VMA → séquences détaillées
  await page.click('text=VMA 4×1200 m')
  await page.waitForSelector('[role="dialog"] >> text=Échauffement')
  await page.waitForSelector('[role="dialog"] >> text=1200 m')
  await page.waitForSelector('[role="dialog"] >> text=4:48')
  await page.waitForSelector('[role="dialog"] >> text=Récupération')
  await page.screenshot({ path: `${DIR}/42-plan-seance.png` })

  // --- Validation manuelle : « Valider ma séance » → sans course → confirmer la date → « Validée »
  await page.click('[role="dialog"] >> text=Valider ma séance')
  await page.waitForSelector('text=Quelle sortie correspond')
  await page.click('text=Valider sans associer de sortie')
  await page.waitForSelector('text=Quel jour as-tu fait cette séance')
  await page.click('[role="dialog"] >> text=Valider ✓')
  await page.waitForSelector('[role="dialog"]', { state: 'detached' })
  // La séance validée quitte le flux principal et passe en « Terminées » (comme Aujourd'hui)
  await page.waitForSelector('h2:has-text("Terminées")')
  await page.waitForSelector('section:has(h2:has-text("Terminées")) >> text=VMA 4×1200 m')
  await page.screenshot({ path: `${DIR}/43-plan-validee.png` })

  // --- Dernière semaine : le semi est bien là
  for (let i = 0; i < 3; i++) {
    await page.click('[aria-label="Semaine suivante"]')
  }
  await page.waitForSelector('text=Semaine 13')
  await page.waitForSelector('text=Semi-marathon — 21,1 km')
  await page.screenshot({ path: `${DIR}/41-plan-course.png` })

  console.log('PLAN OK — vue semaine par semaine, navigation, aperçu hebdo, cartes, viewer type Campus')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-plan.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
