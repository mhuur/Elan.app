import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, MeasuringStrategy, closestCenter } from '@dnd-kit/core'
import FloatingOverlay, { liftedClass } from '../components/FloatingOverlay'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, displayCategory, type Category, type Session } from '../types'
import { DAY_LETTER, DAY_NAMES, addDays, formatShortFr, todayStr } from '../lib/dates'
import { canonicalCycles, describeSchedule, ownerOf, plannedSessionIdsOn } from '../lib/schedule'
import { isPlanLog } from '../lib/planDay'
import { usePlanAnchor } from '../lib/usePlanAnchor'
import { usePlanningWeek } from '../lib/usePlanningWeek'
import { usePlanningOrdering } from '../lib/usePlanningOrdering'
import { CategoryRing, DisplayTitle, Eyebrow, glassCard, iconSquare, secondaryCls } from '../components/ui'
import { DayDot, dayCell, type DayState } from '../components/DayDot'
import { Picto } from '../components/icons'
import WorkoutSheet from '../components/WorkoutSheet'
import { seanceDateStr, type PlanSeance } from '../data/plan'

/** Grille commune : poignée · nom · 7 jours (planche Planning : 24 px / 1fr / 7 × 32, 48 sur bureau) */
const GRID = 'grid grid-cols-[24px_minmax(0,1fr)_repeat(7,32px)] items-center lg:grid-cols-[24px_minmax(0,1fr)_repeat(7,48px)] lg:gap-x-1'

/** Ligne de séance : carte blanche à contour, rayon 12 */
const ROW = GRID + ' rounded-sm border border-hairline bg-surface py-1 pr-1.5 pl-0.5'

const COURT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']

type RowProps = {
  session: Session
  todayIdx: number
  /** État de chaque jour de la semaine affichée */
  states: DayState[]
  sublabel?: string
  /** Toucher un rond : valider / dévalider la séance ce jour-là */
  onDay: (day: number) => void
  onEdit: () => void
}

/**
 * Place de l'élément glissé : un simple espace vide, sans cadre ni copie pâle, que les
 * autres lignes contournent (modèle Google Tasks). Oct. 2026, retours successifs : la
 * copie à 30 % puis le cadre pointillé rendaient l'ensemble « brouillon ».
 */
const SLOT = ' border-transparent bg-transparent [&>*]:invisible'

/** Poignée tactile : défilement natif tant que l'appui long n'a pas pris, ni sélection ni menu */
const HANDLE = 'cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] items-center justify-center text-ink-mute active:cursor-grabbing'

/** Ligne déplaçable : sa place devient un emplacement vide, sa copie flottante (`RowFace`) suit le doigt */
function Row(props: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.session.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={ROW + (isDragging ? SLOT : '')}
    >
      <RowFace {...props} handle={{ ...attributes, ...listeners }} />
    </div>
  )
}

/** « 1 sur 2 » / « Faite(s) » : avancement de la semaine, affiché sur bureau */
function countLabel(states: DayState[]) {
  const n = states.filter((s) => s !== 'none').length
  const d = states.filter((s) => s === 'done').length
  if (!n) return null
  const all = d === n
  return <span className={all ? 'font-semibold text-sage-700' : 'font-semibold'}>{all ? (n > 1 ? 'Faites' : 'Faite') : `${d} sur ${n}`}</span>
}

/** Contenu d'une ligne : poignée · nom · 7 jours — partagé par la ligne et sa copie flottante */
function RowFace({ session, todayIdx, states, sublabel, onDay, onEdit, handle }: RowProps & { handle?: object }) {
  const { exercises } = useData()
  const cat = displayCategory(session, exercises)
  const days = states.map((s, i) => (s !== 'none' ? COURT[i] : '')).filter(Boolean)
  return (
    <>
      <button
        type="button"
        aria-label={`Déplacer ${session.name}`}
        {...handle}
        className={'flex h-11 w-6 ' + HANDLE}
      >
        <Picto name="poignee" className="grip h-4 w-4" strokeWidth={3} />
      </button>
      <button type="button" onClick={onEdit} className="min-w-0 pr-1 pl-0.5 text-left">
        <span className="line-clamp-2 text-[15px] leading-[19px] font-semibold lg:line-clamp-1 lg:text-base lg:leading-[22px]">
          {session.name}
        </span>
        {/* Cadence d'un cycle d'alternance : le ↻ est cherché tel quel par `check-interval` */}
        {sublabel && <span className="block truncate text-[13px] leading-[18px] text-ink-mute lg:hidden">↻ {sublabel}</span>}
        <span className="hidden truncate text-sm leading-5 text-ink-soft lg:block">
          {CATEGORY_META[cat].label}
          {sublabel ? ` · ↻ ${sublabel}` : days.length === 7 ? ' · tous les jours' : days.length ? ` · ${days.join(', ')}` : ''}
          {countLabel(states) && <> · {countLabel(states)}</>}
        </span>
      </button>
      {states.map((st, d) => (
        <button
          key={d}
          type="button"
          aria-label={`${session.name} — ${DAY_NAMES[d]}`}
          aria-pressed={st === 'done' || st === 'planned' || st === 'missed'}
          onClick={() => onDay(d)}
          className={dayCell(d === todayIdx)}
        >
          <DayDot state={st} category={cat} />
        </button>
      ))}
    </>
  )
}

