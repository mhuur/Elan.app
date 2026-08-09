import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Lightbulb, Link2, Play, Repeat, TrendingUp } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, feelingOf, setTargetsOf, type Exercise, type Log, type MetricValue, type Session, type SessionItem } from '../types'
import { relativeDayFr, todayStr } from '../lib/dates'
import { lastDetailLine, lastPerfLine } from '../lib/format'
import { effectiveMetrics, goalLevels, objectiveLevels } from '../lib/metrics'
import { muscuBlocks } from '../lib/blocks'
import { buildTimeline, collectSets, stopPoint, type SetStatus } from '../lib/timeline'
import { progressedSession } from '../lib/progression'
import { CategoryIcon, Field, GhostButton, NumInput, PrimaryButton, Sheet, TextArea } from './ui'
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
  return (
    <Sheet
      open={!!session}
      onClose={onClose}
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
    >
      {session && <Inner key={session.id} session={session} onClose={onClose} date={date} />}
    </Sheet>
  )
}

/** Résumé du programme d'un exercice : « 3 × 20 reps » ou « 30 / 20 / 15 reps » */
function itemSummary(it: SessionItem, ex?: Exercise): string {
  const tgs = setTargetsOf(it)
  const unit = ex?.measure === 'sec' ? 's' : 'reps'
  const uniform = tgs.every((t) => t === tgs[0])
  return uniform ? `${tgs.length} × ${tgs[0]} ${unit}` : `${tgs.join(' / ')} ${unit}`
}


function Inner({ session: planned, onClose, date }: { session: Session; onClose: () => void; date?: string }) {
  const { addLog, logs, exercises } = useData()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [feeling, setFeeling] = useState<number | undefined>(undefined)
  const [entering, setEntering] = useState(false)
  const [celebrate, setCelebrate] = useState<{ text: string; reward?: string }[] | null>(null)
  const logDate = date ?? todayStr()
  // Saisie interdite sur une date future (aperçu seulement) — on ne journalise pas l'avenir
  const isFuture = logDate > todayStr()

  // Objectifs relevés à hauteur de la dernière perf (dérivé : la fiche de séance n'est pas touchée)
  const { session, raised } = useMemo(
    () => progressedSession(planned, exercises, logs, logDate),
    [planned, exercises, logs, logDate],
  )

  const metrics = useMemo(() => effectiveMetrics(session), [session])
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

  return (
    <div className="space-y-4">
      {lastLog && (
        <div className="rounded-sm bg-sage-50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage-600">
              Dernière fois · {relativeDayFr(lastLog.date)}
            </p>
            {feelingOf(lastLog.feeling) && (
              <span className="text-lg" title={feelingOf(lastLog.feeling)!.label}>
                {feelingOf(lastLog.feeling)!.emoji}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-bold text-ink">{lastPerfLine(lastLog, session, exercises)}</p>
          {lastStop && <p className="mt-0.5 text-xs font-semibold text-ink-soft">{lastDetailLine(lastLog)}</p>}
          {lastLog.note && (
            <p className="mt-0.5 text-xs font-semibold italic text-ink-soft">« {lastLog.note} »</p>
          )}
        </div>
      )}

      {session.notes && <p className="text-sm font-semibold text-ink-soft">{session.notes}</p>}

      {raised && (
        <p className="flex items-center gap-2 rounded-sm bg-sage-50 px-4 py-2.5 text-xs font-bold text-sage-600">
          <TrendingUp className="h-4 w-4 shrink-0" />
          Objectifs relevés à hauteur de ta dernière perf.
        </p>
      )}

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
        <div className="overflow-hidden rounded-sm bg-sage-50">
          {session.items.map((it, i) => {
            const ex = exOf(it.exerciseId)
            return (
              <div
                key={i}
                className={'flex items-center justify-between gap-2 px-4 py-2.5 ' + (i > 0 ? 'border-t border-surface' : '')}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{ex?.name ?? 'Exercice'}</p>
                  {it.comment && (
                    <p className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
                      <Lightbulb className="h-3 w-3 shrink-0" />
                      <span className="min-w-0 truncate">{it.comment}</span>
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-extrabold text-ink-soft">{it.durationSec ?? session.workSec ?? 45} s</span>
              </div>
            )
          })}
          <p className="border-t border-surface px-4 py-2 text-xs font-extrabold text-ink-soft">
            × {session.rounds ?? 1} tour{(session.rounds ?? 1) > 1 ? 's' : ''} · {session.restSec ?? 15} s de repos
          </p>
        </div>
      )}

      {/* Muscu / étirements — programme en lecture seule : les tours et le détail d'UN tour */}
      {!entering && (isMuscu || isStretch) && session.items.length > 0 && (
        <div className="space-y-2">
          {blocks.map((b, bi) => (
            <div key={bi} className="overflow-hidden rounded-sm bg-sage-50">
              {(blocks.length > 1 || b.rounds > 1) && (
                <p
                  className={`flex items-center gap-1.5 px-4 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase ${CATEGORY_META[session.category].soft} ${CATEGORY_META[session.category].text}`}
                >
                  <Repeat className="h-3 w-3" />
                  {blocks.length > 1 ? `Bloc ${bi + 1}` : 'Circuit'}
                  {b.rounds > 1 ? ` · × ${b.rounds} tours` : ''}
                </p>
              )}
              {b.items.map((it, i) => {
                const ex = exOf(it.exerciseId)
                return (
                  <div
                    key={i}
                    className={'flex items-center justify-between gap-2 px-4 py-2.5 ' + (i > 0 ? 'border-t border-surface' : '')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-bold">
                        <span className="min-w-0 truncate">{ex?.name ?? 'Exercice'}</span>
                        {it.linkNext && <Link2 className="h-3 w-3 shrink-0 text-muscu" />}
                      </p>
                      {it.comment && (
                        <p className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
                          <Lightbulb className="h-3 w-3 shrink-0" />
                          <span className="min-w-0 truncate">{it.comment}</span>
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-extrabold text-ink-soft">
                      {isMuscu
                        ? itemSummary(it, ex)
                        : ex?.measure === 'reps'
                          ? `${it.target ?? 10} reps`
                          : `${it.durationSec ?? 30} s`}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
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
            <Play className="h-4 w-4" /> Lancer le minuteur guidé
          </span>
        </PrimaryButton>
      )}

      {/* Muscu/HIIT — saisie du résultat : timeline à curseur (un tap marque où on s'est arrêté) */}
      {!isFuture && !entering && (isMuscu || isHiit) && session.items.length > 0 && (
        <GhostButton onClick={() => setEntering(true)}>Entrer le résultat ✓</GhostButton>
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

      <button
        type="button"
        onClick={() => (entering ? setEntering(false) : onClose())}
        className="w-full py-1 text-center text-sm font-bold text-ink-soft active:text-ink"
      >
        {entering ? '← Retour à la séance' : 'Fermer sans valider'}
      </button>
    </div>
  )
}
