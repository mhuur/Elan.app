// Vérifie l'alternance à partenaire unique (fiche simplifiée, sept. 2026) : Vélo tous les
// 2 jours en alternance avec le HIIT, nettoyage des jours fixes des membres, cycle partagé
// visible et re-sauvable depuis la fiche du membre, LECTURE des anciens cycles complexes
// (plusieurs séances le même jour — la fiche ne les crée plus mais les affiche en texte et
// les planifie toujours), et réparation des anciennes données « bidirectionnelles ».
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
const openForm = async (title) => {
  await page.getByRole('link', { name: 'Exercices', exact: true }).click()
  await page.waitForSelector('text=Mes programmes')
  await page.click(`p:has-text("${title}")`)
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.waitForSelector('text=Planification')
}
// La rangée « En alternance avec » de la fiche
const altRow = 'div:has(> span:text-is("En alternance avec"))'

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 })

  // --- Donner des jours fixes au HIIT via sa fiche (ils devront être nettoyés par l'alternance)
  await openForm('HIIT — Cardio express')
  await page.click('button[title="Lundi"]')
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')
  const hiit0 = await sessionByName('HIIT')
  if (!(hiit0.days ?? []).includes(0)) throw new Error('Le HIIT devrait avoir le lundi en jour fixe')

  // --- Vélo : tous les 2 jours, en alternance avec le HIIT (sélecteur « Aucune » → pastille)
  await openForm('Vélo d’appartement')
  await page.getByRole('button', { name: 'Tous les X jours', exact: true }).click()
  await page.waitForSelector('text=à partir du')
  if ((await page.getByRole('button', { name: 'Ajouter', exact: true }).count()) > 0) throw new Error('« + Ajouter » ne doit plus exister')
  await page.locator('select[aria-label="En alternance avec"]').selectOption({ label: 'HIIT — Cardio express' })
  await page.waitForSelector('[aria-label="Retirer l\'alternance"]')
  await page.waitForSelector(`${altRow}:has-text("HIIT — Cardio express")`)
  // « Commencer par » affiche les deux noms
  await page.getByRole('button', { name: 'Vélo d’appartement', exact: true }).waitFor()
  await page.getByRole('button', { name: 'HIIT — Cardio express', exact: true }).waitFor()
  await page.screenshot({ path: 'screenshots/24-alternance-partenaire.png' })
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=en alternance avec HIIT')

  // --- Données : vélo propriétaire de [Vélo | HIIT], membre nettoyé
  const velo = await sessionByName('appartement')
  const hiit = await sessionByName('HIIT')
  const full = await sessionByName('Full body')
  const expected = `${velo.id}|${hiit.id}`
  if (stepsOf(velo) !== expected) throw new Error(`Le vélo devrait porter la rotation [Vélo | HIIT], trouvé : ${stepsOf(velo)}`)
  if (hiit.repeat) throw new Error('Le membre ne devrait plus avoir de repeat propre')
  if ((hiit.days ?? []).length) throw new Error('Les jours fixes du HIIT devraient être nettoyés, trouvé : ' + hiit.days.join(','))

  // --- Aujourd'hui (occurrence 0) : Vélo planifié, pas le HIIT
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.waitForSelector('text=Séance libre')
  await page.waitForSelector('main p:text-is("Vélo d’appartement")')
  if ((await page.locator('main p:text-is("HIIT — Cardio express")').count()) > 0) throw new Error("Le HIIT ne devrait pas être planifié aujourd'hui (il est au cran 2)")

  // --- Côté membre : la fiche du HIIT montre la pastille Vélo, la re-sauvegarde préserve le cycle
  await openForm('HIIT — Cardio express')
  await page.waitForSelector(`${altRow}:has-text("Vélo d’appartement")`)
  await page.screenshot({ path: 'screenshots/20-alternance-bidirectionnelle.png' })
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')
  const velo2 = await sessionByName('appartement')
  if (stepsOf(velo2) !== expected) throw new Error(`Après sauvegarde du HIIT, la rotation devrait être intacte, trouvé : ${stepsOf(velo2)}`)

  // --- Ancien cycle complexe (Vélo + Full body le même jour | HIIT) : toujours lu et planifié,
  //     affiché en texte dans la fiche, préservé à la re-sauvegarde
  await page.evaluate(
    ({ veloId, fullId, hiitId }) => {
      const d = JSON.parse(localStorage.getItem('elan-data-v1'))
      const v = d.sessions.find((s) => s.id === veloId)
      v.repeat = { ...v.repeat, steps: [{ ids: [veloId, fullId] }, { ids: [hiitId] }] }
      localStorage.setItem('elan-data-v1', JSON.stringify(d))
    },
    { veloId: velo.id, fullId: full.id, hiitId: hiit.id },
  )
  await page.reload()
  await page.waitForSelector('text=Mes programmes')
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.waitForSelector('text=Séance libre')
  await page.waitForSelector('main p:text-is("Vélo d’appartement")')
  await page.waitForSelector('main p:text-is("Muscu — Full body")')
  if ((await page.locator('main p:text-is("HIIT — Cardio express")').count()) > 0) throw new Error("Le HIIT ne devrait pas être planifié aujourd'hui (cycle complexe)")
  await page.screenshot({ path: 'screenshots/25-deux-seances-meme-jour.png' })
  await openForm('Muscu — Full body')
  await page.waitForSelector(`${altRow}:has-text("Vélo d’appartement + Muscu — Full body → HIIT — Cardio express")`)
  if ((await page.locator('select[aria-label="En alternance avec"]').count()) > 0) throw new Error('Un cycle complexe ne doit pas proposer le sélecteur, seulement le texte et la croix')
  await page.screenshot({ path: 'screenshots/26-cycle-complexe-lu.png' })
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')
  const velo3 = await sessionByName('appartement')
  const expectedComplex = `${velo.id},${full.id}|${hiit.id}`
  if (stepsOf(velo3) !== expectedComplex) throw new Error(`Le cycle complexe devrait être préservé à la re-sauvegarde, trouvé : ${stepsOf(velo3)}`)

  // --- Réparation des anciennes données « bidirectionnelles » (deux propriétaires concurrents)
  await page.evaluate(
    ({ hiitId, veloId, fullId, start }) => {
      const d = JSON.parse(localStorage.getItem('elan-data-v1'))
      const h = d.sessions.find((s) => s.id === hiitId)
      h.repeat = { everyDays: 2, startDate: start, alternates: [veloId, fullId] }
      localStorage.setItem('elan-data-v1', JSON.stringify(d))
    },
    { hiitId: hiit.id, veloId: velo.id, fullId: full.id, start: velo3.repeat.startDate },
  )
  await page.reload()
  await page.waitForSelector('text=Mes programmes')
  await page.getByRole('link', { name: "Aujourd'hui" }).click()
  await page.waitForSelector('text=Séance libre')
  // À la lecture : un seul cycle canonique → pas de doublon HIIT aujourd'hui
  await page.waitForSelector('main p:text-is("Vélo d’appartement")')
  if ((await page.locator('main p:text-is("HIIT — Cardio express")').count()) > 0) throw new Error("Le HIIT ne devrait pas être planifié aujourd'hui (doublon du cycle corrompu)")
  // À l'écriture : re-sauver le vélo répare les données (le repeat parasite disparaît)
  await openForm('Vélo d’appartement')
  await page.click('text=Enregistrer')
  await page.waitForSelector('text=Mes programmes')
  const hiit3 = await sessionByName('HIIT')
  if (hiit3.repeat) throw new Error('La re-sauvegarde du vélo devrait retirer le repeat parasite du HIIT')

  console.log('ALTERNANCE OK — partenaire unique, rotation partagée, jours fixes nettoyés, cycle complexe lu et préservé, données réparées')
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
