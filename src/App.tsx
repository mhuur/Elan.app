import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DataProvider, useData } from './data/DataContext'
import BottomNav from './components/BottomNav'
import { Logo } from './components/icons'
import Today from './pages/Today'
import Planning from './pages/Planning'
import Library from './pages/Library'
import ExerciseBank from './pages/ExerciseBank'
import Goals from './pages/Goals'
import Plan from './pages/Plan'
import ExerciseForm from './pages/ExerciseForm'
import SessionForm from './pages/SessionForm'
import Player from './pages/Player'
import Login from './pages/Login'

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream">
      <div className="animate-pulse">
        <Logo size={64} label={false} />
      </div>
      <p className="text-2xl font-extrabold">21KM</p>
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
  // Écrans élargis sur desktop : la fiche séance (volet banque d'exercices à droite du
  // formulaire) et la liste des programmes (cartes sur deux colonnes)
  const asideScreen = location.pathname === '/planning' || location.pathname === '/plan' || location.pathname === '/library'
  const wideScreen = location.pathname.startsWith('/session/') || location.pathname === '/library'

  return (
    <>
      <main
        className={
          // Bureau (≥ lg) : la barre latérale de 232 px occupe la gauche
          'mx-auto w-full ' +
          (fullScreen ? '' : 'lg:ml-[232px] lg:mr-0 ') +
          (fullScreen ? '' : wideScreen ? 'max-w-lg lg:max-w-[62rem] ' : 'max-w-lg lg:max-w-[760px] ') +
          // Planning et Plan : colonne de 520 px à droite sur grand écran (≥ xl)
          (asideScreen ? 'xl:max-w-[calc(100vw-232px-520px)] ' : '') +
          (fullScreen ? '' : formScreen ? 'min-h-dvh pb-24' : 'min-h-dvh pb-28')
        }
      >
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/exercices" element={<ExerciseBank />} />
          <Route path="/exercise/new" element={<ExerciseForm />} />
          <Route path="/exercise/:id" element={<ExerciseForm />} />
          <Route path="/session/new" element={<SessionForm />} />
          <Route path="/session/:id" element={<SessionForm />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {/* Formulaires : pas de barre du bas (une barre d'action la remplace), barre latérale gardée sur bureau */}
      {!fullScreen && <BottomNav sideOnly={formScreen} />}
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
