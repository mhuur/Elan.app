// Vérifie la section « Planification » de la fiche séance (refonte sept. 2026) : le « quand »
// à trois positions, la section « En alternance avec » (crans A, B…), « Commencer par », et
// surtout l'APERÇU sur deux semaines, calculé par la même fonction que le Planning :
//  - Jours fixes L/J/S → les cases de l'aperçu suivent (et « Prochaine fois » s'affiche) ;
//  - + Ajouter → HIIT en cran B → cases bordées du HIIT, légende ;
//  - Commencer par B → la prochaine occurrence passe au HIIT AVANT d'enregistrer ;
//  - aucun jour coché → avertissement, et l'enregistrement ne crée PAS de cadence cachée
//    (bug du 05/09/2026 : « Alternance » sans jour enregistrait « Tous les 2 jours »).
// Prérequis : `npm run dev:demo` lancé.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
mkdirSync('screenshots', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 1200 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})
page.on('dialog', (d) => d.accept())

// Cases de l'aperçu : les 14 cellules après les 7 en-têtes de la grille (la seule à 7 colonnes)
const cells = () => page.locator('.grid-cols-7 > span:nth-child(n+8)')
const meCount = async () => (await cells().evaluateAll((els) => els.filter((e) => e.classList.contains('bg-sage-500')).length))
const otherCount = async () => (await cells().evaluateAll((els) => els.filter((e) => e.classList.contains('border')).length))

// Jours L/J/S restants (aujourd'hui inclus) sur les deux semaines affichées, calculés ici
const today = new Date()
const monday = new Date(today)
monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
monday.setHours(0, 0, 0, 0)
let expectedLJS = 0
for (let i = 0; i < 14; i++) {
  const d = new Date(monday)
  d.setDate(monday.getDate() + i)
  const past = d < new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!past && [0, 3, 5].includes((d.getDay() + 6) % 7)) expectedLJS++
}

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })
  await page.getByRole('link', { name: 'Exercices', exact: true }).click()
  await page.waitForSelector('text=Mes programmes')
  await page.click('p:has-text("Muscu — Full body")')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.waitForSelector('text=Planification')

  // Trois positions, plus d'« Alternance » ni de « Rotation »
  for (const lbl of ['Jours fixes', 'Tous les X jours', 'Avant une autre']) await page.getByRole('button', { name: lbl, exact: true }).waitFor()
  if ((await page.getByRole('button', { name: 'Alternance', exact: true }).count()) > 0) throw new Error('« Alternance » ne doit plus être une position du sélecteur')
  if ((await page.locator('text=Rotation').count()) > 0) throw new Error('Le mot « Rotation » ne doit plus apparaître')

  // Aucun jour : avertissement, aucune case
  await page.waitForSelector('text=Aucun jour choisi')
  if ((await meCount()) !== 0) throw new Error('Sans jour coché, aucune case ne devrait être marquée')

  // L / J / S → l'aperçu suit
  for (const t of ['Lundi', 'Jeudi', 'Samedi']) await page.click(`button[title="${t}"]`)
  await page.waitForSelector('text=Prochaine fois')
  const n1 = await meCount()
  if (n1 !== expectedLJS) throw new Error(`Jours fixes L/J/S : ${n1} case(s) marquée(s), ${expectedLJS} attendue(s)`)
  await page.screenshot({ path: 'screenshots/planif-01-jours-fixes.png' })

  // + Ajouter → HIIT en cran B : cases bordées + légende + « Commencer par »
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.locator('select:has-text("Choisir une séance")').selectOption({ label: 'HIIT — Cardio express' })
  await page.waitForSelector('button:has-text("HIIT — Cardio express")')
  await page.waitForSelector('text=Commencer par')
  await page.waitForSelector('div:has(> span:text-is("Aperçu · 2 semaines")) >> text=HIIT — Cardio express')
  const me2 = await meCount()
  const other2 = await otherCount()
  if (me2 + other2 !== expectedLJS || other2 === 0) throw new Error(`Alternance A/B : ${me2} + ${other2} cases pour ${expectedLJS} jours L/J/S`)
  await page.screenshot({ path: 'screenshots/planif-02-alternance.png' })

  // Commencer par B : la première occurrence à venir passe au HIIT, avant tout enregistrement
  const firstBefore = await cells().evaluateAll((els) => els.findIndex((e) => e.classList.contains('bg-sage-500')))
  await page.getByRole('button', { name: 'B', exact: true }).click()
  await page.waitForFunction(
    (idx) => {
      const els = [...document.querySelectorAll('.grid-cols-7 > span:nth-child(n+8)')]
      return els[idx] && els[idx].classList.contains('border')
    },
    firstBefore,
  )
  await page.screenshot({ path: 'screenshots/planif-03-commencer-par-B.png' })

  // Tous les X jours : la cadence se lit dans l'aperçu (2 jours → 7 ou 8 cases sur 14 moins le passé)
  await page.getByRole('button', { name: 'Tous les X jours', exact: true }).click()
  await page.waitForSelector('text=à partir du')
  await page.waitForSelector('text=Prochaine fois')
  const me3 = await meCount()
  const other3 = await otherCount()
  if (me3 + other3 < 3) throw new Error(`Tous les 2 jours : seulement ${me3 + other3} case(s) marquée(s)`)

  // Retour Jours fixes, tout décoché : avertissement, et l'enregistrement ne cache aucune cadence
  await page.getByRole('button', { name: 'Jours fixes', exact: true }).click()
  for (const t of ['Lundi', 'Jeudi', 'Samedi']) await page.click(`button[title="${t}"]`)
  await page.waitForSelector('text=Aucun jour choisi')
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')
  const when = await page.locator('button:has(p:text-is("Muscu — Full body")) span.truncate').innerText()
  if (!/non planifié/i.test(when)) throw new Error(`Sans jour coché, la carte devrait dire « Non planifié », trouvé : ${JSON.stringify(when)}`)

  console.log('PLANIF-UI OK — trois positions, alternance A/B, Commencer par, aperçu calculé, aucune cadence cachée')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: 'screenshots/99-echec-planif.png' })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
