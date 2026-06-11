import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DataProvider, useData } from './data/DataContext'
import BottomNav from './components/BottomNav'
import Today from './pages/Today'
import Planning from './pages/Planning'
import Library from './pages/Library'
import Progress from './pages/Progress'
import Goals from './pages/Goals'
import ExerciseForm from './pages/ExerciseForm'
import SessionForm from './pages/SessionForm'
import Player from './pages/Player'
import Login from './pages/Login'

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-cream">
      <div className="animate-pulse text-5xl">🌿</div>
      <p className="text-lg font-extrabold tracking-wide text-sage-600">Élan</p>
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

  return (
    <>
      <main className={'mx-auto w-full max-w-lg ' + (fullScreen ? '' : 'min-h-dvh pb-28')}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/library" element={<Library />} />
          <Route path="/exercise/new" element={<ExerciseForm />} />
          <Route path="/exercise/:id" element={<ExerciseForm />} />
          <Route path="/session/new" element={<SessionForm />} />
          <Route path="/session/:id" element={<SessionForm />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!fullScreen && <BottomNav />}
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
