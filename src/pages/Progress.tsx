import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Log, type MetricValue } from '../types'
import { addDays, formatDayMonth, formatShortFr, startOfWeek } from '../lib/dates'
import { logSummary } from '../lib/format'
import { Chip, EmptyState, PageHeader } from '../components/ui'

const axisStyle = { fontSize: 11, fontFamily: 'Nunito', fill: '#717d72' }

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-extrabold">{title}</h2>
      {children}
    </section>
  )
}

export default function Progress() {
  const { logs, exercises, sessions, removeLog } = useData()

  const deleteLog = (l: Log) => {
    if (window.confirm(`Supprimer « ${l.sessionName} » du ${formatShortFr(l.date)} ?`)) void removeLog(l.id)
  }

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

  // Mesures par séance (vélo et champs personnalisés)
  const metricSessions = useMemo(
    () => sessions.filter((s) => logs.some((l) => l.sessionId === s.id && l.metrics?.length)),
    [sessions, logs],
  )
  const [msId, setMsId] = useState('')
  const selectedSession = metricSessions.find((s) => s.id === msId) ?? metricSessions[0]
  const metricDefs = useMemo(() => {
    if (!selectedSession) return []
    const seen = new Map<string, MetricValue>()
    for (const l of logs) {
      if (l.sessionId !== selectedSession.id) continue
      for (const mv of l.metrics ?? []) if (!seen.has(mv.key)) seen.set(mv.key, mv)
    }
    return [...seen.values()]
  }, [logs, selectedSession])
  const [metricKey, setMetricKey] = useState('')
  const selDef = metricDefs.find((d) => d.key === metricKey) ?? metricDefs[0]
  const metricData = useMemo(() => {
    if (!selectedSession || !selDef) return []
    return logs
      .slice()
      .reverse()
      .flatMap((l) => {
        if (l.sessionId !== selectedSession.id) return []
        const mv = l.metrics?.find((x) => x.key === selDef.key)
        return mv ? [{ date: formatShortFr(l.date), value: mv.value }] : []
      })
  }, [logs, selectedSession, selDef])

  // Muscu : exercices ayant au moins un résultat enregistré
  const exosWithLogs = useMemo(() => {
    const ids = new Set(logs.flatMap((l) => l.results?.map((r) => r.exerciseId) ?? []))
    return exercises.filter((e) => ids.has(e.id))
  }, [logs, exercises])
  const [exId, setExId] = useState('')
  const [muscuMetric, setMuscuMetric] = useState<'volume' | 'best'>('volume')
  const selectedEx = exosWithLogs.find((e) => e.id === exId) ?? exosWithLogs[0]
  const muscuData = useMemo(() => {
    if (!selectedEx) return []
    return logs
      .slice()
      .reverse()
      .flatMap((l) => {
        const r = l.results?.find((x) => x.exerciseId === selectedEx.id)
        if (!r || !r.sets.length) return []
        const value = muscuMetric === 'volume' ? r.sets.reduce((a, b) => a + b, 0) : Math.max(...r.sets)
        return [{ date: formatShortFr(l.date), value }]
      })
  }, [logs, selectedEx, muscuMetric])
  const muscuUnit = selectedEx?.measure === 'sec' ? 's' : 'reps'

  const hasAnyLog = logs.length > 0

  return (
    <div>
      <PageHeader kicker="Évolution" title="Progrès" />

      <div className="space-y-4 px-5">
        {!hasAnyLog && <EmptyState emoji="🌱" text="Complétez vos premières séances pour voir vos progrès fleurir ici." />}

        {hasAnyLog && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-3xl bg-surface p-3 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-sage-600">{thisWeekCount}</p>
                <p className="text-[11px] font-bold text-ink-soft">cette semaine</p>
              </div>
              <div className="rounded-3xl bg-surface p-3 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-sage-600">{weekly.reduce((a, w) => a + w.count, 0)}</p>
                <p className="text-[11px] font-bold text-ink-soft">sur 8 semaines</p>
              </div>
              <div className="rounded-3xl bg-surface p-3 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-sage-600">{logs.length}</p>
                <p className="text-[11px] font-bold text-ink-soft">au total</p>
              </div>
            </div>

            <ChartCard title="Séances complétées par semaine">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
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

        {metricSessions.length > 0 && selectedSession && (
          <ChartCard title="📈 Mesures par séance">
            <select
              value={selectedSession.id}
              onChange={(e) => {
                setMsId(e.target.value)
                setMetricKey('')
              }}
              className="mb-3 w-full rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-bold outline-none focus:border-sage-400"
            >
              {metricSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {CATEGORY_META[s.category].emoji} {s.name}
                </option>
              ))}
            </select>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {metricDefs.map((d) => (
                <Chip key={d.key} active={selDef?.key === d.key} onClick={() => setMetricKey(d.key)}>
                  {d.label}
                </Chip>
              ))}
            </div>
            {metricData.length >= 2 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee9dd" vertical={false} />
                    <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v) => [`${v}${selDef?.unit ? ' ' + selDef.unit : ''}`, '']} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={CATEGORY_META[selectedSession.category].hex}
                      strokeWidth={3}
                      dot={{ r: 4, fill: CATEGORY_META[selectedSession.category].hex }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-6 text-center text-sm font-semibold text-ink-soft">
                Encore une séance avec cette mesure et la courbe apparaît 📈
              </p>
            )}
          </ChartCard>
        )}

        {exosWithLogs.length > 0 && (
          <ChartCard title={`${CATEGORY_META.muscu.emoji} Par exercice`}>
            <select
              value={selectedEx?.id ?? ''}
              onChange={(e) => setExId(e.target.value)}
              className="mb-3 w-full rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-bold outline-none focus:border-sage-400"
            >
              {exosWithLogs.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <div className="mb-3 flex gap-1.5">
              <Chip active={muscuMetric === 'volume'} onClick={() => setMuscuMetric('volume')}>
                Volume total
              </Chip>
              <Chip active={muscuMetric === 'best'} onClick={() => setMuscuMetric('best')}>
                Meilleure série
              </Chip>
            </div>
            {muscuData.length >= 2 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={muscuData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee9dd" vertical={false} />
                    <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v) => [`${v} ${muscuUnit}`, '']} />
                    <Line type="monotone" dataKey="value" stroke="#8d6ba0" strokeWidth={3} dot={{ r: 4, fill: '#8d6ba0' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-6 text-center text-sm font-semibold text-ink-soft">
                Encore une séance avec cet exercice et la courbe apparaît 💪
              </p>
            )}
            {muscuData.length > 0 && (
              <p className="pt-2 text-center text-xs font-extrabold text-muscu">
                🏆 Record : {Math.max(...muscuData.map((d) => d.value))} {muscuUnit}
                {muscuMetric === 'volume' ? ' (volume)' : ' (série)'}
              </p>
            )}
          </ChartCard>
        )}

        {logs.length > 0 && (
          <ChartCard title="🗓️ Historique">
            <div>
              {logs.slice(0, 15).map((l) => (
                <div key={l.id} className="flex items-center gap-2 border-b border-cream py-2 last:border-0">
                  <span className="w-14 shrink-0 text-xs font-bold text-ink-soft">{formatShortFr(l.date)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">
                      {CATEGORY_META[l.category].emoji} {l.sessionName}
                    </p>
                    <p className="truncate text-xs font-semibold text-ink-soft">{logSummary(l)}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Supprimer cette entrée"
                    onClick={() => deleteLog(l)}
                    className="shrink-0 px-1.5 text-ink-soft/50 active:text-hiit"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {logs.length > 15 && (
                <p className="pt-2 text-center text-xs font-semibold text-ink-soft/60">
                  … et {logs.length - 15} autres séances
                </p>
              )}
            </div>
          </ChartCard>
        )}
      </div>
    </div>
  )
}
