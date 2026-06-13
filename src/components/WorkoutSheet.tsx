import { Repeat, Route, Footprints } from 'lucide-react'
import { Sheet } from './ui'
import { DAY_NAMES } from '../lib/dates'
import { isRepeat, stepSeconds, workoutStats, type PlanSeance, type Pace, type WorkoutStep, type WorkoutPart } from '../data/plan'

// Couleurs façon COROS Campus : échauffement/EF vert, travail orange, récup rose
const KIND: Record<WorkoutStep['kind'], { bar: string; border: string; label: string }> = {
  warmup: { bar: '#bcd35f', border: 'border-[#bcd35f]', label: 'text-[#74902a]' },
  steady: { bar: '#bcd35f', border: 'border-[#bcd35f]', label: 'text-[#74902a]' },
  work: { bar: '#f4733a', border: 'border-[#f4733a]', label: 'text-[#d4541c]' },
  recovery: { bar: '#f6b6cb', border: 'border-[#f6b6cb]', label: 'text-[#c76b89]' },
  cooldown: { bar: '#f6b6cb', border: 'border-[#f6b6cb]', label: 'text-[#c76b89]' },
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
    <p className="text-[15px] leading-tight">
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
        {!hideLabel && <p className={`text-xs font-extrabold uppercase tracking-wide ${k.label}`}>{s.label}</p>}
        <StepAmount s={s} />
        {s.note && <p className="mt-0.5 text-xs font-semibold text-ink-soft">{s.note}</p>}
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
    <div className="flex h-24 items-end gap-[3px] rounded-2xl bg-sage-50/70 px-3 pt-3 pb-0">
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
      <div className="relative rounded-2xl border border-sand bg-sage-50/40 py-2 pl-3 pr-14">
        <div className="space-y-2">
          {part.steps.map((s, i) => (
            <StepRow key={i} s={s} />
          ))}
        </div>
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center text-ink-soft">
          <Repeat className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-lg font-extrabold leading-none">{part.repeat}</span>
        </div>
      </div>
    )
  }
  const pill = part.kind === 'warmup' ? 'Échauffement' : part.kind === 'cooldown' ? 'Récupération' : undefined
  return (
    <div className="relative rounded-2xl border border-sand bg-surface px-3 py-2.5">
      {pill && (
        <span className="absolute -top-2 left-3 rounded-full border border-sand bg-surface px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-soft">
          {pill}
        </span>
      )}
      <StepRow s={part} hideLabel={!!pill} />
    </div>
  )
}

/** Résumé estimé : distance et durée totales (répétitions développées) */
function summary(parts: WorkoutPart[]): string {
  const { sec, distM } = workoutStats({ parts })
  return `≈ ${Math.round(distM / 100) / 10} km · ${Math.round(sec / 60)} min`
}

export default function WorkoutSheet({
  seance,
  weekIdx,
  onClose,
}: {
  seance: PlanSeance | null
  weekIdx: number
  onClose: () => void
}) {
  return (
    <Sheet
      open={!!seance}
      onClose={onClose}
      title={
        seance ? (
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-sage-500">
                {DAY_NAMES[seance.day]} · Semaine {weekIdx + 1}
              </p>
              <p className="mt-0.5 truncate text-lg font-extrabold">{seance.title}</p>
            </div>
            {seance.workout.surface && (
              <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-sage-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sage-700">
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
          <p className="-mt-2 text-xs font-bold text-ink-soft">{summary(seance.workout.parts)}</p>
          <WorkoutBars parts={seance.workout.parts} />
          <div className="space-y-2.5 pt-1">
            {seance.workout.parts.map((part, i) => (
              <Part key={i} part={part} />
            ))}
          </div>
          <button
            type="button"
            disabled
            title="Disponible bientôt : synchro via TrainingPeaks → COROS"
            className="mt-2 w-full rounded-2xl bg-sage-100 px-5 py-3.5 text-base font-bold text-sage-700 opacity-60"
          >
            Exporter vers COROS · TrainingPeaks <span className="font-semibold text-ink-soft">(bientôt)</span>
          </button>
        </div>
      )}
    </Sheet>
  )
}
