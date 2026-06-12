import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Settings, Undo2 } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, type Log, type Session } from '../types'
import { addDays, formatLongFr, toDateStr, todayStr } from '../lib/dates'
import { logSummary, summarizeSession } from '../lib/format'
import { plannedSessionIdsOn } from '../lib/schedule'
import { CategoryIcon, EmptyState, Sheet } from '../components/ui'
import CompleteSheet from '../components/CompleteSheet'
import SettingsSheet from '../components/SettingsSheet'

export default function Today() {
  const { sessions, logs, removeLog } = useData()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [completing, setCompleting] = useState<Session | null>(null)
  // Date affichée : on peut revenir en arrière pour valider des séances oubliées
  const [viewDate, setViewDate] = useState(() => new Date())

  const dStr = toDateStr(viewDate)
  const isToday = dStr === todayStr()
  const shiftDay = (n: number) => setViewDate((d) => addDays(d, n))

  const plannedIds = plannedSessionIdsOn(viewDate, sessions)
  const planned = sessions.filter((s) => plannedIds.has(s.id))
  const todayLogs = logs.filter((l) => l.date === dStr)
  const doneIds = new Set(todayLogs.map((l) => l.sessionId))
  const toDo = planned.filter((s) => !doneIds.has(s.id))

  const cancelLog = (l: Log) => {
    if (window.confirm(`Annuler « ${l.sessionName} » ?`)) void removeLog(l.id)
  }

  return (
    <div>
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-sage-500">
            {isToday ? "Aujourd'hui" : 'Saisie passée'}
          </p>
          <button
            type="button"
            aria-label="Réglages"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full bg-surface p-2.5 text-ink-soft shadow-sm"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            aria-label="Jour précédent"
            onClick={() => shiftDay(-1)}
            className="rounded-full bg-surface p-2 text-ink-soft shadow-sm active:bg-sand"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-xl font-extrabold first-letter:uppercase">
            {formatLongFr(viewDate)}
          </h1>
          <button
            type="button"
            aria-label="Jour suivant"
            disabled={isToday}
            onClick={() => shiftDay(1)}
            className="rounded-full bg-surface p-2 text-ink-soft shadow-sm active:bg-sand disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {!isToday && (
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => setViewDate(new Date())}
              className="mx-auto flex items-center gap-1.5 rounded-full bg-sage-100 px-3.5 py-1.5 text-xs font-extrabold text-sage-700 active:bg-sage-200"
            >
              <Undo2 className="h-3.5 w-3.5" /> Revenir à aujourd'hui
            </button>
          </div>
        )}
      </header>

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
              <div className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl ${meta.soft} ${meta.text}`}>
                <CategoryIcon category={s.category} className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-extrabold uppercase tracking-wider ${meta.text}`}>{meta.label}</p>
                <p className="truncate text-base font-extrabold">{s.name}</p>
                <p className="truncate text-xs font-semibold text-ink-soft">{summarizeSession(s)}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-sage-400" />
            </button>
          )
        })}

        {toDo.length === 0 && todayLogs.length === 0 && (
          <EmptyState
            emoji="🌿"
            text={
              isToday
                ? "Rien de prévu aujourd'hui. Journée repos — ou lancez une séance libre ci-dessous."
                : "Rien n'était prévu ce jour-là. Utilisez « Séance libre » pour saisir une séance oubliée."
            }
          />
        )}
        {toDo.length === 0 && todayLogs.length > 0 && isToday && (
          <div className="rounded-3xl bg-sage-100 px-6 py-5 text-center">
            <p className="text-sm font-extrabold text-sage-700">Tout est fait pour aujourd'hui, bravo ! 🎉</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full rounded-3xl bg-sage-100 px-4 py-3.5 text-sm font-extrabold text-sage-700 active:bg-sage-200"
        >
          + Séance libre
        </button>
      </div>

      {todayLogs.length > 0 && (
        <section className="mt-7 px-5">
          <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">Terminées</h2>
          <div className="space-y-2">
            {todayLogs.map((l) => {
              const meta = CATEGORY_META[l.category]
              return (
                <div key={l.id} className="flex items-center gap-3 rounded-3xl bg-surface/70 p-4 shadow-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-500 text-white">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-extrabold">
                      <CategoryIcon category={l.category} className={`h-3.5 w-3.5 shrink-0 ${meta.text}`} />
                      <span className="min-w-0 truncate">{l.sessionName}</span>
                    </p>
                    <p className="truncate text-xs font-semibold text-ink-soft">{logSummary(l)}</p>
                  </div>
                  <button type="button" onClick={() => cancelLog(l)} className="shrink-0 text-xs font-bold text-ink-soft active:text-hiit">
                    annuler
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CompleteSheet session={completing} date={dStr} onClose={() => setCompleting(null)} />

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choisir une séance">
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const list = sessions.filter((s) => s.category === cat)
            if (!list.length) return null
            const meta = CATEGORY_META[cat]
            return (
              <div key={cat}>
                <p className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider ${meta.text}`}>
                  <CategoryIcon category={cat} className="h-3.5 w-3.5" /> {meta.label}
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
