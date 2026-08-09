import { useState } from 'react'
import { useData } from '../data/DataContext'

export default function Login() {
  const { signIn } = useData()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handle = async () => {
    setBusy(true)
    setError(null)
    try {
      await signIn()
    } catch (e) {
      setError("Connexion impossible. Vérifiez votre connexion internet et la configuration Firebase (voir README). Détail : " + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-abysse px-8 text-center">
      <img src="/icon.svg" alt="" className="h-20 w-20 drop-shadow-[0_18px_34px_rgba(2,10,16,0.55)]" />
      <div>
        <h1 className="text-3xl font-extrabold tracking-wide text-ink">Avel</h1>
        <p className="mt-2 text-sm font-semibold text-ink-soft">
          Planifiez vos séances, enregistrez vos performances,
          <br />
          suivez vos progrès en douceur.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={handle}
        className="flex items-center gap-3 rounded-sm border border-hairline bg-glass px-6 py-4 font-mono text-[11px] font-bold tracking-[0.16em] uppercase text-ink backdrop-blur-lg active:bg-glass-raised disabled:opacity-50"
      >
        <svg viewBox="0 0 48 48" className="h-5 w-5">
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
        </svg>
        Continuer avec Google
      </button>
      {error && <p className="max-w-sm text-xs font-semibold text-hiit">{error}</p>}
      <p className="text-xs text-ink-soft/70">Vos données sont privées et synchronisées sur vos appareils.</p>
    </div>
  )
}
