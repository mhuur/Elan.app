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
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Session } from '../types'
import { DAY_LETTER, DAY_NAMES, addDays, mondayIndex, startOfWeek } from '../lib/dates'
import { describeSchedule, ownerOf, plannedSessionIdsOn } from '../lib/schedule'
import { EmptyState, PageHeader } from '../components/ui'

/** Grille commune : poignée · nom · 7 jours */
const GRID = 'grid grid-cols-[1rem_minmax(0,1fr)_repeat(7,1.85rem)] items-center gap-x-0.5'

function Row({
  session,
  todayIdx,
  autoDays,
  sublabel,
  onToggle,
  onEdit,
}: {
  session: Session
  todayIdx: number
  /** Occurrences calculées (intervalle / alternance) pour la semaine en cours */
  autoDays: boolean[]
  sublabel?: string
  onToggle: (day: number) => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: session.id })
  const meta = CATEGORY_META[session.category]
  const isRepeat = !!session.repeat
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
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <circle cx="9" cy="6" r="1.7" />
          <circle cx="15" cy="6" r="1.7" />
          <circle cx="9" cy="12" r="1.7" />
          <circle cx="15" cy="12" r="1.7" />
          <circle cx="9" cy="18" r="1.7" />
          <circle cx="15" cy="18" r="1.7" />
        </svg>
      </button>
      <button type="button" onClick={onEdit} className="min-w-0 px-1 py-1 text-left">
        <span className="block truncate text-xs font-extrabold">
          {meta.emoji} {session.name}
        </span>
        {sublabel && <span className="block truncate text-[10px] font-bold text-ink-soft/70">↻ {sublabel}</span>}
      </button>
      {Array.from({ length: 7 }, (_, d) => {
        const solid = !isRepeat && session.days.includes(d)
        const auto = !solid && autoDays[d]
        return (
          <button
            key={d}
            type="button"
            aria-label={`${session.name} — ${DAY_NAMES[d]}`}
            aria-pressed={solid || auto}
            onClick={() => (isRepeat ? onEdit() : onToggle(d))}
            className={
              'flex h-10 items-center justify-center rounded-lg transition-colors ' +
              (d === todayIdx ? 'bg-sage-50' : '')
            }
          >
            <span
              className={
                'rounded-full transition-all ' +
                (solid ? 'h-4 w-4 shadow-sm' : auto ? 'h-4 w-4 border-[3px] bg-surface' : 'h-2 w-2 bg-sand')
              }
              style={solid ? { backgroundColor: meta.hex } : auto ? { borderColor: meta.hex } : undefined}
            />
          </button>
        )
      })}
    </div>
  )
}

export default function Planning() {
  const { sessions, updateSession } = useData()
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

  // Occurrences calculées pour la semaine en cours (intervalles et alternances)
  const monday = startOfWeek(new Date())
  const autoByDay = Array.from({ length: 7 }, (_, d) => plannedSessionIdsOn(addDays(monday, d), sessions))
  const perWeek = autoByDay.reduce((a, ids) => a + ids.size, 0)

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = orderIds.indexOf(String(active.id))
    const newIdx = orderIds.indexOf(String(over.id))
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(orderIds, oldIdx, newIdx)
    setOrderIds(next)
    next.forEach((sid, i) => {
      const s = sessions.find((x) => x.id === sid)
      if (s && s.sortOrder !== i) void updateSession(sid, { sortOrder: i })
    })
  }

  const toggle = (s: Session, day: number) => {
    const days = s.days.includes(day) ? s.days.filter((d) => d !== day) : [...s.days, day].sort((a, b) => a - b)
    void updateSession(s.id, { days })
  }

  return (
    <div>
      <PageHeader kicker="Semaine type" title="Planning" />
      <p className="-mt-2 px-5 pb-4 text-xs font-semibold text-ink-soft">
        Touchez un rond pour planifier · glissez{' '}
        <span className="inline-block align-middle text-ink-soft/60">⠿</span> pour réordonner. Rond plein = jour fixe,
        anneau = automatique (tous les X jours / alternance).
        {perWeek > 0 && (
          <span className="ml-1 text-sage-600">
            {perWeek} séance{perWeek > 1 ? 's' : ''} cette semaine.
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
              <div className="space-y-1.5">
                {ordered.map((s) => (
                  <Row
                    key={s.id}
                    session={s}
                    todayIdx={todayIdx}
                    autoDays={autoByDay.map((ids) => ids.has(s.id))}
                    sublabel={s.repeat || ownerOf(s.id, sessions) ? describeSchedule(s, sessions) : undefined}
                    onToggle={(d) => toggle(s, d)}
                    onEdit={() => navigate(`/session/${s.id}`)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <p className="px-2 pt-4 text-center text-xs font-semibold text-ink-soft/60">
            Votre semaine type se répète automatiquement. Touchez le nom d'une séance pour la modifier.
          </p>
        </div>
      )}
    </div>
  )
}
