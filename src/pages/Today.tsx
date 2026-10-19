import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import FloatingOverlay, { liftedClass } from '../components/FloatingOverlay'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, ChevronRight, Plus, Undo2 } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, displayCategory, feelingOf, type Category, type Log, type Session } from '../types'
import { addDays, formatTitleFr, toDateStr } from '../lib/dates'
import { logSummary, summarizeSession } from '../lib/format'
import { canonicalCycles, plannedSessionIdsOn } from '../lib/schedule'
import { isPlanLog, planToDoOn, planWeekFor, warmupsDueOn, type PlanSeanceState } from '../lib/planDay'
import { usePlanAnchor } from '../lib/usePlanAnchor'
import { usePlanningOrdering } from '../lib/usePlanningOrdering'
import { workoutStats } from '../data/plan'
import { Picto } from '../components/icons'
import { CategoryRing, DisplayTitle, EmptyState, Eyebrow, Sheet, glassCard, iconSquare } from '../components/ui'
import CompleteSheet from '../components/CompleteSheet'
import LogSheet from '../components/LogSheet'
import SettingsSheet from '../components/SettingsSheet'
import WorkoutSheet from '../components/WorkoutSheet'

/** « 52 min », « 1 h 35 » */
const fmtMin = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`)

/** Carte déplaçable : la poignée à gauche porte le glisser, le reste de la carte s'ouvre au toucher.
 *  Pendant le glisser, c'est sa copie flottante qui suit le doigt ; elle reste en fantôme à sa place. */
function SortableCard({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex min-h-[88px] items-center gap-1 ${glassCard}` + (isDragging ? ' opacity-30' : '')}
    >
      <button
        type="button"
        aria-label={`Déplacer ${label}`}
        {...attributes}
        {...listeners}
        className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-ink-mute active:cursor-grabbing"
      >
        <Picto name="poignee" className="grip h-5 w-5" strokeWidth={3} />
      </button>
      {children}
    </div>
  )
}

