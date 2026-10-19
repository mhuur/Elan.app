import { useState } from 'react'
import { Check, Repeat, Route, Footprints, RefreshCw } from 'lucide-react'
import { CategoryRing, Sheet } from './ui'
import { useData } from '../data/DataContext'
import { useStravaSync } from '../lib/useStravaSync'
import { DAY_NAMES, addDays, formatShortFr, toDateStr } from '../lib/dates'
import { isRepeat, stepSeconds, workoutStats, type PlanSeance, type Pace, type WorkoutStep, type WorkoutPart } from '../data/plan'
import type { Activity } from '../types'

// Charte 21KM : le dégradé du rouge course des zones (plan.ts) — pâle pour l'échauffement
// et la récupération, plein pour le travail. Libellés en encre : un rouge pâle sur blanc
// ne se lirait pas.
const KIND: Record<WorkoutStep['kind'], { bar: string; label: string }> = {
  warmup: { bar: '#f0a096', label: 'text-ink-soft' },
  steady: { bar: '#f0a096', label: 'text-ink-soft' },
  work: { bar: '#e5483a', label: 'text-running' },
  recovery: { bar: '#f6c9c3', label: 'text-ink-soft' },
  cooldown: { bar: '#f6c9c3', label: 'text-ink-soft' },
}
const HEIGHT: Record<WorkoutStep['kind'], number> = { warmup: 0.62, steady: 0.55, work: 0.96, recovery: 0.4, cooldown: 0.55 }

const fmtPace = (p: Pace) => (p.to ? `${p.from} – ${p.to}` : p.from)
const fmtDur = (sec: number) => {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m} min ${s} s` : `${m} min`
}
const fmtDist = (m: number) => (m >= 1000 ? `${m % 1000 === 0 ? m / 1000 : (m / 1000).toFixed(1)} km` : `${m} m`)

/** Quantité principale d'une étape : durée ou distance, en gras */
function StepAmount({ s }: { s: WorkoutStep }) {
  const amount = s.distanceM ? fmtDist(s.distanceM) : fmtDur(s.durationSec ?? 0)
  const isRecup = s.kind === 'recovery'
  return (
    <p className="text-base leading-[22px] tabular-nums">
      <span className="font-extrabold text-ink">{amount}</span>
      {isRecup ? (
        <span className="font-semibold text-ink-soft"> de récup.</span>
      ) : s.pace ? (
        <>
          <span className="font-semibold text-ink-soft"> à </span>
          <span className="font-extrabold text-ink">{fmtPace(s.pace)}</span>
          <span className="font-semibold text-ink-soft"> /km</span>
        </>
      ) : null}
      {s.hr && <span className="font-semibold text-ink-soft"> · {s.hr} bpm</span>}
    </p>
  )
}

function StepRow({ s, hideLabel }: { s: WorkoutStep; hideLabel?: boolean }) {
  const k = KIND[s.kind]
  return (
    <div className="flex items-stretch gap-3">
      <span className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: k.bar }} />
      <div className="min-w-0 flex-1 py-0.5">
        {!hideLabel && <p className={`text-[13px] font-bold ${k.label}`}>{s.label}</p>}
        <StepAmount s={s} />
        {s.note && <p className="mt-0.5 text-sm text-ink-soft">{s.note}</p>}
      </div>
    </div>
  )
}

/** Mini-diagramme à barres de la séquence (répétitions développées) */
function WorkoutBars({ parts }: { parts: WorkoutPart[] }) {
  const bars: WorkoutStep[] = []
  for (const part of parts) {
    if (isRepeat(part)) for (let i = 0; i < part.repeat; i++) bars.push(...part.steps)
    else bars.push(part)
  }
  if (bars.length < 2) return null
  return (
    <div className="flex h-16 items-end gap-0.5 rounded-sm bg-cream px-3 pt-3 pb-0">
      {bars.map((s, i) => (
        <span
          key={i}
          className="rounded-t-[3px]"
          style={{ flexGrow: Math.max(1, Math.round(stepSeconds(s))), flexBasis: 0, minWidth: 3, height: `${HEIGHT[s.kind] * 100}%`, backgroundColor: KIND[s.kind].bar }}
        />
      ))}
    </div>
  )
}

function Part({ part }: { part: WorkoutPart }) {
  if (isRepeat(part)) {
    return (
      <div className="relative rounded-sm bg-cream py-2.5 pl-3 pr-14">
        <div className="space-y-2">
          {part.steps.map((s, i) => (
            <StepRow key={i} s={s} />
          ))}
        </div>
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center text-ink-soft">
          <Repeat className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-[22px] leading-none font-extrabold tabular-nums">{part.repeat}</span>
        </div>
      </div>
    )
  }
  const pill = part.kind === 'warmup' ? 'Échauffement' : part.kind === 'cooldown' ? 'Récupération' : undefined
  return (
    <div className="relative rounded-sm border border-hairline bg-surface px-3 py-3">
      {pill && (
        <span className="absolute -top-2 left-3 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[13px] font-medium text-ink-soft">
          {pill}
        </span>
      )}
      <StepRow s={part} hideLabel={!!pill} />
    </div>
  )
}

/** Distance et durée estimées (répétitions développées), en deux tuiles */
function Measures({ parts }: { parts: WorkoutPart[] }) {
  const { sec, distM } = workoutStats({ parts })
  const tiles = [
    { l: 'Distance', v: (Math.round(distM / 100) / 10).toLocaleString('fr-FR'), u: 'km' },
    { l: 'Durée', v: String(Math.round(sec / 60)), u: 'min' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((t) => (
        <div key={t.l} className="flex flex-col gap-0.5 rounded-sm bg-cream px-3 py-2.5">
          <span className="text-[13px] leading-[18px] font-medium text-ink-soft">{t.l}</span>
          <span className="text-[22px] leading-7 font-extrabold tabular-nums">
            ≈ {t.v} <span className="text-sm font-medium text-ink-soft">{t.u}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

const fmtPaceSec = (sec?: number) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}/km` : '')
const activityLine = (a: Activity) =>
  `${a.distanceKm.toFixed(1)} km · ${Math.round(a.durationSec / 60)} min${a.paceSec ? ` · ${fmtPaceSec(a.paceSec)}` : ''}`

