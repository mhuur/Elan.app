// Vérifie « Les jours sans » (oct. 2026) : une course posée lun/mer/ven/dim, puis le HIIT en
// « Jours choisis » + « Les jours sans » la course + « En alternance avec » le vélo. Attendu :
// cases mar/jeu/sam cochées et figées, HIIT et vélo jamais un jour de course et alternés d'une
// fois sur l'autre (sur deux semaines de l'aperçu), libellé « Jours sans … » au Planning ; puis
// la course déplacée (lun/mar/jeu/sam) entraîne le HIIT et le vélo sur mer/ven/dim.
// Prérequis : `npm run dev:demo` lancé.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const DIR = 'screenshots'
mkdirSync(DIR, { recursive: true })
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
page.on('dialog', (d) => d.accept())
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

const assert = (ok, msg) => {
  if (!ok) throw new Error(msg)
}

async function openProgram(name) {
  await page.getByRole('link', { name: 'Exercices', exact: true }).click()
  await page.waitForSelector('text=Mes programmes')
  await page.click(`p:has-text("${name}")`)
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.waitForSelector('text=Planification')
}

/** Coche exactement ces jours (indices 0 = lundi) dans les cases de la fiche */
async function setDays(wanted) {
  for (let d = 0; d < 7; d++) {
    const btn = page.locator(`button[title="${DAYS[d]}"]`).first()
    const on = (await btn.getAttribute('aria-pressed')) === 'true'
    if (on !== wanted.includes(d)) await btn.click()
  }
}

/** Jours prévus (anneau) d'une ligne de l'aperçu, semaine affichée */
async function plannedOf(title) {
  const row = page.locator('[data-preview] [data-session]').filter({ has: page.locator(`[data-title]:text-is("${title}")`) })
  const states = await row.locator('span[data-state]').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  return states.map((s, d) => (s !== 'none' ? d : -1)).filter((d) => d >= 0)
}

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // 1. La course : Sortie courte lun / mer / ven / dim
  await openProgram('Sortie courte')
  await setDays([0, 2, 4, 6])
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')

  // 2. Le HIIT : les jours sans la course, en alternance avec le vélo
  await openProgram('HIIT — Cardio express')
  await page.locator('select[aria-label="Les jours sans"]').selectOption({ label: 'Sortie courte' })
  await page.waitForSelector('[aria-label="Retirer les jours sans"]')
  for (let d = 0; d < 7; d++) {
    const btn = page.locator(`button[title="${DAYS[d]}"]`).first()
    const on = (await btn.getAttribute('aria-pressed')) === 'true'
    assert(on === [1, 3, 5].includes(d), `case ${DAYS[d]} : ${on ? 'cochée' : 'décochée'}, attendu l'inverse`)
    assert(await btn.isDisabled(), `case ${DAYS[d]} modifiable alors que « Les jours sans » est choisi`)
  }
  await page.locator('select[aria-label="En alternance avec"]').selectOption({ label: 'Vélo d’appartement' })
  await page.waitForSelector("[aria-label=\"Retirer l'alternance\"]")
  // Le partenaire n'est plus proposé dans « Les jours sans », ni l'inverse
  await page.screenshot({ path: `${DIR}/jours-sans-fiche.png`, fullPage: true })

  // Deux semaines d'aperçu : 6 jours libres, HIIT et vélo alternés, jamais un jour de course
  const seq = []
  for (let w = 0; w < 2; w++) {
    const hiit = await plannedOf('HIIT — Cardio express')
    const velo = await plannedOf('Vélo d’appartement')
    const run = await plannedOf('Sortie courte')
    assert(JSON.stringify(run) === '[0,2,4,6]', `course semaine ${w + 1} : ${run}`)
    for (const d of [...hiit, ...velo]) assert(![0, 2, 4, 6].includes(d), `HIIT/vélo un jour de course (${DAYS[d]})`)
    assert(!hiit.some((d) => velo.includes(d)), 'HIIT et vélo le même jour')
    for (const d of [1, 3, 5]) {
      if (hiit.includes(d)) seq.push('H')
      else if (velo.includes(d)) seq.push('V')
    }
    await page.click('[aria-label="Semaine suivante"]')
  }
  // Semaine en cours : les jours déjà passés ne portent pas d'anneau, on lit la suite
  assert(seq.length >= 3, `trop peu d'occurrences lues : ${seq.join('')}`)
  for (let i = 1; i < seq.length; i++) assert(seq[i] !== seq[i - 1], `pas d'alternance : ${seq.join(' ')}`)

  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await page.waitForSelector('text=Cette semaine')
  await page.waitForSelector('text=/Jours sans Sortie courte \\(Mar · Jeu · Sam\\)/')
  await page.screenshot({ path: `${DIR}/jours-sans-planning.png`, fullPage: true })

  // 3. La course change de jours : le HIIT et le vélo suivent sans retoucher leur fiche
  await openProgram('Sortie courte')
  await setDays([0, 1, 3, 5])
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await page.waitForSelector('text=/Jours sans Sortie courte \\(Mer · Ven · Dim\\)/')

  // 4. Retour dans la fiche du HIIT : le choix est relu, les cases suivent la course
  await openProgram('HIIT — Cardio express')
  await page.waitForSelector('[aria-label="Retirer les jours sans"]')
  const onNow = []
  for (let d = 0; d < 7; d++) {
    if ((await page.locator(`button[title="${DAYS[d]}"]`).first().getAttribute('aria-pressed')) === 'true') onNow.push(d)
  }
  assert(JSON.stringify(onNow) === '[2,4,6]', `cases relues : ${onNow}`)

  console.log(`JOURS-SANS OK — HIIT/vélo sur mar/jeu/sam (${seq.join(' ')}), puis mer/ven/dim après déplacement de la course`)
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-jours-sans.png`, fullPage: true })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
