import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronRight, ChevronUp, Lightbulb, Pause, Play, SkipForward, Square, TriangleAlert, X } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, setTargetsOf, type Category, type Exercise, type Session, type SessionItem } from '../types'
import { todayStr } from '../lib/dates'
import { mmss } from '../lib/format'
import { muscuBlocks } from '../lib/blocks'
import { progressedSession } from '../lib/progression'
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
  /** Position dans la structure, pour la colonne programme : bloc, tour et exercice */
  block?: number
  round?: number
  item?: number
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
          block: 0,
          round: r,
          item: i,
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
            // Bloc et tour sont affichés en permanence dans le panneau programme
            const detail = `Série ${s + 1}/${sets}`
            if (isSec) {
              steps.push({
                type: 'work',
                label: nameOf(it.exerciseId),
                sec: targets[s],
                comment: it.comment,
                detail,
                exerciseId: it.exerciseId,
                block: bi,
                round: r,
                item: ii,
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
                block: bi,
                round: r,
                item: ii,
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
    // Étirements : mêmes blocs/tours que la muscu, transitions entre postures.
    // Les postures (sec) sont chronométrées, les mouvements comptés (reps) se valident à la main.
    const rest = session.restSec ?? 0
    const blocks = muscuBlocks(session)
    blocks.forEach((b, bi) => {
      for (let r = 0; r < b.rounds; r++) {
        b.items.forEach((it, i) => {
          const ex = exercises.find((e) => e.id === it.exerciseId)
          // Bloc et tour sont affichés en permanence dans la colonne programme
          if (ex?.measure === 'reps') {
            steps.push({
              type: 'work',
              label: nameOf(it.exerciseId),
              sec: 30,
              manual: true,
              reps: it.target ?? 10,
              comment: it.comment,
              exerciseId: it.exerciseId,
              block: bi,
              round: r,
              item: i,
            })
          } else {
            steps.push({
              type: 'work',
              label: nameOf(it.exerciseId),
              sec: it.durationSec ?? 30,
              comment: it.comment,
              exerciseId: it.exerciseId,
              block: bi,
              round: r,
              item: i,
            })
          }
          const veryLast = bi === blocks.length - 1 && r === b.rounds - 1 && i === b.items.length - 1
          if (rest > 0 && !veryLast) steps.push({ type: 'rest', label: 'Transition', sec: rest })
        })
      }
    })
  }
  return steps
}

/** Prescription d'un exercice pour le panneau programme : « 3 × 12 », « 30 / 20 / 15 s », « 45 s », « 10 reps » */
function itemLabel(session: Session, it: SessionItem, ex?: Exercise): string {
  if (session.category === 'hiit') return `${it.durationSec ?? session.workSec ?? 45} s`
  if (session.category === 'etirements')
    return ex?.measure === 'reps' ? `${it.target ?? 10} reps` : `${it.durationSec ?? 30} s`
  const tgs = setTargetsOf(it)
  const unit = ex?.measure === 'sec' ? ' s' : ''
  return tgs.every((t) => t === tgs[0]) ? `${tgs.length} × ${tgs[0]}${unit}` : tgs.join(' / ') + unit
}

/**
 * Accents par catégorie de l'écran immersif. Depuis la charte bord de mer, les couleurs
 * de catégorie de l'app sont elles-mêmes claires : plus besoin d'une seconde palette
 * éclaircie, on lit directement les tokens partagés.
 */
const ACCENT: Record<Category, string> = {
  running: CATEGORY_META.running.hex,
  velo: CATEGORY_META.velo.hex,
  muscu: CATEGORY_META.muscu.hex,
  hiit: CATEGORY_META.hiit.hex,
  etirements: CATEGORY_META.etirements.hex,
}
/** Repos et préparation : le lagon de l'app, apaisé (= --color-sage-600) */
const CALM = '#8fd9e4'

/** Anneau de progression : piste discrète + arc accent qui se vide avec le temps restant */
function Ring({
  progress,
  accent,
  size,
  pulse,
  children,
}: {
  /** Fraction restante (0..1), ou null pour une étape sans chrono (piste seule) */
  progress: number | null
  accent: string
  size: number
  pulse?: boolean
  children: ReactNode
}) {
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className={`relative ${pulse ? 'animate-pulse' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff" strokeOpacity={0.08} strokeWidth={stroke} />
        {progress != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-150 ease-linear"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

export default function Player() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sessions, exercises, addLog, logs } = useData()
  const planned = sessions.find((s) => s.id === id)
  // Cibles relevées à hauteur de la dernière perf (dérivé : la fiche de séance n'est pas touchée).
  // Figées à l'ouverture du minuteur : le log écrit en fin de séance — ou une synchro venue d'un
  // autre appareil — ne doit pas réécrire le programme pendant qu'on l'exécute.
  const frozenRef = useRef<Session | null>(null)
  const session = useMemo(() => {
    if (!planned) return undefined
    frozenRef.current ??= progressedSession(planned, exercises, logs, todayStr()).session
    return frozenRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planned])

  const steps = useMemo(() => (session ? buildSteps(session, exercises) : []), [session, exercises])
  const totalSec = useMemo(() => steps.reduce((a, s) => a + s.sec, 0), [steps])
  // Colonne programme : blocs/tours/exercices affichés en permanence pendant la séance
  const panelBlocks = useMemo(() => {
    if (!session) return []
    if (session.category === 'hiit') return [{ items: session.items, rounds: session.rounds ?? 1 }]
    return muscuBlocks(session)
  }, [session])

  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready')
  const [stepIdx, setStepIdx] = useState(0)
  const [remaining, setRemaining] = useState(steps[0]?.sec ?? 0)
  const [paused, setPaused] = useState(false)
  // Répétitions réellement faites sur la série en cours (ajustables avant « Série faite ✓ »)
  const [actualReps, setActualReps] = useState(0)
  // Fraction restante de l'étape courante (anneau de progression, rafraîchie ~10×/s)
  const [frac, setFrac] = useState(1)
  // Tiroir programme déplié
  const [drawerOpen, setDrawerOpen] = useState(false)

  const audioRef = useRef<AudioContext | null>(null)
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const endAtRef = useRef(0)
  const remainMsRef = useRef((steps[0]?.sec ?? 0) * 1000)
  const lastBeepRef = useRef(-1)
  const loggedRef = useRef(false)
  // Séries réalisées par exercice (reps ou secondes), journalisées à la fin ou à l'abandon
  const doneRef = useRef<Record<string, number[]>>({})
  // Dernière série enregistrée (cible du bouton « Série ratée ? » de l'écran de repos)
  const lastSetRef = useRef<{ exId: string; idx: number } | null>(null)
  // Séries marquées « mal réalisées » (clés `exerciseId:index`) — state pour l'affichage, ref pour le log
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const flaggedRef = useRef(flagged)
  flaggedRef.current = flagged

  const recordSet = (exerciseId: string | undefined, value: number) => {
    if (!exerciseId || value <= 0) return
    const sets = (doneRef.current[exerciseId] ??= [])
    lastSetRef.current = { exId: exerciseId, idx: sets.length }
    sets.push(value)
  }

  const toggleFlag = (exId: string, idx: number) =>
    setFlagged((p) => {
      const n = new Set(p)
      const k = `${exId}:${idx}`
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  /** Tiroir : « cet exo était mal fait » — bascule toutes ses séries déjà enregistrées */
  const toggleFlagAll = (exId: string) => {
    const count = doneRef.current[exId]?.length ?? 0
    if (!count) return
    setFlagged((p) => {
      const n = new Set(p)
      const keys = Array.from({ length: count }, (_, i) => `${exId}:${i}`)
      const all = keys.every((k) => n.has(k))
      for (const k of keys) {
        if (all) n.delete(k)
        else n.add(k)
      }
      return n
    })
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

  // Touche espace : démarrer sur l'écran prêt, pause/reprise pendant la séance
  const startRef = useRef<() => void>(() => {})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      if (phaseRef.current === 'ready') startRef.current()
      else if (phaseRef.current === 'running') setPaused((p) => !p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Garde l'exercice courant visible quand la liste du tiroir programme défile
  const curRowRef = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    curRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [stepIdx, drawerOpen])

  const goTo = (idx: number) => {
    if (idx >= steps.length) {
      finish()
      return
    }
    remainMsRef.current = steps[idx].sec * 1000
    lastBeepRef.current = -1
    setRemaining(steps[idx].sec)
    setFrac(1)
    setActualReps(steps[idx].reps ?? 0)
    setStepIdx(idx)
  }

  /** Résultats muscu/HIIT à journaliser : les séries réellement faites (les jamais commencées sont omises = échouées) */
  const buildResults = () => {
    if (!session || (session.category !== 'muscu' && session.category !== 'hiit') || !session.items.length)
      return undefined
    const uniques = [...new Map(session.items.map((it) => [it.exerciseId, it])).values()]
    return uniques
      .map((it) => {
        const ex = exercises.find((e) => e.id === it.exerciseId)
        const sets = doneRef.current[it.exerciseId] ?? []
        const flags = sets.map((_, i) => i).filter((i) => flaggedRef.current.has(`${it.exerciseId}:${i}`))
        return {
          exerciseId: it.exerciseId,
          name: ex?.name ?? 'Exercice',
          measure: session.category === 'hiit' ? ('sec' as const) : ex?.measure ?? ('reps' as const),
          sets,
          ...(flags.length ? { flagged: flags } : {}),
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
        setFrac(Math.max(0, ms / (steps[stepIdx].sec * 1000)))
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
  // Position dans la structure : pendant un repos/la préparation, on pointe déjà l'effort suivant
  const posStep = step?.type === 'work' ? step : (next ?? step)
  const curBlock = posStep?.block ?? 0
  const curRound = posStep?.round ?? 0
  const curItem = posStep?.item ?? 0
  const elapsedSteps = steps.slice(0, stepIdx).reduce((a, s) => a + s.sec, 0)
  const progress = totalSec ? Math.min(1, (elapsedSteps + (step ? step.sec - remaining : 0)) / totalSec) : 0

  const start = () => {
    audioRef.current = audioRef.current ?? new AudioContext()
    void audioRef.current.resume()
    void acquireWakeLock()
    remainMsRef.current = steps[0].sec * 1000
    setRemaining(steps[0].sec)
    setFrac(1)
    tone(660, 0.15)
    setPhase('running')
  }
  startRef.current = start

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
  const workIdx = steps.slice(0, stepIdx + 1).filter((s) => s.type === 'work').length - 1
  const workCount = steps.filter((s) => s.type === 'work').length
  // Dernière série enregistrée : cible du « Série ratée ? » de l'écran de repos
  const lastSet = lastSetRef.current
  const lastSetFlagged = lastSet ? flagged.has(`${lastSet.exId}:${lastSet.idx}`) : false
  // Résumé permanent du tiroir programme : bloc et tour courants
  const curB = panelBlocks[curBlock]
  const drawerTitle =
    [
      panelBlocks.length > 1 ? `Bloc ${curBlock + 1}/${panelBlocks.length}` : '',
      curB && curB.rounds > 1 ? `Tour ${curRound + 1}/${curB.rounds}` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'Programme'

  if (phase === 'ready') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-abysse px-8 text-center text-white">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10"
          style={{ color: ACCENT[session.category] }}
        >
          <CategoryIcon category={session.category} className="h-10 w-10" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">{session.name}</h1>
          <p className="mt-1 text-sm font-semibold text-white/50">
            {steps.filter((s) => s.type === 'work').length}{' '}
            {session.category === 'muscu' ? 'séries' : 'exercices'} · ~{Math.max(1, Math.round(totalSec / 60))} min
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-ink px-10 py-5 text-lg font-extrabold text-abysse shadow-lg shadow-black/40 active:bg-ink/90"
        >
          C'est parti !
        </button>
        <button type="button" onClick={() => navigate(-1)} className="text-sm font-bold text-white/50">
          ← Annuler
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-abysse px-8 text-center text-white">
        <div className="text-6xl">🎉</div>
        <div>
          <h1 className="text-2xl font-extrabold">Bravo !</h1>
          <p className="mt-1 text-sm font-semibold text-white/50">
            « {session.name} » terminée et enregistrée.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="rounded-full bg-ink px-10 py-4 text-base font-extrabold text-abysse shadow-lg shadow-black/40"
        >
          Retour à ma journée
        </button>
      </div>
    )
  }

  // Mode immersif sombre : accent lumineux par catégorie, repos sur une teinte apaisée
  const accent = step.type === 'work' ? ACCENT[session.category] : CALM
  const bgByType = step.type === 'work' ? 'bg-abysse' : 'bg-[#08202e]'

  return (
    <div className={`relative flex min-h-dvh flex-col ${bgByType} text-white transition-colors duration-700`}>
      <header className="flex items-center justify-between px-5 pt-6">
        <button type="button" onClick={quit} aria-label="Quitter" className="rounded-full bg-white/10 p-2.5 active:bg-white/20">
          <X className="h-5 w-5" />
        </button>
        <div className="text-right">
          <p className="text-base font-extrabold">
            {workIdx + 1}/{workCount}
          </p>
          <p className="text-xs font-bold text-white/50">~{Math.max(1, Math.ceil(remainTotalSec / 60))} min restantes</p>
        </div>
      </header>

      {/* Progression globale de la séance */}
      <div className="mx-5 mt-4 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, backgroundColor: accent }} />
      </div>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p
          className="text-xs font-extrabold uppercase tracking-[0.25em]"
          style={{ color: paused ? 'rgba(255,255,255,0.5)' : accent }}
        >
          {paused ? 'En pause' : step.type === 'work' ? meta.label : step.type === 'rest' ? 'Récupération' : 'Préparation'}
        </p>
        <h1 className="text-3xl font-extrabold leading-tight">{step.label}</h1>
        {step.detail && <p className="text-base font-bold text-white/60">{step.detail}</p>}
        {step.comment && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white/60">
            <Lightbulb className="h-3.5 w-3.5 shrink-0" /> {step.comment}
          </p>
        )}
        {stepExercise?.videoUrl && (
          <a
            href={stepExercise.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold text-white/80 active:bg-white/20"
          >
            <Play className="h-3.5 w-3.5" /> démo
          </a>
        )}
        {step.manual ? (
          <>
            <div className="my-2 flex items-center gap-3">
              <button
                type="button"
                aria-label="Une répétition de moins"
                onClick={() => setActualReps((v) => Math.max(0, v - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-3xl font-extrabold text-white/80 active:bg-white/20"
              >
                −
              </button>
              <Ring progress={null} accent={accent} size={196}>
                <p className="text-6xl font-extrabold tabular-nums tracking-tight">{actualReps}</p>
                <p className="text-sm font-bold text-white/50">
                  répétitions
                  {actualReps !== (step.reps ?? 0) && <span className="text-white/35"> · objectif {step.reps}</span>}
                </p>
              </Ring>
              <button
                type="button"
                aria-label="Une répétition de plus"
                onClick={() => setActualReps((v) => v + 1)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-3xl font-extrabold text-white/80 active:bg-white/20"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                recordSet(step.exerciseId, actualReps)
                tone(520, 0.2)
                goTo(stepIdx + 1)
              }}
              className="rounded-full bg-ink px-10 py-4 text-lg font-extrabold text-abysse shadow-lg shadow-black/30 active:bg-ink/90"
            >
              {session.category === 'muscu' ? 'Série faite ✓' : 'Fait ✓'}
            </button>
          </>
        ) : (
          <>
            <div className="my-2">
              <Ring progress={frac} accent={accent} size={236} pulse={paused}>
                <p
                  className={`text-6xl font-extrabold tabular-nums tracking-tight transition-opacity ${paused ? 'opacity-40' : ''}`}
                >
                  {mmss(remaining)}
                </p>
              </Ring>
            </div>
            {step.type !== 'work' && next && (
              <div className="rounded-2xl bg-white/5 px-5 py-3">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-white/40">
                  {next.manual ? 'Prochaine série' : 'Ensuite'}
                </p>
                <p className="mt-0.5 text-base font-extrabold">
                  {next.label}
                  {next.detail ? <span className="font-bold text-white/50"> · {next.detail}</span> : null}
                </p>
                <p className="text-sm font-bold text-white/50">
                  {next.manual ? `objectif ${next.reps} reps` : `${next.sec} s`}
                </p>
              </div>
            )}
            {/* Juste après l'effort : marquer la série qu'on vient de finir comme mal réalisée */}
            {step.type === 'rest' && lastSet && (
              <button
                type="button"
                onClick={() => toggleFlag(lastSet.exId, lastSet.idx)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-extrabold transition-colors ${
                  lastSetFlagged ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-white/40 active:bg-white/10'
                }`}
              >
                <TriangleAlert className="h-3.5 w-3.5" />
                {lastSetFlagged ? 'Mal réalisée — annuler' : 'Série ratée ?'}
              </button>
            )}
          </>
        )}
      </main>

      <footer className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mb-3 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Arrêter et enregistrer"
            title="Arrêter la séance ici (le réalisé est enregistré)"
            onClick={stopAndSave}
            className="flex h-13 w-13 items-center justify-center rounded-full bg-white/10 text-hiit active:bg-white/20"
          >
            <Square className="h-5 w-5" fill="currentColor" />
          </button>
          <button
            type="button"
            aria-label={paused ? 'Reprendre' : 'Pause'}
            title={paused ? 'Reprendre (espace)' : 'Mettre en pause (espace)'}
            onClick={() => setPaused((p) => !p)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-abysse shadow-lg shadow-black/40 active:bg-ink/90"
          >
            {paused ? <Play className="h-7 w-7" /> : <Pause className="h-7 w-7" />}
          </button>
          <button
            type="button"
            aria-label="Passer"
            title="Passer cette étape"
            onClick={skip}
            className="flex h-13 w-13 items-center justify-center rounded-full bg-white/10 text-white/80 active:bg-white/20"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* Tiroir programme : résumé permanent (bloc · tour · suivant), liste complète au tap */}
        <section className="rounded-3xl bg-white/5 ring-1 ring-white/10">
          <button
            type="button"
            aria-label="Programme"
            onClick={() => setDrawerOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left"
          >
            <ChevronUp
              className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-300 ${drawerOpen ? 'rotate-180' : ''}`}
            />
            <span className="shrink-0 text-sm font-extrabold">{drawerTitle}</span>
            <span className="ml-auto min-w-0 truncate pl-3 text-sm font-semibold text-white/40">
              {next ? `Ensuite : ${next.label}` : 'Dernier effort'}
            </span>
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${drawerOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          >
            <div className="overflow-hidden">
              <aside className="max-h-[42dvh] overflow-y-auto px-5 pb-4">
                {panelBlocks.map((b, bi) => {
                  const bState = bi < curBlock ? 'done' : bi === curBlock ? 'current' : 'todo'
                  const head = [
                    panelBlocks.length > 1 ? `Bloc ${bi + 1}` : '',
                    b.rounds > 1 ? (bState === 'current' ? `Tour ${curRound + 1}/${b.rounds}` : `×${b.rounds}`) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <div key={bi} className={bi > 0 ? 'mt-3' : ''}>
                      {head && (
                        <p
                          className={`text-[11px] font-extrabold uppercase tracking-wide ${
                            bState === 'current' ? 'text-white/80' : bState === 'done' ? 'text-white/25' : 'text-white/40'
                          }`}
                        >
                          {head}
                        </p>
                      )}
                      <ul className="mt-0.5">
                        {b.items.map((it, ii) => {
                          const ex = exercises.find((e) => e.id === it.exerciseId)
                          const st =
                            bState !== 'current' ? bState : ii < curItem ? 'done' : ii === curItem ? 'current' : 'todo'
                          const recorded = doneRef.current[it.exerciseId]?.length ?? 0
                          const exFlagged =
                            recorded > 0 &&
                            (doneRef.current[it.exerciseId] ?? []).some((_, i) => flagged.has(`${it.exerciseId}:${i}`))
                          return (
                            <li key={ii} ref={st === 'current' ? curRowRef : undefined}>
                              {/* Tap sur une ligne déjà travaillée = basculer « mal réalisé » */}
                              <button
                                type="button"
                                onClick={() => toggleFlagAll(it.exerciseId)}
                                className="flex w-full items-center gap-2 py-1.5 text-left"
                              >
                                {exFlagged && st !== 'current' ? (
                                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                ) : st === 'done' ? (
                                  <Check className="h-3.5 w-3.5 shrink-0 text-sage-400" />
                                ) : st === 'current' ? (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
                                ) : (
                                  <span className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span
                                  className={`min-w-0 flex-1 truncate text-sm ${
                                    st === 'current'
                                      ? 'font-extrabold'
                                      : st === 'done'
                                        ? 'font-semibold text-white/30'
                                        : 'font-semibold text-white/60'
                                  }`}
                                >
                                  {ex?.name ?? 'Exercice'}
                                </span>
                                {exFlagged && st === 'current' && (
                                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                )}
                                <span className={`shrink-0 text-xs font-bold ${st === 'current' ? 'text-white/60' : 'text-white/30'}`}>
                                  {itemLabel(session, it, ex)}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </aside>
            </div>
          </div>
        </section>
      </footer>
    </div>
  )
}
