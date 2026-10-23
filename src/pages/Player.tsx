import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ListOrdered, Minus, Pause, Play, Plus, SkipForward, Square, TriangleAlert, X } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, displayCategory, setTargetsOf, type Exercise, type Session, type SessionItem } from '../types'
import { todayStr } from '../lib/dates'
import { mmss } from '../lib/format'
import { muscuBlocks } from '../lib/blocks'
import { progressedSession } from '../lib/progression'
import { tone as playTone } from '../lib/audio'
import { CategoryRing } from '../components/ui'

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
    // repos automatique entre les séries.
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
            const restSec = it.restSec ?? 60
            if (!veryLast && restSec > 0) steps.push({ type: 'rest', label: 'Repos', sec: restSec })
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
          // Séries de la posture : 2 × 30 s pour un étirement fait des deux côtés
          const sets = Math.max(1, it.sets ?? 1)
          for (let s = 0; s < sets; s++) {
            // Bloc et tour sont affichés en permanence dans la colonne programme
            const detail = sets > 1 ? `Série ${s + 1}/${sets}` : undefined
            if (ex?.measure === 'reps') {
              steps.push({
                type: 'work',
                label: nameOf(it.exerciseId),
                sec: 30,
                manual: true,
                reps: it.target ?? 10,
                comment: it.comment,
                detail,
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
                detail,
                exerciseId: it.exerciseId,
                block: bi,
                round: r,
                item: i,
              })
            }
            const veryLast =
              bi === blocks.length - 1 && r === b.rounds - 1 && i === b.items.length - 1 && s === sets - 1
            if (rest > 0 && !veryLast) steps.push({ type: 'rest', label: 'Transition', sec: rest })
          }
        })
      }
    })
  }
  return steps
}

/** Prescription d'un exercice pour le panneau programme : « 3 × 12 », « 30 / 20 / 15 s », « 45 s », « 10 reps » */
function itemLabel(session: Session, it: SessionItem, ex?: Exercise): string {
  if (session.category === 'hiit') return `${it.durationSec ?? session.workSec ?? 45} s`
  if (session.category === 'etirements') {
    const pre = (it.sets ?? 1) > 1 ? `${it.sets} × ` : ''
    return ex?.measure === 'reps' ? `${pre}${it.target ?? 10} reps` : `${pre}${it.durationSec ?? 30} s`
  }
  const tgs = setTargetsOf(it)
  const unit = ex?.measure === 'sec' ? ' s' : ''
  return tgs.every((t) => t === tgs[0]) ? `${tgs.length} × ${tgs[0]}${unit}` : tgs.join(' / ') + unit
}

/**
 * Minuteur, charte 21KM (planche Minuteur) : lu posé au sol à 1–2 m. Fond Effort
 * pendant un exercice, Repos (bleu-vert profond) pendant la récupération, Pause gris ;
 * anneau Volt à l'effort, turquoise au repos, gris en pause.
 */
const VOLT = '#C5F23A'
const CALM = '#5ED3C4'
const TRACK = '#2A2F37'

