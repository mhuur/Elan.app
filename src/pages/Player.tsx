import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Lightbulb, Pause, Play, SkipForward, Square, X } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, setTargetsOf, type Exercise, type Session } from '../types'
import { todayStr } from '../lib/dates'
import { mmss } from '../lib/format'
import { muscuBlocks } from '../lib/blocks'
import { tone as playTone } from '../lib/audio'
import { CategoryIcon } from '../components/ui'

interface Step {
  type: 'prep' | 'work' | 'rest'
  label: string
  /** Durée (estimation pour les étapes manuelles, utilisée par la barre de progression) */
  sec: number
  comment?: string
  /** Étape sans chrono : on avance avec le bouton « Série faite ✓ » (reps muscu) */
  manual?: boolean
  /** Répétitions à faire (étapes manuelles) */
  reps?: number
  /** Contexte affiché sous le nom : « Bloc 1 · Tour 1/2 · Série 2/4 » */
  detail?: string
  /** Muscu : exercice de la série, pour journaliser le réalisé réel */
  exerciseId?: string
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
        steps.push({
          type: 'work',
          label: nameOf(it.exerciseId),
          sec: it.durationSec ?? work,
          comment: it.comment,
          exerciseId: it.exerciseId,
        })
        const isLast = r === rounds - 1 && i === session.items.length - 1
        if (!isLast && rest > 0) steps.push({ type: 'rest', label: 'Repos', sec: rest })
      })
    }
  } else if (session.category === 'muscu') {
    // Séries guidées : chrono pour les exercices en secondes, validation manuelle pour les reps,
    // repos automatique entre les séries (sauté entre supersets).
    const blocks = muscuBlocks(session)
    blocks.forEach((b, bi) => {
      for (let r = 0; r < b.rounds; r++) {
        b.items.forEach((it, ii) => {
          const ex = exercises.find((e) => e.id === it.exerciseId)
          const isSec = ex?.measure === 'sec'
          const targets = setTargetsOf(it)
          const sets = targets.length
          for (let s = 0; s < sets; s++) {
            const detail = [
              blocks.length > 1 ? `Bloc ${bi + 1}` : '',
              b.rounds > 1 ? `Tour ${r + 1}/${b.rounds}` : '',
              `Série ${s + 1}/${sets}`,
            ]
              .filter(Boolean)
              .join(' · ')
            if (isSec) {
              steps.push({
                type: 'work',
                label: nameOf(it.exerciseId),
                sec: targets[s],
                comment: it.comment,
                detail,
                exerciseId: it.exerciseId,
              })
            } else {
              steps.push({
                type: 'work',
                label: nameOf(it.exerciseId),
                sec: 45,
                manual: true,
                reps: targets[s],
                comment: it.comment,
                detail,
                exerciseId: it.exerciseId,
              })
            }
            const lastSetOfItem = s === sets - 1
            const veryLast =
              bi === blocks.length - 1 && r === b.rounds - 1 && ii === b.items.length - 1 && lastSetOfItem
            const superset = lastSetOfItem && !!it.linkNext && ii < b.items.length - 1
            const restSec = it.restSec ?? 60
            if (!veryLast && !superset && restSec > 0) steps.push({ type: 'rest', label: 'Repos', sec: restSec })
          }
        })
      }
    })
  } else {
    const rest = session.restSec ?? 0
    session.items.forEach((it, i) => {
      steps.push({
        type: 'work',
        label: nameOf(it.exerciseId),
        sec: it.durationSec ?? 30,
        comment: it.comment,
        exerciseId: it.exerciseId,
      })
      if (rest > 0 && i < session.items.length - 1) steps.push({ type: 'rest', label: 'Transition', sec: rest })
    })
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
  // Répétitions réellement faites sur la série en cours (ajustables avant « Série faite ✓ »)
  const [actualReps, setActualReps] = useState(0)

  const audioRef = useRef<AudioContext | null>(null)
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const endAtRef = useRef(0)
  const remainMsRef = useRef((steps[0]?.sec ?? 0) * 1000)
  const lastBeepRef = useRef(-1)
  const loggedRef = useRef(false)
  // Séries réalisées par exercice (reps ou secondes), journalisées à la fin ou à l'abandon
  const doneRef = useRef<Record<string, number[]>>({})

  const recordSet = (exerciseId: string | undefined, value: number) => {
    if (!exerciseId || value <= 0) return
    ;(doneRef.current[exerciseId] ??= []).push(value)
  }

  const tone = (freq: number, durSec: number) => {
    if (audioRef.current) playTone(audioRef.current, freq, durSec)
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
    setActualReps(steps[idx].reps ?? 0)
    setStepIdx(idx)
  }

  /** Résultats muscu à journaliser : les séries réellement faites (les exercices jamais commencés sont omis) */
  const buildResults = () => {
    if (!session || session.category !== 'muscu' || !session.items.length) return undefined
    const uniques = [...new Map(session.items.map((it) => [it.exerciseId, it])).values()]
    return uniques
      .map((it) => {
        const ex = exercises.find((e) => e.id === it.exerciseId)
        return {
          exerciseId: it.exerciseId,
          name: ex?.name ?? 'Exercice',
          measure: ex?.measure ?? ('reps' as const),
          sets: doneRef.current[it.exerciseId] ?? [],
        }
      })
      .filter((r) => r.sets.length > 0)
  }

  const logNow = (note: string) => {
    if (loggedRef.current || !session) return
    loggedRef.current = true
    const results = buildResults()
    void addLog({
      date: todayStr(),
      sessionId: session.id,
      sessionName: session.name,
      category: session.category,
      createdAt: Date.now(),
      note,
      ...(results && results.length ? { results } : {}),
    })
  }

  const finish = () => {
    logNow('')
    tone(880, 0.6)
    navigator.vibrate?.([200, 100, 200, 100, 400])
    void wakeRef.current?.release()
    setPhase('done')
  }

  // Boucle du minuteur (les étapes manuelles attendent le bouton « Série faite ✓ »)
  useEffect(() => {
    if (phase !== 'running' || paused || steps[stepIdx]?.manual) return
    endAtRef.current = Date.now() + remainMsRef.current
    const iv = window.setInterval(() => {
      const ms = endAtRef.current - Date.now()
      if (ms <= 0) {
        // Série chronométrée tenue jusqu'au bout : on journalise la durée cible
        const cur = steps[stepIdx]
        if (cur.type === 'work') recordSet(cur.exerciseId, cur.sec)
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
    if (phase === 'running' && !window.confirm('Quitter sans enregistrer ?')) return
    navigate(-1)
  }

  /** Arrêter ici : le réalisé (incomplet) est enregistré, avec un commentaire de l'utilisateur */
  const stopAndSave = () => {
    if (!window.confirm('Arrêter la séance ici ? Le réalisé sera enregistré.')) return
    const comment = window.prompt('Un commentaire sur la séance ? (optionnel)') ?? ''
    logNow(comment.trim() || 'Séance interrompue')
    navigate(-1)
  }

  /** Passer une étape : sur une série chronométrée, le temps déjà tenu est journalisé */
  const skip = () => {
    if (step.type === 'work' && !step.manual) {
      const elapsed = Math.round((step.sec * 1000 - remainMsRef.current) / 1000)
      if (elapsed >= 3) recordSet(step.exerciseId, elapsed)
    }
    goTo(stepIdx + 1)
  }

  // Démo vidéo de l'exercice en cours, si l'exercice en a une
  const stepExercise = step?.exerciseId ? exercises.find((e) => e.id === step.exerciseId) : undefined
  // Temps restant estimé (étapes manuelles comptées à leur durée forfaitaire)
  const remainTotalSec = remaining + steps.slice(stepIdx + 1).reduce((a, s) => a + s.sec, 0)
  // Rail de progression « ligne de métro » : un point par étape d'effort
  const workIdx = steps.slice(0, stepIdx + 1).filter((s) => s.type === 'work').length - 1
  const workCount = steps.filter((s) => s.type === 'work').length

  if (phase === 'ready') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
        <div className={`flex h-20 w-20 items-center justify-center rounded-3xl ${meta.soft} ${meta.text}`}>
          <CategoryIcon category={session.category} className="h-10 w-10" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">{session.name}</h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            {steps.filter((s) => s.type === 'work').length}{' '}
            {session.category === 'muscu' ? 'séries' : 'exercices'} · ~{Math.max(1, Math.round(totalSec / 60))} min
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
    <div className={`relative flex min-h-dvh flex-col ${bgByType} transition-colors duration-500`}>
      <header className="flex items-center justify-between px-5 pt-6">
        <button type="button" onClick={quit} aria-label="Quitter" className="rounded-full bg-surface/80 p-2.5 shadow-sm">
          <X className="h-5 w-5" />
        </button>
        <div className="text-right">
          <p className="text-sm font-extrabold text-ink-soft">
            {workIdx + 1}/{workCount}
          </p>
          <p className="text-[11px] font-bold text-ink-soft/70">~{Math.max(1, Math.ceil(remainTotalSec / 60))} min restantes</p>
        </div>
      </header>

      {/* Rail de progression vertical : un point par effort, le point courant est marqué */}
      <div className="pointer-events-none absolute inset-y-0 left-3 flex flex-col items-center justify-center">
        <div className={'flex flex-col items-center ' + (workCount > 18 ? 'gap-1' : 'gap-1.5')}>
          {Array.from({ length: workCount }, (_, i) => (
            <span
              key={i}
              className={
                'rounded-full transition-all ' +
                (i < workIdx || (i === workIdx && step.type !== 'work')
                  ? (workCount > 18 ? 'h-1.5 w-1.5 ' : 'h-2 w-2 ') + 'bg-sage-500'
                  : i === workIdx
                    ? 'h-3 w-3 bg-sage-600 ring-4 ring-sage-200'
                    : (workCount > 18 ? 'h-1.5 w-1.5 ' : 'h-2 w-2 ') + 'bg-ink-soft/20')
              }
            />
          ))}
        </div>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-xs font-extrabold uppercase tracking-widest text-ink-soft">
          {step.type === 'work' ? meta.label : step.type === 'rest' ? 'Récupération' : 'Préparation'}
        </p>
        <h1 className="text-3xl font-extrabold leading-tight">{step.label}</h1>
        {step.detail && <p className="text-sm font-extrabold text-ink-soft">{step.detail}</p>}
        {step.comment && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
            <Lightbulb className="h-3.5 w-3.5 shrink-0" /> {step.comment}
          </p>
        )}
        {stepExercise?.videoUrl && (
          <a
            href={stepExercise.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-surface/80 px-3.5 py-1.5 text-xs font-extrabold text-velo shadow-sm"
          >
            <Play className="h-3 w-3" /> démo
          </a>
        )}
        {step.manual ? (
          <>
            <div className="my-2 flex items-center gap-5">
              <button
                type="button"
                aria-label="Une répétition de moins"
                onClick={() => setActualReps((v) => Math.max(0, v - 1))}
                className="flex h-13 w-13 items-center justify-center rounded-full bg-surface text-3xl font-extrabold text-ink-soft shadow-sm active:bg-sand"
              >
                −
              </button>
              <p className="min-w-28 text-8xl font-extrabold tabular-nums tracking-tight">{actualReps}</p>
              <button
                type="button"
                aria-label="Une répétition de plus"
                onClick={() => setActualReps((v) => v + 1)}
                className="flex h-13 w-13 items-center justify-center rounded-full bg-surface text-3xl font-extrabold text-ink-soft shadow-sm active:bg-sand"
              >
                +
              </button>
            </div>
            <p className="-mt-2 text-base font-extrabold text-ink-soft">
              répétitions
              {actualReps !== (step.reps ?? 0) && <span className="text-ink-soft/60"> · objectif {step.reps}</span>}
            </p>
            <p className="text-xs font-semibold text-ink-soft/70">Ajustez si vous avez fait plus ou moins</p>
            <button
              type="button"
              onClick={() => {
                recordSet(step.exerciseId, actualReps)
                tone(520, 0.2)
                goTo(stepIdx + 1)
              }}
              className="mt-4 rounded-full bg-sage-500 px-10 py-5 text-lg font-extrabold text-white shadow-lg shadow-sage-500/30 active:bg-sage-600"
            >
              Série faite ✓
            </button>
          </>
        ) : (
          <p className="my-2 text-8xl font-extrabold tabular-nums tracking-tight">{mmss(remaining)}</p>
        )}
        {next && (
          <p className="text-sm font-bold text-ink-soft">
            Ensuite : <span className="text-ink">{next.label}</span>
            {next.detail ? <span className="text-ink-soft"> — {next.detail}</span> : null}
          </p>
        )}
      </main>

      <footer className="px-6 pb-10">
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-surface/70">
          <div className="h-full rounded-full bg-sage-500 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Arrêter et enregistrer"
            title="Arrêter la séance ici (le réalisé est enregistré)"
            onClick={stopAndSave}
            className="flex h-13 w-13 items-center justify-center rounded-full bg-surface/70 text-hiit shadow-md active:bg-sand"
          >
            <Square className="h-5 w-5" fill="currentColor" />
          </button>
          <button
            type="button"
            aria-label={paused ? 'Reprendre' : 'Pause'}
            onClick={() => setPaused((p) => !p)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-surface shadow-md active:bg-sand"
          >
            {paused ? <Play className="h-7 w-7" /> : <Pause className="h-7 w-7" />}
          </button>
          <button
            type="button"
            aria-label="Passer"
            title="Passer cette étape"
            onClick={skip}
            className="flex h-13 w-13 items-center justify-center rounded-full bg-surface/70 text-ink-soft shadow-md active:bg-sand"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  )
}
