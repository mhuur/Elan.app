import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import {
  CATEGORIES,
  CATEGORY_META,
  PRESET_SUBTYPES,
  subtypesOf,
  type Category,
  type Exercise,
  type LinkDef,
  type MetricDef,
  type SessionItem,
} from '../types'
import { DAY_LETTER, DAY_NAMES, todayStr } from '../lib/dates'
import { DEFAULT_VELO_METRICS, effectiveMetrics, newMetric } from '../lib/metrics'
import { cycleIdsOf, ownerOf } from '../lib/schedule'
import { Chip, Field, GhostButton, PrimaryButton, Seg, Stepper, TextArea, TextInput } from '../components/ui'

const smallInput =
  'rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-soft/50 focus:border-sage-400'

/** Options du sélecteur d'exercice, groupées par premier sous-type (comme la banque) */
function groupedOptions(list: Exercise[]): [string, Exercise[]][] {
  const map = new Map<string, Exercise[]>()
  for (const e of list) {
    const k = subtypesOf(e)[0] ?? ''
    const arr = map.get(k)
    if (arr) arr.push(e)
    else map.set(k, [e])
  }
  const rank = (k: string) => {
    if (!k) return 10000
    const i = PRESET_SUBTYPES.indexOf(k)
    return i === -1 ? 5000 : i
  }
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'fr'))
}

