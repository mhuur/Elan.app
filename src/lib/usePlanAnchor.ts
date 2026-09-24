import { useData } from '../data/DataContext'

/**
 * Position d'ancrage de la section « Running » du plan : clé de la section utilisateur juste
 * en dessous d'elle, ou '__start__' / '__end__'. Partagé par Planning (lecture + écriture au
 * drag) et Aujourd'hui (lecture + écriture au drag des cartes).
 *
 * Enregistrée dans le compte (document `prefs/ui`, cf. DataContext) depuis le 24/09/2026 :
 * la même position sur le téléphone et l'ordinateur. Elle était avant en localStorage.
 */
export function usePlanAnchor(): [string, (k: string) => void] {
  const { planAnchor, setPlanAnchor } = useData()
  return [planAnchor, (k) => void setPlanAnchor(k)]
}
