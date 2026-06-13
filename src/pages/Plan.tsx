import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronRight, Footprints, Zap } from 'lucide-react'
import { useData } from '../data/DataContext'
import { PageHeader } from '../components/ui'
import WorkoutSheet from '../components/WorkoutSheet'
import { DAY_NAMES, addDays, formatShortFr, toDateStr, todayStr } from '../lib/dates'
import {
  PLAN_ALLURES,
  PLAN_SEMI,
  TYPE_DIFFICULTY,
  currentWeekIndex,
  daysToRace,
  seanceDateStr,
  workoutStats,
  type PlanSeance,
  type PlanWeek,
} from '../data/plan'

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}`
}
const fmtKm = (m: number) => (Math.round(m / 100) / 10).toFixed(1)

type Status = 'done' | 'today' | 'missed' | 'todo'
function statusOf(date: string, runDates: Set<string>, today: string): Status {
  if (runDates.has(date)) return 'done'
  if (date === today) return 'today'
  if (date < today) return 'missed'
  return 'todo'
}
const STATUS_META: Record<Status, { label: string; cls: string }> = {
  done: { label: 'Validée', cls: 'bg-sage-100 text-sage-700' },
  today: { label: "Aujourd'hui", cls: 'bg-sage-500 text-white' },
  missed: { label: 'Non faite', cls: 'bg-sand text-ink-soft' },
  todo: { label: 'À venir', cls: 'bg-sand/60 text-ink-soft' },
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums leading-none">
        {value}
        {unit && <span className="ml-0.5 text-xs font-bold text-ink-soft">{unit}</span>}
      </p>
    </div>
  )
}

function Difficulty({ n }: { n: number }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-soft">Difficulté</p>
      <div className="mt-1 flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Zap key={i} className={'h-4 w-4 ' + (i <= n ? 'fill-running text-running' : 'fill-ink-soft/15 text-ink-soft/15')} />
        ))}
      </div>
    </div>
  )
}

function SeanceCard({
  week,
  s,
  idx,
  total,
  runDates,
  today,
  onOpen,
}: {
  week: PlanWeek
  s: PlanSeance
  idx: number
  total: number
  runDates: Set<string>
  today: string
  onOpen: () => void
}) {
  const date = seanceDateStr(week, s)
  const st = STATUS_META[statusOf(date, runDates, today)]
  const { sec, distM } = workoutStats(s.workout)
  const diff = TYPE_DIFFICULTY[s.type]
  const tile = diff >= 4 ? 'bg-running/15 text-running' : diff === 3 ? 'bg-running/10 text-running' : 'bg-sage-100 text-sage-600'
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-2xl bg-surface text-left shadow-sm active:bg-sage-50/50">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <span className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ' + tile}>
          <Footprints className="h-6 w-6" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={'rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ' + st.cls}>{st.label}</span>
            <span className="text-xs font-bold text-ink-soft">
              Séance {idx + 1}/{total} · {DAY_NAMES[s.day]}
            </span>
          </div>
          <p className="mt-0.5 truncate text-base font-extrabold">{s.title}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft/40" />
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-sand/60 px-4 py-3">
        <Metric label="Durée" value={fmtDur(sec)} unit="min" />
        <Metric label="Distance" value={fmtKm(distM)} unit="km" />
        <Difficulty n={diff} />
      </div>
    </button>
  )
}

export default function Plan() {
  const { logs } = useData()
  const today = todayStr()
  const weeks = PLAN_SEMI.weeks
  const cur = currentWeekIndex(today)
  const clampedCur = Math.min(weeks.length - 1, Math.max(0, cur))
  const [weekIdx, setWeekIdx] = useState(clampedCur)
  const [sheet, setSheet] = useState<PlanSeance | null>(null)

  const runDates = useMemo(() => new Set(logs.filter((l) => l.category === 'running').map((l) => l.date)), [logs])

  const week = weeks[weekIdx]
  const end = toDateStr(addDays(new Date(week.start + 'T12:00:00'), 6))
  const totals = useMemo(() => {
    let sec = 0
    let distM = 0
    for (const s of week.seances) {
      const st = workoutStats(s.workout)
      sec += st.sec
      distM += st.distM
    }
    return { sec, distM }
  }, [week])

  const dtr = daysToRace(today)

  return (
    <div className="px-4 pb-4">
      <PageHeader
        kicker="Plan semi · sub 1h50"
        title={PLAN_SEMI.race}
        right={
          dtr >= 0 ? (
            <div className="text-right">
              <p className="text-2xl font-extrabold text-ink">J-{dtr}</p>
              <p className="text-[11px] font-bold text-ink-soft">dim. {formatShortFr(PLAN_SEMI.raceDate)}</p>
            </div>
          ) : undefined
        }
      />

      {/* Navigation semaine par semaine */}
      <div className="flex items-center justify-between gap-3 pb-3 pt-1">
        <button
          type="button"
          aria-label="Semaine précédente"
          disabled={weekIdx === 0}
          onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
          className="rounded-full bg-surface p-2.5 shadow-sm active:bg-sage-50 disabled:opacity-30"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-base font-extrabold">{weekIdx === cur ? 'Cette semaine' : `Semaine ${weekIdx + 1}`}</p>
          <p className="text-xs font-bold text-ink-soft">{weekIdx + 1} sur {weeks.length}</p>
        </div>
        <button
          type="button"
          aria-label="Semaine suivante"
          disabled={weekIdx === weeks.length - 1}
          onClick={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))}
          className="rounded-full bg-surface p-2.5 shadow-sm active:bg-sage-50 disabled:opacity-30"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Aperçu hebdomadaire */}
      <section className="rounded-2xl bg-surface px-4 py-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-extrabold">Ton aperçu hebdomadaire</p>
          <span className="shrink-0 rounded-full bg-sage-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sage-700">
            {week.phase}
          </span>
        </div>
        <p className="mt-0.5 text-xs font-semibold text-ink-soft">
          {formatShortFr(week.start)} – {formatShortFr(end)}
          {week.label && <span className="text-ink-soft"> · {week.label}</span>}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Activités" value={String(week.seances.length)} />
          <Metric label="Durée" value={fmtDur(totals.sec)} unit="min" />
          <Metric label="Distance" value={fmtKm(totals.distM)} unit="km" />
        </div>
      </section>

      {/* Séances de la semaine */}
      <div className="mt-3 space-y-3">
        {week.seances.map((s, i) => (
          <SeanceCard
            key={s.day}
            week={week}
            s={s}
            idx={i}
            total={week.seances.length}
            runDates={runDates}
            today={today}
            onOpen={() => setSheet(s)}
          />
        ))}
      </div>

      {/* Allures repères, en pied de page */}
      <section className="mt-4 rounded-2xl bg-sage-50 px-4 py-3">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-sage-600">Allures repères</p>
        <div className="mt-2 space-y-1">
          {PLAN_ALLURES.map((a) => (
            <div key={a.label} className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-ink-soft">{a.label}</span>
              <span className="shrink-0 text-sm font-bold text-ink">{a.value}</span>
            </div>
          ))}
        </div>
      </section>

      <WorkoutSheet seance={sheet} weekIdx={weekIdx} onClose={() => setSheet(null)} />
    </div>
  )
}
