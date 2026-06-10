import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, type Category, type SessionItem } from '../types'
import { DAY_LETTER, DAY_NAMES } from '../lib/dates'
import { Chip, Field, GhostButton, NumInput, PrimaryButton, Stepper, TextArea, TextInput } from '../components/ui'

export default function SessionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sessions, exercises, addSession, updateSession, removeSession } = useData()
  const existing = sessions.find((s) => s.id === id)

  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState<Category>(existing?.category ?? 'muscu')
  const [days, setDays] = useState<number[]>(existing?.days ?? [])
  const [items, setItems] = useState<SessionItem[]>(existing?.items ?? [])
  const [workSec, setWorkSec] = useState(existing?.workSec ?? 45)
  const [restSec, setRestSec] = useState(existing?.restSec ?? 15)
  const [rounds, setRounds] = useState(existing?.rounds ?? 2)
  const [targetPowerW, setTargetPowerW] = useState<number | undefined>(existing?.targetPowerW)
  const [targetDurationMin, setTargetDurationMin] = useState<number | undefined>(existing?.targetDurationMin)
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const catExercises = exercises.filter((e) => e.category === category)
  const exOf = (exId: string) => exercises.find((e) => e.id === exId)
  const hasItems = category === 'muscu' || category === 'hiit' || category === 'etirements'

  const switchCategory = (c: Category) => {
    if (c === category) return
    if (items.length && !window.confirm('Changer de catégorie videra la liste des exercices de la séance. Continuer ?')) return
    setCategory(c)
    setItems([])
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
    }
    if (category === 'etirements') base.durationSec = 30
    setItems((p) => [...p, base])
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

  const save = async () => {
    const data = {
      name: name.trim() || 'Séance',
      category,
      days,
      items: hasItems ? items : [],
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? Date.now(),
      ...(category === 'hiit' ? { workSec, restSec, rounds } : {}),
      ...(category === 'velo' ? { targetPowerW, targetDurationMin } : {}),
    }
    if (existing) await updateSession(existing.id, data)
    else await addSession(data)
    navigate(-1)
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

        <Field label="Jours de la semaine">
          <div className="flex gap-1.5">
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
        </Field>

        {category === 'velo' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Puissance cible">
              <NumInput value={targetPowerW} onChange={setTargetPowerW} suffix="W" placeholder="120" />
            </Field>
            <Field label="Durée cible">
              <NumInput value={targetDurationMin} onChange={setTargetDurationMin} suffix="min" placeholder="30" />
            </Field>
          </div>
        )}

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

        {hasItems && (
          <Field label={category === 'etirements' ? 'Postures de la routine' : 'Exercices de la séance'}>
            <div className="space-y-2">
              {items.map((it, idx) => {
                const ex = exOf(it.exerciseId)
                return (
                  <div key={idx} className="rounded-2xl bg-sage-50 p-3">
                    <div className="flex items-center gap-2">
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
                        className="min-w-0 flex-1 rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-bold outline-none focus:border-sage-400"
                      >
                        {catExercises.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                        {ex && ex.category !== category && <option value={ex.id}>{ex.name}</option>}
                      </select>
                      <button type="button" aria-label="Retirer" onClick={() => removeItem(idx)} className="px-1 text-ink-soft/60">
                        ✕
                      </button>
                    </div>

                    {category === 'muscu' && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-center">
                          <p className="mb-1 text-xs font-bold text-ink-soft">Séries</p>
                          <Stepper value={it.sets ?? 3} onChange={(v) => setItem(idx, { sets: v })} min={1} />
                        </div>
                        <div className="text-center">
                          <p className="mb-1 text-xs font-bold text-ink-soft">{ex?.measure === 'sec' ? 'Secondes' : 'Répétitions'}</p>
                          <Stepper
                            value={it.target ?? 10}
                            onChange={(v) => setItem(idx, { target: v })}
                            min={1}
                            step={ex?.measure === 'sec' ? 5 : 1}
                          />
                        </div>
                      </div>
                    )}

                    {category === 'etirements' && (
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs font-bold text-ink-soft">Durée de la posture</p>
                        <Stepper value={it.durationSec ?? 30} onChange={(v) => setItem(idx, { durationSec: v })} min={5} step={5} suffix="s" />
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
              {category === 'hiit' && items.length > 0 && (
                <p className="text-center text-xs font-semibold text-ink-soft">
                  {items.length} exercice{items.length > 1 ? 's' : ''} × {rounds} tour{rounds > 1 ? 's' : ''} ·{' '}
                  {workSec}s d'effort / {restSec}s de repos
                </p>
              )}
            </div>
          </Field>
        )}

        <Field label="Notes (optionnel)">
          <TextArea value={notes} onChange={setNotes} rows={2} placeholder="Ex. 8 × 400 m, récup 1 min" />
        </Field>

        <div className="space-y-2 pt-2 pb-4">
          <PrimaryButton onClick={() => void save()} disabled={!name.trim()}>
            Enregistrer
          </PrimaryButton>
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
