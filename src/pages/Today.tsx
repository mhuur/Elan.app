import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Footprints, Settings, Undo2 } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, feelingOf, type Log, type Session } from '../types'
import { addDays, formatLongFr, toDateStr } from '../lib/dates'
import { logSummary, summarizeSession } from '../lib/format'
import { canonicalCycles, plannedSessionIdsOn } from '../lib/schedule'
import { isPlanLog, planToDoOn, planWeekFor, type PlanSeanceState } from '../lib/planDay'
import { planningSections } from '../lib/planningLayout'
import { usePlanAnchor } from '../lib/usePlanAnchor'
import { TYPE_META } from '../data/plan'
import { CategoryIcon, EmptyState, Sheet } from '../components/ui'
import CompleteSheet from '../components/CompleteSheet'
import LogSheet from '../components/LogSheet'
import SettingsSheet from '../components/SettingsSheet'
import WorkoutSheet from '../components/WorkoutSheet'

export default function Today() {
  const { sessions, logs, user } = useData()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [completing, setCompleting] = useState<Session | null>(null)
  // Fiche Campus d'une séance du plan (consulter / valider)
  const [planSheet, setPlanSheet] = useState<PlanSeanceState | null>(null)
  // Fiche d'une séance terminée (consulter / corriger / supprimer)
  const [viewing, setViewing] = useState<Log | null>(null)
  // Jour affiché en OFFSET relatif au jour réel (et non figé au montage) : la vue suit ainsi
  // le passage de minuit. `tick` force le recalcul quand l'onglet redevient visible/focus.
  const [dayOffset, setDayOffset] = useState(0)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && setTick((t) => t + 1)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const viewDate = useMemo(() => addDays(new Date(), dayOffset), [dayOffset, tick])
  const [planAnchor] = usePlanAnchor(user?.uid)

  const dStr = toDateStr(viewDate)
  const isToday = dayOffset === 0
  const isFuture = dayOffset > 0
  const shiftDay = (n: number) => setDayOffset((o) => o + n)

  const cycles = useMemo(() => canonicalCycles(sessions), [sessions])
  const plannedIds = useMemo(() => plannedSessionIdsOn(viewDate, sessions, cycles), [viewDate, sessions, cycles])
  const todayLogs = logs.filter((l) => l.date === dStr)
  // Les logs « validation de séance du plan » (planRef) ne marquent pas une séance utilisateur faite
  const doneIds = new Set(todayLogs.filter((l) => !isPlanLog(l)).map((l) => l.sessionId))
  const toDo = sessions.filter((s) => plannedIds.has(s.id) && !doneIds.has(s.id))

  // Séances de course du plan dues ce jour-là et pas encore faites — source unique
  // partagée avec le Planning (validation explicite ou course libre, cf. planToDoOn).
  const planInfo = planWeekFor(viewDate)
  const planWeekIdx = planInfo?.weekIdx ?? -1
  const planToDo = planToDoOn(viewDate, logs)

  // Ordre IDENTIQUE au Planning : on parcourt les sections dans leur ordre vertical et,
  // dans la section « Running », on insère la séance du plan du jour avant les séances.
  type DayItem = { kind: 'plan'; st: PlanSeanceState } | { kind: 'session'; s: Session }
  const toDoSet = new Set(toDo.map((s) => s.id))
  const sections = planningSections(sessions, !!planInfo, planAnchor)
  const dayItems: DayItem[] = []
  for (const sec of sections) {
    if (sec.plan) for (const st of planToDo) dayItems.push({ kind: 'plan', st })
    for (const s of sec.sessions) if (toDoSet.has(s.id)) dayItems.push({ kind: 'session', s })
  }

  const renderDayItem = (item: DayItem) => {
    if (item.kind === 'plan') {
      const s = item.st.seance
      const t = TYPE_META[s.type]
      return (
        <button
          key={item.st.planRef}
          type="button"
          onClick={() => setPlanSheet(item.st)}
          className="flex w-full items-center gap-4 rounded-3xl bg-surface p-4 text-left shadow-sm transition-transform active:scale-[0.985]"
        >
          <div
            className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: t.hex + '1a', color: t.hex }}
          >
            <Footprints className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: t.hex }}>{t.short}</p>
            <p className="truncate text-base font-extrabold">{s.title}</p>
            {s.detail && <p className="truncate text-xs font-semibold text-ink-soft">{s.detail}</p>}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-sage-400" />
        </button>
      )
    }
    const s = item.s
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
  }

  return (
    <div>
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-sage-500">
            {isToday ? "Aujourd'hui" : isFuture ? 'À venir' : 'Saisie passée'}
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
            onClick={() => shiftDay(1)}
            className="rounded-full bg-surface p-2 text-ink-soft shadow-sm active:bg-sand"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {!isToday && (
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => setDayOffset(0)}
              className="mx-auto flex items-center gap-1.5 rounded-full bg-sage-100 px-3.5 py-1.5 text-xs font-extrabold text-sage-700 active:bg-sage-200"
            >
              <Undo2 className="h-3.5 w-3.5" /> Revenir à aujourd'hui
            </button>
          </div>
        )}
      </header>

      <div className="space-y-3 px-5">
        {dayItems.map(renderDayItem)}

        {dayItems.length === 0 && todayLogs.length === 0 && (
          <EmptyState
            emoji="🌿"
            text={
              isToday
                ? "Rien de prévu aujourd'hui. Journée repos — ou lancez une séance libre ci-dessous."
                : isFuture
                  ? 'Rien de prévu ce jour-là — journée repos.'
                  : "Rien n'était prévu ce jour-là. Utilisez « Séance libre » pour saisir une séance oubliée."
            }
          />
        )}
        {dayItems.length === 0 && todayLogs.length > 0 && isToday && (
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
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setViewing(l)}
                  className="flex w-full items-center gap-3 rounded-3xl bg-surface/70 p-4 text-left shadow-sm transition-transform active:scale-[0.985]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-500 text-onaccent">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-extrabold">
                      <CategoryIcon category={l.category} className={`h-3.5 w-3.5 shrink-0 ${meta.text}`} />
                      <span className="min-w-0 truncate">{l.sessionName}</span>
                    </p>
                    <p className="truncate text-xs font-semibold text-ink-soft">
                      {logSummary(l)}
                      {feelingOf(l.feeling) && <span className="ml-1">{feelingOf(l.feeling)!.emoji}</span>}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-sage-400" />
                </button>
              )
            })}
          </div>
        </section>
      )}

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CompleteSheet session={completing} date={dStr} onClose={() => setCompleting(null)} />
      <WorkoutSheet
        seance={planSheet?.seance ?? null}
        weekIdx={planWeekIdx}
        planRef={planSheet?.planRef ?? ''}
        plannedDate={planSheet?.date ?? ''}
        onClose={() => setPlanSheet(null)}
      />
      <LogSheet log={viewing} onClose={() => setViewing(null)} />

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