export default function Today() {
  const { sessions, exercises, logs, updateSession } = useData()
  // Couleur d'une séance terminée : celle de sa séance si elle existe encore (une séance en
  // séries faite d'étirements s'affiche ÉTIR), sinon celle notée dans le log
  const logCat = (l: Log): Category => {
    const s = sessions.find((x) => x.id === l.sessionId)
    return s ? displayCategory(s, exercises) : l.category
  }
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
  const [planAnchor, savePlanAnchor] = usePlanAnchor()

  const dStr = toDateStr(viewDate)
  const title = formatTitleFr(viewDate)
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

  // Ordre IDENTIQUE au Planning, et modifiable ici par glisser-déposer : le hook du
  // Planning porte l'ordre (sortOrder des séances + ancre de la section « Running »),
  // Aujourd'hui n'en est qu'une autre vue. On parcourt les sections dans leur ordre
  // vertical et, dans la section « Running », on insère la séance du plan du jour en tête.
  // Les échauffements automatiques (warmupFor), invités par une séance à faire de leur
  // catégorie cible, prennent la place de leur séance comme les autres.
  type DayItem = { id: string; section: string } & ({ kind: 'plan'; st: PlanSeanceState } | { kind: 'session'; s: Session })
  const { sensors, sections, moveSection, moveSession } = usePlanningOrdering({
    sessions,
    planActive: !!planInfo,
    planAnchor,
    savePlanAnchor,
    updateSession,
  })
  const shownIds = new Set([
    ...toDo.map((s) => s.id),
    ...warmupsDueOn(sessions, planToDo, plannedIds, doneIds).map((s) => s.id),
  ])
  const dayItems: DayItem[] = []
  for (const sec of sections) {
    if (sec.plan) for (const st of planToDo) dayItems.push({ id: 'plan-' + st.planRef, section: sec.group, kind: 'plan', st })
    for (const s of sec.sessions) if (shownIds.has(s.id)) dayItems.push({ id: s.id, section: sec.group, kind: 'session', s })
  }

  /** Carte lâchée sur une autre : même section → la séance change de place ; autre
   *  section → toute sa section passe à la place de celle d'arrivée (dans le Planning aussi). */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const a = dayItems.find((i) => i.id === active.id)
    const o = dayItems.find((i) => i.id === over.id)
    if (!a || !o) return
    if (a.section !== o.section) moveSection(a.section, o.section)
    // Les séances du plan restent en tête de leur section : seules deux séances à soi s'échangent
    else if (a.kind === 'session' && o.kind === 'session') moveSession(a.id, o.id)
  }

  /** Carte de séance (planche Composants, « Carte de séance — 88 px ») : anneau de
   *  catégorie 48 px, titre 17 px, deux lignes de détail, chevron. */
  const [dragId, setDragId] = useState<string | null>(null)
  const dragItem = dragId ? dayItems.find((i) => i.id === dragId) : undefined

  const renderDayItem = (item: DayItem) => (
    <SortableCard key={item.id} id={item.id} label={item.kind === 'plan' ? item.st.seance.title : item.s.name}>
      {dayItemBody(item)}
    </SortableCard>
  )

  const dayItemBody = (item: DayItem) => {
    const plan = item.kind === 'plan'
    const cat: Category = plan ? 'running' : displayCategory(item.s, exercises)
    let meta1: string
    let meta2: string
    if (plan) {
      const min = Math.round(workoutStats(item.st.seance.workout).sec / 60)
      meta1 = `${CATEGORY_META.running.label}${min ? ` · ${fmtMin(min)}` : ''}`
      meta2 = item.st.seance.detail || `Plan semi-marathon, semaine ${planWeekIdx + 1}`
    } else {
      meta1 = CATEGORY_META[cat].label
      meta2 = summarizeSession(item.s)
    }
    return (
      <button
        type="button"
        onClick={() => (plan ? setPlanSheet(item.st) : setCompleting(item.s))}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3.5 text-left"
      >
        <CategoryRing category={cat} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-[17px] leading-[22px] font-semibold">{plan ? item.st.seance.title : item.s.name}</p>
          <span className="truncate text-sm leading-5 text-ink-soft">{meta1}</span>
          {meta2 && <span className="truncate text-sm leading-5 text-ink-mute tabular-nums">{meta2}</span>}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-mute" />
      </button>
    )
  }

  const total = dayItems.length + todayLogs.length
  const dateTitle = title.join(' ')

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 lg:px-10 lg:pt-8">
      <header className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <Eyebrow>
            {isToday ? "Aujourd'hui" : dayOffset === 1 ? 'Demain' : dayOffset === -1 ? 'Hier' : isFuture ? 'À venir' : 'Saisie passée'}
          </Eyebrow>
          <DisplayTitle className="text-2xl leading-[1.2] first-letter:uppercase lg:text-[30px]">{dateTitle}</DisplayTitle>
        </div>
        <button type="button" aria-label="Jour précédent" onClick={() => shiftDay(-1)} className={iconSquare}>
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <button type="button" aria-label="Jour suivant" onClick={() => shiftDay(1)} className={iconSquare}>
          <ChevronRight className="h-[22px] w-[22px]" />
        </button>
        <button type="button" aria-label="Réglages" onClick={() => setSettingsOpen(true)} className={iconSquare}>
          <Picto name="reglages" />
        </button>
      </header>
      {!isToday && (
        <button
          type="button"
          onClick={() => setDayOffset(0)}
          className="inline-flex h-8 items-center gap-1.5 self-start rounded-full bg-sage-100 px-3 text-sm font-bold text-sage-700"
        >
          <Undo2 className="h-4 w-4" /> Revenir à aujourd'hui
        </button>
      )}

      {/* Bilan du jour : « 1 sur 4 séances faites » + une barre par séance */}
      <section aria-label="Bilan du jour" className={`flex items-center gap-3 py-3.5 pr-3.5 pl-4 ${glassCard}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[26px] leading-[30px] font-extrabold tabular-nums">
              {total ? `${todayLogs.length} sur ${total}` : '0'}
            </span>
            <span className="text-[15px] font-medium text-ink-soft">
              {total ? (total > 1 ? 'séances faites' : 'séance faite') : 'séance prévue'}
            </span>
          </div>
          {total > 0 && (
            <div className="flex gap-1">
              {todayLogs.map((l) => (
                <span key={l.id} className="h-2 flex-1 rounded-full" style={{ backgroundColor: CATEGORY_META[logCat(l)].hex }} />
              ))}
              {dayItems.map((i) => (
                <span key={i.id} className="h-2 flex-1 rounded-full bg-[#e3e6eb]" />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-ink pr-4 pl-3 text-[15px] font-bold active:scale-[0.97] active:bg-sage-50"
        >
          <Plus className="h-5 w-5" strokeWidth={2.2} />
          Séance libre
        </button>
      </section>

      {dayItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="mt-1 text-base leading-[22px] font-bold">À faire · {dayItems.length}</h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setDragId(String(e.active.id))}
            onDragCancel={() => setDragId(null)}
            onDragEnd={(e) => {
              setDragId(null)
              handleDragEnd(e)
            }}
          >
            <SortableContext items={dayItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {dayItems.map(renderDayItem)}
            </SortableContext>
            <FloatingOverlay>
              {dragItem && (
                <div className={`flex min-h-[88px] items-center gap-1 rounded-md ${liftedClass}`}>
                  <span className="flex h-11 w-8 items-center justify-center text-ink-mute">
                    <Picto name="poignee" className="grip h-5 w-5" strokeWidth={3} />
                  </span>
                  {dayItemBody(dragItem)}
                </div>
              )}
            </FloatingOverlay>
          </DndContext>
        </div>
      )}

      {dayItems.length === 0 && todayLogs.length === 0 && (
        <section className={`flex flex-col items-center gap-3 px-6 py-8 text-center ${glassCard}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ddf4ec]">
            <Picto name="lune" className="h-7 w-7" />
          </span>
          <h2 className="text-[22px] leading-7 font-extrabold">Journée repos</h2>
          <p className="max-w-80 text-base leading-6 text-ink-soft">
            {isToday
              ? 'Rien de prévu aujourd’hui. Lancez une séance libre si l’envie vous prend.'
              : isFuture
                ? 'Rien de prévu ce jour-là.'
                : 'Rien n’était prévu ce jour-là : saisissez une séance oubliée avec « Séance libre ».'}
          </p>
        </section>
      )}
      {dayItems.length === 0 && todayLogs.length > 0 && (
        <section aria-label="Journée bouclée" className="flex items-center gap-4 rounded-md bg-ink p-[18px] text-white">
          <svg width="56" height="56" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
            <circle cx="24" cy="24" r="22" fill="#C5F23A" />
            <path d="M14 24.5l6.5 6.5L34 17.5" fill="none" stroke="#0E1116" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-2xl leading-[30px] font-extrabold">Journée bouclée</p>
            <p className="text-[15px] leading-[22px] text-night-soft tabular-nums">
              {todayLogs.length} séance{todayLogs.length > 1 ? 's' : ''} sur {todayLogs.length}
            </p>
          </div>
        </section>
      )}

      {todayLogs.length > 0 && (
        <section className="flex flex-col gap-2">
          {/* `h2` « Terminées » : plusieurs vérifs Playwright ciblent `h2:has-text("Terminées")` */}
          <h2 className="mt-1 text-base leading-[22px] font-bold">Terminées · {todayLogs.length}</h2>
          {todayLogs.map((l) => {
            const at = new Date(l.createdAt)
            const sameDay = toDateStr(at) === l.date
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setViewing(l)}
                className={`flex min-h-[88px] w-full items-center gap-3 px-3.5 py-3 text-left active:bg-sage-50 ${glassCard}`}
              >
                <CategoryRing category={logCat(l)} done />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[17px] leading-[22px] font-semibold">{l.sessionName}</span>
                  <span className="truncate text-sm leading-5 text-ink-soft tabular-nums">
                    {logSummary(l)}
                    {feelingOf(l.feeling) && <span className="ml-1">{feelingOf(l.feeling)!.emoji}</span>}
                  </span>
                  {sameDay && (
                    <span className="text-sm leading-5 text-ink-mute tabular-nums">
                      Faite à {at.getHours()} h {String(at.getMinutes()).padStart(2, '0')}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-mute" />
              </button>
            )
          })}
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
            const list = sessions.filter((s) => displayCategory(s, exercises) === cat)
            if (!list.length) return null
            const meta = CATEGORY_META[cat]
            return (
              <div key={cat}>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-soft">
                  <CategoryRing category={cat} size={28} /> {meta.label}
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
                      className="flex min-h-[52px] w-full items-center justify-between gap-2 rounded-sm bg-cream px-4 py-2.5 text-left active:bg-sage-50"
                    >
                      <span className="truncate text-base font-semibold">{s.name}</span>
                      <span className="shrink-0 text-sm text-ink-soft tabular-nums">
                        {summarizeSession(s)}
                      </span>
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