/** Valider une séance du plan : la relier à une vraie sortie COROS (ou non), en confirmant la date faite */
function Validation({ title, planRef, plannedDate, onClose }: { title: string; planRef: string; plannedDate: string; onClose: () => void }) {
  const { activities, logs, addLog, removeLog } = useData()
  const strava = useStravaSync()
  const [step, setStep] = useState<'idle' | 'picking' | 'confirm'>('idle')
  const [chosen, setChosen] = useState<Activity | null>(null)
  const [date, setDate] = useState(plannedDate)
  const existing = logs.find((l) => l.planRef === planRef)
  const assoc = existing?.activityId ? activities.find((a) => a.id === existing.activityId) : undefined
  // Ne proposer que les sorties récentes (≤ 1 semaine) : au-delà, ce n'est pas la course à valider
  const weekAgo = toDateStr(addDays(new Date(), -7))
  // Une sortie déjà utilisée pour valider une séance ne réapparaît pas (une course = une séance)
  const usedIds = new Set(logs.filter((l) => l.activityId).map((l) => l.activityId))
  const recent = activities.filter((a) => a.date >= weekAgo && !usedIds.has(a.id)).slice(0, 12)

  // Sélection d'une sortie (ou « sans sortie ») → on passe à la confirmation de date,
  // pré-remplie avec la date de la sortie COROS (ou le jour prévu).
  const pick = (a: Activity | null) => {
    setChosen(a)
    setDate(a?.date ?? plannedDate)
    setStep('confirm')
  }
  const validate = () => {
    void addLog({
      date,
      sessionId: '',
      sessionName: title,
      category: 'running',
      planRef,
      ...(chosen ? { activityId: chosen.id } : {}),
      ...(chosen
        ? {
            metrics: [
              { key: 'distance', label: 'Distance', unit: 'km', value: chosen.distanceKm },
              { key: 'duration', label: 'Durée', unit: 'min', value: Math.round(chosen.durationSec / 60) },
            ],
          }
        : {}),
      note: '',
      createdAt: Date.now(),
    })
    setStep('idle')
    onClose()
  }

  if (existing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm bg-sage-100 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-sage-700">
            <Check className="h-4 w-4" strokeWidth={3} /> Validée le {formatShortFr(existing.date)}
          </p>
          {assoc && <p className="mt-0.5 truncate text-xs font-semibold text-ink-soft">{activityLine(assoc)}</p>}
        </div>
        <button type="button" onClick={() => void removeLog(existing.id)} className="min-h-11 shrink-0 px-2 text-[15px] font-bold text-flare active:opacity-70">
          Annuler
        </button>
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <div className="space-y-3">
        <p className="text-base font-bold">Quel jour as-tu fait cette séance ?</p>
        {chosen && (
          <div className="rounded-sm border border-hairline bg-surface px-4 py-2.5">
            <p className="text-sm font-bold first-letter:uppercase">{formatShortFr(chosen.date)}</p>
            <p className="text-xs font-semibold text-ink-soft">{activityLine(chosen)}</p>
          </div>
        )}
        <input
          type="date"
          aria-label="Date de la séance"
          value={date}
          onChange={(e) => setDate(e.target.value || plannedDate)}
          className="h-12 w-full rounded-sm border border-hairline-strong bg-surface px-3.5 text-base text-ink outline-none focus:border-ink focus:ring-4 focus:ring-sage-100"
        />
        <button
          type="button"
          onClick={validate}
          className="w-full inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-sage-500 px-5 text-[17px] font-bold text-onaccent active:bg-sage-600"
        >
          Valider ✓
        </button>
        <button type="button" onClick={() => setStep('picking')} className="min-h-11 w-full text-center text-[15px] font-semibold text-ink-soft">
          Retour
        </button>
      </div>
    )
  }

  if (step === 'picking') {
    return (
      <div className="space-y-2">
        <p className="text-base font-bold">Quelle sortie correspond à cette séance ?</p>
        {strava.configured && (
          <button
            type="button"
            onClick={() => void strava.sync()}
            disabled={strava.syncing}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-ink px-4 text-[15px] font-bold text-ink active:bg-sage-50 disabled:opacity-50"
          >
            <RefreshCw className={'h-4 w-4 ' + (strava.syncing ? 'animate-spin' : '')} />
            {strava.syncing ? 'Synchronisation…' : 'Synchroniser depuis Strava'}
          </button>
        )}
        {strava.message && <p className="text-center text-xs font-semibold text-ink-soft">{strava.message}</p>}
        {recent.length === 0 && !strava.syncing && (
          <p className="rounded-sm bg-cream px-3 py-2.5 text-sm text-ink-soft">
            {strava.configured
              ? 'Aucune sortie récente (moins d\'une semaine). Tape « Synchroniser depuis Strava » ci-dessus.'
              : 'Aucune sortie récente (moins d\'une semaine). Double-clique « recuperer-mes-courses » sur ton PC, puis reviens ici.'}
          </p>
        )}
        {recent.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => pick(a)}
            className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-sm border border-hairline bg-surface px-4 py-2.5 text-left active:bg-sage-50"
          >
            <span className="text-base font-semibold first-letter:uppercase">{formatShortFr(a.date)}</span>
            <span className="shrink-0 text-sm text-ink-soft tabular-nums">{activityLine(a)}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => pick(null)}
          className="min-h-[52px] w-full rounded-full border-[1.5px] border-ink px-4 text-[17px] font-bold text-ink active:bg-sage-50"
        >
          Valider sans associer de sortie
        </button>
        <button type="button" onClick={() => setStep('idle')} className="min-h-11 w-full text-center text-[15px] font-semibold text-ink-soft">
          Annuler
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setStep('picking')}
      className="w-full inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-sage-500 px-5 text-[17px] font-bold text-onaccent active:bg-sage-600"
    >
      Valider ma séance ✓
    </button>
  )
}

