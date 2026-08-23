import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Bike, Check, ChevronDown, ChevronRight, Footprints, Zap } from 'lucide-react'
import { useData } from '../data/DataContext'
import { Field, NumInput, PageHeader, Seg, Sheet } from '../components/ui'
import WorkoutSheet from '../components/WorkoutSheet'
import { DAY_NAMES, addDays, formatShortFr, mondayIndex, toDateStr, todayStr } from '../lib/dates'
import {
  PLAN_VELO,
  currentVeloWeekIndex,
  veloWeekStates,
  type VeloSeanceState,
  type VeloWeek,
} from '../data/planVelo'
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

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}`
}
const fmtKm = (m: number) => (Math.round(m / 100) / 10).toFixed(1)

type Status = 'done' | 'today' | 'missed' | 'todo'
function statusOf(date: string, runDates: Set<string>, today: string): Status {
  if (runDates.has(date)) return 'done'
  if (date === today) return 'today'
  if (date < today) return 'missed'
  return 'todo'
}
const STATUS_META: Record<Status, { label: string; cls: string }> = {
  done: { label: 'Validée', cls: 'bg-sage-100 text-sage-700' },
  today: { label: "Aujourd'hui", cls: 'bg-sage-500 text-onaccent' },
  missed: { label: 'Non faite', cls: 'bg-sand text-ink-soft' },
  todo: { label: 'À venir', cls: 'bg-sand/60 text-ink-soft' },
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="mt-0.5 font-display text-2xl leading-none font-bold uppercase tabular-nums leading-none">
        {value}
        {unit && <span className="ml-0.5 text-xs font-bold text-ink-soft">{unit}</span>}
      </p>
    </div>
  )
}

function Difficulty({ n }: { n: number }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-soft">Difficulté</p>
      <div className="mt-1 flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Zap key={i} className={'h-4 w-4 ' + (i <= n ? 'fill-running text-running' : 'fill-ink-soft/15 text-ink-soft/15')} />
        ))}
      </div>
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
  const t = TYPE_META[s.type]
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-md border border-hairline bg-glass text-left backdrop-blur-lg active:bg-glass-raised">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: t.hex + '22', color: t.hex }}>
          <Footprints className="h-6 w-6" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={'rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.16em] uppercase tracking-wide ' + st.cls}>{st.label}</span>
            <span className="text-xs font-bold text-ink-soft">
              Séance {idx + 1}/{total} · {DAY_NAMES[s.day]}
            </span>
          </div>
          <p className="mt-0.5 truncate font-display text-xl leading-none font-bold uppercase">{s.title}</p>
          <p className="text-[11px] font-bold" style={{ color: t.hex }}>{t.short}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft/40" />
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-sand/60 px-4 py-3">
        <Metric label="Durée" value={fmtDur(sec)} unit="min" />
        <Metric label="Distance" value={fmtKm(distM)} unit="km" />
        <Difficulty n={diff} />
      </div>
    </button>
  )
}

/** Ligne compacte d'une séance déjà validée (section « Terminées », façon Aujourd'hui) */
function DoneSeanceRow({
  s,
  idx,
  total,
  onOpen,
}: {
  s: PlanSeance
  idx: number
  total: number
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md border border-hairline bg-glass-soft px-4 py-3 text-left backdrop-blur-lg active:bg-glass"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-500 text-onaccent">
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-ink-soft">
          Séance {idx + 1}/{total} · {DAY_NAMES[s.day]}
        </p>
        <p className="truncate text-sm font-extrabold">{s.title}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft/40" />
    </button>
  )
}

/** Onglet Plan : deux plans côte à côte — le semi (course) et le vélo d'appartement */
export default function Plan() {
  const [view, setView] = useState<'21k' | 'velo'>('21k')
  return (
    <div>
      <div className="px-4 pt-5">
        <Seg
          options={[
            { value: '21k', label: 'Course · 21K' },
            { value: 'velo', label: 'Vélo' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      {view === '21k' ? <PlanSemi /> : <PlanVelo />}
    </div>
  )
}

function PlanSemi() {
  const { logs } = useData()
  const today = todayStr()
  const weeks = PLAN_SEMI.weeks
  const cur = currentWeekIndex(today)
  // Plan recalé le 8 juil. 2026 : les semaines de juin (Fondation) sont conservées comme historique.
  // On numérote « Semaine 1 » à partir de la reprise = 1re semaine de Reconstruction.
  const planStart = Math.max(0, weeks.findIndex((w) => w.phase === 'Reconstruction'))
  const clampedCur = Math.min(weeks.length - 1, Math.max(0, cur))
  const [weekIdx, setWeekIdx] = useState(clampedCur)
  const [sheet, setSheet] = useState<PlanSeance | null>(null)
  const [zonesOpen, setZonesOpen] = useState(false)

  const runDates = useMemo(() => new Set(logs.filter((l) => l.category === 'running').map((l) => l.date)), [logs])
  const validatedRefs = useMemo(() => new Set(logs.filter((l) => l.planRef).map((l) => l.planRef as string)), [logs])

  const week = weeks[weekIdx]
  // Comme « Aujourd'hui » : les séances validées quittent le flux principal et passent en
  // « Terminées ». Validée = référence de séance (planRef) OU course enregistrée ce jour-là.
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

  const dtr = daysToRace(today)

  return (
    <div className="px-4 pb-4">
      <PageHeader
        kicker="Plan semi · sub 1h50"
        title={PLAN_SEMI.race}
        right={
          dtr >= 0 ? (
            <div className="text-right">
              <p className="font-display text-3xl leading-none font-black uppercase text-ink">J-{dtr}</p>
              <p className="text-[11px] font-bold text-ink-soft">dim. {formatShortFr(PLAN_SEMI.raceDate)}</p>
            </div>
          ) : undefined
        }
      />

      {/* Navigation semaine par semaine */}
      <div className="flex items-center justify-between gap-3 pb-3 pt-1">
        <button
          type="button"
          aria-label="Semaine précédente"
          disabled={weekIdx === 0}
          onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
          className="rounded-full bg-surface p-2.5 shadow-sm active:bg-sage-50 disabled:opacity-30"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-display text-xl leading-none font-bold uppercase">
            {weekIdx === cur ? 'Cette semaine' : weekIdx >= planStart ? `Semaine ${weekIdx - planStart + 1}` : 'Préparation juin'}
          </p>
          <p className="text-xs font-bold text-ink-soft">
            {weekIdx >= planStart ? `${weekIdx - planStart + 1} sur ${weeks.length - planStart}` : 'historique'}
          </p>
        </div>
        <button
          type="button"
          aria-label="Semaine suivante"
          disabled={weekIdx === weeks.length - 1}
          onClick={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))}
          className="rounded-full bg-surface p-2.5 shadow-sm active:bg-sage-50 disabled:opacity-30"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Aperçu hebdomadaire */}
      <section className="rounded-md border border-hairline bg-glass px-4 py-3.5 backdrop-blur-lg">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-xl leading-none font-bold uppercase">Ton aperçu hebdomadaire</p>
          <span className="shrink-0 rounded-full bg-sage-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sage-700">
            {week.phase}
          </span>
        </div>
        <p className="mt-0.5 text-xs font-semibold text-ink-soft">
          {formatShortFr(week.start)} – {formatShortFr(end)}
          {week.label && <span className="text-ink-soft"> · {week.label}</span>}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Activités" value={String(week.seances.length)} />
          <Metric label="Durée" value={fmtDur(totals.sec)} unit="min" />
          <Metric label="Distance" value={fmtKm(totals.distM)} unit="km" />
        </div>
      </section>

      {/* Séances restant à faire (les validées passent en « Terminées », comme Aujourd'hui) */}
      <div className="mt-3 space-y-3">
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
        {todo.length === 0 && (
          <div className="rounded-md border border-hairline bg-glass px-6 py-5 text-center backdrop-blur-lg">
            <p className="text-sm font-extrabold text-sage-700">Semaine bouclée, bravo ! 🎉</p>
          </div>
        )}
      </div>

      {done.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 px-1 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">Terminées</h2>
          <div className="space-y-2">
            {done.map(({ s, i }) => (
              <DoneSeanceRow key={s.day} s={s} idx={i} total={week.seances.length} onOpen={() => setSheet(s)} />
            ))}
          </div>
        </section>
      )}

      {/* Mes allures & zones — dépliable, calculé sur les données COROS */}
      <section className="mt-4 overflow-hidden rounded-sm bg-sage-50">
        <button
          type="button"
          onClick={() => setZonesOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 active:bg-sage-100/50"
        >
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-sage-600">Mes allures &amp; zones</span>
          <ChevronDown className={'h-4 w-4 text-sage-600 transition-transform ' + (zonesOpen ? 'rotate-180' : '')} />
        </button>
        {zonesOpen && (
          <div className="px-4 pb-3.5">
            <div className="grid grid-cols-3 gap-2 border-t border-sage-200/70 pt-3">
              <Metric label="VO2max" value={String(PLAN_METRICS.vo2max)} />
              <Metric label="FC max" value={String(PLAN_METRICS.fcMax)} unit="bpm" />
              <Metric label="FC repos" value={String(PLAN_METRICS.fcRest)} unit="bpm" />
            </div>
            <div className="mt-3.5 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0" />
              <span className="flex-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft/60">Zone</span>
              <span className="w-[4.5rem] text-right text-[10px] font-bold uppercase tracking-wide text-ink-soft/60">Allure</span>
              <span className="w-14 text-right text-[10px] font-bold uppercase tracking-wide text-ink-soft/60">FC bpm</span>
            </div>
            <div className="mt-1.5 space-y-2">
              {PLAN_ZONES.map((z) => (
                <div key={z.label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: z.hex }} />
                  <span className="flex-1 truncate text-sm font-semibold text-ink-soft">{z.label}</span>
                  <span className="w-[4.5rem] shrink-0 whitespace-nowrap text-right text-sm font-bold tabular-nums text-ink">{z.pace}</span>
                  <span className="w-14 shrink-0 whitespace-nowrap text-right text-xs font-bold tabular-nums text-ink-soft">{z.hr}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-snug text-ink-soft/80">
              La <strong>FC</strong> définit la zone (contiguë, méthode Réserve FC comme ta montre) ; l'<strong>allure</strong> en face est celle visée dans ce type de séance. FC max confirmée (pic réel 183 bpm).
            </p>
          </div>
        )}
      </section>

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

/* ── Plan vélo d'appartement ─────────────────────────────────────────────────
 * Endurance de base sur 12 semaines, aux dates réelles de l'alternance vélo/HIIT
 * (lun/jeu/sam). Le plan ne crée AUCUNE séance dans Aujourd'hui/Planning : la
 * séance « Vélo d'appartement » de l'utilisateur y est déjà planifiée, et
 * CompleteSheet surcharge ses cibles depuis `veloSeanceOn` les jours du plan.
 * Ici : la vue d'ensemble, la progression et la validation manuelle (Campus).
 */

const VELO_HEX = '#7ec8e3' // miroir du token `--color-velo`

function VeloSeanceCard({ st, idx, total, today, onOpen }: { st: VeloSeanceState; idx: number; total: number; today: string; onOpen: () => void }) {
  const se = st.seance
  const status: Status = st.done ? 'done' : se.date === today ? 'today' : se.date < today ? 'missed' : 'todo'
  const meta = STATUS_META[status]
  const day = mondayIndex(new Date(se.date + 'T12:00:00'))
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-md border border-hairline bg-glass text-left backdrop-blur-lg active:bg-glass-raised">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: VELO_HEX + '22', color: VELO_HEX }}>
          <Bike className="h-6 w-6" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={'rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.16em] uppercase ' + meta.cls}>{meta.label}</span>
            <span className="text-xs font-bold text-ink-soft">
              Séance {idx + 1}/{total} · {DAY_NAMES[day]} {formatShortFr(se.date)}
            </span>
          </div>
          <p className="mt-0.5 truncate font-display text-xl leading-none font-bold uppercase">{se.title}</p>
          <p className="text-[11px] font-bold" style={{ color: VELO_HEX }}>Endurance de base</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft/40" />
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-sand/60 px-4 py-3">
        <Metric label="Durée" value={String(se.durationMin)} unit="min" />
        <Metric label="Résistance" value={String(se.resistance)} />
        <Metric label="FC guide" value={se.hr} unit="bpm" />
      </div>
    </button>
  )
}

/** Fiche d'une séance du plan vélo : programme + validation manuelle (comme le plan semi, sans sélecteur de sortie) */
function VeloSheet({ st, week, onClose }: { st: VeloSeanceState | null; week: VeloWeek; onClose: () => void }) {
  const { logs, addLog, removeLog } = useData()
  const [confirming, setConfirming] = useState(false)
  const [date, setDate] = useState('')
  // FC moyenne de la séance (optionnelle) : c'est elle qui permettra de recalibrer le
  // plan sur les vraies données, comme les allures du semi le sont sur Strava
  const [bpm, setBpm] = useState<number | undefined>(undefined)
  if (!st) return null
  const se = st.seance
  const existing = logs.find((l) => l.planRef === st.planRef)
  const validate = () => {
    void addLog({
      date: date || se.date,
      sessionId: '',
      sessionName: `Vélo — ${se.title}`,
      category: 'velo',
      planRef: st.planRef,
      metrics: [
        { key: 'power', label: 'Résistance', unit: '', value: se.resistance },
        { key: 'duration', label: 'Durée', unit: 'min', value: se.durationMin },
        ...(bpm != null ? [{ key: 'bpm', label: 'BPM moyen', unit: 'bpm', value: bpm }] : []),
      ],
      note: '',
      createdAt: Date.now(),
    })
    setConfirming(false)
    onClose()
  }
  return (
    <Sheet
      open={!!st}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Bike className="h-5 w-5 shrink-0 text-velo" />
          <span className="min-w-0 truncate">{se.title}</span>
        </span>
      }
    >
      <div className="space-y-4">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
          {week.phase}
          {week.label ? ` · ${week.label}` : ''} · {DAY_NAMES[mondayIndex(new Date(se.date + 'T12:00:00'))]} {formatShortFr(se.date)}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Durée" value={String(se.durationMin)} unit="min" />
          <Metric label="Résistance" value={String(se.resistance)} />
          <Metric label="FC guide" value={se.hr} unit="bpm" />
        </div>
        {se.note && <p className="text-sm font-semibold text-ink-soft">{se.note}</p>}

        {existing ? (
          <div className="flex items-center justify-between gap-3 rounded-sm bg-sage-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-extrabold text-sage-700">
              <Check className="h-4 w-4" strokeWidth={3} /> Validée le {formatShortFr(existing.date)}
            </p>
            <button type="button" onClick={() => void removeLog(existing.id)} className="shrink-0 text-xs font-bold text-hiit active:opacity-70">
              Annuler
            </button>
          </div>
        ) : st.done ? (
          <p className="flex items-center gap-1.5 rounded-sm bg-sage-50 px-4 py-3 text-sm font-extrabold text-sage-700">
            <Check className="h-4 w-4" strokeWidth={3} /> Séance vélo journalisée le {formatShortFr(st.doneDate ?? se.date)}
          </p>
        ) : confirming ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-ink-soft">Quel jour as-tu fait cette séance ?</p>
            <input
              type="date"
              aria-label="Date de la séance"
              value={date || se.date}
              onChange={(e) => setDate(e.target.value || se.date)}
              className="w-full rounded-xl border border-sand bg-shoal px-3 py-2.5 text-sm font-bold text-ink outline-none focus:border-sage-400"
            />
            <Field label="FC moyenne (optionnel)">
              <NumInput value={bpm} onChange={setBpm} suffix="bpm" />
            </Field>
            <button
              type="button"
              onClick={validate}
              className="w-full rounded-sm bg-ink px-5 py-3.5 font-mono text-[11px] font-bold tracking-[0.16em] uppercase text-onaccent active:bg-sage-700"
            >
              Valider ✓
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="w-full py-1 text-center text-xs font-bold text-ink-soft">
              Retour
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="w-full rounded-sm bg-ink px-5 py-3.5 font-mono text-[11px] font-bold tracking-[0.16em] uppercase text-onaccent active:bg-sage-700"
          >
            Valider ma séance
          </button>
        )}
      </div>
    </Sheet>
  )
}

function PlanVelo() {
  const { logs } = useData()
  const today = todayStr()
  const weeks = PLAN_VELO.weeks
  const [weekIdx, setWeekIdx] = useState(() => currentVeloWeekIndex(today))
  const [sheet, setSheet] = useState<VeloSeanceState | null>(null)
  const week = weeks[weekIdx]
  const states = useMemo(() => veloWeekStates(week, logs), [week, logs])
  const todo = states.filter((st) => !st.done)
  const done = states.filter((st) => st.done)
  const end = toDateStr(addDays(new Date(week.start + 'T12:00:00'), 6))
  const totalMin = week.seances.reduce((a, se) => a + se.durationMin, 0)
  const cur = currentVeloWeekIndex(today)

  return (
    <div className="px-4 pb-4">
      <PageHeader kicker="Plan vélo · endurance de base" title="Vélo indoor" />

      {/* Navigation semaine par semaine */}
      <div className="flex items-center justify-between gap-3 pb-3 pt-1">
        <button
          type="button"
          aria-label="Semaine précédente"
          disabled={weekIdx === 0}
          onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
          className="rounded-full bg-surface p-2.5 shadow-sm active:bg-sage-50 disabled:opacity-30"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-display text-xl leading-none font-bold uppercase">
            {weekIdx === cur && today >= weeks[0].start ? 'Cette semaine' : `Semaine ${weekIdx + 1}`}
          </p>
          <p className="text-xs font-bold text-ink-soft">{weekIdx + 1} sur {weeks.length}</p>
        </div>
        <button
          type="button"
          aria-label="Semaine suivante"
          disabled={weekIdx === weeks.length - 1}
          onClick={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))}
          className="rounded-full bg-surface p-2.5 shadow-sm active:bg-sage-50 disabled:opacity-30"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Aperçu hebdomadaire */}
      <section className="rounded-md border border-hairline bg-glass px-4 py-3.5 backdrop-blur-lg">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-xl leading-none font-bold uppercase">Ton aperçu hebdomadaire</p>
          <span className="shrink-0 rounded-full bg-sage-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sage-700">
            {week.phase}
          </span>
        </div>
        <p className="mt-0.5 text-xs font-semibold text-ink-soft">
          {formatShortFr(week.start)} – {formatShortFr(end)}
          {week.label && <span className="text-ink-soft"> · {week.label}</span>}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Activités" value={String(week.seances.length)} />
          <Metric label="Durée" value={String(totalMin)} unit="min" />
          <Metric label="Résistance" value={week.seances.map((se) => se.resistance).join(' · ')} />
        </div>
      </section>

      {/* Séances restant à faire (les validées passent en « Terminées », comme le 21K) */}
      <div className="mt-3 space-y-3">
        {todo.map((st) => (
          <VeloSeanceCard
            key={st.seance.date}
            st={st}
            idx={states.indexOf(st)}
            total={states.length}
            today={today}
            onOpen={() => setSheet(st)}
          />
        ))}
        {todo.length === 0 && (
          <div className="rounded-md border border-hairline bg-glass px-6 py-5 text-center backdrop-blur-lg">
            <p className="text-sm font-extrabold text-sage-700">Semaine bouclée, bravo ! 🎉</p>
          </div>
        )}
      </div>

      {done.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 px-1 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">Terminées</h2>
          <div className="space-y-2">
            {done.map((st) => (
              <button
                key={st.seance.date}
                type="button"
                onClick={() => setSheet(st)}
                className="flex w-full items-center gap-3 rounded-md border border-hairline bg-glass-soft px-4 py-3 text-left backdrop-blur-lg active:bg-glass"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-500 text-onaccent">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-ink-soft">
                    Séance {states.indexOf(st) + 1}/{states.length} · {DAY_NAMES[mondayIndex(new Date(st.seance.date + 'T12:00:00'))]}
                  </p>
                  <p className="truncate text-sm font-extrabold">{st.seance.title}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft/40" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* key = la séance ouverte : la date/FC saisies ne fuient pas d'une séance à l'autre */}
      <VeloSheet key={sheet?.planRef ?? 'aucune'} st={sheet} week={week} onClose={() => setSheet(null)} />
    </div>
  )
}