export default function SessionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sessions, exercises, addSession, updateSession, removeSession, updateExercise, addExercise } = useData()
  const existing = sessions.find((s) => s.id === id)

  // Cycle d'alternance : la séance « propriétaire » porte la planification, les
  // autres membres la voient et la modifient depuis leur propre fiche.
  const cycleOwner = existing ? (existing.repeat ? existing : ownerOf(existing.id, sessions)) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState<Category>(existing?.category ?? 'muscu')
  const [days, setDays] = useState<number[]>(existing?.days ?? [])
  const [scheduleMode, setScheduleMode] = useState<'weekly' | 'interval'>(cycleOwner ? 'interval' : 'weekly')
  const [everyDays, setEveryDays] = useState(cycleOwner?.repeat?.everyDays ?? 2)
  const [startDate, setStartDate] = useState(cycleOwner?.repeat?.startDate ?? todayStr())
  const [altIds, setAltIds] = useState<string[]>(() =>
    cycleOwner && existing ? cycleIdsOf(cycleOwner).filter((x) => x !== existing.id) : [],
  )
  const [items, setItems] = useState<SessionItem[]>(existing?.items ?? [])
  const [metrics, setMetrics] = useState<MetricDef[]>(existing ? effectiveMetrics(existing) : [])
  const [links, setLinks] = useState<LinkDef[]>(existing?.links ?? [])
  const [workSec, setWorkSec] = useState(existing?.workSec ?? 45)
  const [restSec, setRestSec] = useState(existing?.restSec ?? 15)
  const [rounds, setRounds] = useState(existing?.rounds ?? 2)
  const [stretchRest, setStretchRest] = useState(existing?.category === 'etirements' ? (existing.restSec ?? 0) : 5)
  const [muscuRounds, setMuscuRounds] = useState(existing?.category === 'muscu' ? (existing.rounds ?? 1) : 1)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [quickName, setQuickName] = useState('')

  /** Ordre de rotation prévisualisé (même logique que la sauvegarde) */
  const previewRotation = (): string[] => {
    const selfId = existing?.id ?? '__self__'
    const wanted = [selfId, ...altIds]
    const prev = cycleOwner ? cycleIdsOf(cycleOwner) : []
    const cycle = [...prev.filter((x) => wanted.includes(x)), ...wanted.filter((x) => !prev.includes(x))].filter(
      (x, i, a) => a.indexOf(x) === i,
    )
    return cycle.map((cid) =>
      cid === selfId ? `${name.trim() || 'Cette séance'} ★` : (sessions.find((x) => x.id === cid)?.name ?? '?'),
    )
  }

  const catExercises = exercises.filter((e) => e.category === category)
  const exOf = (exId: string) => exercises.find((e) => e.id === exId)
  const hasItems = category === 'muscu' || category === 'hiit' || category === 'etirements'

  const switchCategory = (c: Category) => {
    if (c === category) return
    if (items.length && !window.confirm('Changer de catégorie videra la liste des exercices de la séance. Continuer ?')) return
    setCategory(c)
    setItems([])
    if (c === 'velo' && metrics.length === 0) setMetrics(DEFAULT_VELO_METRICS)
  }

  const toggleDay = (d: number) =>
    setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)))

  const addItem = () => {
    const used = new Set(items.map((i) => i.exerciseId))
    const next = catExercises.find((e) => !used.has(e.id)) ?? catExercises[0]
    if (!next) {
      window.alert(`Créez d'abord un exercice dans la catégorie ${CATEGORY_META[category].label} (onglet Exercices).`)
      return
    }
    const base: SessionItem = { exerciseId: next.id }
    if (category === 'muscu') {
      base.sets = 3
      base.target = exOf(next.id)?.measure === 'sec' ? 30 : 10
      base.restSec = 60
    }
    if (category === 'etirements') base.durationSec = 30
    setItems((p) => [...p, base])
  }

  /** Crée un exercice à la volée et l'ajoute à la séance, sans quitter le formulaire */
  const quickCreate = async () => {
    const nm = quickName.trim()
    if (!nm) return
    const exId = await addExercise({
      name: nm,
      category,
      subtypes: [],
      subtype: '',
      measure: 'reps',
      description: '',
      videoUrl: '',
      createdAt: Date.now(),
    })
    const base: SessionItem = { exerciseId: exId }
    if (category === 'muscu') {
      base.sets = 3
      base.target = 10
      base.restSec = 60
    }
    if (category === 'etirements') base.durationSec = 30
    setItems((p) => [...p, base])
    setQuickName('')
  }

  const setItem = (idx: number, patch: Partial<SessionItem>) =>
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx))
  const moveItem = (idx: number, dir: -1 | 1) =>
    setItems((p) => {
      const j = idx + dir
      if (j < 0 || j >= p.length) return p
      const copy = [...p]
      ;[copy[idx], copy[j]] = [copy[j], copy[idx]]
      return copy
    })

  const setMetric = (idx: number, patch: Partial<MetricDef>) =>
    setMetrics((p) => p.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  const setLink = (idx: number, patch: Partial<LinkDef>) =>
    setLinks((p) => p.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  /**
   * Applique la planification du cycle d'alternance : le premier de la liste
   * devient propriétaire du `repeat`, les autres membres sont nettoyés.
   */
  const applySchedule = async (selfId: string) => {
    const byId = (sid: string) => sessions.find((x) => x.id === sid)
    if (scheduleMode === 'weekly') {
      if (!cycleOwner) return
      if (cycleOwner.id === selfId) {
        // J'étais propriétaire : la première alternance restante reprend le cycle
        const rest = cycleIdsOf(cycleOwner).filter((x) => x !== selfId && !!byId(x))
        if (rest.length) {
          await updateSession(rest[0], { repeat: { everyDays, startDate, alternates: rest.slice(1) } })
        }
      } else {
        // Je quitte le cycle du propriétaire
        const rest = cycleIdsOf(cycleOwner).filter((x) => x !== selfId && x !== cycleOwner.id)
        await updateSession(cycleOwner.id, { repeat: { everyDays, startDate, alternates: rest } })
      }
      return
    }
    // Mode intervalle : reconstruire le cycle en conservant l'ordre précédent
    const wanted = [selfId, ...altIds]
    const prev = cycleOwner ? cycleIdsOf(cycleOwner) : []
    const cycle = [...prev.filter((x) => wanted.includes(x)), ...wanted.filter((x) => !prev.includes(x))].filter(
      (x, i, arr) => arr.indexOf(x) === i && (x === selfId || !!byId(x)),
    )
    const ownerId = cycle[0]
    await updateSession(ownerId, { repeat: { everyDays, startDate, alternates: cycle.slice(1) } })
    for (const mid of cycle.slice(1)) {
      if (byId(mid)?.repeat) await updateSession(mid, { repeat: null })
    }
    if (cycleOwner && cycleOwner.id !== selfId && !cycle.includes(cycleOwner.id)) {
      await updateSession(cycleOwner.id, { repeat: null })
    }
  }

  const save = async () => {
    const cleanMetrics = metrics
      .filter((m) => m.label.trim())
      .map((m) => ({ key: m.key, label: m.label.trim(), unit: m.unit.trim() }))
    const cleanLinks = links
      .filter((l) => l.url.trim())
      .map((l) => ({ label: l.label.trim() || 'Lien', url: l.url.trim() }))
    const maxOrder = sessions.reduce((a, s) => Math.max(a, s.sortOrder ?? -1), -1)
    const data = {
      name: name.trim() || 'Séance',
      category,
      days: scheduleMode === 'weekly' ? days : [],
      // La planification par cycle est réécrite par applySchedule ci-dessous
      repeat: null,
      items: hasItems ? items : [],
      metrics: cleanMetrics,
      links: cleanLinks,
      notes: notes.trim(),
      sortOrder: existing?.sortOrder ?? maxOrder + 1,
      createdAt: existing?.createdAt ?? Date.now(),
      ...(category === 'hiit' ? { workSec, restSec, rounds } : {}),
      ...(category === 'etirements' ? { restSec: stretchRest } : {}),
      ...(category === 'muscu' ? { rounds: muscuRounds } : {}),
    }
    let selfId: string
    if (existing) {
      await updateSession(existing.id, data)
      selfId = existing.id
    } else {
      selfId = await addSession(data)
    }
    await applySchedule(selfId)
    navigate(-1)
  }

  const duplicate = async () => {
    if (!existing) return
    const { id: _ignored, ...rest } = existing
    const maxOrder = sessions.reduce((a, s) => Math.max(a, s.sortOrder ?? -1), -1)
    await addSession({
      ...rest,
      name: existing.name + ' (copie)',
      days: [],
      repeat: null,
      sortOrder: maxOrder + 1,
      createdAt: Date.now(),
    })
    navigate('/library', { replace: true })
  }

  const del = async () => {
    if (!existing) return
    if (!window.confirm(`Supprimer la séance « ${existing.name} » ? L'historique déjà enregistré est conservé.`)) return
    await removeSession(existing.id)
    navigate('/library', { replace: true })
  }

  return (
    <div>
      <header className="flex items-center gap-3 px-5 pt-8 pb-4">
        <button type="button" aria-label="Retour" onClick={() => navigate(-1)} className="rounded-full bg-surface p-2.5 shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-xl font-extrabold">{existing ? 'Modifier la séance' : 'Nouvelle séance'}</h1>
      </header>

      <div className="space-y-4 px-5">
        <Field label="Nom">
          <TextInput value={name} onChange={setName} placeholder="Ex. HIIT du mardi" />
        </Field>

        <Field label="Catégorie">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => switchCategory(c)}>
                {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Planification">
          <Seg
            options={[
              { value: 'weekly' as const, label: 'Jours fixes' },
              { value: 'interval' as const, label: 'Tous les X jours' },
            ]}
            value={scheduleMode}
            onChange={setScheduleMode}
          />
          {scheduleMode === 'weekly' ? (
            <div className="mt-2 flex gap-1.5">
              {DAY_LETTER.map((letter, d) => (
                <button
                  key={d}
                  type="button"
                  title={DAY_NAMES[d]}
                  onClick={() => toggleDay(d)}
                  className={
                    'h-10 flex-1 rounded-xl text-sm font-extrabold transition-colors ' +
                    (days.includes(d) ? 'bg-sage-500 text-white shadow-sm' : 'bg-sage-100 text-sage-700')
                  }
                >
                  {letter}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-2 space-y-3 rounded-2xl bg-sage-50 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">Tous les</p>
                <div className="flex items-center gap-1.5">
                  <Stepper value={everyDays} onChange={setEveryDays} min={1} max={30} />
                  <span className="text-sm font-bold">jour{everyDays > 1 ? 's' : ''}</span>
                </div>
              </div>
              <label className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">À partir du</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value || todayStr())}
                  className="rounded-xl border border-sand bg-surface px-3 py-2 text-sm font-bold outline-none focus:border-sage-400"
                />
              </label>
              <div>
                <p className="mb-1 text-sm font-bold">En alternance avec (optionnel)</p>
                {altIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {altIds.map((aid) => {
                      const s = sessions.find((x) => x.id === aid)
                      if (!s) return null
                      const meta = CATEGORY_META[s.category]
                      return (
                        <button
                          key={aid}
                          type="button"
                          title="Retirer de l'alternance"
                          onClick={() => setAltIds((p) => p.filter((x) => x !== aid))}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${meta.soft} ${meta.text}`}
                        >
                          {meta.emoji} {s.name} <span className="opacity-50">✕</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setAltIds((p) => [...p, e.target.value])
                  }}
                  className="w-full rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-bold outline-none focus:border-sage-400"
                >
                  <option value="">+ Ajouter une séance à l'alternance…</option>
                  {sessions
                    .filter((s) => s.id !== existing?.id && !altIds.includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {CATEGORY_META[s.category].emoji} {s.name}
                      </option>
                    ))}
                </select>
                {altIds.length > 0 && (
                  <div className="mt-2 rounded-xl bg-surface px-3 py-2.5">
                    <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-ink-soft">
                      🔁 Rotation ({everyDays === 1 ? 'chaque jour' : `tous les ${everyDays} jours`})
                    </p>
                    <p className="text-xs font-extrabold leading-relaxed">
                      {previewRotation().join('  →  ')} <span className="text-ink-soft">→ on recommence</span>
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-ink-soft">
                      ★ = cette séance. Les séances tournent dans l'ordre ; l'alternance est partagée et modifiable
                      depuis la fiche de chacune.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Field>

        {category === 'hiit' && (
          <div className="rounded-2xl bg-sage-50 p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="mb-1 text-xs font-bold text-ink-soft">Effort</p>
                <Stepper value={workSec} onChange={setWorkSec} min={5} step={5} suffix="s" />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold text-ink-soft">Repos</p>
                <Stepper value={restSec} onChange={setRestSec} min={0} step={5} suffix="s" />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold text-ink-soft">Tours</p>
                <Stepper value={rounds} onChange={setRounds} min={1} />
              </div>
            </div>
          </div>
        )}

        {category === 'etirements' && (
          <div className="rounded-2xl bg-sage-50 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-ink-soft">Transition entre postures</p>
              <Stepper value={stretchRest} onChange={setStretchRest} min={0} step={5} suffix="s" />
            </div>
          </div>
        )}

        {category === 'muscu' && (
          <div className="rounded-2xl bg-sage-50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-ink-soft">Tours du circuit</p>
                <p className="text-[10px] font-semibold text-ink-soft/70">Refaire toute la série d'exercices</p>
              </div>
              <Stepper value={muscuRounds} onChange={setMuscuRounds} min={1} max={10} small />
            </div>
          </div>
        )}

        {hasItems && (
          <Field label={category === 'etirements' ? 'Postures de la routine' : 'Exercices de la séance'}>
            <div className="space-y-2">
              {items.map((it, idx) => {
                const ex = exOf(it.exerciseId)
                const isSec = ex?.measure === 'sec'
                return (
                  <div key={idx}>
                    <div className="rounded-2xl bg-sage-50 p-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-col">
                          <button type="button" aria-label="Monter" onClick={() => moveItem(idx, -1)} className="text-xs text-ink-soft/60 disabled:opacity-30" disabled={idx === 0}>
                            ▲
                          </button>
                          <button type="button" aria-label="Descendre" onClick={() => moveItem(idx, 1)} className="text-xs text-ink-soft/60 disabled:opacity-30" disabled={idx === items.length - 1}>
                            ▼
                          </button>
                        </div>
                        <select
                          value={it.exerciseId}
                          onChange={(e) => setItem(idx, { exerciseId: e.target.value })}
                          className="min-w-0 flex-1 rounded-xl border border-sand bg-surface px-3 py-2 text-sm font-bold outline-none focus:border-sage-400"
                        >
                          {groupedOptions(catExercises).map(([st, exos]) => {
                            const opts = exos.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))
                            return st ? (
                              <optgroup key={st} label={st}>
                                {opts}
                              </optgroup>
                            ) : (
                              <optgroup key="autres" label="Autres">
                                {opts}
                              </optgroup>
                            )
                          })}
                          {ex && ex.category !== category && <option value={ex.id}>{ex.name}</option>}
                        </select>
                        {it.comment === undefined && (
                          <button
                            type="button"
                            aria-label="Ajouter un commentaire"
                            onClick={() => setItem(idx, { comment: '' })}
                            className="px-0.5 text-sm text-ink-soft/60"
                          >
                            💬
                          </button>
                        )}
                        <button type="button" aria-label="Retirer" onClick={() => removeItem(idx)} className="px-0.5 text-ink-soft/60">
                          ✕
                        </button>
                      </div>

                      {category === 'muscu' && (
                        <div className="mt-1.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-ink-soft">Séries</span>
                            <Stepper small value={it.sets ?? 3} onChange={(v) => setItem(idx, { sets: v })} min={1} />
                            <span className="text-xs font-extrabold text-ink-soft/60">×</span>
                            <Stepper
                              small
                              value={it.target ?? 10}
                              onChange={(v) => setItem(idx, { target: v })}
                              min={1}
                              step={isSec ? 5 : 1}
                            />
                            <div className="flex overflow-hidden rounded-lg border border-sand text-[10px] font-extrabold">
                              <button
                                type="button"
                                onClick={() => ex && void updateExercise(ex.id, { measure: 'reps' })}
                                className={'px-1.5 py-1 ' + (!isSec ? 'bg-sage-500 text-white' : 'bg-surface text-ink-soft')}
                              >
                                reps
                              </button>
                              <button
                                type="button"
                                onClick={() => ex && void updateExercise(ex.id, { measure: 'sec' })}
                                className={'px-1.5 py-1 ' + (isSec ? 'bg-sage-500 text-white' : 'bg-surface text-ink-soft')}
                              >
                                sec
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-ink-soft">Repos entre séries</span>
                            <Stepper small value={it.restSec ?? 60} onChange={(v) => setItem(idx, { restSec: v })} min={0} max={600} step={15} suffix="s" />
                          </div>
                        </div>
                      )}

                      {category === 'etirements' && (
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-ink-soft">Durée de la posture</span>
                          <Stepper small value={it.durationSec ?? 30} onChange={(v) => setItem(idx, { durationSec: v })} min={5} step={5} suffix="s" />
                        </div>
                      )}

                      {it.comment !== undefined && (
                        <input
                          type="text"
                          value={it.comment}
                          onChange={(e) => setItem(idx, { comment: e.target.value })}
                          placeholder="Commentaire (tempo, consigne…)"
                          className={smallInput + ' mt-1.5 w-full py-2'}
                        />
                      )}
                    </div>

                    {category === 'muscu' && idx < items.length - 1 && (
                      <div className="-my-0.5 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setItem(idx, { linkNext: !it.linkNext })}
                          className={
                            'relative z-10 rounded-full px-3 py-1 text-[10px] font-extrabold transition-colors ' +
                            (it.linkNext ? 'bg-muscu text-white shadow-sm' : 'bg-sage-100 text-ink-soft/70')
                          }
                        >
                          {it.linkNext ? '🔗 Superset — enchaîné sans repos' : '+ lier en superset'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              <button
                type="button"
                onClick={addItem}
                className="w-full rounded-2xl border-2 border-dashed border-sage-300 px-4 py-3 text-sm font-extrabold text-sage-600 active:bg-sage-100"
              >
                + Ajouter un exercice
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="Ou créez un nouvel exercice ici…"
                  className={smallInput + ' min-w-0 flex-1 py-2'}
                />
                {quickName.trim() && (
                  <button
                    type="button"
                    onClick={() => void quickCreate()}
                    className="shrink-0 rounded-full bg-sage-500 px-3.5 py-2 text-xs font-extrabold text-white active:bg-sage-600"
                  >
                    + Créer
                  </button>
                )}
              </div>
              {category === 'hiit' && items.length > 0 && (
                <p className="text-center text-xs font-semibold text-ink-soft">
                  {items.length} exercice{items.length > 1 ? 's' : ''} × {rounds} tour{rounds > 1 ? 's' : ''} ·{' '}
                  {workSec}s d'effort / {restSec}s de repos
                </p>
              )}
            </div>
          </Field>
        )}

        <Field label="Mesures à saisir en fin de séance">
          <div className="space-y-2">
            {metrics.map((m, idx) => (
              <div key={m.key} className="flex items-center gap-2">
                <input
                  type="text"
                  value={m.label}
                  onChange={(e) => setMetric(idx, { label: e.target.value })}
                  placeholder="Ex. Puissance"
                  className={smallInput + ' min-w-0 flex-1'}
                />
                <input
                  type="text"
                  value={m.unit}
                  onChange={(e) => setMetric(idx, { unit: e.target.value })}
                  placeholder="unité"
                  className={smallInput + ' w-24'}
                />
                <button type="button" aria-label="Retirer la mesure" onClick={() => setMetrics((p) => p.filter((_, i) => i !== idx))} className="px-1 text-ink-soft/60">
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMetrics((p) => [...p, newMetric()])}
              className="rounded-full bg-sage-100 px-4 py-2 text-xs font-extrabold text-sage-700 active:bg-sage-200"
            >
              + Ajouter une mesure
            </button>
            {metrics.length === 0 && (
              <p className="text-xs font-semibold text-ink-soft/70">
                Optionnel — ex. durée, calories, niveau de résistance… Saisies à chaque séance et suivies dans Progrès.
              </p>
            )}
          </div>
        </Field>

        <Field label="Liens utiles (YouTube, programme…)">
          <div className="space-y-2">
            {links.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={l.label}
                  onChange={(e) => setLink(idx, { label: e.target.value })}
                  placeholder="Titre"
                  className={smallInput + ' w-28'}
                />
                <input
                  type="url"
                  value={l.url}
                  onChange={(e) => setLink(idx, { url: e.target.value })}
                  placeholder="https://…"
                  className={smallInput + ' min-w-0 flex-1'}
                />
                <button type="button" aria-label="Retirer le lien" onClick={() => setLinks((p) => p.filter((_, i) => i !== idx))} className="px-1 text-ink-soft/60">
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLinks((p) => [...p, { label: '', url: '' }])}
              className="rounded-full bg-sage-100 px-4 py-2 text-xs font-extrabold text-sage-700 active:bg-sage-200"
            >
              + Ajouter un lien
            </button>
          </div>
        </Field>

        <Field label="Notes (optionnel)">
          <TextArea value={notes} onChange={setNotes} rows={2} placeholder="Ex. 8 × 400 m, récup 1 min" />
        </Field>

        <div className="space-y-2 pt-2 pb-4">
          <PrimaryButton onClick={() => void save()} disabled={!name.trim()}>
            Enregistrer
          </PrimaryButton>
          {existing && <GhostButton onClick={() => void duplicate()}>📋 Dupliquer la séance</GhostButton>}
          {existing && (
            <GhostButton danger onClick={() => void del()}>
              Supprimer la séance
            </GhostButton>
          )}
        </div>
      </div>
    </div>
  )
}
