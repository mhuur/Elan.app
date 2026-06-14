import { useState } from 'react'
import { useData } from '../data/DataContext'

const LAST_KEY = 'elan-strava-last'

/**
 * Logique partagée du bouton « Synchroniser » (sélecteur de validation + Réglages) :
 * appelle le Worker Strava via DataContext.syncStrava, expose l'état (en cours / message /
 * dernière synchro) et mémorise l'horodatage en localStorage.
 */
export function useStravaSync() {
  const { syncStrava, stravaSyncConfigured } = useData()
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_KEY)
    } catch {
      return null
    }
  })

  const sync = async (days = 30) => {
    setSyncing(true)
    setMessage(null)
    try {
      const { added } = await syncStrava(days)
      setMessage(added > 0 ? `${added} course${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''} ✓` : 'Déjà à jour ✓')
      const now = new Date().toISOString()
      try {
        localStorage.setItem(LAST_KEY, now)
      } catch {
        /* stockage indisponible */
      }
      setLastSync(now)
    } catch {
      setMessage('Synchro impossible — réessaie')
    } finally {
      setSyncing(false)
    }
  }

  return { sync, syncing, message, lastSync, configured: stravaSyncConfigured }
}

/** « 14 juin, 09:32 » à partir d'un ISO, ou null */
export function formatLastSync(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