/** Anneau de progression : piste + arc qui se vide avec le temps restant */
function Ring({
  progress,
  accent,
  track = TRACK,
  children,
}: {
  /** Fraction restante (0..1), ou null pour une étape sans chrono (piste seule) */
  progress: number | null
  accent: string
  track?: string
  children: ReactNode
}) {
  const c = 2 * Math.PI * 45
  return (
    <div className="relative h-[272px] w-[272px] shrink-0 lg:h-[340px] lg:w-[340px]">
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <circle cx="50" cy="50" r="45" fill="none" stroke={track} strokeWidth="4" />
        {progress != null && (
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={accent}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            transform="rotate(-90 50 50)"
            className="transition-[stroke-dashoffset] duration-150 ease-linear"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">{children}</div>
    </div>
  )
}

/** Bouton XL du minuteur (« Série faite », « Reprendre ») : 88 px, Volt */
const xlBtn =
  'flex h-[88px] w-full max-w-[358px] shrink-0 items-center justify-center gap-3 rounded-full bg-sage-500 text-[26px] font-extrabold text-ink active:scale-[0.97] active:bg-sage-600 lg:h-24 lg:max-w-[520px] lg:text-[30px]'

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
        <button type="button" className="font-extrabold text-sage-700" onClick={() => navigate('/')}>
          ← Retour
        </button>
      </div>
    )
  }

  // Couleur affichée (ÉTIR pour une séance en séries faite d'étirements) ; le déroulé reste `category`
  const shownCat = displayCategory(session, exercises)
  const meta = CATEGORY_META[shownCat]
  const step = steps[stepIdx]
  const next = steps.slice(stepIdx + 1).find((s) => s.type === 'work')
  // Position dans la structure : pendant un repos/la préparation, on pointe déjà l'effort suivant
  const posStep = step?.type === 'work' ? step : (next ?? step)
  const curBlock = posStep?.block ?? 0
  const curRound = posStep?.round ?? 0
  const curItem = posStep?.item ?? 0

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

  /** Valider une série chronométrée avant la fin du chrono : elle compte pour sa durée
   *  PRÉVUE (choix de Romain, 23/10/2026), exactement comme si le chrono était allé au bout,
   *  et le minuteur enchaîne. (« Passer », lui, journalise le temps réellement tenu.) */
  const validateEarly = () => {
    recordSet(step.exerciseId, step.sec)
    tone(520, 0.2)
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-abysse px-6 text-center text-white">
        <CategoryRing category={shownCat} size={72} done />
        <div>
          <h1 className="text-[34px] leading-10 font-extrabold lg:text-5xl">{session.name}</h1>
          <p className="mt-1 text-[17px] text-night-soft tabular-nums">
            {meta.label} · {workCount} {session.category === 'muscu' ? 'séries' : 'exercices'} · {Math.max(1, Math.round(totalSec / 60))} min
          </p>
        </div>
        <button type="button" onClick={start} className={xlBtn}>
          <Play className="h-8 w-8" fill="currentColor" />
          C'est parti !
        </button>
        <button type="button" onClick={() => navigate(-1)} className="min-h-11 px-4 text-[17px] font-semibold text-night-soft">
          Annuler
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    const setsDone = Object.values(doneRef.current).reduce((a, s) => a + s.length, 0)
    return (
      <div className="flex min-h-dvh flex-col bg-abysse px-4 pt-10 pb-8 text-white lg:items-center lg:px-12">
        <div className="flex w-full max-w-[640px] flex-col gap-4">
          <div>
            <h1 className="text-5xl leading-[1.05] font-extrabold lg:text-[64px]">Bravo</h1>
            <p className="mt-1.5 text-[17px] leading-6 text-night-soft">{session.name} terminée et enregistrée</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5 rounded-sm bg-night p-3">
              <span className="text-[13px] leading-[18px] font-medium text-night-soft">Séries</span>
              <span className="text-2xl leading-[30px] font-extrabold tabular-nums">
                {setsDone}/{workCount}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-sm bg-night p-3">
              <span className="text-[13px] leading-[18px] font-medium text-night-soft">Durée prévue</span>
              <span className="text-2xl leading-[30px] font-extrabold tabular-nums">{mmss(totalSec)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="mt-2 h-[52px] rounded-full bg-sage-500 text-[17px] font-bold text-ink active:bg-sage-600"
          >
            Retour à ma journée
          </button>
        </div>
      </div>
    )
  }

  // Fond par phase (planche Main, « Minuteur, fond sombre ») et couleur de l'anneau
  const resting = step.type !== 'work'
  const bg = paused ? 'bg-pause' : resting ? 'bg-repos' : 'bg-abysse'
  const accent = paused ? '#8A919C' : step.type === 'rest' ? CALM : step.type === 'prep' ? '#FFFFFF' : VOLT
  const track = step.type === 'rest' && !paused ? 'rgba(255,255,255,0.18)' : TRACK
  const workSteps = steps.filter((s) => s.type === 'work')

  /** Liste du programme : blocs, tours, exercices (volet sur téléphone, colonne sur bureau) */
  const programList = (
    <ol className="flex flex-col gap-2 px-5 pb-5">
      {panelBlocks.map((b, bi) => {
        const bState = bi < curBlock ? 'done' : bi === curBlock ? 'current' : 'todo'
        const head = [
          panelBlocks.length > 1 ? `Bloc ${bi + 1}` : '',
          b.rounds > 1 ? (bState === 'current' ? `Tour ${curRound + 1} sur ${b.rounds}` : `${b.rounds} tours`) : '',
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <li key={bi} className="flex flex-col gap-2">
            {head && <p className={`mt-1 text-sm font-semibold ${bState === 'done' ? 'text-ink-soft' : 'text-night-soft'}`}>{head}</p>}
            <ul className="flex flex-col gap-2">
              {b.items.map((it, ii) => {
                const ex = exercises.find((e) => e.id === it.exerciseId)
                const st = bState !== 'current' ? bState : ii < curItem ? 'done' : ii === curItem ? 'current' : 'todo'
                const recorded = doneRef.current[it.exerciseId]?.length ?? 0
                const exFlagged =
                  recorded > 0 && (doneRef.current[it.exerciseId] ?? []).some((_, i) => flagged.has(`${it.exerciseId}:${i}`))
                return (
                  <li key={ii} ref={st === 'current' ? curRowRef : undefined}>
                    {/* Tap sur une ligne déjà travaillée = basculer « mal réalisé » */}
                    <button
                      type="button"
                      onClick={() => toggleFlagAll(it.exerciseId)}
                      className={
                        'flex w-full flex-col gap-1 rounded-sm px-3.5 py-3 text-left ' +
                        (st === 'current' ? 'bg-night-line' : 'ring-1 ring-night-line ring-inset')
                      }
                    >
                      <span className="flex items-baseline gap-3">
                        <span className={`min-w-0 flex-1 text-[17px] leading-[22px] font-bold ${st === 'done' ? 'text-night-soft' : ''}`}>
                          {ex?.name ?? 'Exercice'}
                        </span>
                        <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${st === 'done' ? 'text-night-soft' : ''}`}>
                          {itemLabel(session, it, ex)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-sm text-night-soft">
                        {exFlagged ? (
                          <TriangleAlert className="h-4 w-4 text-amber-300" />
                        ) : st === 'done' ? (
                          <Check className="h-4 w-4" style={{ color: VOLT }} />
                        ) : null}
                        {exFlagged ? 'mal réalisé' : st === 'done' ? 'fait' : st === 'current' ? 'en cours' : 'à venir'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ol>
  )

  const ctrlBtn = 'flex h-16 w-16 items-center justify-center rounded-full bg-night active:scale-95 active:bg-night-line lg:h-[76px] lg:w-[76px]'

  return (
    <div className={`relative flex min-h-dvh text-white transition-colors duration-700 ${bg}`}>
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col gap-3 px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:gap-3.5 lg:px-12 lg:pt-7 lg:pb-8">
        <header className="flex items-center gap-3">
          <button type="button" onClick={quit} aria-label="Quitter" className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-night active:bg-night-line">
            <X className="h-[22px] w-[22px]" />
          </button>
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-3">
            <span className="text-2xl leading-[1.1] font-extrabold tabular-nums lg:text-[30px]">
              {workIdx + 1}/{workCount}
            </span>
            <span className="text-[17px] text-night-soft tabular-nums lg:text-xl">reste {mmss(remainTotalSec)}</span>
          </div>
          <button
            type="button"
            aria-label="Programme"
            onClick={() => setDrawerOpen((o) => !o)}
            className="inline-flex h-[52px] shrink-0 items-center gap-2 rounded-full bg-night pr-[18px] pl-3.5 text-base font-bold active:bg-night-line lg:hidden"
          >
            <ListOrdered className="h-[22px] w-[22px]" />
            Programme
          </button>
        </header>

        {/* Une barre par série : faites en Volt, en cours en blanc */}
        <div aria-hidden="true" className="flex gap-[3px]">
          {workSteps.map((_, i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{ backgroundColor: i < workIdx + (step.type === 'work' ? 0 : 1) ? VOLT : i === workIdx && step.type === 'work' ? '#FFFFFF' : track }}
            />
          ))}
        </div>
        <p className="text-[15px] leading-[1.35] text-night-soft lg:text-lg">
          {meta.label} · {session.name}
          {drawerTitle !== 'Programme' ? ` · ${drawerTitle.toLowerCase()}` : ''}
        </p>

        <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          {paused ? (
            <p className="text-[34px] leading-[1.15] font-extrabold lg:text-5xl">En pause</p>
          ) : step.type === 'rest' ? (
            <p className="text-[34px] leading-[1.15] font-extrabold lg:text-5xl" style={{ color: CALM }}>
              {step.label}
            </p>
          ) : step.type === 'prep' ? (
            <p className="text-[34px] leading-[1.15] font-extrabold lg:text-5xl">Préparez-vous…</p>
          ) : (
            <div className="flex flex-col gap-1">
              <h1 className="text-[34px] leading-[1.15] font-extrabold lg:text-5xl">{step.label}</h1>
              {step.detail && <p className="text-[19px] leading-[1.3] text-night-soft tabular-nums lg:text-2xl">{step.detail}</p>}
            </div>
          )}

          {step.manual ? (
            <>
              <div className="flex items-center justify-center gap-2 lg:gap-8">
                <button
                  type="button"
                  aria-label="Une répétition de moins"
                  onClick={() => setActualReps((v) => Math.max(0, v - 1))}
                  className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-night active:bg-night-line lg:h-24 lg:w-24"
                >
                  <Minus className="h-9 w-9" strokeWidth={2.5} />
                </button>
                <span className="min-w-[170px] text-center text-[160px] leading-none font-extrabold tracking-[-0.03em] tabular-nums lg:min-w-[300px] lg:text-[240px]">
                  {actualReps}
                </span>
                <button
                  type="button"
                  aria-label="Une répétition de plus"
                  onClick={() => setActualReps((v) => v + 1)}
                  className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-night active:bg-night-line lg:h-24 lg:w-24"
                >
                  <Plus className="h-9 w-9" strokeWidth={2.5} />
                </button>
              </div>
              <p className="text-[19px] text-night-soft tabular-nums lg:text-2xl">
                répétitions{actualReps !== (step.reps ?? 0) ? ` · objectif ${step.reps}` : ''}
              </p>
              {step.comment && <p className="max-w-[640px] text-[21px] leading-[1.3] font-medium lg:text-[30px]">{step.comment}</p>}
              <button
                type="button"
                onClick={() => {
                  recordSet(step.exerciseId, actualReps)
                  tone(520, 0.2)
                  goTo(stepIdx + 1)
                }}
                className={xlBtn}
              >
                {session.category === 'muscu' ? 'Série faite ✓' : 'Fait ✓'}
              </button>
            </>
          ) : (
            <>
              <Ring progress={frac} accent={accent} track={track}>
                <span
                  className={
                    'leading-none font-extrabold tracking-[-0.03em] tabular-nums ' +
                    (step.type === 'prep' ? 'text-[150px] lg:text-[200px] ' : 'text-[88px] lg:text-[116px] ') +
                    (paused ? 'text-night-soft' : '')
                  }
                >
                  {step.type === 'prep' ? remaining : mmss(remaining)}
                </span>
                {step.type !== 'prep' && <span className="text-[15px] text-night-soft tabular-nums lg:text-lg">sur {mmss(step.sec)}</span>}
              </Ring>
              {step.type === 'work' && step.comment && !paused && (
                <p className="max-w-[640px] text-[21px] leading-[1.3] font-medium lg:text-[30px]">{step.comment}</p>
              )}
              {/* Série chronométrée terminée avant la fin du chrono (demande de Romain, 23/10/2026) */}
              {step.type === 'work' && !paused && (
                <button
                  type="button"
                  onClick={validateEarly}
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-full px-6 text-[17px] font-bold text-white ring-[1.5px] ring-white ring-inset active:scale-[0.97] active:bg-night"
                >
                  <Check className="h-5 w-5" strokeWidth={2.6} />
                  Valider maintenant
                </button>
              )}
              {paused && (
                <button type="button" onClick={() => setPaused(false)} className={xlBtn}>
                  <Play className="h-[30px] w-[30px]" fill="currentColor" />
                  Reprendre
                </button>
              )}
              {!paused && step.type !== 'work' && next && (
                <div className="text-center">
                  <p className="text-[15px] text-night-soft lg:text-lg">{step.type === 'prep' ? 'Premier exercice' : 'Ensuite'}</p>
                  <p className="text-xl leading-[1.25] font-bold lg:text-[28px]">
                    {next.label}
                    {next.manual ? ` · ${next.reps} répétitions` : ` · ${next.sec} s`}
                  </p>
                </div>
              )}
              {/* Juste après l'effort : marquer la série qu'on vient de finir comme mal réalisée */}
              {!paused && step.type === 'rest' && lastSet && (
                <button
                  type="button"
                  onClick={() => toggleFlag(lastSet.exId, lastSet.idx)}
                  className={
                    'inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-bold ' +
                    (lastSetFlagged ? 'bg-amber-300/15 text-amber-300' : 'text-white ring-[1.5px] ring-white/40 ring-inset')
                  }
                >
                  <TriangleAlert className="h-4 w-4" />
                  {lastSetFlagged ? 'Mal réalisée — annuler' : 'Série ratée ?'}
                </button>
              )}
            </>
          )}
          {stepExercise?.videoUrl && !paused && (
            <a
              href={stepExercise.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-night px-4 text-[15px] font-bold active:bg-night-line"
            >
              <Play className="h-4 w-4" /> Vidéo
            </a>
          )}
        </main>

        <div className="flex justify-center gap-7 lg:gap-10">
          <button
            type="button"
            aria-label="Arrêter et enregistrer"
            title="Arrêter la séance ici (le réalisé est enregistré)"
            onClick={stopAndSave}
            className="flex flex-col items-center gap-1.5 text-[15px] font-semibold"
          >
            <span className={ctrlBtn}>
              <Square className="h-7 w-7" strokeWidth={2.2} />
            </span>
            Arrêter
          </button>
          <button
            type="button"
            aria-label={paused ? 'Reprendre' : 'Pause'}
            title={paused ? 'Reprendre (espace)' : 'Mettre en pause (espace)'}
            onClick={() => setPaused((p) => !p)}
            className="flex flex-col items-center gap-1.5 text-[15px] font-semibold"
          >
            <span className={ctrlBtn}>{paused ? <Play className="h-7 w-7" fill="currentColor" /> : <Pause className="h-7 w-7" strokeWidth={2.2} />}</span>
            {paused ? 'Reprendre' : 'Pause'}
          </button>
          <button
            type="button"
            aria-label="Passer"
            title="Passer cette étape"
            onClick={skip}
            className="flex flex-col items-center gap-1.5 text-[15px] font-semibold"
          >
            <span className={ctrlBtn}>
              <SkipForward className="h-7 w-7" strokeWidth={2.2} />
            </span>
            Passer
          </button>
        </div>
      </div>

      {/* Programme : colonne de 400 px sur bureau, volet du bas sur téléphone */}
      <aside aria-label="Programme de la séance" className="hidden w-[400px] shrink-0 flex-col border-l border-night-line bg-[#13161b] pt-5 lg:flex">
        <header className="px-5 pt-4 pb-2">
          <h2 className="text-[22px] leading-7 font-extrabold">Programme</h2>
          <p className="text-sm text-night-soft tabular-nums">
            {workIdx + 1}/{workCount} · reste {mmss(remainTotalSec)}
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{programList}</div>
      </aside>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/55" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[75dvh] flex-col rounded-t-xl bg-night">
            <div className="flex justify-center pt-2">
              <span className="h-[5px] w-10 rounded-full bg-ink-soft" />
            </div>
            <header className="flex items-center gap-3 px-5 pt-4 pb-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] leading-7 font-extrabold">Programme</h2>
                <p className="text-sm text-night-soft tabular-nums">
                  {workIdx + 1}/{workCount} · {next ? `ensuite : ${next.label}` : 'dernier effort'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fermer le programme"
                onClick={() => setDrawerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-night-line"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{programList}</div>
          </div>
        </div>
      )}
    </div>
  )
}
