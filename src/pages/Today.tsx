import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Settings, Timer, Undo2 } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, feelingOf, type Category, type Log, type Session } from '../types'
import { addDays, formatTitleFr, toDateStr } from '../lib/dates'
import { logSummary, summarizeSession } from '../lib/format'
import { canonicalCycles, plannedSessionIdsOn } from '../lib/schedule'
import { isPlanLog, planToDoOn, planWeekFor, warmupsDueOn, type PlanSeanceState } from '../lib/planDay'
import { planningSections } from '../lib/planningLayout'
import { usePlanAnchor } from '../lib/usePlanAnchor'
import { TYPE_META } from '../data/plan'
import {
  CategoryIcon,
  CodeTile,
  DisplayTitle,
  EmptyState,
  Eyebrow,
  Pill,
  Sheet,
  glassCard,
  iconSquare,
} from '../components/ui'
import CompleteSheet from '../components/CompleteSheet'
import LogSheet from '../components/LogSheet'
import SettingsSheet from '../components/SettingsSheet'
import WorkoutSheet from '../components/WorkoutSheet'

/** Disciplines qui se déroulent au minuteur guidé (`pages/Player`) : leur carte porte
 *  un chronomètre plutôt qu'un chevron — l'action reste « ouvrir la fiche ». */