export default function WorkoutSheet({
  seance,
  weekIdx,
  planRef,
  plannedDate,
  onClose,
}: {
  seance: PlanSeance | null
  weekIdx: number
  planRef: string
  plannedDate: string
  onClose: () => void
}) {
  return (
    <Sheet
      open={!!seance}
      onClose={onClose}
      title={
        seance ? (
          <div className="flex items-center gap-3">
            <CategoryRing category="running" size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 font-semibold text-sage-700">
                {DAY_NAMES[seance.day]} · semaine {weekIdx + 1}
              </p>
              <p className="truncate text-[22px] leading-7 font-extrabold">{seance.title}</p>
            </div>
            {seance.workout.surface && (
              <span className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-sage-50 px-3 text-sm font-semibold text-ink">
                {seance.workout.surface === 'piste' ? <Footprints className="h-3 w-3" /> : <Route className="h-3 w-3" />}
                {seance.workout.surface}
              </span>
            )}
          </div>
        ) : undefined
      }
    >
      {seance && (
        <div className="space-y-3">
          <Measures parts={seance.workout.parts} />
          <h3 className="pt-1 text-base leading-[22px] font-bold">Étapes</h3>
          <WorkoutBars parts={seance.workout.parts} />
          <div className="space-y-3 pt-1">
            {seance.workout.parts.map((part, i) => (
              <Part key={i} part={part} />
            ))}
          </div>
          <div className="border-t border-hairline pt-4">
            <Validation title={seance.title} planRef={planRef} plannedDate={plannedDate} onClose={onClose} />
          </div>
        </div>
      )}
    </Sheet>
  )
}
