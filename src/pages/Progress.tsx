import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronRight, MoveRight, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Exercise, type Log, type MetricValue, type Session } from '../types'
import { addDays, formatDayMonth, formatShortFr, startOfWeek, toDateStr, todayStr } from '../lib/dates'
import { logSummary } from '../lib/format'
import { goalLevels } from '../lib/metrics'
import { buildTimeline } from '../lib/timeline'
import { CategoryIcon, Chip, EmptyState, PageHeader, Select, Sheet } from '../components/ui'
import LogSheet from '../components/LogSheet'

const HEAT_WEEKS = 16

/** Heatmap d'activité façon Strava/GitHub : 16 semaines, lundi en haut */
function Heatmap({ logs }: { logs: Log[] }) {
  const byDate = new Map<string, number>()
  for (const l of logs) byDate.set(l.date, (byDate.get(l.date) ?? 0) + 1)
  const monday = startOfWeek(new Date())
  const today = todayStr()
  return (
    <div className="flex justify-between gap-1">
      {Array.from({ length: HEAT_WEEKS }, (_, w) => {
        const ws = addDays(monday, -7 * (HEAT_WEEKS - 1 - w))
        return (
          <div key={w} className="flex flex-col gap-1">
            {Array.from({ length: 7 }, (_, d) => {
              const ds = toDateStr(addDays(ws, d))
              const count = byDate.get(ds) ?? 0
              const cls =
                ds > today
                  ? 'bg-transparent'
                  : count === 0
                    ? 'bg-sand/70'
                    : count === 1
                      ? 'bg-sage-300'
                      : count === 2
                        ? 'bg-sage-500'
                        : 'bg-sage-700'
              return <div key={d} title={`${formatShortFr(ds)} : ${count}`} className={'h-3.5 w-3.5 rounded-[4px] ' + cls} />
            })}
          </div>
        )
      })}
    </div>
  )
}

const axisStyle = { fontSize: 11, fontFamily: 'Nunito', fill: '#717d72' }

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-extrabold">{title}</h2>
      {children}
    </section>
  )
}

/** Tendance entre les deux derniers points : ↗ / ↘ au-delà de ±3 %, → sinon */
function Trend({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="w-12 shrink-0 text-center text-xs font-bold text-ink-soft/40">—</span>
  const prev = values[values.length - 2]
  const last = values[values.length - 1]
  const pct = prev ? Math.round(((last - prev) / prev) * 100) : 0
  if (!prev || Math.abs(pct) < 3)
    return (
      <span className="w-12 shrink-0 text-center">
        <MoveRight className="inline h-3.5 w-3.5 text-ink-soft/60" />
      </span>
    )
  const up = pct > 0
  return (
    <span className={`w-12 shrink-0 text-center text-xs font-extrabold ${up ? 'text-sage-600' : 'text-running'}`}>
      {up ? <TrendingUp className="inline h-3.5 w-3.5" /> : <TrendingDown className="inline h-3.5 w-3.5" />} {Math.abs(pct)}%
    </span>
  )
}

/** Mini-courbe inline (10 derniers points) */
function Sparkline({ values, color, width = 60, height = 24 }: { values: number[]; color: string; width?: number; height?: number }) {
  const pts = values.slice(-10)
  if (pts.length < 2) return <span className="shrink-0" style={{ width }} />
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const step = width / (pts.length - 1)
  const xy = pts.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)] as const)
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = xy[xy.length - 1]
  return (
    <svg width={width} height={height} className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <circle cx={lx} cy={ly} r={2.5} fill={color} />
    </svg>
  )
}

/** Suivi d'un exercice : un point par séance journalisée */
interface ExoTracker {
  kind: 'exo'
  ex: Exercise
  unit: string
  points: { date: string; best: number; volume: number; sets: number[]; flagged: number[] }[]
}
/** Suivi des mesures d'une séance (vélo, champs perso) */
interface MetricTracker {
  kind: 'metrics'
  session: Session
  defs: MetricValue[]
  series: Record<string, { date: string; value: number }[]>
}

/** Fiche détail d'un exercice : grand graphe, paliers, dernières séries */
function ExoSheet({ t, onClose }: { t: ExoTracker | null; onClose: () => void }) {
  return (
    <Sheet
      open={!!t}
      onClose={onClose}
      title={
        t ? (
          <span className="flex items-center gap-2">
            <CategoryIcon category={t.ex.category} className={`h-5 w-5 shrink-0 ${CATEGORY_META[t.ex.category].text}`} />
            <span className="min-w-0 truncate">{t.ex.name}</span>
          </span>
        ) : undefined
      }
    >
      {t && <ExoSheetInner key={t.ex.id} t={t} />}
    </Sheet>
  )
}

