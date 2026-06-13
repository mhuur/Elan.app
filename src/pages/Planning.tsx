import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, ArrowRight, Footprints, GripVertical } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Session } from '../types'
import { DAY_LETTER, DAY_NAMES, addDays, formatShortFr, mondayIndex, startOfWeek, toDateStr, todayStr } from '../lib/dates'
import { describeSchedule, ownerOf, plannedSessionIdsOn } from '../lib/schedule'
import { CategoryIcon, EmptyState, PageHeader } from '../components/ui'
import WorkoutSheet from '../components/WorkoutSheet'
import { PLAN_SEMI, TYPE_META, seanceDateStr, type PlanSeance, type PlanWeek } from '../data/plan'

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
  onOpen,
}: {
  s: PlanSeance
  todayIdx: number
  done: boolean
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
      {Array.from({ length: 7 }, (_, d) => (
        <button
          key={d}
          type="button"
          aria-label={`${s.title} — ${DAY_NAMES[s.day]}`}
          onClick={onOpen}
          className={'flex h-10 items-center justify-center rounded-lg ' + (d === todayIdx ? 'bg-sage-50' : '')}
        >
          {d === s.day ? (
            <span
              className={'rounded-full transition-all ' + (done ? 'h-4 w-4 shadow-sm' : 'h-4 w-4 border-[3px] bg-surface')}
              style={done ? { backgroundColor: t.hex } : { borderColor: t.hex }}
            />
          ) : (
            <span className="h-2 w-2 rounded-full bg-sand" />
          )}
        </button>
      ))}
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
  const monday = addDays(startOfWeek(new Date()), weekOffset * 7)
  // On ne surligne « aujourd'hui » que sur la semaine en cours
  const todayIdx = weekOffset === 0 ? mondayIndex() : -1

  // Position de la section « Running » du plan : elle n'a pas de séance pour porter un
  // `sortOrder`, on l'ancre donc AU-DESSUS d'une section utilisateur ('__start__' = tout
  // en haut, '__end__' = tout en bas), mémorisé en local (préférence d'affichage).
  const anchorKey = `elan-plan-anchor-${user?.uid ?? 'local'}`
  const [planAnchor, setPlanAnchor] = useState<string>(() => {
    try {
      return localStorage.getItem(anchorKey) ?? '__start__'
    } catch {
      return '__start__'
    }
  })
  useEffect(() => {
    try {
      setPlanAnchor(localStorage.getItem(anchorKey) ?? '__start__')
    } catch {
      setPlanAnchor('__start__')
    }
  }, [anchorKey])
  const savePlanAnchor = (k: string) => {
    setPlanAnchor(k)
    try {
      localStorage.setItem(anchorKey, k)
    } catch {
      /* stockage indisponible */
    }
  }

  // Ordre local optimiste pendant le drag & drop
  const [orderIds, setOrderIds] = useState<string[]>(() => sessions.map((s) => s.id))
  useEffect(() => {
    setOrderIds(sessions.map((s) => s.id))
  }, [sessions])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const ordered = orderIds.map((id) => sessions.find((s) => s.id === id)).filter((s): s is Session => !!s)

  // Jours de la semaine AFFICHÉE : planifié (jours fixes + rotation) et fait (logs)
  const weekDates = Array.from({ length: 7 }, (_, d) => toDateStr(addDays(monday, d)))
  const plannedByDay = Array.from({ length: 7 }, (_, d) => plannedSessionIdsOn(addDays(monday, d), sessions))
  const doneByDay = weekDates.map((ds) => new Set(logs.filter((l) => l.date === ds).map((l) => l.sessionId)))
  const perWeek = plannedByDay.reduce((a, ids) => a + ids.size, 0)

  // Plan semi : la semaine du plan dont le lundi correspond à la semaine AFFICHÉE (alignée
  // par date → les séances tombent sur leurs vraies dates, plus d'illusion de retard).
  const planWeekIdx = PLAN_SEMI.weeks.findIndex((w) => w.start === weekDates[0])
  const planWeek: PlanWeek | undefined = planWeekIdx >= 0 ? PLAN_SEMI.weeks[planWeekIdx] : undefined
  // Avant le départ du plan : indice cliquable pour sauter à la 1re semaine
  const firstStart = PLAN_SEMI.weeks[0].start
  const planStartOffset = Math.round(
    (new Date(firstStart + 'T12:00:00').getTime() - startOfWeek(new Date()).getTime()) / (7 * 86_400_000),
  )
  const showStartHint = !planWeek && weekDates[0] < firstStart
  const runDates = useMemo(() => new Set(logs.filter((l) => l.category === 'running').map((l) => l.date)), [logs])
  const validatedRefs = useMemo(() => new Set(logs.filter((l) => l.planRef).map((l) => l.planRef as string)), [logs])
  const [sheet, setSheet] = useState<PlanSeance | null>(null)

  // Sections personnalisées (Session.group) : ordre d'apparition, « Autres » à la fin
  const groupOf = (s: Session) => (s.group ?? '').trim()
  const groupNames: string[] = []
  for (const s of ordered) {
    const g = groupOf(s)
    if (g && !groupNames.includes(g)) groupNames.push(g)
  }
  const hasGroups = groupNames.length > 0
  const grouped: [string, Session[]][] = hasGroups
    ? [...groupNames.map((g): [string, Session[]] => [g, ordered.filter((s) => groupOf(s) === g)]),
       ...(ordered.some((s) => !groupOf(s)) ? [['', ordered.filter((s) => !groupOf(s))] as [string, Session[]]] : [])]
    : [['', ordered]]

  // Les séances du plan s'injectent DANS la section « Running » de l'utilisateur, à sa
  // place habituelle (l'ordre des autres sections est préservé). Si aucune section
  // « Running » n'existe encore, on la crée en tête.
  const RUN = 'Running'
  const hasRunningGroup = groupNames.includes(RUN)
  // Quand l'utilisateur n'a pas de section « Running » à lui, le plan en crée une, insérée
  // à sa position d'ancrage parmi les sections utilisateur (et non plus figée en tête).
  const showPlanSection = !!planWeek && !hasRunningGroup
  let sections: [string, Session[]][] = grouped
  if (showPlanSection) {
    const at =
      planAnchor === '__end__'
        ? grouped.length
        : (() => {
            const i = grouped.findIndex(([g]) => g === planAnchor)
            return i === -1 ? 0 : i // ancre absente (ex. section supprimée) → tout en haut
          })()
    sections = [...grouped.slice(0, at), [RUN, []] as [string, Session[]], ...grouped.slice(at)]
  }
  const emptyLabel = hasGroups ? 'Autres' : 'Mes séances'
  const showHeaders = hasGroups || !!planWeek
  const showGrid = !!planWeek || sessions.length > 0
  // Sections déplaçables par drag & drop de leur en-tête : celles qui portent ≥ 1 séance,
  // plus la section « Running » du plan (même sans séance à elle).
  const draggableKeys = sections.filter(([g, list]) => list.length > 0 || (showPlanSection && g === RUN)).map(([g]) => g)
  const canDragSections = draggableKeys.length >= 2
  const sectionItems = canDragSections ? draggableKeys.map((g) => 'sec-' + g) : []

  /** Réécrit le `sortOrder` de toutes les séances pour refléter `next` (et persiste). */
  const persistOrder = (next: string[]) => {
    setOrderIds(next)
    next.forEach((sid, i) => {
      const s = sessions.find((x) => x.id === sid)
      if (s && s.sortOrder !== i) void updateSession(sid, { sortOrder: i })
    })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const aId = String(active.id)
    const oId = String(over.id)

    // Réordonner une SECTION entière (glissée par sa poignée d'en-tête).
    // L'ordre des sections utilisateur dérive du sortOrder (réécrit par blocs) ; la
    // section « Running » du plan (sans séance) se repositionne via son ancre.
    if (aId.startsWith('sec-')) {
      const displayKeys = sections.map(([g]) => g)
      const fromKey = aId.slice(4)
      const toKey = oId.startsWith('sec-') ? oId.slice(4) : groupOf(sessions.find((s) => s.id === oId) ?? ({} as Session))
      const from = displayKeys.indexOf(fromKey)
      const to = displayKeys.indexOf(toKey)
      if (from === -1 || to === -1 || from === to) return
      const newKeys = arrayMove(displayKeys, from, to)
      const byKey = new Map(sections.map(([g, list]) => [g, list]))
      // Réécrit le sortOrder des séances dans le nouvel ordre de sections (le plan, sans séance, est ignoré)
      persistOrder(newKeys.flatMap((k) => (byKey.get(k) ?? []).map((s) => s.id)))
      // Réancre la section du plan juste au-dessus de la section qui la suit (ou tout en bas)
      if (showPlanSection) {
        const idx = newKeys.indexOf(RUN)
        if (idx >= 0) savePlanAnchor(newKeys[idx + 1] ?? '__end__')
      }
      return
    }

    // Déplacer une SÉANCE : réordonner, et la déposer sur une autre section l'y déplace.
    const oldIdx = orderIds.indexOf(aId)
    const newIdx = orderIds.indexOf(oId)
    if (oldIdx === -1 || newIdx === -1) return
    const a = sessions.find((s) => s.id === aId)
    const o = sessions.find((s) => s.id === oId)
    if (a && o && groupOf(a) !== groupOf(o)) void updateSession(a.id, { group: groupOf(o) })
    persistOrder(arrayMove(orderIds, oldIdx, newIdx))
  }

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
                      (isToday ? 'bg-sage-500 text-white shadow-sm' : 'text-ink-soft')
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
              {sections.map(([g, list]) => {
                // La section « Running » porte les séances du plan (course à pied), typées
                // par couleur, posées en tête — au-dessus des séances Running de l'utilisateur.
                const isRun = !!planWeek && g === RUN
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
                        planWeek.seances.map((s) => {
                          const date = seanceDateStr(planWeek, s)
                          const done = validatedRefs.has('elan-' + date) || runDates.has(date)
                          return <PlanRow key={'plan-' + s.day} s={s} todayIdx={todayIdx} done={done} onOpen={() => setSheet(s)} />
                        })}
                      <SortableContext items={list.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                        {list.map((s) => (
                          <Row
                            key={s.id}
                            session={s}
                            todayIdx={todayIdx}
                            plannedDays={plannedByDay.map((ids) => ids.has(s.id))}
                            doneDays={doneByDay.map((ids) => ids.has(s.id))}
                            sublabel={ownerOf(s.id, sessions) ? describeSchedule(s, sessions) : undefined}
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
