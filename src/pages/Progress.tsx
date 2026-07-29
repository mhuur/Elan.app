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
import { CATEGORY_META, type Exercise, type MetricValue, type Session } from '../types'
import { formatShortFr } from '../lib/dates'
import { goalLevels } from '../lib/metrics'
import { buildTimeline } from '../lib/timeline'
import { CategoryIcon, Chip, EmptyState, PageHeader, Select, Sheet } from '../components/ui'

// Recharts dessine en SVG : ses couleurs ne peuvent pas venir des classes Tailwind.
// Ces valeurs sont donc le miroir des tokens de index.css (charte bord de mer).
const axisStyle = { fontSize: 11, fontFamily: 'Nunito', fill: '#8fa8b6' } // ink-soft
const GRID = '#17323f' // sand
/** Infobulle Recharts par défaut : fond clair d'origine → carte ardoise */
const TOOLTIP = {
  contentStyle: {
    background: '#0e2634',
    border: '1px solid #17323f',
    borderRadius: 12,
    fontFamily: 'Nunito',
    fontSize: 12,
    fontWeight: 700,
    color: '#e9f2f6',
    boxShadow: '0 10px 22px rgb(2 10 16 / 0.55)',
  },
  itemStyle: { color: '#e9f2f6' },
  labelStyle: { color: '#8fa8b6' },
  cursor: { stroke: '#2c6b85' },
}

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
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip {...TOOLTIP} formatter={(v) => [`${v} ${t.unit}`, '']} />
              {levelsOnChart.map((lv) => (
                <ReferenceLine key={lv.value} y={lv.value} stroke="#e8a15c" strokeWidth={2} strokeDasharray="6 4" />
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
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip {...TOOLTIP} formatter={(v) => [`${v}${sel?.unit ? ' ' + sel.unit : ''}`, '']} />
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
    <div className="rounded-xl border border-sand bg-shoal px-3 py-2 text-xs font-bold shadow-md">
      {label} · {p.done}/{p.total} séries · {p.total ? Math.round((p.done / p.total) * 100) : 0} %
      {p.flag > 0 ? ` · ${p.flag} mal réalisée${p.flag > 1 ? 's' : ''}` : ''}
    </div>
  )
}

export default function Progress() {
  const { logs, exercises, sessions } = useData()
  const [openExo, setOpenExo] = useState<ExoTracker | null>(null)
  const [openMetrics, setOpenMetrics] = useState<MetricTracker | null>(null)

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
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#16394b' }} content={<SuccTooltip />} />
                    <Bar dataKey="ok" stackId="a" fill="#6fc6d6" />
                    <Bar dataKey="flag" stackId="a" fill="#fbbf24" />
                    <Bar dataKey="missed" stackId="a" fill="#17323f" radius={[8, 8, 0, 0]} />
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

      </div>

      <ExoSheet t={openExo} onClose={() => setOpenExo(null)} />
      <MetricsSheet t={openMetrics} onClose={() => setOpenMetrics(null)} />
    </div>
  )
}