function ExoSheetInner({ t }: { t: ExoTracker }) {
  const [metric, setMetric] = useState<'best' | 'volume'>('best')
  const data = t.points.map((p) => ({ date: p.date, value: p[metric] }))
  const color = CATEGORY_META[t.ex.category].hex
  const goal = t.ex.goal ?? null
  const levels = goal ? goalLevels(goal) : []
  const levelsOnChart = goal && goal.metric === metric ? levels : []
  const goalBest = goal ? Math.max(0, ...t.points.map((p) => (goal.metric === 'best' ? p.best : p.volume))) : 0
  const nextLevel = levels.find((lv) => goalBest < lv.value)
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <Chip active={metric === 'best'} onClick={() => setMetric('best')}>
          Meilleure série
        </Chip>
        <Chip active={metric === 'volume'} onClick={() => setMetric('volume')}>
          Volume total
        </Chip>
      </div>
      {data.length >= 2 ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee9dd" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip formatter={(v) => [`${v} ${t.unit}`, '']} />
              {levelsOnChart.map((lv) => (
                <ReferenceLine key={lv.value} y={lv.value} stroke="#c2773e" strokeWidth={2} strokeDasharray="6 4" />
              ))}
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={{ r: 4, fill: color }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-6 text-center text-sm font-semibold text-ink-soft">
          Encore une séance avec cet exercice et la courbe apparaît 💪
        </p>
      )}
      {data.length > 0 && (
        <p className="text-center text-xs font-extrabold text-muscu">
          🏆 Record : {Math.max(...data.map((d) => d.value))} {t.unit}
          {metric === 'volume' ? ' (volume)' : ' (série)'}
          {goal && levels.length > 0 && (
            <span className={'ml-2 ' + (nextLevel ? 'text-running' : 'text-sage-600')}>
              🎯{' '}
              {nextLevel
                ? `Palier ${nextLevel.value} (${goal.metric === 'best' ? 'série' : 'volume'})${
                    nextLevel.reward ? ' · 🎁 ' + nextLevel.reward : ''
                  }`
                : 'Tous les paliers atteints 🎉'}
            </span>
          )}
        </p>
      )}
      {/* Dernières séances : le détail des séries, ⚠ = mal réalisée */}
      <div className="overflow-hidden rounded-2xl bg-sage-50">
        {t.points
          .slice(-5)
          .reverse()
          .map((p, i) => (
            <div
              key={i}
              className={'flex items-center justify-between gap-2 px-4 py-2 ' + (i > 0 ? 'border-t border-surface' : '')}
            >
              <span className="shrink-0 text-xs font-bold text-ink-soft">{p.date}</span>
              <span className="min-w-0 truncate text-right text-sm font-extrabold tabular-nums">
                {p.sets.map((v, si) => (
                  <span key={si}>
                    {si > 0 && <span className="text-ink-soft/50"> / </span>}
                    {v}
                    {p.flagged.includes(si) && <TriangleAlert className="ml-0.5 inline h-3 w-3 text-amber-500" />}
                  </span>
                ))}{' '}
                <span className="text-xs font-semibold text-ink-soft">{t.unit}</span>
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}

/** Fiche détail des mesures d'une séance (vélo…) : grand graphe + petits multiples */
function MetricsSheet({ t, onClose }: { t: MetricTracker | null; onClose: () => void }) {
  return (
    <Sheet
      open={!!t}
      onClose={onClose}
      title={
        t ? (
          <span className="flex items-center gap-2">
            <CategoryIcon
              category={t.session.category}
              className={`h-5 w-5 shrink-0 ${CATEGORY_META[t.session.category].text}`}
            />
            <span className="min-w-0 truncate">{t.session.name}</span>
          </span>
        ) : undefined
      }
    >
      {t && <MetricsSheetInner key={t.session.id} t={t} />}
    </Sheet>
  )
}

function MetricsSheetInner({ t }: { t: MetricTracker }) {
  const [key, setKey] = useState(t.defs[0]?.key ?? '')
  const sel = t.defs.find((d) => d.key === key) ?? t.defs[0]
  const data = t.series[sel?.key ?? ''] ?? []
  const color = CATEGORY_META[t.session.category].hex
  return (
    <div className="space-y-3">
      {data.length >= 2 ? (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee9dd" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip formatter={(v) => [`${v}${sel?.unit ? ' ' + sel.unit : ''}`, '']} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={{ r: 4, fill: color }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-6 text-center text-sm font-semibold text-ink-soft">
          Encore une séance avec cette mesure et la courbe apparaît 📈
        </p>
      )}
      {/* Petits multiples : tous les paramètres, tap = afficher en grand */}
      <div className="overflow-hidden rounded-2xl bg-sage-50">
        {t.defs.map((def, i) => {
          const serie = t.series[def.key] ?? []
          const values = serie.map((p) => p.value)
          const last = values[values.length - 1]
          const active = sel?.key === def.key
          return (
            <button
              key={def.key}
              type="button"
              onClick={() => setKey(def.key)}
              className={
                'flex w-full items-center gap-2 px-4 py-2.5 text-left ' +
                (i > 0 ? 'border-t border-surface ' : '') +
                (active ? 'bg-sage-100/60' : '')
              }
            >
              <span className={`min-w-0 flex-1 truncate text-sm ${active ? 'font-extrabold' : 'font-bold text-ink-soft'}`}>
                {def.label}
              </span>
              <span className="shrink-0 text-sm font-extrabold tabular-nums">
                {last}
                {def.unit && <span className="text-xs font-semibold text-ink-soft"> {def.unit}</span>}
              </span>
              <Trend values={values} />
              <Sparkline values={values} color={color} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Point du graphe de réussite d'une séance (barres empilées ✓/⚠/✗) */
interface SuccPoint {
  date: string
  ok: number
  flag: number
  missed: number
  done: number
  total: number
}

function SuccTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: SuccPoint }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-sand bg-surface px-3 py-2 text-xs font-bold shadow-md">
      {label} · {p.done}/{p.total} séries · {p.total ? Math.round((p.done / p.total) * 100) : 0} %
      {p.flag > 0 ? ` · ${p.flag} mal réalisée${p.flag > 1 ? 's' : ''}` : ''}
    </div>
  )
}

export default function Progress() {
  const { logs, exercises, sessions } = useData()
  const [openExo, setOpenExo] = useState<ExoTracker | null>(null)
  const [openMetrics, setOpenMetrics] = useState<MetricTracker | null>(null)
  const [viewingLog, setViewingLog] = useState<Log | null>(null)

  // Streak : semaines consécutives avec au moins une séance (semaine en cours tolérée)
  const streak = useMemo(() => {
    const monday = startOfWeek(new Date())
    const hasWeek = (offset: number) => {
      const a = toDateStr(addDays(monday, -7 * offset))
      const b = toDateStr(addDays(monday, -7 * offset + 6))
      return logs.some((l) => l.date >= a && l.date <= b)
    }
    let count = 0
    let w = hasWeek(0) ? 0 : 1
    while (hasWeek(w)) {
      count++
      w++
    }
    return count
  }, [logs])

  // Séances par semaine (8 dernières semaines)
  const weekly = useMemo(() => {
    const thisMonday = startOfWeek(new Date())
    return Array.from({ length: 8 }, (_, i) => {
      const ws = addDays(thisMonday, -7 * (7 - i))
      const we = addDays(ws, 7)
      const count = logs.filter((l) => {
        const d = new Date(l.date + 'T12:00:00')
        return d >= ws && d < we
      }).length
      return { label: i === 7 ? 'Cette sem.' : formatDayMonth(ws), count }
    })
  }, [logs])

  const thisWeekCount = weekly[7]?.count ?? 0

  // Mes suivis — exercices : un point par séance où l'exercice a été journalisé
  const exoTrackers = useMemo(() => {
    const list: ExoTracker[] = []
    for (const ex of exercises) {
      // L'unité vient des résultats (un exo « reps » travaillé en HIIT est journalisé en secondes)
      let measure = ex.measure ?? 'reps'
      const points = logs
        .slice()
        .reverse()
        .flatMap((l) => {
          const r = l.results?.find((x) => x.exerciseId === ex.id)
          if (!r || !r.sets.length) return []
          measure = r.measure ?? measure
          return [
            {
              date: formatShortFr(l.date),
              best: Math.max(...r.sets),
              volume: r.sets.reduce((a, b) => a + b, 0),
              sets: r.sets,
              flagged: r.flagged ?? [],
            },
          ]
        })
      if (points.length) list.push({ kind: 'exo', ex, unit: measure === 'sec' ? 's' : 'reps', points })
    }
    return list.sort((a, b) => b.points.length - a.points.length)
  }, [exercises, logs])

  // Mes suivis — séances à mesures (vélo, champs perso) : une ligne par séance, tous paramètres en fiche
  const metricTrackers = useMemo(() => {
    const list: MetricTracker[] = []
    for (const s of sessions) {
      const defs = new Map<string, MetricValue>()
      const series: Record<string, { date: string; value: number }[]> = {}
      for (const l of logs.slice().reverse()) {
        if (l.sessionId !== s.id) continue
        for (const mv of l.metrics ?? []) {
          if (!defs.has(mv.key)) defs.set(mv.key, mv)
          ;(series[mv.key] ??= []).push({ date: formatShortFr(l.date), value: mv.value })
        }
      }
      if (defs.size) list.push({ kind: 'metrics', session: s, defs: [...defs.values()], series })
    }
    return list
  }, [sessions, logs])

  // Réussite des séances (muscu/HIIT) : séries faites vs programme, ⚠ à part
  const successSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          (s.category === 'muscu' || s.category === 'hiit') &&
          logs.some((l) => l.sessionId === s.id && l.results?.length),
      ),
    [sessions, logs],
  )
  const [succId, setSuccId] = useState('')
  const succSession = successSessions.find((s) => s.id === succId) ?? successSessions[0]
  const succData = useMemo(() => {
    if (!succSession) return []
    const planned = buildTimeline(succSession, exercises).reduce((a, g) => a + g.rows.length, 0)
    return logs
      .slice()
      .reverse()
      .flatMap((l) => {
        if (l.sessionId !== succSession.id || !l.results?.length) return []
        const done = l.results.reduce((a, r) => a + r.sets.length, 0)
        const flag = l.results.reduce((a, r) => a + (r.flagged?.length ?? 0), 0)
        const total = Math.max(planned, done)
        return [{ date: formatShortFr(l.date), ok: done - flag, flag, missed: Math.max(0, total - done), done, total }]
      })
  }, [logs, succSession, exercises])

  const hasAnyLog = logs.length > 0
  const hasTrackers = exoTrackers.length > 0 || metricTrackers.length > 0

  return (
    <div>
      <PageHeader kicker="Évolution" title="Progrès" />

      <div className="space-y-4 px-5">
        {!hasAnyLog && <EmptyState emoji="🌱" text="Complétez vos premières séances pour voir vos progrès fleurir ici." />}

        {hasAnyLog && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-3xl bg-surface p-4 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-sage-600">{thisWeekCount}</p>
                <p className="text-[11px] font-bold text-ink-soft">cette semaine</p>
              </div>
              <div className="rounded-3xl bg-surface p-4 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-sage-600">{weekly.reduce((a, w) => a + w.count, 0)}</p>
                <p className="text-[11px] font-bold text-ink-soft">sur 8 semaines</p>
              </div>
              <div className="rounded-3xl bg-surface p-4 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-sage-600">{logs.length}</p>
                <p className="text-[11px] font-bold text-ink-soft">au total</p>
              </div>
            </div>

            <ChartCard title="Régularité">
              <p className="mb-3 text-sm font-extrabold text-sage-700">
                {streak > 0
                  ? `🔥 ${streak} semaine${streak > 1 ? 's' : ''} d'affilée avec au moins une séance`
                  : '🌱 Complétez une séance pour démarrer votre série'}
              </p>
              <Heatmap logs={logs} />
              <p className="mt-2 text-right text-[11px] font-semibold text-ink-soft">16 dernières semaines</p>
            </ChartCard>

            <ChartCard title="Séances complétées par semaine">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee9dd" vertical={false} />
                    <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#f1f5f0' }} formatter={(v) => [`${v} séance${Number(v) > 1 ? 's' : ''}`, '']} />
                    <Bar dataKey="count" fill="#71946f" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </>
        )}

        {hasAnyLog && !hasTrackers && (
          <ChartCard title="Mes suivis">
            <p className="py-1 text-sm font-semibold text-ink-soft">
              Vos courbes par exercice apparaîtront ici dès qu'une séance muscu, HIIT ou vélo aura été validée avec
              son réalisé (minuteur guidé ou « Entrer le résultat ✓ »). Les sorties running, elles, se cochent
              simplement.
            </p>
          </ChartCard>
        )}

        {hasTrackers && (
          <ChartCard title="Mes suivis">
            <div>
              {metricTrackers.map((t, i) => {
                const first = t.defs[0]
                const values = (t.series[first.key] ?? []).map((p) => p.value)
                const last = values[values.length - 1]
                return (
                  <button
                    key={t.session.id}
                    type="button"
                    onClick={() => setOpenMetrics(t)}
                    className={
                      'flex w-full items-center gap-2 py-2.5 text-left ' + (i > 0 ? 'border-t border-cream' : '')
                    }
                  >
                    <CategoryIcon
                      category={t.session.category}
                      className={`h-4 w-4 shrink-0 ${CATEGORY_META[t.session.category].text}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{t.session.name}</span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums">
                      {last}
                      {first.unit && <span className="text-xs font-semibold text-ink-soft"> {first.unit}</span>}
                    </span>
                    <Trend values={values} />
                    <Sparkline values={values} color={CATEGORY_META[t.session.category].hex} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft/40" />
                  </button>
                )
              })}
              {exoTrackers.map((t, i) => {
                const values = t.points.map((p) => p.best)
                const last = t.points[t.points.length - 1]
                return (
                  <button
                    key={t.ex.id}
                    type="button"
                    onClick={() => setOpenExo(t)}
                    className={
                      'flex w-full items-center gap-2 py-2.5 text-left ' +
                      (i > 0 || metricTrackers.length > 0 ? 'border-t border-cream' : '')
                    }
                  >
                    <CategoryIcon
                      category={t.ex.category}
                      className={`h-4 w-4 shrink-0 ${CATEGORY_META[t.ex.category].text}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{t.ex.name}</span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums">
                      {last.best}
                      <span className="text-xs font-semibold text-ink-soft"> {t.unit}</span>
                    </span>
                    <Trend values={values} />
                    <Sparkline values={values} color={CATEGORY_META[t.ex.category].hex} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft/40" />
                  </button>
                )
              })}
            </div>
            <p className="pt-2 text-[11px] font-semibold text-ink-soft">
              Meilleure série par séance — tapez une ligne pour le détail (volume, paliers, historique).
            </p>
          </ChartCard>
        )}

        {successSessions.length > 0 && succSession && (
          <ChartCard title="Réussite des séances">
            <Select value={succSession.id} onChange={setSuccId} className="mb-3 w-full">
              {successSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {succData.length >= 2 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={succData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee9dd" vertical={false} />
                    <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#f1f5f0' }} content={<SuccTooltip />} />
                    <Bar dataKey="ok" stackId="a" fill="#71946f" />
                    <Bar dataKey="flag" stackId="a" fill="#fbbf24" />
                    <Bar dataKey="missed" stackId="a" fill="#eee9dd" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-6 text-center text-sm font-semibold text-ink-soft">
                Encore une réalisation de cette séance et le graphique apparaît 📊
              </p>
            )}
            <p className="flex items-center gap-3 pt-2 text-[11px] font-semibold text-ink-soft">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-sage-500" /> réussies
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-amber-400" /> mal réalisées
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-sand" /> manquées
              </span>
            </p>
          </ChartCard>
        )}

        {logs.length > 0 && (
          <ChartCard title="Historique">
            <p className="mb-2 text-xs font-semibold text-ink-soft">
              Tapez une séance pour la consulter ou la corriger. Une séance oubliée ? Naviguez vers une date passée
              depuis l'écran Aujourd'hui (flèche ‹).
            </p>
            <div>
              {logs.slice(0, 15).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setViewingLog(l)}
                  className="flex w-full items-center gap-2 border-b border-cream py-2 text-left last:border-0"
                >
                  <span className="w-14 shrink-0 text-xs font-bold text-ink-soft">{formatShortFr(l.date)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-extrabold">
                      <CategoryIcon
                        category={l.category}
                        className={`h-3.5 w-3.5 shrink-0 ${CATEGORY_META[l.category].text}`}
                      />
                      <span className="min-w-0 truncate">{l.sessionName}</span>
                    </p>
                    <p className="truncate text-xs font-semibold text-ink-soft">{logSummary(l)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft/40" />
                </button>
              ))}
              {logs.length > 15 && (
                <p className="pt-2 text-center text-xs font-semibold text-ink-soft">
                  … et {logs.length - 15} autres séances
                </p>
              )}
            </div>
          </ChartCard>
        )}
      </div>

      <ExoSheet t={openExo} onClose={() => setOpenExo(null)} />
      <MetricsSheet t={openMetrics} onClose={() => setOpenMetrics(null)} />
      <LogSheet log={viewingLog} onClose={() => setViewingLog(null)} />
    </div>
  )
}
