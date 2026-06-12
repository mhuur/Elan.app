import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Flag } from 'lucide-react'
import { useData } from '../data/DataContext'
import { PageHeader } from '../components/ui'
import { DAY_SHORT, addDays, formatShortFr, toDateStr, todayStr } from '../lib/dates'
import {
  PLAN_ALLURES,
  PLAN_SEMI,
  currentWeekIndex,
  daysToRace,
  seanceDateStr,
  type PlanSeance,
  type PlanWeek,
} from '../data/plan'

function StatusIcon({ s, date, runDates, today }: { s: PlanSeance; date: string; runDates: Set<string>; today: string }) {
  const done = runDates.has(date)
  if (s.type === 'course' && !done)
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-running/10 text-running">
        <Flag className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    )
  if (done)
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-500 text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    )
  // Passée sans log = légèrement estompée, à venir = anneau simple
  return <span className={'h-6 w-6 shrink-0 rounded-full border-2 border-sand ' + (date < today ? 'bg-sand/60' : '')} />
}

function SeanceRow({ week, s, runDates, today }: { week: PlanWeek; s: PlanSeance; runDates: Set<string>; today: string }) {
  const date = seanceDateStr(week, s)
  const race = s.type === 'course'
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="w-9 pt-0.5 text-xs font-bold text-ink-soft">{DAY_SHORT[s.day]}</span>
      <div className="min-w-0 flex-1">
        <p className={'text-sm font-bold ' + (race ? 'text-running' : 'text-ink')}>{s.title}</p>
        {s.detail && <p className="mt-0.5 text-xs font-semibold text-ink-soft">{s.detail}</p>}
      </div>
      <StatusIcon s={s} date={date} runDates={runDates} today={today} />
    </div>
  )
}

export default function Plan() {
  const { logs } = useData()
  const today = todayStr()
  const cur = currentWeekIndex(today)
  const [open, setOpen] = useState<number | null>(cur >= 0 && cur < PLAN_SEMI.weeks.length ? cur : 0)
  const curRef = useRef<HTMLDivElement>(null)

  const runDates = useMemo(
    () => new Set(logs.filter((l) => l.category === 'running').map((l) => l.date)),
    [logs],
  )

  useEffect(() => {
    if (cur > 0) curRef.current?.scrollIntoView({ block: 'center' })
  }, [cur])

  const groups = useMemo(() => {
    const g: { phase: string; weeks: { week: PlanWeek; idx: number }[] }[] = []
    PLAN_SEMI.weeks.forEach((week, idx) => {
      if (!g.length || g[g.length - 1].phase !== week.phase) g.push({ phase: week.phase, weeks: [] })
      g[g.length - 1].weeks.push({ week, idx })
    })
    return g
  }, [])

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

      <section className="rounded-2xl bg-surface px-4 py-3 shadow-sm">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-sage-500">Allures repères</p>
        <div className="mt-2 space-y-1.5">
          {PLAN_ALLURES.map((a) => (
            <div key={a.label} className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-ink-soft">{a.label}</span>
              <span className="shrink-0 text-sm font-bold text-ink">{a.value}</span>
            </div>
          ))}
        </div>
      </section>

      {cur === -1 && (
        <p className="mt-4 px-1 text-sm font-semibold text-ink-soft">
          Le plan démarre le lundi {formatShortFr(PLAN_SEMI.weeks[0].start)} — d'ici là, on continue tranquillement.
        </p>
      )}

      {groups.map((g) => (
        <section key={g.phase}>
          <h2 className="px-1 pt-5 pb-2 text-[11px] font-extrabold uppercase tracking-widest text-sage-500">
            {g.phase} · {g.weeks.length} semaine{g.weeks.length > 1 ? 's' : ''}
          </h2>
          <div className="space-y-2">
            {g.weeks.map(({ week, idx }) => {
              const isOpen = open === idx
              const isCur = idx === cur
              const end = toDateStr(addDays(new Date(week.start + 'T12:00:00'), 6))
              const doneCount = week.seances.filter((s) => runDates.has(seanceDateStr(week, s))).length
              const complete = doneCount === week.seances.length
              return (
                <div key={week.start} ref={isCur ? curRef : undefined} className="rounded-2xl bg-surface shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div>
                      <p className={'text-sm font-extrabold ' + (isCur ? 'text-sage-600' : 'text-ink')}>
                        Semaine {idx + 1}
                        {week.label && <span className="font-bold text-ink-soft"> · {week.label}</span>}
                      </p>
                      <p className="text-[11px] font-semibold text-ink-soft">
                        {formatShortFr(week.start)} – {formatShortFr(end)}
                        {isCur && <span className="font-extrabold text-sage-600"> · en cours</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {complete ? (
                        <Check className="h-4 w-4 text-sage-500" strokeWidth={3} />
                      ) : (
                        <span className="text-xs font-bold text-ink-soft">{week.km} km</span>
                      )}
                      <ChevronDown
                        className={'h-4 w-4 text-ink-soft/60 transition-transform ' + (isOpen ? 'rotate-180' : '')}
                      />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-sand/60 border-t border-sand/60 pb-1">
                      {week.seances.map((s) => (
                        <SeanceRow key={s.day} week={week} s={s} runDates={runDates} today={today} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <p className="mt-5 px-1 text-xs font-semibold text-ink-soft">
        Allures calibrées sur l'objectif 1h50 — elles seront affinées avec tes données COROS.
      </p>
    </div>
  )
}
