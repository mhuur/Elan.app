import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import {
  CATEGORIES,
  CATEGORY_META,
  PRESET_SUBTYPES,
  subtypesOf,
  type Category,
  type Exercise,
  type SessionItem,
} from '../types'
import { DAY_LETTER, DAY_NAMES, todayStr } from '../lib/dates'
import { canonicalCycles, cycleStepsOf, ownerOf } from '../lib/schedule'
import { Combobox, Field, FormActions, PageHeader, Seg, Select, Stepper, TextInput } from '../components/ui'

const smallInput =
  'rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-soft/50 focus:border-sage-400'

/** Petit champ numérique à saisie directe (plus compact que le Stepper dans les listes) */
function MiniNum({ value, onChange, min = 0, max = 990 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const [text, setText] = useState(String(value))
  const editingRef = useRef(false)
  useEffect(() => {
    if (!editingRef.current) setText(String(value))
  }, [value])
  const commit = (t: string) => {
    const n = Number(t.replace(',', '.'))
    if (t.trim() !== '' && !Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onFocus={(e) => {
        editingRef.current = true
        e.target.select()
      }}
      onChange={(e) => {
        setText(e.target.value)
        commit(e.target.value)
      }}
      onBlur={() => {
        editingRef.current = false
        setText(String(value))
      }}
      className="w-11 rounded-lg border border-sand bg-sage-50/60 py-1.5 text-center text-sm font-extrabold tabular-nums outline-none focus:border-sage-400 focus:bg-surface"
    />
  )
}

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
  const cycleOwner = existing ? ownerOf(existing.id, sessions) : undefined
  const ownerSteps = cycleOwner ? (canonicalCycles(sessions).get(cycleOwner.id) ?? []) : []
  // Identifiant de « cette séance » dans la rotation (placeholder tant qu'elle n'existe pas)
  const selfKey = existing?.id ?? '__self__'

  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState<Category>(existing?.category ?? 'muscu')
  const [days, setDays] = useState<number[]>(existing?.days ?? [])
  const [scheduleMode, setScheduleMode] = useState<'weekly' | 'interval'>(cycleOwner ? 'interval' : 'weekly')
  const [everyDays, setEveryDays] = useState(cycleOwner?.repeat?.everyDays ?? 2)
  const [startDate, setStartDate] = useState(cycleOwner?.repeat?.startDate ?? todayStr())
  // Rotation en cours d'édition : un tableau de « jours », chacun regroupant
  // les séances faites ensemble ce jour-là (selfKey = cette séance).
  const [steps, setSteps] = useState<string[][]>(() => (ownerSteps.length ? ownerSteps : [[selfKey]]))
  const [items, setItems] = useState<SessionItem[]>(existing?.items ?? [])
  const [workSec, setWorkSec] = useState(existing?.workSec ?? 45)
  const [restSec, setRestSec] = useState(existing?.restSec ?? 15)
  const [rounds, setRounds] = useState(existing?.rounds ?? 2)
  const [stretchRest, setStretchRest] = useState(existing?.category === 'etirements' ? (existing.restSec ?? 0) : 5)
  const [muscuRounds, setMuscuRounds] = useState(existing?.category === 'muscu' ? (existing.rounds ?? 1) : 1)
  const [group, setGroup] = useState(existing?.group ?? '')
  const [addQuery, setAddQuery] = useState('')

  // Sections déjà utilisées dans le planning, proposées dans la combobox
  const groupSuggestions = [...new Set(sessions.map((s) => (s.group ?? '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  )

  // --- Édition de la rotation
  const usedIds = new Set(steps.flat())
  const hasRotation = steps.flat().some((id) => id !== selfKey)
  const stepName = (id: string) =>
    id === selfKey ? `${name.trim() || 'Cette séance'} ★` : (sessions.find((x) => x.id === id)?.name ?? '?')
  const addToStep = (si: number, id: string) => setSteps((p) => p.map((st, i) => (i === si ? [...st, id] : st)))
  const removeFromStep = (si: number, id: string) =>
    setSteps((p) => p.map((st, i) => (i === si ? st.filter((x) => x !== id) : st)).filter((st, i) => st.length > 0 || i !== si))
  const addStep = () => setSteps((p) => [...p, []])
  const removeStep = (si: number) => setSteps((p) => p.filter((_, i) => i !== si))

  const catExercises = exercises.filter((e) => e.category === category)
  const exOf = (exId: string) => exercises.find((e) => e.id === exId)
  const hasItems = category === 'muscu' || category === 'hiit' || category === 'etirements'
  // Blocs muscu : découpage de la séance en groupes répétés indépendamment
  const hasBreaks = category === 'muscu' && items.some((it, i) => i > 0 && it.blockBreak)
  const blockNumberAt = (idx: number) => 1 + items.slice(1, idx + 1).filter((x) => x.blockBreak).length

  const switchCategory = (c: Category) => {
    if (c === category) return
    if (items.length && !window.confirm('Changer de catégorie videra la liste des exercices de la séance. Continuer ?')) return
    setCategory(c)
    setItems([])
  }

  const toggleDay = (d: number) =>
    setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)))

  /** Ajoute un exercice existant à la séance avec les réglages par défaut de la catégorie */
  const appendItem = (exId: string) => {
    const base: SessionItem = { exerciseId: exId }
    if (category === 'muscu') {
      base.sets = 3
      base.target = exOf(exId)?.measure === 'sec' ? 30 : 10
      base.restSec = 60
    }
    if (category === 'etirements') base.durationSec = 30
    setItems((p) => [...p, base])
  }

  /** Crée un exercice à la volée et l'ajoute à la séance, sans quitter le formulaire */
  const quickCreate = async (nm: string) => {
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
    appendItem(exId)
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

  /**
   * Applique la planification du cycle : la première séance du premier jour
   * devient propriétaire du `repeat` (rotation par jours, plusieurs séances
   * possibles le même jour) ; les autres membres sont nettoyés (plus de
   * `repeat` propre ni de jours fixes résiduels), et les anciens cycles qui
   * revendiquent une séance du nôtre sont réparés.
   */
  const applySchedule = async (selfId: string) => {
    const byId = (sid: string) => sessions.find((x) => x.id === sid)

    if (scheduleMode === 'weekly') {
      // Je quitte le cycle éventuel ; il continue sans moi
      const rest = ownerSteps.map((st) => st.filter((x) => x !== selfId && !!byId(x))).filter((st) => st.length)
      const restIds = rest.flat()
      if (cycleOwner?.repeat && restIds.length) {
        await updateSession(rest[0][0], {
          repeat: {
            everyDays: cycleOwner.repeat.everyDays,
            startDate: cycleOwner.repeat.startDate,
            steps: rest.map((ids) => ({ ids })),
          },
        })
        for (const mid of restIds.slice(1)) {
          if (byId(mid)?.repeat) await updateSession(mid, { repeat: null })
        }
      }
      return
    }

    // Mode intervalle : nettoyer la rotation saisie (doublons, séances disparues)
    const seen = new Set<string>()
    const cleanSteps = steps
      .map((st) =>
        st
          .map((id) => (id === '__self__' ? selfId : id))
          .filter((id) => {
            if (seen.has(id) || (id !== selfId && !byId(id))) return false
            seen.add(id)
            return true
          }),
      )
      .filter((st) => st.length)
    const allIds = cleanSteps.flat()
    const ownerId = cleanSteps[0][0]
    await updateSession(ownerId, { repeat: { everyDays, startDate, steps: cleanSteps.map((ids) => ({ ids })) } })
    // Les membres sont pilotés par la rotation : ni repeat propre, ni jours fixes
    for (const mid of allIds) {
      if (mid === ownerId || mid === selfId) continue // la sauvegarde du formulaire nettoie déjà selfId
      const m = byId(mid)
      if (!m) continue
      const patch: { repeat?: null; days?: number[] } = {}
      if (m.repeat) patch.repeat = null
      if (m.days.length) patch.days = []
      if (Object.keys(patch).length) await updateSession(mid, patch)
    }
    // Répare les autres cycles qui revendiquent encore une séance du nôtre
    for (const s of sessions) {
      if (!s.repeat || s.id === ownerId || allIds.includes(s.id)) continue
      const oSteps = cycleStepsOf(s)
      const kept = oSteps.map((st) => st.filter((x) => !allIds.includes(x))).filter((st) => st.length)
      if (kept.flat().length !== oSteps.flat().length) {
        await updateSession(s.id, {
          repeat: { everyDays: s.repeat.everyDays, startDate: s.repeat.startDate, steps: kept.map((ids) => ({ ids })) },
        })
      }
    }
  }

  const save = async () => {
    const maxOrder = sessions.reduce((a, s) => Math.max(a, s.sortOrder ?? -1), -1)
    const data = {
      name: name.trim() || 'Séance',
      category,
      days: scheduleMode === 'weekly' ? days : [],
      // La planification par cycle est réécrite par applySchedule ci-dessous
      repeat: null,
      items: hasItems ? items : [],
      // Mesures, liens et notes ne s'éditent plus ici : on conserve l'existant
      metrics: existing?.metrics ?? [],
      links: existing?.links ?? [],
      notes: existing?.notes ?? '',
      group: group.trim(),
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
      <PageHeader title={existing ? 'Modifier la séance' : 'Nouvelle séance'} onBack={() => navigate(-1)} />

      <div className="space-y-4 px-5 pb-2">
        <Field label="Nom">
          <TextInput value={name} onChange={setName} placeholder="Ex. HIIT du mardi" />
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Catégorie">
            <Select value={category} onChange={(v) => switchCategory(v as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Section du planning">
            <Combobox
              small
              value={group}
              onChange={setGroup}
              options={groupSuggestions.map((g) => ({ id: g, label: g }))}
              onSelect={setGroup}
              placeholder="Optionnel…"
            />
          </Field>
        </div>

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
                <p className="text-sm font-semibold">Tous les</p>
                <div className="flex items-center gap-1.5">
                  <Stepper value={everyDays} onChange={setEveryDays} min={1} max={30} small />
                  <span className="text-sm font-semibold">jour{everyDays > 1 ? 's' : ''}</span>
                </div>
              </div>
              <label className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">À partir du</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value || todayStr())}
                  className="rounded-xl border border-sand bg-surface px-3 py-2 text-sm font-bold outline-none focus:border-sage-400"
                />
              </label>
              <div>
                <p className="mb-1 text-sm font-semibold">Rotation (optionnel) — composez vos jours</p>
                <div className="space-y-2">
                  {steps.map((st, si) => (
                    <div key={si} className="rounded-xl bg-surface p-2.5">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
                          Jour {si + 1}
                        </p>
                        {!st.includes(selfKey) && steps.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Retirer le jour ${si + 1}`}
                            onClick={() => removeStep(si)}
                            className="px-1 text-ink-soft/50"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {st.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-1.5">
                          {st.map((sid) => {
                            if (sid === selfKey) {
                              return (
                                <span key={sid} className="rounded-full bg-sage-500 px-3 py-1.5 text-xs font-extrabold text-white">
                                  ★ {name.trim() || 'Cette séance'}
                                </span>
                              )
                            }
                            const x = sessions.find((q) => q.id === sid)
                            if (!x) return null
                            const meta = CATEGORY_META[x.category]
                            return (
                              <button
                                key={sid}
                                type="button"
                                title="Retirer de ce jour"
                                onClick={() => removeFromStep(si, sid)}
                                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${meta.soft} ${meta.text}`}
                              >
                                {meta.emoji} {x.name} <span className="opacity-50">✕</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                      <Select value="" onChange={(v) => v && addToStep(si, v)}>
                        <option value="">+ Ajouter une séance ce jour-là…</option>
                        {sessions
                          .filter((s) => s.id !== existing?.id && !usedIds.has(s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {CATEGORY_META[s.category].emoji} {s.name}
                            </option>
                          ))}
                      </Select>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addStep}
                    className="w-full rounded-xl border-2 border-dashed border-sage-300 px-3 py-2 text-xs font-extrabold text-sage-600 active:bg-sage-100"
                  >
                    + Ajouter un jour d'alternance
                  </button>
                  {hasRotation && (
                    <div className="rounded-xl bg-surface px-3 py-2.5">
                      <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
                        🔁 Rotation ({everyDays === 1 ? 'chaque jour' : `tous les ${everyDays} jours`})
                      </p>
                      <p className="text-xs font-extrabold leading-relaxed">
                        {steps
                          .filter((st) => st.length)
                          .map((st) => st.map(stepName).join(' + '))
                          .join('  →  ')}{' '}
                        <span className="text-ink-soft">→ on recommence</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Field>

        {category === 'hiit' && (
          <div className="rounded-2xl bg-sage-50 p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="mb-1 text-xs font-semibold text-ink-soft">Effort</p>
                <Stepper value={workSec} onChange={setWorkSec} min={5} step={5} suffix="s" small />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-ink-soft">Repos</p>
                <Stepper value={restSec} onChange={setRestSec} min={0} step={5} suffix="s" small />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-ink-soft">Tours</p>
                <Stepper value={rounds} onChange={setRounds} min={1} small />
              </div>
            </div>
          </div>
        )}

        {category === 'etirements' && (
          <div className="rounded-2xl bg-sage-50 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-soft">Transition entre postures</p>
              <Stepper value={stretchRest} onChange={setStretchRest} min={0} step={5} suffix="s" small />
            </div>
          </div>
        )}

        {category === 'muscu' && !hasBreaks && (
          <div className="rounded-2xl bg-sage-50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-ink-soft">Tours du circuit</p>
                <p className="text-[11px] font-semibold text-ink-soft">Refaire toute la série d'exercices</p>
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
                    {category === 'muscu' && hasBreaks && (idx === 0 || it.blockBreak) && (
                      <div className="mb-1.5 flex items-center justify-between gap-2 rounded-xl bg-muscu/10 px-3 py-1.5">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-muscu">
                          ▦ Bloc {blockNumberAt(idx)} — tours
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Stepper
                            small
                            value={it.blockRounds ?? 1}
                            onChange={(v) => setItem(idx, { blockRounds: v })}
                            min={1}
                            max={10}
                          />
                          {idx > 0 && (
                            <button
                              type="button"
                              aria-label="Fusionner avec le bloc précédent"
                              title="Fusionner avec le bloc précédent"
                              onClick={() => setItem(idx, { blockBreak: false })}
                              className="px-1 text-ink-soft/50"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="rounded-2xl bg-surface p-3 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <div className="-ml-1 flex shrink-0 flex-col">
                          <button
                            type="button"
                            aria-label="Monter"
                            onClick={() => moveItem(idx, -1)}
                            className="px-1.5 text-[10px] leading-tight text-ink-soft/50 disabled:opacity-25"
                            disabled={idx === 0}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            aria-label="Descendre"
                            onClick={() => moveItem(idx, 1)}
                            className="px-1.5 text-[10px] leading-tight text-ink-soft/50 disabled:opacity-25"
                            disabled={idx === items.length - 1}
                          >
                            ▼
                          </button>
                        </div>
                        <Select
                          bare
                          value={it.exerciseId}
                          onChange={(v) => setItem(idx, { exerciseId: v })}
                          className="min-w-0 flex-1"
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
                        </Select>
                        {it.comment === undefined && (
                          <button
                            type="button"
                            aria-label="Ajouter un commentaire"
                            onClick={() => setItem(idx, { comment: '' })}
                            className="px-0.5 text-sm text-ink-soft/50"
                          >
                            💬
                          </button>
                        )}
                        <button type="button" aria-label="Retirer" onClick={() => removeItem(idx)} className="px-0.5 text-ink-soft/50">
                          ✕
                        </button>
                      </div>

                      {category === 'muscu' && (
                        <div className="mt-2 flex items-center gap-1.5 pl-1 text-xs font-bold text-ink-soft">
                          <MiniNum value={it.sets ?? 3} onChange={(v) => setItem(idx, { sets: v })} min={1} />
                          <span className="text-ink-soft/60">×</span>
                          <MiniNum value={it.target ?? 10} onChange={(v) => setItem(idx, { target: v })} min={1} />
                          <button
                            type="button"
                            title="Basculer répétitions / secondes"
                            onClick={() => ex && void updateExercise(ex.id, { measure: isSec ? 'reps' : 'sec' })}
                            className="rounded-md bg-sage-100 px-2 py-1 text-[11px] font-extrabold text-sage-700 active:bg-sage-200"
                          >
                            {isSec ? 'sec' : 'reps'}
                          </button>
                          <span className="ml-auto flex items-center gap-1.5" title="Repos entre séries">
                            <span>⏱</span>
                            <MiniNum value={it.restSec ?? 60} onChange={(v) => setItem(idx, { restSec: v })} max={600} />
                            <span>s</span>
                          </span>
                        </div>
                      )}

                      {category === 'etirements' && (
                        <div className="mt-2 flex items-center gap-1.5 pl-1 text-xs font-bold text-ink-soft">
                          <span>Durée</span>
                          <MiniNum value={it.durationSec ?? 30} onChange={(v) => setItem(idx, { durationSec: v })} min={5} />
                          <span>s</span>
                        </div>
                      )}

                      {it.comment !== undefined && (
                        <input
                          type="text"
                          value={it.comment}
                          onChange={(e) => setItem(idx, { comment: e.target.value })}
                          placeholder="Commentaire (tempo, consigne…)"
                          className={smallInput + ' mt-2 w-full py-2'}
                        />
                      )}
                    </div>

                    {category === 'muscu' && idx < items.length - 1 && !items[idx + 1].blockBreak && (
                      <div className="-my-0.5 flex justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setItem(idx, { linkNext: !it.linkNext })}
                          className={
                            'relative z-10 rounded-full px-3 py-1 text-[11px] font-extrabold transition-colors ' +
                            (it.linkNext ? 'bg-muscu text-white shadow-sm' : 'bg-sage-100 text-ink-soft')
                          }
                        >
                          {it.linkNext ? '🔗 Superset — enchaîné sans repos' : '+ lier en superset'}
                        </button>
                        {!it.linkNext && (
                          <button
                            type="button"
                            title="Couper la séance ici : la suite forme un bloc avec ses propres tours"
                            onClick={() => {
                              setItem(idx + 1, { blockBreak: true, blockRounds: items[idx + 1].blockRounds ?? 1 })
                              setItem(idx, { linkNext: false })
                            }}
                            className="relative z-10 rounded-full bg-sage-100 px-3 py-1 text-[11px] font-extrabold text-ink-soft"
                          >
                            ▦ nouveau bloc
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              <Combobox
                small
                value={addQuery}
                onChange={setAddQuery}
                options={catExercises.map((e) => ({ id: e.id, label: e.name, hint: subtypesOf(e)[0] }))}
                onSelect={(exId) => {
                  appendItem(exId)
                  setAddQuery('')
                }}
                onCreate={(text) => {
                  void quickCreate(text)
                  setAddQuery('')
                }}
                placeholder={category === 'etirements' ? '+ Ajouter ou créer une posture…' : '+ Ajouter ou créer un exercice…'}
              />
              {category === 'hiit' && items.length > 0 && (
                <p className="text-center text-xs font-semibold text-ink-soft">
                  {items.length} exercice{items.length > 1 ? 's' : ''} × {rounds} tour{rounds > 1 ? 's' : ''} ·{' '}
                  {workSec}s d'effort / {restSec}s de repos
                </p>
              )}
            </div>
          </Field>
        )}
      </div>

      <FormActions
        onSave={() => void save()}
        saveDisabled={!name.trim()}
        onDuplicate={existing ? () => void duplicate() : undefined}
        onDelete={existing ? () => void del() : undefined}
      />
    </div>
  )
}
