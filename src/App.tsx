import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DataProvider, useData } from './data/DataContext'
import BottomNav from './components/BottomNav'
import SeaBackdrop from './components/SeaBackdrop'
import Today from './pages/Today'
import Planning from './pages/Planning'
import Library from './pages/Library'
import Progress from './pages/Progress'
import Goals from './pages/Goals'
import Plan from './pages/Plan'
import ExerciseForm from './pages/ExerciseForm'
import SessionForm from './pages/SessionForm'
import Player from './pages/Player'
import Login from './pages/Login'

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-abysse">
      {/* L'ogive écume, ombre douce de la charte, sur l'abysse du manifest */}
      <img src="/icon.svg" alt="" className="h-16 w-16 animate-pulse drop-shadow-[0_18px_34px_rgba(2,10,16,0.55)]" />
      <p className="font-display text-2xl leading-none font-bold tracking-[0.2em] text-ink-soft uppercase">Avel</p>
    </div>
  )
}

function Shell() {
  const { mode, user, authReady, dataReady } = useData()
  const location = useLocation()

  if (!authReady) return <Splash />
  if (mode === 'cloud' && !user) return <Login />
  if (!dataReady) return <Splash />

  const fullScreen = location.pathname.startsWith('/player')
  // Écrans d'édition : pas de barre d'onglets, une barre d'action fixe les remplace
  const formScreen = location.pathname.startsWith('/session/') || location.pathname.startsWith('/exercise/')

  return (
    <>
      {/* Pas de fond photo sous le Player : il est immersif, opaque, et ses animations
          tournent déjà — inutile d'en faire tourner deux de plus derrière lui. */}
      {!fullScreen && <SeaBackdrop />}
      <main className={'mx-auto w-full max-w-lg ' + (fullScreen ? '' : formScreen ? 'min-h-dvh pb-24' : 'min-h-dvh pb-28')}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/library" element={<Library />} />
          <Route path="/exercise/new" element={<ExerciseForm />} />
          <Route path="/exercise/:id" element={<ExerciseForm />} />
          <Route path="/session/new" element={<SessionForm />} />
          <Route path="/session/:id" element={<SessionForm />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!fullScreen && !formScreen && <BottomNav />}
    </>
  )
}

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </DataProvider>
  )
}
