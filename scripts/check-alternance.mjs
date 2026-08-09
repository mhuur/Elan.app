// Vérifie l'alternance par groupes de jours : plusieurs séances le même jour
// (ex. Vélo + Full body) en alternance avec un autre jour (HIIT), nettoyage
// des jours fixes des membres, cycle partagé modifiable des deux côtés, et
// réparation des anciennes données « bidirectionnelles » corrompues.
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
const stepsOf = (s) => (s.repeat?.steps ?? []).map((st) => st.ids.join(',')).join('|')

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // --- Donner des jours fixes au HIIT via sa fiche (ils devront être nettoyés par l'alternance)
  await page.getByRole('link', { name: 'Séries' }).click()
  await page.waitForSelector('text=Bibliothèque')
  await page.click('p:has-text("HIIT — Cardio express")')
  await page.waitForSelector('text=Planification')
  await page.click('button[title="Lundi"]')
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Bibliothèque')
  const hiit0 = await sessionByName('HIIT')
  if (!(hiit0.days ?? []).includes(0)) throw new Error('Le HIIT devrait avoir le lundi en jour fixe')

  // --- Vélo : tous les 2 jours ; jour 1 = Vélo + Full body, jour 2 = HIIT
  await page.getByRole('link', { name: 'Séries' }).click()
  await page.waitForSelector('text=Bibliothèque')
  await page.click('p:has-text("Vélo d’appartement")')
  await page.waitForSelector('text=Planification')
  await page.getByRole('button', { name: 'Tous les X jours', exact: true }).click()
  await page.waitForSelector('text=à partir du')
  // Le « + » du jour 1 ouvre le sélecteur ; Full body rejoint le même jour que le vélo
  await page.click('[aria-label="Ajouter une séance au jour 1"]')
  await page.locator('select:has-text("Choisir une séance")').selectOption({ label: 'Muscu — Full body' })
  await page.waitForSelector('button:has-text("Muscu — Full body")')
  await page.getByRole('button', { name: 'jour', exact: true }).click()
  await page.locator('select:has-text("Choisir une séance")').selectOption({ label: 'HIIT — Cardio express' }) // jour 2
  await page.waitForSelector('button:has-text("HIIT — Cardio express")')
  await page.screenshot({ path: 'screenshots/24-rotation-groupes.png' })
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=en alternance avec HIIT')

  // --- Données : vélo propriétaire de [Vélo+Full body | HIIT], membres nettoyés
  const velo = await sessionByName('appartement')
  const hiit = await sessionByName('HIIT')
  const full = await sessionByName('Full body')
  const expected = `${velo.id},${full.id}|${hiit.id}`
  if (stepsOf(velo) !== expected)
    throw new Error(`Le vélo devrait porter la rotation [Vélo+Full body | HIIT], trouvé : ${stepsOf(velo)}`)
  if (hiit.repeat || full.repeat) throw new Error('Les membres ne devraient plus avoir de repeat propre')
  if ((hiit.days ?? []).length)
    throw new Error('Les jours fixes du HIIT devraient être nettoyés, trouvé : ' + hiit.days.join(','))
  if ((full.days ?? []).length) throw new Error('Les jours fixes de Full body devraient être nettoyés')

  // --- Aujourd'hui (occurrence 0 = jour 1) : Vélo ET Full body planifiés ensemble, pas le HIIT
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.waitForSelector('text=Séance libre')
  await page.waitForSelector('main p:text-is("Vélo d’appartement")')
  await page.waitForSelector('main p:text-is("Muscu — Full body")')
  if ((await page.locator('main p:text-is("HIIT — Cardio express")').count()) > 0)
    throw new Error("Le HIIT ne devrait pas être planifié aujourd'hui (il est au jour 2)")
  await page.screenshot({ path: 'screenshots/25-deux-seances-meme-jour.png' })

  // --- Côté membre : la fiche du Full body montre toute la rotation, la re-sauvegarde la préserve
  await page.getByRole('link', { name: 'Séries' }).click()
  await page.waitForSelector('text=Bibliothèque')
  await page.click('p:has-text("Muscu — Full body")')
  await page.waitForSelector('text=Planification')
  await page.waitForSelector('button:has-text("Vélo d’appartement")')
  await page.waitForSelector('button:has-text("HIIT — Cardio express")')
  await page.screenshot({ path: 'screenshots/20-alternance-bidirectionnelle.png' })
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Bibliothèque')
  const velo2 = await sessionByName('appartement')
  if (stepsOf(velo2) !== expected)
    throw new Error(`Après sauvegarde du Full body, la rotation devrait être intacte, trouvé : ${stepsOf(velo2)}`)

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
  // À la lecture : un seul cycle canonique → pas de doublon HIIT aujourd'hui
  await page.waitForSelector('main p:text-is("Vélo d’appartement")')
  if ((await page.locator('main p:text-is("HIIT — Cardio express")').count()) > 0)
    throw new Error("Le HIIT ne devrait pas être planifié aujourd'hui (doublon du cycle corrompu)")
  // À l'écriture : re-sauver le vélo répare les données (le repeat parasite disparaît)
  await page.getByRole('link', { name: 'Séries' }).click()
  await page.waitForSelector('text=Bibliothèque')
  await page.click('p:has-text("Vélo d’appartement")')
  await page.waitForSelector('text=Planification')
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Bibliothèque')
  const hiit3 = await sessionByName('HIIT')
  if (hiit3.repeat) throw new Error('La re-sauvegarde du vélo devrait retirer le repeat parasite du HIIT')

  console.log('ALTERNANCE OK — groupes même jour, rotation partagée, jours fixes nettoyés, données réparées')
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
