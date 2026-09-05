// Vérifie la section « Planification » de la fiche séance (refonte sept. 2026) : le « quand »
// à trois positions, la section « En alternance avec » (crans A, B…), « Commencer par », et
// surtout l'APERÇU — la grille du Planning (une ligne par séance, un rond par jour, semaine
// navigable ‹ ›), avec TOUT ce qui est déjà posé, calculée par la même fonction que le Planning :
//  - la fiche en cours est la première ligne (teintée), les autres séances planifiées suivent
//    (« Routine matinale » = 7 anneaux), puis les courses du plan semi ;
//  - Jours fixes L/J/S → 3 anneaux sur la ligne de la fiche (et « Prochaine fois » s'affiche) ;
//  - + Ajouter → HIIT en cran B → une ligne HIIT apparaît, les anneaux se partagent ;
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

// Lignes de l'aperçu : la fiche en cours est la première ; les autres se retrouvent par leur titre
const selfRow = () => page.locator('[data-preview] [data-session]').first()
const rowOf = (name) => page.locator(`[data-preview] [data-session]:has(span.font-display:text-is("${name}"))`)
// Anneaux « prévu » d'une ligne (DayDot planned = border-2) : les 7 cellules après le nom
const rings = (loc) => loc.locator(':scope > span > span.border-2').count()
const firstRing = (loc) =>
  loc.locator(':scope > span').evaluateAll((els) => els.findIndex((e) => e.firstElementChild?.classList.contains('border-2')))
const nextWeek = async () => {
  await page.getByRole('button', { name: 'Semaine suivante', exact: true }).click()
  await page.waitForSelector('text=Sem. du')
}
const thisWeek = async () => {
  await page.getByRole('button', { name: 'Semaine précédente', exact: true }).click()
  await page.waitForSelector('text=Cette semaine')
}
// Anneaux d'une ligne sur cette semaine + la suivante (une alternance A/B se lit sur deux semaines)
const ringsTwoWeeks = async (loc) => {
  const a = await rings(loc)
  await nextWeek()
  const b = await rings(loc)
  await thisWeek()
  return a + b
}

// Jours L/J/S restants (aujourd'hui inclus) sur cette semaine et la suivante, calculés ici
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
const mondayStr = monday.toISOString().slice(0, 10)
const inPlanSemi = mondayStr >= '2026-06-08' && mondayStr <= '2026-09-28'

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

  // L'aperçu est la grille du Planning : la fiche en tête, les autres séances planifiées, le plan
  await page.waitForSelector('text=Cette semaine')
  const firstTitle = await selfRow().locator('span.font-display').innerText()
  if (firstTitle !== 'MUSCU — FULL BODY') throw new Error(`La première ligne de l'aperçu doit être la fiche en cours, trouvé : ${JSON.stringify(firstTitle)}`)
  if ((await rings(rowOf('Routine matinale'))) !== 7) throw new Error('« Routine matinale » (tous les jours) doit montrer 7 anneaux dans l\'aperçu')
  if (inPlanSemi && (await page.locator('[data-preview] [data-session^="plan-"]').count()) === 0) throw new Error('Les courses du plan semi de la semaine doivent figurer dans l\'aperçu')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (overflow > 0) throw new Error(`Débordement horizontal de ${overflow}px avec l'aperçu`)

  // Aucun jour : avertissement, aucun anneau sur la ligne de la fiche
  await page.waitForSelector('text=Aucun jour choisi')
  if ((await rings(selfRow())) !== 0) throw new Error('Sans jour coché, la ligne de la fiche ne devrait porter aucun anneau')

  // L / J / S → l'aperçu suit (semaine complète affichée, passé compris : 3 anneaux)
  for (const t of ['Lundi', 'Jeudi', 'Samedi']) await page.click(`button[title="${t}"]`)
  await page.waitForSelector('text=Prochaine fois')
  const n1 = await rings(selfRow())
  if (n1 !== 3) throw new Error(`Jours fixes L/J/S : ${n1} anneau(x) sur la ligne de la fiche, 3 attendus`)
  await page.screenshot({ path: 'screenshots/planif-01-jours-fixes.png' })

  // + Ajouter → HIIT en cran B : une ligne HIIT dans l'aperçu, anneaux partagés + « Commencer par »
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.locator('select:has-text("Choisir une séance")').selectOption({ label: 'HIIT — Cardio express' })
  await page.waitForSelector('button:has-text("HIIT — Cardio express")')
  await page.waitForSelector('text=Commencer par')
  await rowOf('HIIT — Cardio express').waitFor()
  const me2 = await ringsTwoWeeks(selfRow())
  const other2 = await ringsTwoWeeks(rowOf('HIIT — Cardio express'))
  if (me2 + other2 !== expectedLJS || other2 === 0) throw new Error(`Alternance A/B : ${me2} + ${other2} anneaux pour ${expectedLJS} jours L/J/S à venir sur deux semaines`)
  await page.screenshot({ path: 'screenshots/planif-02-alternance.png', fullPage: true })

  // Commencer par B : la première occurrence à venir passe au HIIT, avant tout enregistrement
  let idx = await firstRing(selfRow())
  let onNext = false
  if (idx < 0) {
    await nextWeek()
    onNext = true
    idx = await firstRing(selfRow())
  }
  if (idx < 0) throw new Error('Aucune occurrence à venir de la fiche sur deux semaines')
  await page.getByRole('button', { name: 'B', exact: true }).click()
  await page.waitForFunction(
    (i) => {
      const rows = [...document.querySelectorAll('[data-preview] [data-session]')]
      const hiit = rows.find((r) => r.querySelector('span.font-display')?.textContent === 'HIIT — Cardio express')
      const cell = hiit?.querySelectorAll(':scope > span')[i]
      return !!cell?.firstElementChild?.classList.contains('border-2')
    },
    idx,
  )
  await page.screenshot({ path: 'screenshots/planif-03-commencer-par-B.png' })
  if (onNext) await thisWeek()

  // Tous les X jours : la cadence se lit dans l'aperçu (2 jours → au moins 3 anneaux sur deux semaines)
  await page.getByRole('button', { name: 'Tous les X jours', exact: true }).click()
  await page.waitForSelector('text=à partir du')
  await page.waitForSelector('text=Prochaine fois')
  const me3 = await ringsTwoWeeks(selfRow())
  const other3 = await ringsTwoWeeks(rowOf('HIIT — Cardio express'))
  if (me3 + other3 < 3) throw new Error(`Tous les 2 jours : seulement ${me3 + other3} anneau(x) sur deux semaines`)

  // Retour Jours fixes, tout décoché : avertissement, et l'enregistrement ne cache aucune cadence
  await page.getByRole('button', { name: 'Jours fixes', exact: true }).click()
  for (const t of ['Lundi', 'Jeudi', 'Samedi']) await page.click(`button[title="${t}"]`)
  await page.waitForSelector('text=Aucun jour choisi')
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')
  const when = await page.locator('button:has(p:text-is("Muscu — Full body")) span.truncate').innerText()
  if (!/non planifié/i.test(when)) throw new Error(`Sans jour coché, la carte devrait dire « Non planifié », trouvé : ${JSON.stringify(when)}`)

  console.log('PLANIF-UI OK — trois positions, aperçu = grille du Planning avec tout le reste, alternance A/B, Commencer par, aucune cadence cachée')
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
