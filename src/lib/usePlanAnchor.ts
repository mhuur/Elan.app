import { useCallback, useEffect, useState } from 'react'

/**
 * Position d'ancrage de la section « Running » du plan (préférence d'affichage locale,
 * par utilisateur). Partagé par Planning (lecture + écriture au drag) et Aujourd'hui
 * (lecture, pour afficher les séances du jour dans le même ordre que le Planning).
 */
export function usePlanAnchor(uid?: string): [string, (k: string) => void] {
  const key = `elan-plan-anchor-${uid ?? 'local'}`
  const [anchor, setAnchor] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? '__start__'
    } catch {
      return '__start__'
    }
  })
  useEffect(() => {
    try {
      setAnchor(localStorage.getItem(key) ?? '__start__')
    } catch {
      setAnchor('__start__')
    }
  }, [key])
  const save = useCallback(
    (k: string) => {
      setAnchor(k)
      try {
        localStorage.setItem(key, k)
      } catch {
        /* stockage indisponible */
      }
    },
    [key],
  )
  return [anchor, save]
}
