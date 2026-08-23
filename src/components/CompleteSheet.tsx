import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ClipboardList, Lightbulb, Link2, MoreVertical, Pencil, Play, Repeat, X } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, feelingOf, setTargetsOf, type Exercise, type Log, type MetricValue, type Session, type SessionItem } from '../types'
import { relativeDayFr, todayStr } from '../lib/dates'
import { lastDetailLine, lastPerfLine } from '../lib/format'
import { effectiveMetrics, goalLevels, objectiveLevels } from '../lib/metrics'
import { muscuBlocks } from '../lib/blocks'
import { buildTimeline, collectSets, stopPoint, type SetStatus } from '../lib/timeline'
import { progressedSession } from '../lib/progression'
import { veloSeanceOn } from '../data/planVelo'
import { CategoryIcon, Eyebrow, Field, GhostButton, iconSquare, NumInput, PrimaryButton, Sheet, TextArea } from './ui'
import FeelingPicker from './FeelingPicker'
import ResultTimeline from './ResultTimeline'

/** Feuille d'une séance depuis Aujourd'hui : consulter le programme, lancer le minuteur, entrer le résultat */
export default function CompleteSheet({
  session,
  onClose,
  date,
}: {
  session: Session | null
  onClose: () => void
  /** Date du log (YYYY-MM-DD), aujourd'hui par défaut — permet la saisie rétroactive */
  date?: string
}) {
  const navigate = useNavigate()
  // La saisie du résultat vit dans le menu ⋮ de l'en-tête, rendu par le parent :
  // son état remonte donc ici, et se réinitialise à chaque séance ouverte
  const [entering, setEntering] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    setEntering(false)
    setMenuOpen(false)
  }, [session?.id])
  const close = () => {
    setEntering(false)
    setMenuOpen(false)
    onClose()
  }
  const logDate = date ?? todayStr()
  const canEnter =
    !!session &&
    (session.category === 'muscu' || session.category === 'hiit') &&
    session.items.length > 0 &&
    logDate <= todayStr()
  return (
    <Sheet
      open={!!session}
      onClose={close}
      title={
        session ? (
          <span className="flex items-center gap-2">
            <CategoryIcon
              category={session.category}
              className={`h-5 w-5 shrink-0 ${CATEGORY_META[session.category].text}`}
            />
            <span className="min-w-0 truncate">{session.name}</span>
          </span>
        ) : undefined
      }
      actions={
        session ? (
          <>
            <div className="relative shrink-0">
              <button type="button" aria-label="Options" onClick={() => setMenuOpen((v) => !v)} className={iconSquare}>
                <MoreVertical className="h-[18px] w-[18px]" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute top-10 right-0 z-20 w-56 overflow-hidden rounded-md border border-hairline-strong bg-shoal shadow-xl">
                    {canEnter && !entering && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          setEntering(true)
                        }}
                        className="flex w-full items-center gap-3 border-b border-hairline px-4 py-3 text-left text-sm font-bold active:bg-glass"
                      >
                        <Check className="h-4 w-4 shrink-0 text-sage-500" /> Entrer le résultat
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        close()
                        navigate(`/session/${session.id}`)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold active:bg-glass"
                    >
                      <Pencil className="h-4 w-4 shrink-0 text-sage-500" /> Modifier la séance
                    </button>
                  </div>
                </>
              )}
            </div>
            <button type="button" aria-label="Fermer" onClick={close} className={iconSquare}>
              <X className="h-[18px] w-[18px]" />
            </button>
          </>
        ) : undefined
      }
    >
      {session && (
        <Inner key={session.id} session={session} onClose={close} date={date} entering={entering} setEntering={setEntering} />
      )}
    </Sheet>
  )
}

/** Cible du programme d'un exercice, valeur et unité séparées : « 3 × 20 | reps » ou « 30 / 20 / 15 | reps » */
function itemTarget(it: SessionItem, ex: Exercise | undefined, isStretch: boolean): { value: string; unit: string } {
  if (isStretch) {
    // Étirements : « 2 × 30 s » quand la posture se fait des deux côtés
    const pre = (it.sets ?? 1) > 1 ? `${it.sets} × ` : ''
    return ex?.measure === 'reps'
      ? { value: pre + String(it.target ?? 10), unit: 'reps' }
      : { value: pre + String(it.durationSec ?? 30), unit: 's' }
  }
  const tgs = setTargetsOf(it)
  const unit = ex?.measure === 'sec' ? 's' : 'reps'
  const uniform = tgs.every((t) => t === tgs[0])
  return { value: uniform ? `${tgs.length} × ${tgs[0]}` : tgs.join(' / '), unit }
}

