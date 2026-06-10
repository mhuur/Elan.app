import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Exercise, type Session } from '../types'
import { todayStr } from '../lib/dates'
import { mmss } from '../lib/format'

interface Step {
  type: 'prep' | 'work' | 'rest'
  label: string
  sec: number
}

function buildSteps(session: Session, exercises: Exercise[]): Step[] {
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercice'
  const steps: Step[] = [{ type: 'prep', label: 'Préparez-vous…', sec: 5 }]
  if (session.category === 'hiit') {
    const rounds = session.rounds ?? 1
    const work = session.workSec ?? 45
    const rest = session.restSec ?? 15
    for (let r = 0; r < rounds; r++) {
      session.items.forEach((it, i) => {
        steps.push({ type: 'work', label: nameOf(it.exerciseId), sec: it.durationSec ?? work })
        const isLast = r === rounds - 1 && i === session.items.length - 1
        if (!isLast && rest > 0) steps.push({ type: 'rest', label: 'Repos', sec: rest })
      })
    }
  } else {
    for (const it of session.items) {
      steps.push({ type: 'work', label: nameOf(it.exerciseId), sec: it.durationSec ?? 30 })
    }
  }
  return steps
}

export default function Player() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sessions, exercises, addLog } = useData()
  const session = sessions.find((s) => s.id === id)

  const steps = useMemo(() => (session ? buildSteps(session, exercises) : []), [session, exercises])
  const totalSec = useMemo(() => steps.reduce((a, s) => a + s.sec, 0), [steps])

  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready')
  const [stepIdx, setStepIdx] = useState(0)
  const [remaining, setRemaining] = useState(steps[0]?.sec ?? 0)
  const [paused, setPaused] = useState(false)

  const audioRef = useRef<AudioContext | null>(null)
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const endAtRef = useRef(0)
  const remainMsRef = useRef((steps[0]?.sec ?? 0) * 1000)
  const lastBeepRef = useRef(-1)
  const loggedRef = useRef(false)

  const tone = (freq: number, durSec: number, vol = 0.2) => {
    const ctx = audioRef.current
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durSec)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + durSec)
  }

  const acquireWakeLock = async () => {
    try {
      wakeRef.current = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      // refus silencieux : le minuteur fonctionne quand même
    }
  }

  // Libère l'audio et le wake lock uniquement à la sortie de l'écran
  useEffect(() => {
    return () => {
      void wakeRef.current?.release()
      if (audioRef.current && audioRef.current.state !== 'closed') void audioRef.current.close()
      audioRef.current = null
    }
  }, [])

  // Ré-acquiert le wake lock quand l'onglet redevient visible pendant la séance
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && phaseRef.current === 'running') void acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goTo = (idx: number) => {
    if (idx >= steps.length) {
      finish()
      return
    }
    remainMsRef.current = steps[idx].sec * 1000
    lastBeepRef.current = -1
    setRemaining(steps[idx].sec)
    setStepIdx(idx)
  }

  const finish = () => {
    if (!loggedRef.current && session) {
      loggedRef.current = true
      void addLog({
        date: todayStr(),
        sessionId: session.id,
        sessionName: session.name,
        category: session.category,
        createdAt: Date.now(),
        note: '',
      })
    }
    tone(880, 0.6)
    navigator.vibrate?.([200, 100, 200, 100, 400])
    void wakeRef.current?.release()
    setPhase('done')
  }

  // Boucle du minuteur
  useEffect(() => {
    if (phase !== 'running' || paused) return
    endAtRef.current = Date.now() + remainMsRef.current
    const iv = window.setInterval(() => {
      const ms = endAtRef.current - Date.now()
      if (ms <= 0) {
        const nextIdx = stepIdx + 1
        if (nextIdx < steps.length) {
          tone(steps[nextIdx].type === 'work' ? 880 : 520, 0.35)
          navigator.vibrate?.(steps[nextIdx].type === 'work' ? [120, 60, 120] : 80)
        }
        goTo(nextIdx)
      } else {
        remainMsRef.current = ms
        const sec = Math.ceil(ms / 1000)
        setRemaining(sec)
        if (sec <= 3 && sec !== lastBeepRef.current) {
          lastBeepRef.current = sec
          tone(660, 0.12)
        }
      }
    }, 100)
    return () => window.clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, stepIdx, steps])

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="font-bold text-ink-soft">Séance introuvable.</p>
        <button type="button" className="font-extrabold text-sage-600" onClick={() => navigate('/')}>
          ← Retour
        </button>
      </div>
    )
  }

  const meta = CATEGORY_META[session.category]
  const step = steps[stepIdx]
  const next = steps.slice(stepIdx + 1).find((s) => s.type === 'work')
  const elapsedSteps = steps.slice(0, stepIdx).reduce((a, s) => a + s.sec, 0)
  const progress = totalSec ? Math.min(1, (elapsedSteps + (step ? step.sec - remaining : 0)) / totalSec) : 0

  const start = () => {
    audioRef.current = audioRef.current ?? new AudioContext()
    void audioRef.current.resume()
    void acquireWakeLock()
    remainMsRef.current = steps[0].sec * 1000
    setRemaining(steps[0].sec)
    tone(660, 0.15)
    setPhase('running')
  }

  const quit = () => {
    if (phase === 'running' && !window.confirm('Quitter la séance en cours ?')) return
    navigate(-1)
  }

  if (phase === 'ready') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
        <div className={`flex h-20 w-20 items-center justify-center rounded-3xl text-4xl ${meta.soft}`}>{meta.emoji}</div>
        <div>
          <h1 className="text-2xl font-extrabold">{session.name}</h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            {steps.filter((s) => s.type === 'work').length} exercices · ~{Math.max(1, Math.round(totalSec / 60))} min
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-sage-500 px-10 py-5 text-lg font-extrabold text-white shadow-lg shadow-sage-500/30 active:bg-sage-600"
        >
          C'est parti !
        </button>
        <button type="button" onClick={() => navigate(-1)} className="text-sm font-bold text-ink-soft">
          ← Annuler
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
        <div className="text-6xl">🎉</div>
        <div>
          <h1 className="text-2xl font-extrabold">Bravo !</h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            « {session.name} » terminée et enregistrée.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="rounded-full bg-sage-500 px-10 py-4 text-base font-extrabold text-white shadow-lg shadow-sage-500/30"
        >
          Retour à ma journée
        </button>
      </div>
    )
  }

  const bgByType = step.type === 'work' ? meta.soft : step.type === 'rest' ? 'bg-velo/10' : 'bg-sand'

  return (
    <div className={`flex min-h-dvh flex-col ${bgByType} transition-colors duration-500`}>
      <header className="flex items-center justify-between px-5 pt-6">
        <button type="button" onClick={quit} aria-label="Quitter" className="rounded-full bg-surface/80 p-2.5 shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="text-sm font-extrabold text-ink-soft">
          {steps.slice(0, stepIdx + 1).filter((s) => s.type === 'work').length}/{steps.filter((s) => s.type === 'work').length}
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-xs font-extrabold uppercase tracking-widest text-ink-soft">
          {step.type === 'work' ? meta.label : step.type === 'rest' ? 'Récupération' : 'Préparation'}
        </p>
        <h1 className="text-3xl font-extrabold leading-tight">{step.label}</h1>
        <p className="my-2 text-8xl font-extrabold tabular-nums tracking-tight">{mmss(remaining)}</p>
        {next && (
          <p className="text-sm font-bold text-ink-soft">
            Ensuite : <span className="text-ink">{next.label}</span>
          </p>
        )}
      </main>

      <footer className="px-6 pb-10">
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-surface/70">
          <div className="h-full rounded-full bg-sage-500 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="flex-1 rounded-2xl bg-surface px-6 py-4 text-base font-extrabold shadow-md active:bg-sand"
          >
            {paused ? '▶ Reprendre' : '⏸ Pause'}
          </button>
          <button
            type="button"
            onClick={() => goTo(stepIdx + 1)}
            className="rounded-2xl bg-surface/70 px-6 py-4 text-base font-extrabold text-ink-soft shadow-md active:bg-sand"
          >
            Passer ⏭
          </button>
        </div>
      </footer>
    </div>
  )
}
