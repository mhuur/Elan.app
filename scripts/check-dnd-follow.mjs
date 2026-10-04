// Vérif du glisser-déposer (oct. 2026, retour utilisateur : « l'encadré est décalé par
// rapport à l'accroche de la souris ») : sur Aujourd'hui, le Planning (ligne et section)
// et la fiche séance (ligne repliée, puis avec une ligne dépliée au-dessus), en mobile
// et en desktop, la poignée de la copie flottante doit rester sous le pointeur.
// Avant correction : ~200 px d'écart dans la fiche séance sur desktop (DragOverlay rendu
// dans une carte `backdrop-filter`). Prérequis : `npm run dev:demo`. Captures `screenshots/dnd-*.png`.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const MAX_GAP = 8 // px entre le centre de la poignée de la copie et le pointeur

const browser = await chromium.launch()
const failures = []

async function probe(page, name, handleSel, nth = 0) {
  const h = page.locator(handleSel).nth(nth)
  await h.scrollIntoViewIfNeeded()
  const box = await h.boundingBox()
  const x0 = box.x + box.width / 2
  const y0 = box.y + box.height / 2
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x0 + 4 * i, y0 + 6 * i)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(250)
  const [mx, my] = [x0 + 48, y0 + 72]
  // La copie flottante : élément `position: fixed` déplacé par translate3d, rendu dans <body>
  const r = await page.evaluate(() => {
    const el = [...document.body.querySelectorAll('*')].find(
      (e) => getComputedStyle(e).position === 'fixed' && e.style.transform?.includes('translate3d'),
    )
    if (!el) return null
    const q = (el.querySelector('svg.lucide-grip-vertical') ?? el).getBoundingClientRect()
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 }
  })
  await page.screenshot({ path: `screenshots/dnd-${name}.png` })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const gap = r ? Math.hypot(r.x - mx, r.y - my) : Infinity
  console.log(`${name.padEnd(16)} écart ${r ? gap.toFixed(0) : '∅ (aucune copie flottante)'} px`)
  if (gap > MAX_GAP) failures.push(`${name} : ${r ? gap.toFixed(0) + ' px' : 'pas de copie flottante'}`)
}

try {
  for (const vp of [
    { width: 390, height: 844, tag: 'mob' },
    { width: 1400, height: 900, tag: 'desk' },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    await page.goto(BASE)
    await page.waitForSelector('text=Routine matinale', { timeout: 20000 })
    await probe(page, `today-${vp.tag}`, '[aria-label^="Déplacer "]')
    await page.getByRole('link', { name: 'Planning' }).click()
    await page.waitForTimeout(500)
    await probe(page, `planning-${vp.tag}`, '[aria-label^="Déplacer "]:not([aria-label*="section"])')
    await probe(page, `section-${vp.tag}`, '[aria-label^="Déplacer la section"]')
    await page.getByRole('link', { name: 'Exercices', exact: true }).click()
    await page.waitForSelector('text=Mes programmes')
    await page.click('p:has-text("Muscu — Full body")')
    await page.getByRole('button', { name: 'Modifier', exact: true }).click()
    await page.waitForSelector('text=Planification')
    await probe(page, `form-${vp.tag}`, '[aria-label^="Réordonner"]')
    await page.click('div.rounded-md p.truncate:text-is("Squats")') // ligne dépliée au-dessus
    await page.waitForTimeout(300)
    await probe(page, `form-open-${vp.tag}`, '[aria-label^="Réordonner"]', 2)
    await page.close()
  }
  if (failures.length) {
    console.error('ÉCHEC — copie décalée :\n - ' + failures.join('\n - '))
    process.exitCode = 1
  } else console.log(`DND-FOLLOW OK — la copie reste sous le pointeur (≤ ${MAX_GAP} px) sur Aujourd'hui, Planning et fiche séance`)
} catch (e) {
  console.error('ÉCHEC :', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
