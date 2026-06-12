import { useEffect, useState } from 'react'
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
import { GripVertical } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Session } from '../types'
import { DAY_LETTER, DAY_NAMES, addDays, formatShortFr, mondayIndex, startOfWeek, toDateStr, todayStr } from '../lib/dates'
import { describeSchedule, ownerOf, plannedSessionIdsOn } from '../lib/schedule'
import { CategoryIcon, EmptyState, PageHeader } from '../components/ui'

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

export default function Planning() {
  const { sessions, logs, updateSession, addLog, removeLog } = useData()
  const navigate = useNavigate()
  const todayIdx = mondayIndex()

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

  // Semaine en cours : planifié (jours fixes + rotation) et fait (logs)
  const monday = startOfWeek(new Date())
  const weekDates = Array.from({ length: 7 }, (_, d) => toDateStr(addDays(monday, d)))
  const plannedByDay = Array.from({ length: 7 }, (_, d) => plannedSessionIdsOn(addDays(monday, d), sessions))
  const doneByDay = weekDates.map((ds) => new Set(logs.filter((l) => l.date === ds).map((l) => l.sessionId)))
  const perWeek = plannedByDay.reduce((a, ids) => a + ids.size, 0)

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

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = orderIds.indexOf(String(active.id))
    const newIdx = orderIds.indexOf(String(over.id))
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(orderIds, oldIdx, newIdx)
    setOrderIds(next)
    // Déposer sur une autre section déplace la séance dans cette section
    const a = sessions.find((s) => s.id === String(active.id))
    const o = sessions.find((s) => s.id === String(over.id))
    if (a && o && groupOf(a) !== groupOf(o)) void updateSession(a.id, { group: groupOf(o) })
    next.forEach((sid, i) => {
      const s = sessions.find((x) => x.id === sid)
      if (s && s.sortOrder !== i) void updateSession(sid, { sortOrder: i })
    })
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
      <PageHeader kicker="Semaine type" title="Planning" />
      <p className="-mt-2 px-5 pb-4 text-xs font-semibold text-ink-soft">
        Anneau = prévu · rond plein = fait. Touchez un rond pour valider / dévalider la séance ce jour-là ; la
        planification se modifie dans la fiche de la séance. Glissez{' '}
        <span className="inline-block align-middle text-ink-soft/60">⠿</span> pour réordonner ou changer de section.
        {perWeek > 0 && (
          <span className="ml-1 text-sage-600">
            {perWeek} séance{perWeek > 1 ? 's' : ''} prévue{perWeek > 1 ? 's' : ''} cette semaine.
          </span>
        )}
      </p>

      {sessions.length === 0 ? (
        <div className="px-5">
          <EmptyState emoji="🗂️" text="Créez d'abord une séance dans l'onglet Exercices." />
        </div>
      ) : (
        <div className="px-3">
          {/* En-tête des jours */}
          <div className={GRID + ' px-1.5 pb-1'}>
            <span />
            <span />
            {DAY_LETTER.map((letter, d) => (
              <span
                key={d}
                title={DAY_NAMES[d]}
                className={
                  'mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ' +
                  (d === todayIdx ? 'bg-sage-500 text-white shadow-sm' : 'text-ink-soft')
                }
              >
                {letter}
              </span>
            ))}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
              {grouped.map(([g, list]) => (
                <div key={g || '—'}>
                  {hasGroups && (
                    <h2 className="px-1.5 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
                      {g || 'Autres'}
                    </h2>
                  )}
                  <div className="space-y-1.5">
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
                  </div>
                </div>
              ))}
            </SortableContext>
          </DndContext>

          <p className="px-2 pt-4 text-center text-xs font-semibold text-ink-soft">
            Votre semaine type se répète automatiquement. Touchez le nom d'une séance pour la modifier — la section se
            choisit dans sa fiche (champ « Section du planning »).
          </p>
        </div>
      )}
    </div>
  )
}
