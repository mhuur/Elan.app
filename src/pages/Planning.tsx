import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, ArrowRight, Footprints, GripVertical } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Session } from '../types'
import { DAY_LETTER, DAY_NAMES, addDays, formatShortFr, todayStr } from '../lib/dates'
import { canonicalCycles, describeSchedule, ownerOf, plannedSessionIdsOn } from '../lib/schedule'
import { isPlanLog } from '../lib/planDay'
import { usePlanAnchor } from '../lib/usePlanAnchor'
import { usePlanningWeek } from '../lib/usePlanningWeek'
import { usePlanningOrdering } from '../lib/usePlanningOrdering'
import { CategoryIcon, EmptyState, PageHeader } from '../components/ui'
import WorkoutSheet from '../components/WorkoutSheet'
import { TYPE_META, seanceDateStr, type PlanSeance } from '../data/plan'

/** Grille commune : poignée · nom · 7 jours */
const GRID = 'grid grid-cols-[1rem_minmax(0,1fr)_repeat(7,1.85rem)] items-center gap-x-0.5'

function Row({
  session,
  todayIdx,
  plannedDays,
  doneDays,
  sublabel,
  onDay,
  onEdit,
}: {
  session: Session
  todayIdx: number
  /** Jours planifiés cette semaine (jours fixes + rotation) */
  plannedDays: boolean[]
  /** Jours où la séance a été complétée cette semaine */
  doneDays: boolean[]
  sublabel?: string
  /** Toucher un rond : valider / dévalider la séance ce jour-là */
  onDay: (day: number) => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: session.id })
  const meta = CATEGORY_META[session.category]
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        GRID +
        ' rounded-2xl bg-surface px-1.5 py-1 shadow-sm ' +
        (isDragging ? 'relative z-10 shadow-lg ring-2 ring-sage-300' : '')
      }
    >
      <button
        type="button"
        aria-label={`Déplacer ${session.name}`}
        {...attributes}
        {...listeners}
        className="flex h-9 cursor-grab touch-none items-center justify-center text-ink-soft/40 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onEdit} className="min-w-0 px-1 py-1 text-left">
        <span className="flex items-center gap-1 text-xs font-extrabold">
          <CategoryIcon category={session.category} className={`h-3.5 w-3.5 shrink-0 ${meta.text}`} />
          <span className="min-w-0 truncate">{session.name}</span>
        </span>
        {sublabel && <span className="block truncate text-[11px] font-bold text-ink-soft">↻ {sublabel}</span>}
      </button>
      {Array.from({ length: 7 }, (_, d) => {
        const done = doneDays[d]
        const planned = plannedDays[d]
        return (
          <button
            key={d}
            type="button"
            aria-label={`${session.name} — ${DAY_NAMES[d]}`}
            aria-pressed={done || planned}
            onClick={() => onDay(d)}
            className={
              'flex h-10 items-center justify-center rounded-lg transition-colors ' +
              (d === todayIdx ? 'bg-sage-50' : '')
            }
          >
            <span
              className={
                'rounded-full transition-all ' +
                (done ? 'h-4 w-4 shadow-sm' : planned ? 'h-4 w-4 border-[3px] bg-surface' : 'h-2 w-2 bg-sand')
              }
              style={done ? { backgroundColor: meta.hex } : planned ? { borderColor: meta.hex } : undefined}
            />
          </button>
        )
      })}
    </div>
  )
}

/**
 * Ligne d'une séance du plan semi (course à pied), en lecture seule, typée par
 * couleur. Posée sur sa colonne de jour ; taper ouvre la fiche Campus (consulter
 * + valider). Ne s'édite pas ici : le plan est figé.
 */
