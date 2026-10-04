// Aides partagées par les vérifs Playwright de la fiche programme (`SessionForm.tsx`).
// Depuis le 04/10/2026 (canvas « Créer simple »), la planification vit dans la feuille
// « Quand ? » (ouverte par la ligne `[data-quand]`), les réglages d'un exercice dans sa
// feuille (ouverte en tapant sa ligne `[data-item="Nom"]`), et la catégorie sous
// « Plus d'options ». Une feuille ouverte recouvre la barre « Enregistrer » : la refermer
// avant d'enregistrer.

const quandSheet = '[role="dialog"]:has(h2:text-is("Quand ?"))'
const itemSheet = '[role="dialog"]:has(button:text-is("Retirer"))'

/** Ouvre la feuille « Quand ? » (sans effet si elle l'est déjà) */
export async function openQuand(page) {
  if ((await page.locator(quandSheet).count()) === 0) await page.click('[data-quand]')
  await page.waitForSelector(quandSheet)
}

/** Ouvre « Quand ? » et passe en « Jours choisis » (les cases L…D apparaissent) */
export async function openJoursChoisis(page) {
  await openQuand(page)
  await page.locator(quandSheet).getByRole('button', { name: 'Jours choisis', exact: true }).click()
  await page.waitForSelector('button[title="Lundi"]')
}

/** Referme la feuille « Quand ? » par son bouton OK, si elle est ouverte */
export async function closeQuand(page) {
  const sheet = page.locator(quandSheet)
  if (await sheet.count()) await sheet.locator('button:text-is("OK")').click()
}

/** Ouvre la feuille de réglage d'un exercice du programme, par son nom */
export async function openItem(page, name, nth = 0) {
  await page.locator(`[data-item="${name}"]`).nth(nth).click()
  await page.waitForSelector(itemSheet)
}

/** Referme la feuille de réglage d'un exercice, si elle est ouverte */
export async function closeItem(page) {
  const sheet = page.locator(itemSheet)
  if (await sheet.count()) await sheet.locator('button:text-is("OK")').click()
}

/** Ouvre « Plus d'options » (catégorie, section du planning), sans effet si c'est déjà fait */
export async function openOptions(page) {
  const btn = page.locator('button[aria-expanded]:has-text("Plus d\'options")')
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click()
}

/** Referme les feuilles éventuellement ouvertes, puis « Enregistrer » */
export async function saveFiche(page) {
  await closeItem(page)
  await closeQuand(page)
  await page.click('text=Enregistrer')
}
