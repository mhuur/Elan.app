// Vérifie le réordonnancement des cartes d'Aujourd'hui (sept. 2026) : glisser une carte
// par sa poignée change l'ordre, l'ordre survit au rechargement, s'applique aux jours
// suivants et se retrouve dans le Planning (même source : sortOrder + ancre « Running »).
// Prérequis : `npm run dev:demo` lancé, puis `node scripts/check-today-order.mjs`
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

const handles = () => page.getByRole('button', { name: /^Déplacer / })
const cardOrder = async () => (await handles().evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').slice(9))))

/** Glisse la poignée `from` au-dessus de la carte `to` (souris : PointerSensor, seuil 5 px) */
async function drag(from, to) {
  const a = await handles().nth(from).boundingBox()
  const b = await handles().nth(to).boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 - 10, { steps: 3 })
  await page.mouse.move(b.x + b.width / 2, b.y + 4, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(600)
}

let ok = true
const fail = (m) => {
  ok = false
  console.log('ÉCHEC — ' + m)
}

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })
  // Cherche, dans les 14 prochains jours, un jour à au moins 2 cartes
  let offset = 0
  for (; offset < 14 && (await handles().count()) < 2; offset++) await page.getByLabel('Jour suivant').click()
  const before = await cardOrder()
  console.log('avant  :', before.join(' | '))
  if (before.length < 2) throw new Error('aucun jour à 2 cartes sur 14 jours')

  const last = before.length - 1
  await drag(last, 0)
  const after = await cardOrder()
  console.log('après  :', after.join(' | '))
  if (after[0] !== before[last]) fail(`« ${before[last]} » devait passer en tête`)

  // Rechargement : l'ordre est persisté
  await page.reload()
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 }).catch(() => {})
  for (let i = 0; i < offset; i++) await page.getByLabel('Jour suivant').click()
  const reloaded = await cardOrder()
  console.log('rechargé :', reloaded.join(' | '))
  if (reloaded.join('|') !== after.join('|')) fail('ordre perdu au rechargement')

  // Jours suivants : deux cartes déjà vues gardent leur ordre relatif
  let checkedNext = false
  for (let d = 1; d <= 14 && !checkedNext; d++) {
    await page.getByLabel('Jour suivant').click()
    const o = await cardOrder()
    const common = after.filter((n) => o.includes(n))
    if (common.length >= 2) {
      checkedNext = true
      const rel = o.filter((n) => common.includes(n))
      console.log(`J+${d}   :`, o.join(' | '))
      if (rel.join('|') !== common.join('|')) fail('ordre non repris les jours suivants')
    }
  }
  if (!checkedNext) console.log('(pas d’autre jour avec deux des mêmes cartes : contrôle J+n sauté)')

  // Planning : même ordre relatif entre les cartes déplacées
  await page.getByRole('link', { name: 'Planning', exact: true }).click()
  await page.waitForTimeout(800)
  const planningText = await page.locator('main, body').first().innerText()
  const pos = (n) => planningText.toUpperCase().indexOf(n.toUpperCase())
  const seen = after.filter((n) => pos(n) >= 0)
  const sorted = [...seen].sort((x, y) => pos(x) - pos(y))
  console.log('Planning :', sorted.join(' | '))
  if (seen.length >= 2 && sorted.join('|') !== seen.join('|')) fail('le Planning n’a pas le même ordre')
  await page.screenshot({ path: 'screenshots/today-order-planning.png' })
} catch (e) {
  fail(e.message)
}
if (errors.length) fail(errors.join('\n'))
console.log(ok ? 'TODAY-ORDER OK — glisser, persistance, jours suivants, Planning' : 'TODAY-ORDER ÉCHEC')
await browser.close()
process.exit(ok ? 0 : 1)
