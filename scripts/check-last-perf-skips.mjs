// Vérifie que le bloc « Dernière fois » montre la DERNIÈRE séance VALIDÉE de ce type, même si des
// séances ont été sautées entre-temps. On injecte deux séances vélo validées (3 juin puis 10 juin)
// et, en ouvrant la séance le 17 juin (rien fait entre le 10 et le 17), le bloc doit afficher la
// perf, le smiley et la note du 10 juin — jamais celles, plus anciennes, du 3 juin.
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

  // Deux séances vélo validées : une ancienne (3 juin) et une plus récente (10 juin)
  await page.evaluate(() => {
    const KEY = 'elan-data-v1'
    const data = JSON.parse(localStorage.getItem(KEY) || '{}')
    const velo = (data.sessions || []).find((s) => s.category === 'velo')
    const m = (dur, dist) => [
      { key: 'duration', label: 'Durée', unit: 'min', value: dur },
      { key: 'distance', label: 'Distance', unit: 'km', value: dist },
    ]
    data.logs = data.logs || []
    data.logs.push(
      { id: 'log-vieux', date: '2026-06-03', sessionId: velo.id, sessionName: velo.name, category: 'velo', metrics: m(30, 15), feeling: 2, note: 'vieille perf', createdAt: 1000 },
      { id: 'log-recent', date: '2026-06-10', sessionId: velo.id, sessionName: velo.name, category: 'velo', metrics: m(45, 22), feeling: 3, note: 'recente perf', createdAt: 2000 },
    )
    localStorage.setItem(KEY, JSON.stringify(data))
  })
  await page.reload()
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // Ouvrir la séance vélo aujourd'hui (17 juin) — rien fait entre le 10 et le 17
  await page.click('text=+ Séance libre')
  await page.locator('[role="dialog"] button:has-text("appartement")').click()
  await page.waitForSelector('text=Dernière fois')

  // Le bloc doit montrer la séance du 10 juin (la plus récente validée)…
  await page.waitForSelector('[role="dialog"] >> text=il y a 1 sem.')
  await page.waitForSelector('[role="dialog"] >> text=45 min')
  await page.waitForSelector('[role="dialog"] >> text=recente perf')
  await page.waitForSelector('[role="dialog"] >> text=😐')
  // …et surtout PAS celle du 3 juin
  if (await page.locator('[role="dialog"] >> text=vieille perf').count()) {
    throw new Error('Le bloc affiche la vieille séance (3 juin) au lieu de la dernière (10 juin)')
  }
  await page.screenshot({ path: `${DIR}/52-derniere-validee-malgre-sauts.png` })

  console.log('LAST-PERF-SKIPS OK — le bloc montre la dernière séance validée, malgré les sauts')
  if (errors.length) {
    console.error('ERREURS DÉTECTÉES :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: `${DIR}/99-echec-last-perf-skips.png` })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