/**
 * Ligne d'une séance du plan semi (course à pied), en lecture seule : un drapeau à la
 * place de la poignée. Posée sur sa colonne de jour ; taper ouvre la fiche (consulter +
 * valider). Ne s'édite pas ici : le plan est figé.
 */
function PlanRow({ s, states, todayIdx, onOpen }: { s: PlanSeance; states: DayState[]; todayIdx: number; onOpen: () => void }) {
  return (
    <div className={ROW}>
      <span title="Séance du plan, non déplaçable" className="flex h-11 w-6 items-center justify-center text-ink-mute">
        <Picto name="drapeau" className="h-4 w-4" />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 pr-1 pl-0.5 text-left">
        <span className="line-clamp-2 text-[15px] leading-[19px] font-semibold lg:line-clamp-1 lg:text-base lg:leading-[22px]">{s.title}</span>
        <span className="hidden truncate text-sm leading-5 text-ink-soft lg:block">
          {CATEGORY_META.running.label} · {COURT[s.day]}
          {countLabel(states) && <> · {countLabel(states)}</>}
        </span>
      </button>
      {states.map((st, d) => (
        <button key={d} type="button" aria-label={`${s.title} — ${DAY_NAMES[s.day]}`} onClick={onOpen} className={dayCell(d === todayIdx)}>
          <DayDot state={st} category="running" />
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
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? SLOT : undefined}
    >
      {children({ attributes, listeners })}
    </div>
  )
}

/** « 12 – 18 octobre » ou « 28 sept. – 4 oct. » */
function rangeLabel(a: string, b: string) {
  const da = new Date(a + 'T12:00:00')
  const db = new Date(b + 'T12:00:00')
  if (da.getMonth() === db.getMonth()) return `${da.getDate()} – ${db.getDate()} ${db.toLocaleDateString('fr-FR', { month: 'long' })}`
  return `${formatShortFr(a)} – ${formatShortFr(b)}`
}

export default function Planning() {
  const { sessions, exercises, logs, updateSession, addLog, removeLog } = useData()
  const navigate = useNavigate()
  // Navigation semaine par semaine (0 = cette semaine)
  const [weekOffset, setWeekOffset] = useState(0)
  const [sheet, setSheet] = useState<PlanSeance | null>(null)
  // Position de la section « Running » du plan (préférence partagée avec Aujourd'hui)
  const [planAnchor, savePlanAnchor] = usePlanAnchor()

  const { monday, weekDates, todayIdx, planWeek, planWeekIdx, planStates, firstStart, planStartOffset, showStartHint } =
    usePlanningWeek(weekOffset, logs)
  const { sensors, sections, sectionItems, canDragSections, hasGroups, showGrid, handleDragEnd } = usePlanningOrdering({
    sessions,
    planActive: !!planWeek,
    planAnchor,
    savePlanAnchor,
    updateSession,
  })

  const cycles = useMemo(() => canonicalCycles(sessions), [sessions])
  // Jours de la semaine AFFICHÉE : planifié (jours fixes + rotation) et fait (logs)
  const plannedByDay = useMemo(
    () => Array.from({ length: 7 }, (_, d) => plannedSessionIdsOn(addDays(monday, d), sessions, cycles)),
    [monday, sessions, cycles],
  )
  const doneByDay = weekDates.map((ds) => new Set(logs.filter((l) => l.date === ds && !isPlanLog(l)).map((l) => l.sessionId)))
  const today = todayStr()
  // Une séance non planifiée n'encombre pas la grille : elle n'apparaît que les semaines où elle a été faite.
  const visibleInWeek = (s: Session) =>
    s.days.length > 0 || !!s.repeat || !!ownerOf(s.id, sessions, cycles) || doneByDay.some((ids) => ids.has(s.id))

  const statesOf = (s: Session): DayState[] =>
    weekDates.map((ds, d) =>
      doneByDay[d].has(s.id) ? 'done' : plannedByDay[d].has(s.id) ? (ds < today ? 'missed' : 'planned') : 'none',
    )
  /** Séance du plan : plein le jour réellement fait, anneau le jour prévu tant qu'elle n'est pas faite */
  const planStatesOf = (st: (typeof planStates)[number]): DayState[] => {
    const inWeek = st.doneDate ? weekDates.indexOf(st.doneDate) : -1
    const doneCol = !st.done ? -1 : inWeek >= 0 ? inWeek : st.seance.day
    return weekDates.map((ds, d) =>
      st.done && d === doneCol ? 'done' : !st.done && d === st.seance.day ? (ds < today ? 'missed' : 'planned') : 'none',
    )
  }

  // Bilan de la semaine : une barre par séance prévue, dans l'ordre des jours
  const segs: { day: number; cat: Category; done: boolean; title: string }[] = []
  for (let d = 0; d < 7; d++) {
    for (const id of plannedByDay[d]) {
      const s = sessions.find((x) => x.id === id)
      if (s) segs.push({ day: d, cat: displayCategory(s, exercises), done: doneByDay[d].has(id), title: s.name })
    }
    for (const st of planStates) if (st.seance.day === d) segs.push({ day: d, cat: 'running', done: st.done, title: st.seance.title })
  }
  const doneN = segs.filter((s) => s.done).length
  const future = weekOffset > 0
  const missed = segs.filter((s) => !s.done && weekDates[s.day] < today)

  const emptyLabel = hasGroups ? 'Autres' : 'Mes séances'

  const [dragId, setDragId] = useState<string | null>(null)
  const rowProps = (s: Session): RowProps => ({
    session: s,
    todayIdx,
    states: statesOf(s),
    sublabel: ownerOf(s.id, sessions, cycles) ? describeSchedule(s, sessions, cycles) : undefined,
    onDay: (d) => validateDay(s, d),
    onEdit: () => navigate(`/session/${s.id}`),
  })
  const dragSession = dragId && !dragId.startsWith('sec-') ? sessions.find((s) => s.id === dragId) : undefined
  const dragSection = dragId?.startsWith('sec-') ? sections.find((sec) => 'sec-' + sec.group === dragId) : undefined
  const showHeaders = hasGroups || !!planWeek

  /**
   * Toucher un rond : valide (crée un log) ou dévalide (supprime le log) la séance ce
   * jour-là. Ne modifie JAMAIS la planification — elle s'édite dans la fiche de la séance.
   */
  const validateDay = (s: Session, day: number) => {
    const ds = weekDates[day]
    if (ds > today) return // jour pas encore arrivé
    const log = logs.find((l) => l.sessionId === s.id && l.date === ds)
    if (log) {
      const hasPerfs = !!(log.metrics?.length || log.results?.length)
      if (hasPerfs && !window.confirm(`Dévalider « ${s.name} » du ${formatShortFr(ds)} ? Les perfs enregistrées seront supprimées.`)) return
      void removeLog(log.id)
    } else {
      void addLog({ date: ds, sessionId: s.id, sessionName: s.name, category: s.category, createdAt: Date.now(), note: '' })
    }
  }

  const weekLabel = weekOffset === 0 ? 'Cette semaine' : weekOffset === 1 ? 'Semaine prochaine' : weekOffset === -1 ? 'Semaine dernière' : `Semaine du ${formatShortFr(weekDates[0])}`
  const range = rangeLabel(weekDates[0], weekDates[6])

  // Bilan par catégorie (colonne « Semaine en bref » du bureau)
  const byCat = CATEGORIES.map((c) => ({ c, n: segs.filter((s) => s.cat === c).length, d: segs.filter((s) => s.cat === c && s.done).length })).filter((x) => x.n)

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 lg:gap-4 lg:px-10 lg:pt-8">
      <header className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <Eyebrow>{weekLabel}</Eyebrow>
          <DisplayTitle className="text-2xl leading-[1.2] lg:text-[30px]">{range}</DisplayTitle>
        </div>
        <button type="button" aria-label="Semaine précédente" onClick={() => setWeekOffset((o) => o - 1)} className={iconSquare}>
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <button type="button" aria-label="Semaine suivante" onClick={() => setWeekOffset((o) => o + 1)} className={iconSquare}>
          <ChevronRight className="h-[22px] w-[22px]" />
        </button>
      </header>

      {!showGrid ? (
        <section className={`flex flex-col items-center gap-3 px-6 py-8 text-center ${glassCard}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-50">
            <Picto name="planning" className="h-7 w-7" />
          </span>
          <h2 className="text-[22px] leading-7 font-extrabold">Aucune séance à organiser</h2>
          <p className="max-w-[340px] text-base leading-6 text-ink-soft">
            Créez une séance dans l'onglet Exercices et choisissez ses jours : elle apparaîtra ici, une ligne par séance, un anneau par jour.
          </p>
          <button type="button" onClick={() => navigate('/library')} className={secondaryCls + ' mt-1'}>
            Ouvrir Exercices
          </button>
        </section>
      ) : (
        <>
          {segs.length > 0 && (
            <section aria-label="Bilan de la semaine" className={`flex flex-col gap-2 px-4 py-3.5 ${glassCard}`}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[26px] leading-[30px] font-extrabold tabular-nums">{future ? segs.length : `${doneN} sur ${segs.length}`}</span>
                <span className="text-[15px] font-medium text-ink-soft">{future ? 'séances prévues' : 'séances faites cette semaine'}</span>
              </div>
              <div className="flex gap-[3px]">
                {segs.map((s, i) => (
                  <span key={i} className="h-2 flex-1 rounded-full" style={{ backgroundColor: s.done ? CATEGORY_META[s.cat].hex : '#e3e6eb' }} />
                ))}
              </div>
            </section>
          )}

          {showStartHint && (
            <button
              type="button"
              onClick={() => setWeekOffset(planStartOffset)}
              className="inline-flex h-11 items-center justify-center gap-1.5 self-start rounded-full bg-sage-100 px-4 text-[15px] font-bold text-sage-700"
            >
              Le plan semi démarre {formatShortFr(firstStart)}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          <div className="flex flex-col gap-1.5">
            {/* En-tête des jours : lettre + numéro, aujourd'hui en pastille Volt */}
            <div aria-hidden className={GRID + ' pr-1.5 pl-0.5'}>
              <span />
              <span />
              {DAY_LETTER.map((letter, d) => {
                const isToday = d === todayIdx
                return (
                  <div key={d} title={DAY_NAMES[d]} className="flex flex-col items-center gap-0.5">
                    <span className={'text-[13px] leading-[18px] font-semibold ' + (isToday ? 'text-sage-700' : 'text-ink-soft')}>{letter}</span>
                    <span
                      className={
                        'flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold tabular-nums ' + (isToday ? 'bg-sage-500 text-ink' : 'text-ink')
                      }
                    >
                      {Number(weekDates[d].slice(8, 10))}
                    </span>
                  </div>
                )
              })}
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              // Les sections se replient au début du glisser : remesurer en continu
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
              onDragStart={(e) => setDragId(String(e.active.id))}
              onDragCancel={() => setDragId(null)}
              onDragEnd={(e) => {
                setDragId(null)
                handleDragEnd(e)
              }}
            >
              <SortableContext items={sectionItems} strategy={verticalListSortingStrategy}>
                {sections.map((sec) => {
                  const g = sec.group
                  const list = sec.sessions.filter(visibleInWeek)
                  // La section « Running » porte les séances du plan, posées en tête
                  const isRun = sec.plan
                  if (!isRun && list.length === 0) return null
                  const draggable = canDragSections && (list.length > 0 || isRun)
                  const body = (handle?: ReactNode) => (
                    <section aria-label={g || emptyLabel} className="flex flex-col gap-2 pt-1.5">
                      {showHeaders && (
                        <h2 className="flex items-center gap-0.5 text-base leading-[22px] font-bold">
                          {handle ?? <span className="w-1" />}
                          <span>{g || emptyLabel}</span>
                          {isRun && planWeek && (
                            <span className="text-sm font-medium text-ink-soft">&nbsp;· plan semi, semaine {planWeekIdx + 1}</span>
                          )}
                        </h2>
                      )}
                      {/* Pendant le glisser d'une section, toutes se replient sur leur en-tête :
                          la place libérée a la hauteur d'un en-tête, pas d'une section entière */}
                      {isRun &&
                        !dragSection &&
                        planStates.map((st) => (
                          <PlanRow key={'plan-' + st.seance.day} s={st.seance} states={planStatesOf(st)} todayIdx={todayIdx} onOpen={() => setSheet(st.seance)} />
                        ))}
                      {!dragSection && (
                        <SortableContext items={list.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                          {list.map((s) => (
                            <Row key={s.id} {...rowProps(s)} />
                          ))}
                        </SortableContext>
                      )}
                    </section>
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
                            className={'flex h-9 w-8 ' + HANDLE}
                          >
                            <Picto name="poignee" className="grip h-[18px] w-[18px]" strokeWidth={3} />
                          </button>,
                        )
                      }
                    </SortableSection>
                  )
                })}
              </SortableContext>
              <FloatingOverlay>
                {dragSession && (
                  <div className={GRID + ' rounded-sm py-1 pr-1.5 pl-0.5 ' + liftedClass}>
                    <RowFace {...rowProps(dragSession)} />
                  </div>
                )}
                {dragSection && (
                  <div className={'flex items-center gap-1 rounded-sm px-2 py-2.5 ' + liftedClass}>
                    <Picto name="poignee" className="grip h-[18px] w-[18px] text-ink-mute" strokeWidth={3} />
                    <span className="text-base font-bold">{dragSection.group || emptyLabel}</span>
                    {(() => {
                      const n = dragSection.sessions.filter(visibleInWeek).length + (dragSection.plan ? planStates.length : 0)
                      return <span className="text-sm text-ink-soft">· {n} séance{n > 1 ? 's' : ''}</span>
                    })()}
                  </div>
                )}
              </FloatingOverlay>
            </DndContext>
          </div>

          {sessions.length === 0 && (
            <p className="px-3 pt-3 text-center text-sm text-ink-soft">
              Ajoutez vos séances HIIT ou muscu dans l'onglet Exercices pour les organiser autour du plan.
            </p>
          )}
        </>
      )}

      {/* Bureau : colonne « Semaine en bref » de 520 px */}
      <aside
        aria-label="Semaine en bref"
        className="fixed top-0 right-0 bottom-0 hidden w-[520px] flex-col gap-6 overflow-y-auto border-l border-hairline bg-surface px-7 py-8 xl:flex"
      >
        <div>
          <Eyebrow>Semaine en bref</Eyebrow>
          <h2 className="text-[22px] leading-7 font-extrabold">{range}</h2>
        </div>
        {byCat.length > 0 && (
          <div className="flex flex-col gap-1">
            {byCat.map((k) => (
              <div key={k.c} className="flex items-center gap-3 border-t border-hairline py-2">
                <CategoryRing category={k.c} size={40} progress={k.d / k.n} done={k.d === k.n} />
                <span className="min-w-0 flex-1 text-base leading-[22px] font-semibold">{CATEGORY_META[k.c].label}</span>
                <span className="text-base font-bold tabular-nums">
                  {k.d} sur {k.n}
                </span>
              </div>
            ))}
          </div>
        )}
        {missed.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-base leading-[22px] font-bold">Non faites</h3>
            {missed.map((m, i) => (
              <div key={i} className="flex items-center gap-3 rounded-sm bg-cream px-3 py-2.5">
                <CategoryRing category={m.cat} missed size={32} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] leading-5 font-semibold">{m.title}</span>
                  <span className="text-sm leading-5 text-ink-soft first-letter:uppercase">
                    {DAY_NAMES[m.day]} {formatShortFr(weekDates[m.day])} · prévue, non faite
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-base leading-[22px] font-bold">Lire la grille</h3>
          {(
            [
              ['Faite', 'disque plein', { done: true }],
              ['Prévue', 'anneau clair', {}],
              ['Non faite', 'jour passé, pointillés gris', { missed: true }],
            ] as const
          ).map(([l, d, p]) => (
            <div key={l} className="flex items-center gap-3">
              <CategoryRing category="muscu" size={32} {...p} />
              <span className="text-[15px] leading-5">
                <b className="font-bold">{l}</b> · {d}
              </span>
            </div>
          ))}
          <p className="mt-1 text-sm leading-5 text-ink-soft">
            Toucher un anneau valide ou dévalide la séance ce jour-là. Les jours se règlent dans la fiche de la séance.
          </p>
        </div>
      </aside>

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