const TIMED: Category[] = ['muscu', 'hiit', 'etirements']

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

  // Ordre IDENTIQUE au Planning : on parcourt les sections dans leur ordre vertical et,
  // dans la section « Running », on insère la séance du plan du jour avant les séances.
  type DayItem = { kind: 'plan'; st: PlanSeanceState } | { kind: 'session'; s: Session }
  const toDoSet = new Set(toDo.map((s) => s.id))
  const sections = planningSections(sessions, !!planInfo, planAnchor)
  const dayItems: DayItem[] = []
  // Échauffements automatiques (warmupFor) : invités par une séance à faire de leur
  // catégorie cible, placés en tête — un échauffement se fait avant le reste.
  for (const s of warmupsDueOn(sessions, planToDo, plannedIds, doneIds)) dayItems.push({ kind: 'session', s })
  for (const sec of sections) {
    if (sec.plan) for (const st of planToDo) dayItems.push({ kind: 'plan', st })
    for (const s of sec.sessions) if (toDoSet.has(s.id)) dayItems.push({ kind: 'session', s })
  }

  /** Carte de séance à faire — même moule pour une course du plan et une séance
   *  utilisateur : tuile de code, titre condensé, prescription en mono, carré d'action. */
  const renderDayItem = (item: DayItem) => {
    const plan = item.kind === 'plan'
    const t = plan ? TYPE_META[item.st.seance.type] : null
    const meta = plan ? null : CATEGORY_META[item.s.category]
    const timed = !plan && TIMED.includes(item.s.category)
    // Une séance du plan n'a pas toujours de `detail` : pas de ligne mono vide.
    const sub = plan ? item.st.seance.detail : summarizeSession(item.s)
    return (
      <button
        key={plan ? item.st.planRef : item.s.id}
        type="button"
        onClick={() => (plan ? setPlanSheet(item.st) : setCompleting(item.s))}
        className={`flex w-full items-center gap-3.5 p-4 text-left transition-transform active:scale-[0.985] ${glassCard}`}
      >
        <CodeTile code={t ? t.code : meta!.code} hex={t ? t.hex : meta!.hex} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl leading-none font-bold uppercase">
            {plan ? item.st.seance.title : item.s.name}
          </p>
          {sub && (
            <p className="mt-1 truncate font-mono text-[10px] tracking-[0.12em] uppercase text-ink/65">{sub}</p>
          )}
        </div>
        <span className={iconSquare + ' text-sage-500'}>
          {timed ? <Timer className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
    )
  }

  return (
    <div>
      <header className="px-[22px] pt-9">
        <div className="flex items-start justify-between gap-3">
          <Eyebrow className="pt-1 text-sage-500">
            ● — AVEL · {isToday ? 'JOUR' : isFuture ? 'À VENIR' : 'SAISIE PASSÉE'}
          </Eyebrow>
          <div className="flex shrink-0 gap-2">
            <button type="button" aria-label="Jour précédent" onClick={() => shiftDay(-1)} className={iconSquare}>
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
            <button type="button" aria-label="Jour suivant" onClick={() => shiftDay(1)} className={iconSquare}>
              <ChevronRight className="h-[18px] w-[18px]" />
            </button>
            <button type="button" aria-label="Réglages" onClick={() => setSettingsOpen(true)} className={iconSquare}>
              <Settings className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
        {/* Titre sur deux lignes, cassé au même endroit quel que soit le jour. La taille
            suit la largeur d'écran : « 29 SEPTEMBRE » doit tenir sur un iPhone SE. */}
        <DisplayTitle className="mt-4 text-[min(15vw,72px)] leading-[0.84] tracking-tight">
          {title[0]}
          <br />
          {title[1]}
        </DisplayTitle>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone="accent">
            {dayItems.length} PRÉVUE{dayItems.length > 1 ? 'S' : ''}
          </Pill>
          <Pill>
            {todayLogs.length} FAITE{todayLogs.length > 1 ? 'S' : ''}
          </Pill>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDayOffset(0)}
              className="flex items-center gap-1.5 rounded-full border border-sage-500/50 px-3 py-[5px] font-mono text-[10px] tracking-[0.16em] uppercase text-sage-700"
            >
              <Undo2 className="h-3 w-3" /> Revenir à aujourd'hui
            </button>
          )}
        </div>
      </header>

      <div className="mt-9 space-y-2.5 px-[22px]">
        {dayItems.map(renderDayItem)}

        {dayItems.length === 0 && todayLogs.length === 0 && (
          <div className={`px-4 py-6 text-center ${glassCard}`}>
            <p className="font-display text-xl leading-none font-bold uppercase">Journée repos</p>
            <p className="mt-2 font-mono text-[10px] leading-relaxed tracking-[0.12em] uppercase text-ink/65">
              {isToday
                ? 'Rien de prévu — ou lancez une séance hors planning'
                : isFuture
                  ? 'Rien de prévu ce jour-là'
                  : "Rien n'était prévu — saisissez une séance oubliée"}
            </p>
          </div>
        )}
        {dayItems.length === 0 && todayLogs.length > 0 && isToday && (
          <div className={`px-4 py-6 text-center ${glassCard}`}>
            <p className="font-display text-2xl leading-none font-bold uppercase text-sage-700">Journée bouclée 🎉</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full rounded-md border border-dashed border-ink/35 py-3.5 font-mono text-[11px] font-bold tracking-[0.16em] uppercase text-ink active:bg-glass-soft"
        >
          {/* La maquette dit « + SÉANCE HORS PLANNING » ; on garde le mot de l'app
              (« libre »), que huit vérifs Playwright ciblent — `uppercase` donne de
              toute façon le même rendu que la maquette. */}
          + Séance libre
        </button>
      </div>

      {todayLogs.length > 0 && (
        <section className="mt-6 px-[22px]">
          {/* Style de la maquette (mono interlettré, tiret d'attaque) mais on garde le
              mot « Terminées » et la balise h2 : plusieurs vérifs Playwright ciblent
              `h2:has-text("Terminées")`, et c'est bien un titre de section. */}
          <h2 className="mb-2.5 font-mono text-[10px] tracking-[0.22em] uppercase text-ink/55">— Terminées</h2>
          <div className="space-y-2">
            {todayLogs.map((l) => {
              const meta = CATEGORY_META[l.category]
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setViewing(l)}
                  // Le filet gauche accentué remplace la coche : c'est le marqueur
                  // « fait » de la maquette, et la section le dit déjà.
                  className="flex w-full items-center gap-3 border border-hairline border-l-2 border-l-sage-500 bg-glass-sunken px-3.5 py-3 text-left backdrop-blur-lg transition-transform active:scale-[0.985]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <CategoryIcon category={l.category} className={`h-3.5 w-3.5 shrink-0 ${meta.text}`} />
                      <span className="min-w-0 truncate font-display text-xl leading-none font-bold uppercase">
                        {l.sessionName}
                      </span>
                    </p>
                    <p className="mt-1 truncate font-mono text-[10px] tracking-[0.12em] uppercase text-ink/60">
                      {logSummary(l)}
                      {feelingOf(l.feeling) && <span className="ml-1">{feelingOf(l.feeling)!.emoji}</span>}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-sage-500" />
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
                <p className={`mb-1.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase ${meta.text}`}>
                  <CategoryIcon category={cat} className="h-3.5 w-3.5" /> — {meta.label}
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
                      className="flex w-full items-center justify-between gap-2 rounded-sm bg-sage-50 px-4 py-3 text-left active:bg-sage-100"
                    >
                      <span className="truncate font-display text-xl leading-none font-bold uppercase">{s.name}</span>
                      <span className="shrink-0 font-mono text-[9px] tracking-[0.1em] uppercase text-ink/60">
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
