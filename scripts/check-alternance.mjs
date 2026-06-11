// Vérifie l'alternance multiple : nettoyage des jours fixes des membres,
// cycle partagé modifiable des deux côtés, et réparation des anciennes
// données « bidirectionnelles » corrompues (deux propriétaires concurrents).
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})
page.on('dialog', (d) => d.accept())

const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('elan-data-v1')))
const sessionByName = async (name) => {
  const d = await data()
  return d.sessions.find((s) => s.name.includes(name))
}

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // --- Donner des jours fixes au HIIT via le planning (ils devront être nettoyés)
  await page.click('text=Planning')
  await page.click('[aria-label="HIIT — Cardio express — Lundi"]')
  await page.waitForSelector('[aria-label="HIIT — Cardio express — Lundi"][aria-pressed="true"]')

  // --- Vélo : tous les 2 jours, en alternance avec HIIT puis Full body
  await page.click('text=Exercices')
  await page.waitForSelector('text=Bibliothèque')
  await page.click('p:has-text("Vélo d’appartement")')
  await page.waitForSelector('text=Planification')
  await page.getByRole('button', { name: 'Tous les X jours', exact: true }).click()
  await page.waitForSelector('text=À partir du')
  await page.locator('select').first().selectOption({ label: '🔥 HIIT — Cardio express' })
  await page.waitForSelector('text=Les séances tournent')
  await page.locator('select').first().selectOption({ label: '💪 Muscu — Full body' })
  await page.waitForSelector('button:has-text("Muscu — Full body")')
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=en alternance avec HIIT')

  // --- Données : vélo propriétaire du cycle, membres nettoyés (ni repeat ni jours fixes)
  const velo = await sessionByName('appartement')
  const hiit = await sessionByName('HIIT')
  const full = await sessionByName('Full body')
  if (!velo.repeat || velo.repeat.alternates.join() !== [hiit.id, full.id].join())
    throw new Error('Le vélo devrait posséder le cycle [HIIT, Full body]')
  if (hiit.repeat) throw new Error('Le HIIT ne devrait plus avoir de repeat propre')
  if ((hiit.days ?? []).length)
    throw new Error('Les jours fixes du HIIT devraient être nettoyés, trouvé : ' + hiit.days.join(','))
  if ((full.days ?? []).length || full.repeat) throw new Error('Full body devrait être nettoyé (membre du cycle)')

  // --- Côté membre : la fiche du HIIT montre le cycle complet et la re-sauvegarde le préserve
  await page.click('p:has-text("HIIT — Cardio express")')
  await page.waitForSelector('text=Planification')
  await page.waitForSelector('button:has-text("Vélo d’appartement")')
  await page.waitForSelector('button:has-text("Muscu — Full body")')
  await page.screenshot({ path: 'screenshots/20-alternance-bidirectionnelle.png' })
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Bibliothèque')
  const velo2 = await sessionByName('appartement')
  if (!velo2.repeat || velo2.repeat.alternates.join() !== [hiit.id, full.id].join())
    throw new Error('Après sauvegarde du HIIT, le cycle devrait rester [vélo ★, HIIT, Full body]')

  // --- Réparation des anciennes données « bidirectionnelles » (deux propriétaires concurrents)
  await page.evaluate(
    ({ hiitId, veloId, fullId, start }) => {
      const d = JSON.parse(localStorage.getItem('elan-data-v1'))
      const h = d.sessions.find((s) => s.id === hiitId)
      h.repeat = { everyDays: 2, startDate: start, alternates: [veloId, fullId] }
      localStorage.setItem('elan-data-v1', JSON.stringify(d))
    },
    { hiitId: hiit.id, veloId: velo.id, fullId: full.id, start: velo2.repeat.startDate },
  )
  await page.reload()
  await page.waitForSelector('text=Bibliothèque')
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.waitForSelector('text=Séance libre')
  // À la lecture : un seul cycle canonique → seul le vélo est planifié aujourd'hui (pas de doublon HIIT)
  await page.waitForSelector('p:has-text("Vélo d’appartement")')
  const hiitCards = await page.locator('main p:text-is("HIIT — Cardio express")').count()
  if (hiitCards > 0) throw new Error('Le HIIT ne devrait pas être planifié aujourd’hui (doublon du cycle corrompu)')
  // À l'écriture : re-sauver le vélo répare les données (le repeat parasite du HIIT disparaît)
  await page.click('text=Exercices')
  await page.waitForSelector('text=Bibliothèque')
  await page.click('p:has-text("Vélo d’appartement")')
  await page.waitForSelector('text=Planification')
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Bibliothèque')
  const hiit3 = await sessionByName('HIIT')
  if (hiit3.repeat) throw new Error('La re-sauvegarde du vélo devrait retirer le repeat parasite du HIIT')

  console.log('ALTERNANCE OK — cycle partagé, jours fixes nettoyés, données corrompues réparées')
  if (errors.length) {
    console.error('ERREURS :')
    for (const e of errors) console.error(' -', e)
    process.exitCode = 1
  }
} catch (e) {
  await page.screenshot({ path: 'screenshots/99-echec-alternance.png' })
  console.error('ÉCHEC :', e.message)
  if (errors.length) for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
