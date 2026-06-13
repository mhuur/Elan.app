// Vérifie l'onglet Planning : navigation semaine par semaine avec dates (comme « Plan »),
// section « Running » du plan alignée par DATE sur la semaine affichée (pas d'illusion de
// retard avant le départ), déplaçable par drag & drop, sans casser l'ordre des sections.
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

const yOf = async (sel) => {
  const box = await page.locator(sel).first().boundingBox()
  return box ? box.y : Number.NaN
}

// Glisse une poignée d'en-tête de section jusqu'à l'ordonnée `destY`
const drag = async (handleSel, destY) => {
  const h = await page.locator(handleSel).boundingBox()
  const cx = h.x + h.width / 2
  const cy = h.y + h.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx, cy - 8, { steps: 4 })
  await page.waitForTimeout(60)
  const steps = 16
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx, cy - 8 + ((destY - (cy - 8)) * i) / steps, { steps: 2 })
    await page.waitForTimeout(15)
  }
  await page.waitForTimeout(120)
  await page.mouse.up()
  await page.waitForTimeout(250)
}

// Depuis la semaine en cours (avant le départ du plan), saute à la 1re semaine du plan
const gotoPlanWeek = async () => {
  await page.click('button:has-text("Le plan semi démarre")')
  await page.waitForSelector('h2:has-text("Running")')
}

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // === 1) Semaine en cours : navigateur + dates, AUCUNE séance du plan (le plan démarre lundi) ===
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await page.waitForSelector('text=Cette semaine')
  await page.waitForSelector('button:has-text("Le plan semi démarre")')
  if ((await page.locator('text=Footing 6 km').count()) > 0) {
    throw new Error('Le plan ne devrait pas apparaître sur la semaine en cours (illusion de retard)')
  }
  await page.screenshot({ path: `${DIR}/44-planning-cette-semaine.png`, fullPage: true })

  // === 2) Navigation vers la semaine du plan : dates + section « Running » alignée ===
  await gotoPlanWeek()
  await page.waitForSelector('text=15 juin') // semaine du 15 au 21 juin
  await page.waitForSelector('text=Footing 6 km')
  await page.waitForSelector('text=Sortie longue')
  await page.screenshot({ path: `${DIR}/45-planning-plan.png`, fullPage: true })

  // Fiche Campus à l'ouverture d'une séance du plan
  await page.click('text=Footing 6 km')
  await page.waitForSelector('[role="dialog"] >> text=Valider ma séance')
  await page.screenshot({ path: `${DIR}/46-planning-plan-seance.png` })
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"]', { state: 'detached' }).catch(() => {})

  // === 3) Cas réel : sections « Routine matinale » + « Cardio », PAS de groupe « Running » à
  //        l'utilisateur → le plan crée la sienne, déplaçable ; on remonte Routine au-dessus ===
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('elan-plan-anchor'))
      .forEach((k) => localStorage.removeItem(k))
    const raw = localStorage.getItem('elan-data-v1')
    if (!raw) return
    const data = JSON.parse(raw)
    const groupFor = (s) => {
      const n = (s.name || '').toLowerCase()
      if (n.includes('routine')) return 'Routine matinale'
      if (s.category === 'velo' || s.category === 'hiit') return 'Cardio'
      return ''
    }
    const rank = { 'Routine matinale': 0, Cardio: 1, '': 2 }
    data.sessions.sort((a, b) => rank[groupFor(a)] - rank[groupFor(b)])
    let order = 0
    for (const s of data.sessions) {
      s.group = groupFor(s)
      s.sortOrder = order++
    }
    localStorage.setItem('elan-data-v1', JSON.stringify(data))
  })
  await page.reload()
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await gotoPlanWeek()

  await page.waitForSelector('h2:has-text("Routine matinale")')
  await page.waitForSelector('h2:has-text("Cardio")')
  await page.waitForSelector('[aria-label="Déplacer la section Running"]') // la section plan a une poignée
  const yRunning0 = await yOf('h2:has-text("Running")')
  const yRoutine0 = await yOf('h2:has-text("Routine matinale")')
  const yFooting0 = await yOf('text=Footing 6 km')
  if (!(yRunning0 < yFooting0 && yFooting0 < yRoutine0)) {
    throw new Error(`Section plan mal placée par défaut — Running=${yRunning0} Footing=${yFooting0} Routine=${yRoutine0}`)
  }
  await page.screenshot({ path: `${DIR}/47-planning-sections.png`, fullPage: true })

  // Remonter « Routine matinale » au-dessus de « Running » (le besoin exprimé)
  await drag('[aria-label="Déplacer la section Routine matinale"]', yRunning0 - 24)
  let yRoutine2 = await yOf('h2:has-text("Routine matinale")')
  let yRunning2 = await yOf('h2:has-text("Running")')
  if (!(yRoutine2 < yRunning2)) {
    throw new Error(`Impossible de remonter Routine au-dessus de Running — Routine=${yRoutine2} Running=${yRunning2}`)
  }

  // Persistance : recharger, revenir sur la semaine du plan, l'ordre tient
  await page.reload()
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await gotoPlanWeek()
  yRoutine2 = await yOf('h2:has-text("Routine matinale")')
  yRunning2 = await yOf('h2:has-text("Running")')
  if (!(yRoutine2 < yRunning2)) {
    throw new Error(`Position non persistée — Routine=${yRoutine2} Running=${yRunning2}`)
  }
  await page.screenshot({ path: `${DIR}/48-planning-sections-reordered.png`, fullPage: true })

  console.log('PLANNING OK — navigation + dates, plan aligné par date (pas de retard), section plan déplaçable et persistée')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-planning-plan.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