/** Ligne du programme : nom à gauche, ▷ démo si l'exercice a une vidéo, cible en display à droite */
function ProgramRow({
  name,
  comment,
  linkNext,
  videoUrl,
  value,
  unit,
}: {
  name: string
  comment?: string
  linkNext?: boolean
  videoUrl?: string
  value: string
  unit: string
}) {
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <span className="min-w-0 truncate">{name}</span>
          {linkNext && <Link2 className="h-3 w-3 shrink-0 text-muscu" />}
        </p>
        {comment && (
          <p className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
            <Lightbulb className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate">{comment}</span>
          </p>
        )}
      </div>
      {videoUrl && (
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Démo ${name}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-sage-500 active:bg-glass"
        >
          <Play className="h-4 w-4" fill="currentColor" />
        </a>
      )}
      <p className="shrink-0 font-display text-2xl leading-none font-black text-ink">
        {value} <span className="font-sans text-[13px] font-bold text-ink-soft">{unit}</span>
      </p>
    </div>
  )
}


function Inner({
  session: planned,
  onClose,
  date,
  entering,
  setEntering,
}: {
  session: Session
  onClose: () => void
  date?: string
  entering: boolean
  setEntering: (v: boolean) => void
}) {
  const { addLog, logs, exercises } = useData()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [feeling, setFeeling] = useState<number | undefined>(undefined)
  const [celebrate, setCelebrate] = useState<{ text: string; reward?: string }[] | null>(null)
  const logDate = date ?? todayStr()
  // Saisie interdite sur une date future (aperçu seulement) — on ne journalise pas l'avenir
  const isFuture = logDate > todayStr()

  // Objectifs relevés à hauteur de la dernière perf (dérivé : la fiche de séance n'est pas touchée)
  const { session } = useMemo(
    () => progressedSession(planned, exercises, logs, logDate),
    [planned, exercises, logs, logDate],
  )

  // Jour de plan vélo : la durée et la résistance cibles viennent du plan (progression
  // semaine par semaine), pas des cibles fixes de la fiche — même esprit que progressedSession
  const veloPlanSeance = session.category === 'velo' ? veloSeanceOn(logDate) : undefined
  const metrics = useMemo(() => {
    const base = effectiveMetrics(session)
    if (!veloPlanSeance) return base
    return base.map((m) =>
      m.key === 'duration'
        ? { ...m, target: veloPlanSeance.durationMin }
        : m.key === 'power'
          ? { ...m, target: veloPlanSeance.resistance }
          : m,
    )
  }, [session, veloPlanSeance])
  const links = session.links ?? []
  const isMuscu = session.category === 'muscu'
  const isHiit = session.category === 'hiit'
  const isStretch = session.category === 'etirements'
  // Le minuteur guidé n'a de sens que pour la journée en cours
  const hasTimer =
    (session.category === 'hiit' || session.category === 'etirements' || isMuscu) &&
    session.items.length > 0 &&
    logDate === todayStr()
  const hasForm = metrics.length > 0

  // Dernière séance VALIDÉE de ce type (la plus récente jusqu'au jour affiché), pour le récap
  // « Dernière fois » et le préremplissage. Indépendante des séances sautées entre-temps — une
  // séance sautée ne crée aucun log — et robuste quel que soit l'ordre de la liste (tri explicite).
  const lastLog = useMemo(
    () =>
      logs
        .filter((l) => l.sessionId === session.id && l.date <= logDate)
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)))[0],
    [logs, session.id, logDate],
  )

  // Point d'arrêt de la dernière séance (bloc/tour/exercice) : quand il est connu, la ligne
  // principale l'annonce et le détail par exercice passe en dessous, complet (plus de « … »)
  const lastStop = useMemo(
    () => (lastLog ? stopPoint(lastLog, session, exercises) : null),
    [lastLog, session, exercises],
  )

  // Valeurs des mesures personnalisées
  const [mvals, setMvals] = useState<Record<string, number | undefined>>(() => {
    const m: Record<string, number | undefined> = {}
    for (const def of metrics) m[def.key] = lastLog?.metrics?.find((x) => x.key === def.key)?.value
    return m
  })

  // Muscu/étirements : structure blocs → tours → exercices (→ séries pour la muscu)
  const exOf = (id: string) => exercises.find((e) => e.id === id)
  const blocks = useMemo(() => (isMuscu || isStretch ? muscuBlocks(session) : []), [session, isMuscu, isStretch])

  // Timeline de saisie (muscu et HIIT) : toutes les séries dans l'ordre réel, groupées par bloc/tour
  const timeline = useMemo(() => buildTimeline(session, exercises), [session, exercises])
  const [status, setStatus] = useState<SetStatus[]>(() => timeline.flatMap((g) => g.rows).map(() => 'ok'))

  // Tap = curseur « je me suis arrêté ici » : la série et toutes les suivantes passent en non faites ;
  // re-tap sur une non-faite la refait (et requalifie tout ce qui précède)
  const tapRow = (gi: number) =>
    setStatus((p) =>
      p[gi] === 'no'
        ? p.map((s, i) => (i === gi ? 'ok' : i < gi && s === 'no' ? 'ok' : s))
        : p.map((s, i) => (i >= gi ? 'no' : s)),
    )
  const flagRow = (gi: number) => setStatus((p) => p.map((s, i) => (i === gi ? (s === 'flag' ? 'ok' : 'flag') : s)))

  const buildMetricValues = (): MetricValue[] => {
    const vals = { ...mvals }
    // Vitesse moyenne déduite si absente (mesures vélo par défaut)
    if (vals.speed == null && vals.distance && vals.duration) {
      vals.speed = Math.round((vals.distance / (vals.duration / 60)) * 10) / 10
    }
    return metrics.flatMap((d) => {
      const v = vals[d.key]
      return v == null ? [] : [{ key: d.key, label: d.label, unit: d.unit, value: v }]
    })
  }

  const save = async () => {
    const extra: Partial<Omit<Log, 'id'>> = {}
    const mv = buildMetricValues()
    if (mv.length) extra.metrics = mv
    const achieved: { text: string; reward?: string }[] = []
    // Objectif de séance : paliers nouvellement franchis (toutes les cibles dans cette séance)
    const meetsLevel = (vals: MetricValue[] | undefined, targets: { key: string; value: number }[]) =>
      targets.every((t) => {
        const got = vals?.find((x) => x.key === t.key)
        return !!got && got.value >= t.value
      })
    for (const lv of objectiveLevels(session)) {
      if (!meetsLevel(mv, lv.targets)) continue
      // Déjà atteint lors d'une séance passée : on ne re-célèbre pas (la récompense est déjà débloquée)
      if (logs.some((l) => l.sessionId === session.id && meetsLevel(l.metrics, lv.targets))) continue
      achieved.push({
        text: lv.targets
          .map((t) => {
            const got = mv.find((x) => x.key === t.key)!
            return `${t.label} : ${got.value}${t.unit ? ' ' + t.unit : ''} (palier ${t.value})`
          })
          .join(' · '),
        reward: lv.reward,
      })
    }
    if ((isMuscu || isHiit) && session.items.length) {
      const seen = new Set<string>()
      const flatRows = timeline.flatMap((g) => g.rows)
      extra.results = session.items
        .filter((it) => !seen.has(it.exerciseId) && (seen.add(it.exerciseId), true))
        .map((it) => {
          const ex = exOf(it.exerciseId)
          // Les séries « non faites » sont exclues ; ⚠ mal réalisée = annotation, la valeur compte
          const { sets, flags } = collectSets(flatRows, status, it.exerciseId)
          // Paliers d'objectif nouvellement franchis ? (muscu)
          if (isMuscu && ex?.goal && sets.length) {
            const metric = ex.goal.metric
            const v = metric === 'best' ? Math.max(...sets) : sets.reduce((a, b) => a + b, 0)
            let prevBest = 0
            for (const l of logs) {
              const r = l.results?.find((x) => x.exerciseId === it.exerciseId)
              if (!r || !r.sets.length) continue
              const pv = metric === 'best' ? Math.max(...r.sets) : r.sets.reduce((a, b) => a + b, 0)
              if (pv > prevBest) prevBest = pv
            }
            const unit = ex.measure === 'sec' ? 's' : 'reps'
            for (const lvl of goalLevels(ex.goal)) {
              if (v >= lvl.value && prevBest < lvl.value) {
                achieved.push({ text: `${ex.name} : ${v} ${unit} (palier ${lvl.value})`, reward: lvl.reward })
              }
            }
          }
          return {
            exerciseId: it.exerciseId,
            name: ex?.name ?? 'Exercice',
            measure: isHiit ? ('sec' as const) : ex?.measure ?? ('reps' as const),
            sets,
            ...(flags.length ? { flagged: flags } : {}),
          }
        })
        .filter((r) => r.sets.length > 0)
    }
    await addLog({
      date: logDate,
      sessionId: session.id,
      sessionName: session.name,
      category: session.category,
      createdAt: Date.now(),
      note: note.trim(),
      ...(feeling ? { feeling } : {}),
      ...extra,
    })
    if (achieved.length) setCelebrate(achieved)
    else onClose()
  }

  if (celebrate) {
    const rewards = celebrate.filter((a) => a.reward)
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="text-6xl">{rewards.length ? '🎁' : '🎉'}</div>
        <h3 className="font-display text-2xl leading-none font-bold uppercase">{rewards.length ? 'Palier franchi, bravo !' : 'Objectif atteint, bravo !'}</h3>
        <div className="space-y-1.5">
          {celebrate.map((a, i) => (
            <div key={i}>
              <p className="text-sm font-bold text-sage-700">🎯 {a.text}</p>
              {a.reward && (
                <p className="mt-0.5 rounded-full bg-running/10 px-4 py-1.5 text-sm font-extrabold text-running">
                  🎁 Récompense débloquée : {a.reward} !
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="w-full">
          <PrimaryButton onClick={onClose}>Continuer</PrimaryButton>
        </div>
      </div>
    )
  }

  const program = metrics.filter((m) => m.target != null)

  // Le programme du jour est l'info principale — sur une autre date, le mot « aujourd'hui » mentirait
  const programLabel = logDate === todayStr() ? "À faire aujourd'hui" : 'Programme'

  return (
    <div className="space-y-4">
      {session.notes && <p className="text-sm font-semibold text-ink-soft">{session.notes}</p>}

      {program.length > 0 && (
        <p className="flex items-center gap-2 rounded-sm bg-sage-50 px-4 py-2.5 text-sm font-bold">
          <ClipboardList className="h-4 w-4 shrink-0 text-sage-600" />
          <span>Programme : {program.map((m) => `${m.label} ${m.target}${m.unit ? ' ' + m.unit : ''}`).join(' · ')}</span>
        </p>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-velo/10 px-3.5 py-2 text-xs font-extrabold text-velo active:bg-velo/20"
            >
              <Play className="h-3 w-3" /> {l.label}
            </a>
          ))}
        </div>
      )}

      {session.category === 'running' && !hasForm && (
        <p className="text-sm text-ink-soft">
          Vos perfs running restent sur votre app de course — ici, on coche simplement la sortie.
        </p>
      )}

      {session.category === 'hiit' && session.items.length > 0 && (
        <div>
          <Eyebrow>{programLabel}</Eyebrow>
          <div className="divide-y divide-hairline">
            {session.items.map((it, i) => {
              const ex = exOf(it.exerciseId)
              return (
                <ProgramRow
                  key={i}
                  name={ex?.name ?? 'Exercice'}
                  comment={it.comment}
                  videoUrl={ex?.videoUrl}
                  value={String(it.durationSec ?? session.workSec ?? 45)}
                  unit="s"
                />
              )
            })}
          </div>
          <p className="border-t border-hairline pt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
            × {session.rounds ?? 1} tour{(session.rounds ?? 1) > 1 ? 's' : ''} · {session.restSec ?? 15} s de repos
          </p>
        </div>
      )}

      {/* Muscu / étirements — programme en lecture seule : les tours et le détail d'UN tour */}
      {!entering && (isMuscu || isStretch) && session.items.length > 0 && (
        <div>
          <Eyebrow>{programLabel}</Eyebrow>
          {blocks.map((b, bi) => (
            <div key={bi}>
              {(blocks.length > 1 || b.rounds > 1) && (
                <p
                  className={`flex items-center gap-1.5 pt-2.5 font-mono text-[10px] tracking-[0.2em] uppercase ${CATEGORY_META[session.category].text}`}
                >
                  <Repeat className="h-3 w-3" />
                  {blocks.length > 1 ? `Bloc ${bi + 1}` : 'Circuit'}
                  {b.rounds > 1 ? ` · × ${b.rounds} tours` : ''}
                </p>
              )}
              <div className="divide-y divide-hairline">
                {b.items.map((it, i) => {
                  const ex = exOf(it.exerciseId)
                  const t = itemTarget(it, ex, isStretch)
                  return (
                    <ProgramRow
                      key={i}
                      name={ex?.name ?? 'Exercice'}
                      comment={it.comment}
                      linkNext={it.linkNext}
                      videoUrl={ex?.videoUrl}
                      value={t.value}
                      unit={t.unit}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {lastLog && (
        <div className="border-t border-hairline pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
              Dernière fois · {relativeDayFr(lastLog.date)}
            </p>
            {feelingOf(lastLog.feeling) && (
              <span className="text-lg" title={feelingOf(lastLog.feeling)!.label}>
                {feelingOf(lastLog.feeling)!.emoji}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-extrabold text-ink">{lastPerfLine(lastLog, session, exercises)}</p>
          {lastStop && <p className="mt-0.5 text-xs font-semibold text-ink-soft">{lastDetailLine(lastLog)}</p>}
          {lastLog.note && (
            <p className="mt-0.5 text-xs font-semibold italic text-ink-soft">« {lastLog.note} »</p>
          )}
        </div>
      )}

      {isFuture && (
        <p className="rounded-2xl bg-sand/60 px-4 py-3 text-sm font-semibold text-ink-soft">
          📅 Séance à venir — reviens le jour J pour la lancer et enregistrer ton résultat.
        </p>
      )}

      {!isFuture && !entering && hasTimer && (
        <PrimaryButton onClick={() => navigate(`/player/${session.id}`)}>
          <span className="flex items-center justify-center gap-2">
            <Play className="h-4 w-4" /> Démarrer
          </span>
        </PrimaryButton>
      )}

      {entering && (
        <>
          <p className="text-xs font-semibold text-ink-soft">
            Tapez la série où vous vous êtes arrêté : elle et les suivantes passent en « non faite ». L'icône à
            droite marque une série faite mais mal réalisée.
          </p>
          <ResultTimeline
            groups={timeline}
            status={status}
            category={session.category}
            onTap={tapRow}
            onFlag={flagRow}
          />
        </>
      )}

      {!isFuture && (!isMuscu || entering) && metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((d) => (
            <Field key={d.key} label={d.label}>
              <NumInput
                value={mvals[d.key]}
                onChange={(v) => setMvals((p) => ({ ...p, [d.key]: v }))}
                suffix={d.unit || undefined}
                placeholder={d.key === 'speed' ? 'auto' : undefined}
              />
            </Field>
          ))}
        </div>
      )}

      {!isFuture && (entering || (!isMuscu && hasForm)) && (
        <>
          <FeelingPicker value={feeling} onChange={setFeeling} />
          <Field label="Note (optionnel)">
            <TextArea value={note} onChange={setNote} rows={2} placeholder="Remarques (ex. « monter le niveau »)…" />
          </Field>
        </>
      )}

      {entering && <PrimaryButton onClick={() => void save()}>Valider la séance ✓</PrimaryButton>}

      {!isFuture &&
        !isMuscu &&
        !entering &&
        (hasTimer ? (
          <GhostButton onClick={() => void save()}>Marquer comme faite ✓ (sans minuteur)</GhostButton>
        ) : (
          <PrimaryButton onClick={() => void save()}>
            {hasForm ? 'Valider la séance ✓' : 'Marquer comme faite ✓'}
          </PrimaryButton>
        ))}

      {/* La fermeture sans valider passe par la croix ✕ de l'en-tête */}
      {entering && (
        <button
          type="button"
          onClick={() => setEntering(false)}
          className="w-full py-1 text-center text-sm font-bold text-ink-soft active:text-ink"
        >
          ← Retour à la séance
        </button>
      )}
    </div>
  )
}