function PlanRow({
  s,
  todayIdx,
  done,
  doneCol,
  onOpen,
}: {
  s: PlanSeance
  todayIdx: number
  done: boolean
  /** Colonne où afficher le rond « fait » = jour réellement effectué (peut différer du jour prévu), -1 si pas fait */
  doneCol: number
  onOpen: () => void
}) {
  const t = TYPE_META[s.type]
  return (
    <div className={GRID + ' rounded-2xl bg-surface px-1.5 py-1 shadow-sm'}>
      <span aria-hidden className="flex h-9 items-center justify-center">
        <span className="h-4 w-1 rounded-full" style={{ backgroundColor: t.hex }} />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 px-1 py-1 text-left">
        <span className="flex items-center gap-1 text-xs font-extrabold">
          <Footprints className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} style={{ color: t.hex }} />
          <span className="min-w-0 truncate">{s.title}</span>
        </span>
        <span className="block truncate text-[11px] font-bold" style={{ color: t.hex }}>
          {t.short}
        </span>
      </button>
      {Array.from({ length: 7 }, (_, d) => {
        // Rond plein le jour réellement fait ; anneau « prévu » le jour du plan UNIQUEMENT si
        // la séance n'est pas encore faite (sinon le rond plein du vrai jour suffit, on
        // n'encombre plus le jour prévu d'un anneau qui ressemble à « en attente ») ; petit
        // point sable ailleurs.
        const isDone = done && d === doneCol
        // Anneau « prévu » seulement tant que la séance n'a pas été faite (ailleurs ou non)
        const showPlannedRing = d === s.day && !done
        return (
          <button
            key={d}
            type="button"
            aria-label={`${s.title} — ${DAY_NAMES[s.day]}`}
            onClick={onOpen}
            className={'flex h-10 items-center justify-center rounded-lg ' + (d === todayIdx ? 'bg-sage-50' : '')}
          >
            {isDone ? (
              <span className="h-4 w-4 rounded-full shadow-sm transition-all" style={{ backgroundColor: t.hex }} />
            ) : showPlannedRing ? (
              <span className="h-4 w-4 rounded-full border-[3px] bg-surface transition-all" style={{ borderColor: t.hex }} />
            ) : (
              <span className="h-2 w-2 rounded-full bg-sand" />
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Enveloppe sortable d'une section : la poignée (passée à l'en-tête) déplace tout le bloc */
function SortableSection({
  uid,
  children,
}: {
  uid: string
  children: (drag: Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: uid })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-20' : undefined}
    >
      {children({ attributes, listeners })}
    </div>
  )
}

export default function Planning() {
  const { sessions, logs, updateSession, addLog, removeLog, user } = useData()
  const navigate = useNavigate()
  // Navigation semaine par semaine (0 = cette semaine), avec dates, comme l'onglet Plan
  const [weekOffset, setWeekOffset] = useState(0)
  const [sheet, setSheet] = useState<PlanSeance | null>(null)
  // Position de la section « Running » du plan (préférence locale partagée avec Aujourd'hui)
  const [planAnchor, savePlanAnchor] = usePlanAnchor(user?.uid)

  // Semaine affichée + alignement de la semaine du plan (audit P2 : extrait en hook pur)
  const { monday, weekDates, todayIdx, planWeek, planWeekIdx, planStates, firstStart, planStartOffset, showStartHint } =
    usePlanningWeek(weekOffset, logs)
  // Ordre optimiste + sections + drag & drop (audit P2 : extrait en hook dédié)
  const { sensors, sections, sectionItems, canDragSections, hasGroups, showGrid, handleDragEnd } = usePlanningOrdering({
    sessions,
    planActive: !!planWeek,
    planAnchor,
    savePlanAnchor,
    updateSession,
  })

  // Cycles d'alternance calculés une fois par changement de séances, partagés aux helpers.
  const cycles = useMemo(() => canonicalCycles(sessions), [sessions])
  // Jours de la semaine AFFICHÉE : planifié (jours fixes + rotation) et fait (logs)
  const plannedByDay = useMemo(
    () => Array.from({ length: 7 }, (_, d) => plannedSessionIdsOn(addDays(monday, d), sessions, cycles)),
    [monday, sessions, cycles],
  )
  const doneByDay = weekDates.map((ds) => new Set(logs.filter((l) => l.date === ds && !isPlanLog(l)).map((l) => l.sessionId)))
  // Compteur d'en-tête : séances utilisateur planifiées + séances de course du plan de la semaine
  const perWeek = plannedByDay.reduce((a, ids) => a + ids.size, 0) + planStates.length

  const emptyLabel = hasGroups ? 'Autres' : 'Mes séances'
  const showHeaders = hasGroups || !!planWeek

  /**
   * Toucher un rond : valide (crée un log) ou dévalide (supprime le log) la
   * séance ce jour-là. Ne modifie JAMAIS la planification — elle s'édite dans
   * la fiche de la séance.
   */
  const validateDay = (s: Session, day: number) => {
    const ds = weekDates[day]
    if (ds > todayStr()) return // jour pas encore arrivé
    const log = logs.find((l) => l.sessionId === s.id && l.date === ds)
    if (log) {
      const hasPerfs = !!(log.metrics?.length || log.results?.length)
      if (
        hasPerfs &&
        !window.confirm(`Dévalider « ${s.name} » du ${formatShortFr(ds)} ? Les perfs enregistrées seront supprimées.`)
      )
        return
      void removeLog(log.id)
    } else {
      void addLog({
        date: ds,
        sessionId: s.id,
        sessionName: s.name,
        category: s.category,
        createdAt: Date.now(),
        note: '',
      })
    }
  }

  return (
    <div>
      <PageHeader
        title="Planning"
        right={
          perWeek > 0 ? (
            <p className="text-xs font-extrabold text-sage-600">
              {perWeek} séance{perWeek > 1 ? 's' : ''} / sem.
            </p>
          ) : undefined
        }
      />

      {!showGrid ? (
        <div className="px-5">
          <EmptyState emoji="🗂️" text="Créez d'abord une séance dans l'onglet Exercices." />
        </div>
      ) : (
        <div className="px-3">
          {/* Navigation semaine par semaine (flèches + dates), comme l'onglet Plan */}
          <div className="flex items-center justify-between gap-3 px-1.5 pb-1.5">
            <button
              type="button"
              aria-label="Semaine précédente"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="rounded-full bg-surface p-2 shadow-sm active:bg-sage-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-sm font-extrabold first-letter:uppercase">
                {weekOffset === 0 ? 'Cette semaine' : `Semaine du ${formatShortFr(weekDates[0])}`}
              </p>
              <p className="text-[11px] font-bold text-ink-soft">
                {formatShortFr(weekDates[0])} – {formatShortFr(weekDates[6])}
              </p>
            </div>
            <button
              type="button"
              aria-label="Semaine suivante"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="rounded-full bg-surface p-2 shadow-sm active:bg-sage-50"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          {showStartHint && (
            <button
              type="button"
              onClick={() => setWeekOffset(planStartOffset)}
              className="mb-1.5 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-sage-50 px-4 py-2 text-xs font-bold text-sage-700 active:bg-sage-100"
            >
              Le plan semi démarre {formatShortFr(firstStart)}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* En-tête des jours : lettre + numéro du jour, aujourd'hui surligné */}
          <div className={GRID + ' px-1.5 pb-1'}>
            <span />
            <span />
            {DAY_LETTER.map((letter, d) => {
              const isToday = d === todayIdx
              return (
                <div key={d} title={DAY_NAMES[d]} className="mx-auto flex flex-col items-center gap-0.5">
                  <span className={'text-[10px] font-extrabold ' + (isToday ? 'text-sage-600' : 'text-ink-soft/60')}>{letter}</span>
                  <span
                    className={
                      'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold tabular-nums ' +
                      (isToday ? 'bg-sage-500 text-onaccent shadow-sm' : 'text-ink-soft')
                    }
                  >
                    {Number(weekDates[d].slice(8, 10))}
                  </span>
                </div>
              )
            })}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sectionItems} strategy={verticalListSortingStrategy}>
              {sections.map((sec) => {
                const g = sec.group
                const list = sec.sessions
                // La section « Running » porte les séances du plan (course à pied), typées
                // par couleur, posées en tête — au-dessus des séances Running de l'utilisateur.
                const isRun = sec.plan
                if (!isRun && list.length === 0) return null
                const draggable = canDragSections && (list.length > 0 || isRun)
                // Corps de la section ; `handle` (optionnel) est la poignée de drag de l'en-tête
                const body = (handle?: ReactNode) => (
                  <div>
                    {showHeaders && (
                      <h2 className="flex items-center gap-1.5 px-1.5 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
                        {handle}
                        {g || emptyLabel}
                        {isRun && planWeek && (
                          <span className="font-bold normal-case tracking-normal text-ink-soft/70">
                            plan · sem. {planWeekIdx + 1}
                          </span>
                        )}
                      </h2>
                    )}
                    <div className="space-y-1.5">
                      {isRun &&
                        planStates.map((st) => {
                          // La séance peut avoir été faite un autre jour : le rond « fait » suit la date du log
                          const inWeek = st.doneDate ? weekDates.indexOf(st.doneDate) : -1
                          const doneCol = !st.done ? -1 : inWeek >= 0 ? inWeek : st.seance.day
                          return (
                            <PlanRow
                              key={'plan-' + st.seance.day}
                              s={st.seance}
                              todayIdx={todayIdx}
                              done={st.done}
                              doneCol={doneCol}
                              onOpen={() => setSheet(st.seance)}
                            />
                          )
                        })}
                      <SortableContext items={list.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                        {list.map((s) => (
                          <Row
                            key={s.id}
                            session={s}
                            todayIdx={todayIdx}
                            plannedDays={plannedByDay.map((ids) => ids.has(s.id))}
                            doneDays={doneByDay.map((ids) => ids.has(s.id))}
                            sublabel={ownerOf(s.id, sessions, cycles) ? describeSchedule(s, sessions, cycles) : undefined}
                            onDay={(d) => validateDay(s, d)}
                            onEdit={() => navigate(`/session/${s.id}`)}
                          />
                        ))}
                      </SortableContext>
                    </div>
                  </div>
                )
                if (!draggable) return <div key={g || '—'}>{body()}</div>
                return (
                  <SortableSection key={'sec-' + g} uid={'sec-' + g}>
                    {(drag) =>
                      body(
                        <button
                          type="button"
                          aria-label={`Déplacer la section ${g || emptyLabel}`}
                          {...drag.attributes}
                          {...drag.listeners}
                          className="-ml-0.5 flex cursor-grab touch-none items-center text-ink-soft/40 active:cursor-grabbing"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>,
                      )
                    }
                  </SortableSection>
                )
              })}
            </SortableContext>
          </DndContext>

          {sessions.length === 0 && (
            <p className="px-3 pt-5 text-center text-xs font-semibold text-ink-soft">
              Ajoute tes séances HIIT ou muscu dans l'onglet Exercices pour les organiser autour du plan.
            </p>
          )}
        </div>
      )}

      <WorkoutSheet
        seance={sheet}
        weekIdx={planWeekIdx}
        planRef={sheet && planWeek ? 'elan-' + seanceDateStr(planWeek, sheet) : ''}
        plannedDate={sheet && planWeek ? seanceDateStr(planWeek, sheet) : ''}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}
