import { useState } from 'react'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, type Log, type Session } from '../types'
import { formatLongFr, mondayIndex, todayStr } from '../lib/dates'
import { summarizeSession } from '../lib/format'
import { EmptyState, PageHeader, Sheet } from '../components/ui'
import CompleteSheet from '../components/CompleteSheet'
import SettingsSheet from '../components/SettingsSheet'

function logSummary(l: Log): string {
  if (l.metrics?.length) {
    return l.metrics
      .slice(0, 3)
      .map((m) => `${m.value}${m.unit ? ' ' + m.unit : ''}`)
      .join(' · ')
  }
  if (l.velo) {
    const parts: string[] = []
    if (l.velo.durationMin) parts.push(`${l.velo.durationMin} min`)
    if (l.velo.distanceKm) parts.push(`${l.velo.distanceKm} km`)
    if (l.velo.powerW) parts.push(`${l.velo.powerW} W`)
    if (l.velo.avgSpeedKmh) parts.push(`${l.velo.avgSpeedKmh} km/h`)
    if (l.velo.avgBpm) parts.push(`${l.velo.avgBpm} bpm`)
    if (parts.length) return parts.join(' · ')
  }
  if (l.results?.length) {
    const totalSets = l.results.reduce((a, r) => a + r.sets.length, 0)
    return `${l.results.length} exercices · ${totalSets} séries`
  }
  return l.note || 'Bien joué !'
}

export default function Today() {
  const { sessions, logs, removeLog } = useData()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [completing, setCompleting] = useState<Session | null>(null)

  const today = new Date()
  const dayIdx = mondayIndex(today)
  const dStr = todayStr()

  const planned = sessions.filter((s) => s.days.includes(dayIdx))
  const todayLogs = logs.filter((l) => l.date === dStr)
  const doneIds = new Set(todayLogs.map((l) => l.sessionId))
  const toDo = planned.filter((s) => !doneIds.has(s.id))

  const cancelLog = (l: Log) => {
    if (window.confirm(`Annuler « ${l.sessionName} » ?`)) void removeLog(l.id)
  }

  return (
    <div>
      <PageHeader
        kicker="Aujourd'hui"
        title={formatLongFr(today)}
        right={
          <button
            type="button"
            aria-label="Réglages"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full bg-surface p-2.5 text-ink-soft shadow-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.66.28 1.51.55 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        }
      />

      <div className="space-y-3 px-5">
        {toDo.map((s) => {
          const meta = CATEGORY_META[s.category]
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCompleting(s)}
              className="flex w-full items-center gap-4 rounded-3xl bg-surface p-4 text-left shadow-sm transition-transform active:scale-[0.985]"
            >
              <div className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-2xl ${meta.soft}`}>
                {meta.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-extrabold uppercase tracking-wider ${meta.text}`}>{meta.label}</p>
                <p className="truncate text-base font-extrabold">{s.name}</p>
                <p className="truncate text-xs font-semibold text-ink-soft">{summarizeSession(s)}</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-sage-400">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          )
        })}

        {toDo.length === 0 && todayLogs.length === 0 && (
          <EmptyState emoji="🌿" text="Rien de prévu aujourd'hui. Journée repos — ou lancez une séance libre ci-dessous." />
        )}
        {toDo.length === 0 && todayLogs.length > 0 && (
          <div className="rounded-3xl bg-sage-100 px-6 py-5 text-center">
            <p className="text-sm font-extrabold text-sage-700">Tout est fait pour aujourd'hui, bravo ! 🎉</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full rounded-3xl border-2 border-dashed border-sage-300 px-4 py-3.5 text-sm font-extrabold text-sage-600 active:bg-sage-100"
        >
          + Séance libre
        </button>
      </div>

      {todayLogs.length > 0 && (
        <section className="mt-7 px-5">
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-ink-soft">Terminées</h2>
          <div className="space-y-2">
            {todayLogs.map((l) => {
              const meta = CATEGORY_META[l.category]
              return (
                <div key={l.id} className="flex items-center gap-3 rounded-3xl bg-surface/70 p-3.5 shadow-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-500 text-sm font-extrabold text-white">
                    ✓
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">
                      {meta.emoji} {l.sessionName}
                    </p>
                    <p className="truncate text-xs font-semibold text-ink-soft">{logSummary(l)}</p>
                  </div>
                  <button type="button" onClick={() => cancelLog(l)} className="shrink-0 text-xs font-bold text-ink-soft/60 active:text-hiit">
                    annuler
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CompleteSheet session={completing} onClose={() => setCompleting(null)} />

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choisir une séance">
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const list = sessions.filter((s) => s.category === cat)
            if (!list.length) return null
            const meta = CATEGORY_META[cat]
            return (
              <div key={cat}>
                <p className={`mb-1.5 text-[11px] font-extrabold uppercase tracking-wider ${meta.text}`}>
                  {meta.emoji} {meta.label}
                </p>
                <div className="space-y-1.5">
                  {list.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setPickerOpen(false)
                        setCompleting(s)
                      }}
                      className="flex w-full items-center justify-between rounded-2xl bg-sage-50 px-4 py-3 text-left text-sm font-bold active:bg-sage-100"
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="ml-2 shrink-0 text-xs font-semibold text-ink-soft">{summarizeSession(s)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {sessions.length === 0 && <EmptyState emoji="🗂️" text="Créez d'abord une séance dans l'onglet Exercices." />}
        </div>
      </Sheet>
    </div>
  )
}
