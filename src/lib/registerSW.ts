// Enregistrement du service worker, écrit à la main à la place du `registerSW.js` injecté
// par vite-plugin-pwa (cf. `injectRegister: false` dans vite.config.ts).
//
// Le script injecté se contentait d'enregistrer `/sw.js` : le navigateur ne cherchait une
// nouvelle version qu'à la navigation, et la page déjà ouverte gardait l'ancien JS. Une PWA
// restée en mémoire sur le téléphone, ou un onglet ouvert plusieurs jours, affichait donc
// l'ancien plan (constaté le 24/09 : « Allure semi 2×2 km » retirée le 21/09 toujours là).
//
// Ici : vérification d'une nouvelle version à chaque retour dans l'app et toutes les
// 30 min, puis rechargement dès que le nouveau service worker prend la main — sauf pendant
// une séance en cours ou une fiche en édition, où le rechargement attend la sortie.

const UNSAFE = /^\/(player|session|exercise)\//
const CHECK_EVERY_MS = 30 * 60 * 1000

let pending = false

function reloadIfSafe() {
  if (pending && !UNSAFE.test(location.pathname)) location.reload()
}

export function registerSW() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // Premier enregistrement : clientsClaim() déclenche aussi `controllerchange`, sans
  // qu'il y ait d'ancienne version à remplacer — pas de rechargement dans ce cas.
  let hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    if (pending) return
    pending = true
    reloadIfSafe()
    // Séance ou fiche en cours : on retente jusqu'à ce que l'utilisateur en sorte
    setInterval(reloadIfSafe, 5000)
  })

  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    const check = () => reg.update().catch(() => {})
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    setInterval(check, CHECK_EVERY_MS)
  })
}
