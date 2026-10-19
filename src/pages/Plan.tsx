import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CategoryRing, DisplayTitle, Eyebrow, glassCard, iconSquare, secondaryCls } from '../components/ui'
import { Picto } from '../components/icons'
import WorkoutSheet from '../components/WorkoutSheet'
import { DAY_NAMES, addDays, formatShortFr, toDateStr, todayStr } from '../lib/dates'
import {
  PLAN_METRICS,
  PLAN_ZONES,
  PLAN_SEMI,
  TYPE_DIFFICULTY,
  TYPE_META,
  currentWeekIndex,
  daysToRace,
  seanceDateStr,
  workoutStats,
  type PlanSeance,
  type PlanWeek,
} from '../data/plan'

/** « 52 », « 2 h 38 » (minutes) */
const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m}`
}
/** « 27,6 » (km, une décimale, virgule) */
const fmtKm = (m: number) => (Math.round(m / 100) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

type Status = 'done' | 'today' | 'missed' | 'todo'
function statusOf(date: string, runDates: Set<string>, today: string): Status {
  if (runDates.has(date)) return 'done'
  if (date === today) return 'today'
  if (date < today) return 'missed'
  return 'todo'
}
const STATUS_META: Record<Status, { label: string; cls: string }> = {
  done: { label: 'Validée', cls: 'bg-sage-100 text-sage-700' },
  today: { label: "Aujourd'hui", cls: 'bg-sage-500 text-ink' },
  missed: { label: 'Non faite', cls: 'bg-sage-50 text-ink-soft' },
  todo: { label: 'À venir', cls: 'bg-sage-50 text-ink' },
}

/** Mesure : légende 13 px, valeur 20–22 px en gras, unité 14 px */
function Metric({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] leading-[18px] font-medium text-ink-soft">{label}</span>
      <span className={(big ? 'text-[22px] leading-7 ' : 'text-xl leading-[26px] ') + 'font-extrabold tabular-nums'}>
        {value} {unit && <span className="text-sm font-medium text-ink-soft">{unit}</span>}
      </span>
    </div>
  )
}

function SeanceCard({
  week,
  s,
  idx,
  total,
  runDates,
  validatedRefs,
  today,
  onOpen,
}: {
  week: PlanWeek
  s: PlanSeance
  idx: number
  total: number
  runDates: Set<string>
  validatedRefs: Set<string>
  today: string
  onOpen: () => void
}) {
  const date = seanceDateStr(week, s)
  // Validation explicite (par référence de séance) prime sur la coche automatique par date
  const status = validatedRefs.has('elan-' + date) ? 'done' : statusOf(date, runDates, today)
  const st = STATUS_META[status]
  const { sec, distM } = workoutStats(s.workout)
  const diff = TYPE_DIFFICULTY[s.type]
  return (
    <button type="button" onClick={onOpen} className={`flex w-full flex-col text-left active:bg-sage-50 ${glassCard}`}>
      <span className="flex items-center gap-3 pt-3.5 pr-3.5 pb-3 pl-4">
        <CategoryRing category="running" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className={'inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[13px] font-bold ' + st.cls}>{st.label}</span>
            <span className="truncate text-sm leading-5 text-ink-soft">
              Séance {idx + 1} sur {total} · {DAY_NAMES[s.day]}
            </span>
          </span>
          <span className="text-lg leading-6 font-bold">{s.title}</span>
          <span className="text-sm leading-5 text-ink-soft">{TYPE_META[s.type].short}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-mute" />
      </span>
      <span className="grid grid-cols-3 gap-2 border-t border-hairline px-4 pt-2.5 pb-3.5">
        <Metric label="Durée" value={fmtDur(sec)} unit={sec < 3600 ? 'min' : undefined} />
        <Metric label="Distance" value={fmtKm(distM)} unit="km" />
        <span className="flex flex-col gap-1.5">
          <span className="text-[13px] leading-[18px] font-medium text-ink-soft">Difficulté {diff} sur 5</span>
          <span aria-hidden className="flex gap-[3px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={'h-2 flex-1 rounded-full ' + (i <= diff ? 'bg-running' : 'bg-[#e3e6eb]')} />
            ))}
          </span>
        </span>
      </span>
    </button>
  )
}

/** Ligne compacte d'une séance déjà validée (section « Terminées », comme Aujourd'hui) */
function DoneSeanceRow({ s, idx, total, onOpen }: { s: PlanSeance; idx: number; total: number; onOpen: () => void }) {
  const { sec, distM } = workoutStats(s.workout)
  return (
    <button type="button" onClick={onOpen} className={`flex min-h-16 w-full items-center gap-3 py-2 pr-3.5 pl-4 text-left active:bg-sage-50 ${glassCard}`}>
      <CategoryRing category="running" size={40} done />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base leading-[22px] font-semibold">{s.title}</span>
        <span className="truncate text-sm leading-5 text-ink-soft tabular-nums">
          Séance {idx + 1} sur {total} · {DAY_NAMES[s.day]} · {fmtKm(distM)} km · {fmtDur(sec)}{sec < 3600 ? ' min' : ''}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-ink-mute" />
    </button>
  )
}

/** Tableau des zones (FC définit la zone, allure visée en face) */
function ZonesTable() {
  return (
    <table className="w-full border-collapse text-[15px] leading-5">
      <thead>
        <tr>
          <th scope="col" className="pb-1.5 text-left text-[13px] font-medium text-ink-soft">
            Zone
          </th>
          <th scope="col" className="pb-1.5 text-right text-[13px] font-medium text-ink-soft">
            Allure /km
          </th>
          <th scope="col" className="pb-1.5 pl-3 text-right text-[13px] font-medium text-ink-soft">
            FC bpm
          </th>
        </tr>
      </thead>
      <tbody>
        {PLAN_ZONES.map((z) => (
          <tr key={z.label} className="border-t border-hairline">
            <td className="py-2">
              <span className="inline-flex items-center gap-2 font-semibold">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: z.hex }} />
                {z.label}
              </span>
            </td>
            <td className="py-2 text-right font-bold whitespace-nowrap tabular-nums">{z.pace}</td>
            <td className="py-2 pl-3 text-right whitespace-nowrap text-ink-soft tabular-nums">{z.hr}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const zonesNote =
  'La fréquence cardiaque définit la zone (méthode de la réserve cardiaque, comme la montre) ; l’allure en face est celle visée dans ce type de séance.'

/** Onglet Plan : le plan semi-marathon (course) */
export default function Plan() {
  const { logs } = useData()
  const today = todayStr()
  const weeks = PLAN_SEMI.weeks
  const cur = currentWeekIndex(today)
  // Les semaines de juin (Fondation) sont gardées comme historique : « Semaine 1 » = reprise
  const planStart = Math.max(0, weeks.findIndex((w) => w.phase === 'Reconstruction'))
  const planLen = weeks.length - planStart
  const clampedCur = Math.min(weeks.length - 1, Math.max(0, cur))
  const [weekIdx, setWeekIdx] = useState(clampedCur)
  const [sheet, setSheet] = useState<PlanSeance | null>(null)
  const [zonesOpen, setZonesOpen] = useState(false)
  const dtr = daysToRace(today)
  // Course passée : état « plan terminé » (planche Plan, état vide), « Revoir » rouvre les semaines
  const [review, setReview] = useState(false)
  const ended = dtr < 0

  const runDates = useMemo(() => new Set(logs.filter((l) => l.category === 'running').map((l) => l.date)), [logs])
  const validatedRefs = useMemo(() => new Set(logs.filter((l) => l.planRef).map((l) => l.planRef as string)), [logs])

  // Volume de chaque semaine du plan (graphique des 13 barres)
  const weekKm = useMemo(
    () => weeks.map((w) => w.seances.reduce((a, s) => a + workoutStats(s.workout).distM, 0) / 1000),
    [weeks],
  )
  const planKm = weekKm.slice(planStart)
  const maxKm = Math.max(...planKm, 1)
  const peak = planKm.indexOf(Math.max(...planKm))

  const week = weeks[weekIdx]
  const isValidated = (s: PlanSeance) => {
    const date = seanceDateStr(week, s)
    return validatedRefs.has('elan-' + date) || runDates.has(date)
  }
  const indexed = week.seances.map((s, i) => ({ s, i }))
  const todo = indexed.filter(({ s }) => !isValidated(s))
  const done = indexed.filter(({ s }) => isValidated(s))
  const end = toDateStr(addDays(new Date(week.start + 'T12:00:00'), 6))
  const totals = useMemo(() => {
    let sec = 0
    let distM = 0
    for (const s of week.seances) {
      const st = workoutStats(s.workout)
      sec += st.sec
      distM += st.distM
    }
    return { sec, distM }
  }, [week])

  const n = weekIdx - planStart + 1
  const goal = PLAN_SEMI.goal.split(' · ')[0]

  /** 13 barres de km : semaine affichée en encre, passées en gris moyen, à venir en clair */
  const chart = (tall: boolean): ReactNode => (
    <div
      role="img"
      aria-label={`Kilomètres par semaine, semaine ${n} en noir`}
      className={'flex items-end ' + (tall ? 'h-40 gap-1.5 border-b border-hairline' : 'h-9 gap-1')}
    >
      {planKm.map((km, i) => {
        const wi = i + planStart
        const bg = wi === weekIdx ? '#0E1116' : wi < weekIdx ? '#9AA3AF' : '#DDE1E7'
        return (
          <span key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            {tall && (
              <span className={'text-xs leading-4 font-bold tabular-nums ' + (wi === weekIdx ? 'text-ink' : 'text-ink-mute')}>
                {Math.round(km)}
              </span>
            )}
            <span className={'w-full ' + (tall ? 'rounded-t-[4px]' : 'rounded-[3px]')} style={{ height: `${Math.round((km / maxKm) * 100)}%`, backgroundColor: bg }} />
          </span>
        )
      })}
    </div>
  )

  // Phases sous le graphique (bureau)
  const phases: { l: string; f: number; on: boolean; past: boolean }[] = []
  weeks.slice(planStart).forEach((w, i) => {
    const last = phases[phases.length - 1]
    const wi = i + planStart
    if (last && last.l === w.phase) {
      last.f++
      last.on ||= wi === weekIdx
      last.past &&= wi < weekIdx
    } else phases.push({ l: w.phase, f: 1, on: wi === weekIdx, past: wi < weekIdx })
  })

  const physio = (
    <div className="grid grid-cols-3 gap-2">
      <Metric label="VO2max" value={String(PLAN_METRICS.vo2max)} big />
      <Metric label="FC max" value={String(PLAN_METRICS.fcMax)} unit="bpm" big />
      <Metric label="FC repos" value={String(PLAN_METRICS.fcRest)} unit="bpm" big />
    </div>
  )

  const aside = (
    <aside
      aria-label="Progression et zones"
      className="fixed top-0 right-0 bottom-0 hidden w-[520px] flex-col gap-7 overflow-y-auto border-l border-hairline bg-surface px-7 py-8 xl:flex"
    >
      {(!ended || review) && (
        <section className="flex flex-col gap-3.5">
          <div>
            <Eyebrow>Progression</Eyebrow>
            <h2 className="text-[22px] leading-7 font-extrabold">Kilomètres par semaine</h2>
          </div>
          {chart(true)}
          <div className="flex gap-1.5">
            {phases.map((p) => (
              <span key={p.l} className="flex min-w-0 flex-col gap-1" style={{ flex: p.f }}>
                <span className="h-1 rounded-full" style={{ backgroundColor: p.on ? '#0E1116' : p.past ? '#9AA3AF' : '#DDE1E7' }} />
                <span className="truncate text-[13px] leading-[18px] font-semibold text-ink-soft">{p.l}</span>
              </span>
            ))}
          </div>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] leading-7 font-extrabold">Mes allures et zones</h2>
        {physio}
        <ZonesTable />
        <p className="text-sm leading-5 text-ink-soft">{zonesNote}</p>
      </section>
    </aside>
  )

  if (ended && !review) {
    return (
      <div className="flex flex-col gap-3 px-4 pt-4 lg:gap-4 lg:px-10 lg:pt-8">
        <header>
          <Eyebrow>Plan</Eyebrow>
          <DisplayTitle className="text-2xl leading-[1.2] lg:text-[30px]">Aucun plan en cours</DisplayTitle>
        </header>
        <section className={`flex flex-col items-center gap-3 px-6 py-8 text-center ${glassCard}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-50">
            <Picto name="drapeau" className="h-7 w-7" />
          </span>
          <h2 className="text-[22px] leading-7 font-extrabold">Course passée, plan terminé</h2>
          <p className="max-w-[340px] text-base leading-6 text-ink-soft">
            Le prochain plan apparaîtra ici dès qu'il sera chargé, avec ses semaines, ses séances et le compte à rebours jusqu'à la course.
          </p>
        </section>
        <div className="flex flex-col gap-2">
          <h2 className="mt-1 text-base leading-[22px] font-bold">Dernier plan</h2>
          <div className={`flex items-center gap-3 px-4 py-3.5 ${glassCard}`}>
            <CategoryRing category="running" picto="drapeau" done />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[17px] leading-[22px] font-semibold">{PLAN_SEMI.race} · semi-marathon</span>
              <span className="text-sm leading-5 text-ink-soft">
                {planLen} semaines · course le {new Date(PLAN_SEMI.raceDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </span>
            <button type="button" onClick={() => setReview(true)} className="inline-flex h-11 shrink-0 items-center rounded-full border-[1.5px] border-ink px-4 text-[15px] font-bold active:bg-sage-50">
              Revoir
            </button>
          </div>
        </div>
        <ZonesSection open={zonesOpen} setOpen={setZonesOpen} physio={physio} />
        {aside}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 lg:gap-4 lg:px-10 lg:pt-8">
      <header className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <Eyebrow>{ended ? `Plan terminé · objectif ${goal}` : `Plan en cours · objectif ${goal}`}</Eyebrow>
          <DisplayTitle className="text-2xl leading-[1.2] lg:text-[30px]">{PLAN_SEMI.race}</DisplayTitle>
        </div>
        {dtr >= 0 ? (
          <div className="shrink-0 text-right">
            <p className="text-2xl leading-[1.1] font-extrabold tabular-nums lg:text-[30px]">J-{dtr}</p>
            <p className="text-sm leading-5 text-ink-soft">{new Date(PLAN_SEMI.raceDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        ) : (
          <button type="button" onClick={() => setReview(false)} className={secondaryCls + ' !min-h-11 shrink-0 !px-4 !text-[15px]'}>
            Fermer
          </button>
        )}
      </header>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Semaine précédente"
          disabled={weekIdx === 0}
          onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
          className={iconSquare}
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-lg leading-6 font-extrabold">{weekIdx >= planStart ? `Semaine ${n} sur ${planLen}` : 'Préparation juin'}</p>
          <p className="text-sm leading-5 text-ink-soft">
            {weekIdx === cur ? 'Cette semaine · ' : weekIdx < planStart ? 'Historique · ' : ''}
            {formatShortFr(week.start)} – {formatShortFr(end)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Semaine suivante"
          disabled={weekIdx === weeks.length - 1}
          onClick={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))}
          className={iconSquare}
        >
          <ChevronRight className="h-[22px] w-[22px]" />
        </button>
      </div>

      <section aria-label="Aperçu de la semaine" className={`flex flex-col gap-3 px-4 py-3.5 ${glassCard}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base leading-[22px] font-bold">Aperçu de la semaine</h2>
          <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-sage-100 px-3 text-[13px] font-bold text-sage-700">{week.phase}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Séances" value={String(week.seances.length)} big />
          <Metric label="Durée" value={fmtDur(totals.sec)} unit={totals.sec < 3600 ? 'min' : undefined} big />
          <Metric label="Distance" value={fmtKm(totals.distM)} unit="km" big />
        </div>
        {weekIdx >= planStart && (
          <div className="flex flex-col gap-1.5 xl:hidden">
            {chart(false)}
            <span className="text-[13px] leading-[18px] text-ink-soft">
              Volume des {planLen} semaines · pic de {Math.round(planKm[peak])} km en semaine {peak + 1}
            </span>
          </div>
        )}
        {week.label && <p className="text-sm text-ink-soft">{week.label}</p>}
      </section>

      {todo.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="mt-1 text-base leading-[22px] font-bold">À faire · {todo.length}</h2>
          {todo.map(({ s, i }) => (
            <SeanceCard
              key={s.day}
              week={week}
              s={s}
              idx={i}
              total={week.seances.length}
              runDates={runDates}
              validatedRefs={validatedRefs}
              today={today}
              onOpen={() => setSheet(s)}
            />
          ))}
        </div>
      ) : (
        <section aria-label="Semaine bouclée" className="flex items-center gap-4 rounded-md bg-ink p-[18px] text-white">
          <svg width="56" height="56" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
            <circle cx="24" cy="24" r="22" fill="#C5F23A" />
            <path d="M14 24.5l6.5 6.5L34 17.5" fill="none" stroke="#0E1116" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-2xl leading-[30px] font-extrabold">Semaine bouclée</p>
            <p className="text-[15px] leading-[22px] text-night-soft tabular-nums">
              {week.seances.length} séances sur {week.seances.length} · {fmtKm(totals.distM)} km · {fmtDur(totals.sec)}
              {totals.sec < 3600 ? ' min' : ''}
            </p>
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="mt-1 text-base leading-[22px] font-bold">Terminées · {done.length}</h2>
          {done.map(({ s, i }) => (
            <DoneSeanceRow key={s.day} s={s} idx={i} total={week.seances.length} onOpen={() => setSheet(s)} />
          ))}
        </section>
      )}

      <ZonesSection open={zonesOpen} setOpen={setZonesOpen} physio={physio} />
      {aside}

      <WorkoutSheet
        seance={sheet}
        weekIdx={weekIdx}
        planRef={sheet ? 'elan-' + seanceDateStr(week, sheet) : ''}
        plannedDate={sheet ? seanceDateStr(week, sheet) : ''}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}

/** « Mes allures et zones » dépliable (téléphone ; sur grand écran, la colonne de droite) */
function ZonesSection({ open, setOpen, physio }: { open: boolean; setOpen: (f: (o: boolean) => boolean) => void; physio: ReactNode }) {
  return (
    <section aria-label="Mes allures et zones" className={`flex flex-col xl:hidden ${glassCard}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[52px] items-center justify-between px-4 text-base font-bold"
      >
        Mes allures et zones
        <ChevronDown className={'h-5 w-5 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="border-t border-hairline pt-3">{physio}</div>
          <ZonesTable />
          <p className="text-sm leading-5 text-ink-soft">{zonesNote}</p>
        </div>
      )}
    </section>
  )
}
