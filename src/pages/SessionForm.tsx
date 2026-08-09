import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS, getEventCoordinates } from '@dnd-kit/utilities'
import { GripVertical, LayoutGrid, Link2, MessageSquarePlus, Plus, Repeat, SlidersHorizontal, Timer, X } from 'lucide-react'
import { useData } from '../data/DataContext'
import {
  CATEGORIES,
  CATEGORY_META,
  setTargetsOf,
  subtypesOf,
  type Category,
  type Measure,
  type SessionItem,
} from '../types'
import { DAY_LETTER, DAY_NAMES, todayStr } from '../lib/dates'
import { canonicalCycles, cycleStepsOf, ownerOf } from '../lib/schedule'
import { CategoryIcon, Combobox, Eyebrow, Field, FormActions, PageHeader, Seg, Select, Sheet, Stepper, TextInput, glassCard } from '../components/ui'
import ExercisePicker from '../components/ExercisePicker'

const smallInput =
  'rounded-xl border border-sand bg-shoal px-3 py-2.5 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-soft/50 focus:border-sage-400'

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
      className="w-11 rounded-lg border border-sand bg-sage-50/60 py-1.5 text-center text-sm font-extrabold tabular-nums outline-none focus:border-sage-400 focus:bg-shoal"
    />
  )
}

/** Item en cours d'édition : un uid transitoire identifie la ligne pour le drag & drop */
type DraftItem = SessionItem & { uid: string }
const newUid = () => crypto.randomUUID()

/** Enveloppe sortable d'une ligne d'exercice — la poignée reçoit attributes/listeners.
 * Pendant un drag, la vignette qui suit le doigt est le DragOverlay : l'original reste
 * dans la liste en fantôme (opacity) et matérialise l'emplacement d'atterrissage. */
function SortableItem({
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
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-30' : undefined}
    >
      {children({ attributes, listeners })}
    </div>
  )
}

/**
 * La vignette reste centrée sous le curseur, alignée sur la colonne (x figé).
 * Indispensable avec le repli des cartes : dnd-kit ancre l'overlay sur le rect
 * mesuré AVANT le repli, et la liste remonte de toute la hauteur perdue — sans
 * cette compensation la vignette flotte à des centimètres du pointeur et le
 * dépôt devient imprécis. Même transform pour la détection de collision.
 */
const followCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !activatorEvent) return { ...transform, x: 0 }
  const grab = getEventCoordinates(activatorEvent)
  if (!grab) return { ...transform, x: 0 }
  return {
    ...transform,
    x: 0,
    y: transform.y + (grab.y - draggingNodeRect.top) - draggingNodeRect.height / 2,
  }
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
  // Cadence du cycle d'alternance : « tous les X jours » ou sur des jours de semaine fixes
  const [intervalKind, setIntervalKind] = useState<'every' | 'weekdays'>(cycleOwner?.repeat?.onDays?.length ? 'weekdays' : 'every')
  const [onDays, setOnDays] = useState<number[]>(cycleOwner?.repeat?.onDays ?? [])
  // Rotation en cours d'édition : un tableau de « jours », chacun regroupant
  // les séances faites ensemble ce jour-là (selfKey = cette séance).
  const [steps, setSteps] = useState<string[][]>(() => (ownerSteps.length ? ownerSteps : [[selfKey]]))
  // `comment: ''` (un commentaire ajouté puis laissé vide — Firestore stocke les champs vidés
  // comme '') redevient « pas de commentaire » : le champ ne s'affiche que s'il y a du texte.
  const [items, setItems] = useState<DraftItem[]>(() =>
    (existing?.items ?? []).map((it) => ({ ...it, comment: it.comment || undefined, uid: newUid() })),
  )
  const [workSec, setWorkSec] = useState(existing?.workSec ?? 45)
  const [restSec, setRestSec] = useState(existing?.restSec ?? 15)
  const [rounds, setRounds] = useState(existing?.rounds ?? 2)
  const [stretchRest, setStretchRest] = useState(existing?.category === 'etirements' ? (existing.restSec ?? 0) : 5)
  const [stretchRounds, setStretchRounds] = useState(existing?.category === 'etirements' ? (existing.rounds ?? 1) : 1)
  const [muscuRounds, setMuscuRounds] = useState(existing?.category === 'muscu' ? (existing.rounds ?? 1) : 1)
  const [group, setGroup] = useState(existing?.group ?? '')
  // Sheet mobile du sélecteur d'exercices (sur desktop le volet est permanent)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Sections déjà utilisées dans le planning, proposées dans la combobox
  const groupSuggestions = [...new Set(sessions.map((s) => (s.group ?? '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  )

  // --- Édition de la rotation (le sélecteur d'ajout n'apparaît qu'au tap sur +)
  const usedIds = new Set(steps.flat())
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const addToStep = (si: number, id: string) => setSteps((p) => p.map((st, i) => (i === si ? [...st, id] : st)))
  const removeFromStep = (si: number, id: string) =>
    setSteps((p) => p.map((st, i) => (i === si ? st.filter((x) => x !== id) : st)).filter((st, i) => st.length > 0 || i !== si))
  const addStep = () => {
    setAddingDay(steps.length)
    setSteps((p) => [...p, []])
  }
  const removeStep = (si: number) => {
    setAddingDay(null)
    setSteps((p) => p.filter((_, i) => i !== si))
  }

  const catExercises = exercises.filter((e) => e.category === category)
  const exOf = (exId: string) => exercises.find((e) => e.id === exId)
  const hasItems = category === 'muscu' || category === 'hiit' || category === 'etirements'
  // Blocs (muscu ET étirements) : découpage de la séance en groupes répétés indépendamment
  const canBlocks = category === 'muscu' || category === 'etirements'
  const hasBreaks = canBlocks && items.some((it, i) => i > 0 && it.blockBreak)
  const catMeta = CATEGORY_META[category]
  // Groupes de blocs pour l'affichage et le drag & drop (un seul bloc si pas de découpage)
  const blocksArr: DraftItem[][] = []
  items.forEach((it, i) => {
    if (i === 0 || (hasBreaks && it.blockBreak)) blocksArr.push([])
    blocksArr[blocksArr.length - 1].push(it)
  })
  const blockStarts: number[] = []
  {
    let acc = 0
    for (const b of blocksArr) {
      blockStarts.push(acc)
      acc += b.length
    }
  }

  const switchCategory = (c: Category) => {
    if (c === category) return
    if (items.length && !window.confirm('Changer de catégorie videra la liste des exercices de la séance. Continuer ?')) return
    setCategory(c)
    setItems([])
  }

  const toggleDay = (d: number) =>
    setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)))
  const toggleOnDay = (d: number) =>
    setOnDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)))

  /**
   * Ajoute un exercice existant à la séance avec les réglages par défaut de la
   * catégorie. `measure` évite de dépendre de `exercises` pour un exercice qui
   * vient d'être créé (l'abonnement du store peut ne pas l'avoir encore livré).
   */
  const appendItem = (exId: string, measure?: Measure) => {
    const m = measure ?? exOf(exId)?.measure
    const base: DraftItem = { exerciseId: exId, uid: newUid() }
    if (category === 'muscu') {
      base.sets = 3
      base.target = m === 'sec' ? 30 : 10
      base.restSec = 60
    }
    if (category === 'etirements') {
      // Posture tenue (sec) ou mouvement compté (reps), selon la mesure de l'exercice
      if (m === 'reps') base.target = 10
      else base.durationSec = 30
    }
    setItems((p) => [...p, base])
  }

  /** Crée un exercice à la volée (mini-ligne du sélecteur) et l'ajoute à la séance */
  const quickCreate = async ({ name: nm, subtype, measure }: { name: string; subtype: string; measure: Measure }) => {
    if (!nm) return
    const exId = await addExercise({
      name: nm,
      category,
      subtypes: subtype ? [subtype] : [],
      subtype: '',
      measure,
      description: '',
      videoUrl: '',
      createdAt: Date.now(),
    })
    appendItem(exId, measure)
  }

  // Occurrences de chaque exercice déjà dans la séance (coches du sélecteur)
  const itemCounts = new Map<string, number>()
  for (const it of items) itemCounts.set(it.exerciseId, (itemCounts.get(it.exerciseId) ?? 0) + 1)

  const setItem = (idx: number, patch: Partial<SessionItem>) =>
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx))

  // Drag & drop de la liste d'exercices (mêmes réglages tactiles que le Planning).
  // Pendant un drag (`dragId` posé), toutes les cartes se replient sur leur ligne de titre :
  // hauteurs uniformes → les échanges deviennent progressifs au lieu de sauter de la hauteur
  // d'une carte pleine, et la liste entière reste visible pour viser.
  const [dragId, setDragId] = useState<string | null>(null)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const aId = String(active.id)
    const oId = String(over.id)
    if (aId.startsWith('blk-')) {
      // Déplacer un bloc entier (glissé par son en-tête)
      setItems((p) => {
        const bl: DraftItem[][] = []
        p.forEach((it, i) => {
          if (i === 0 || it.blockBreak) bl.push([])
          bl[bl.length - 1].push(it)
        })
        const from = bl.findIndex((b) => 'blk-' + b[0].uid === aId)
        let to = bl.findIndex((b) => 'blk-' + b[0].uid === oId)
        if (to === -1) to = bl.findIndex((b) => b.some((x) => x.uid === oId))
        if (from === -1 || to === -1 || from === to) return p
        return arrayMove(bl, from, to).flatMap((b, bi) =>
          b.map((it, i) =>
            i === 0 ? { ...it, blockBreak: bi > 0, blockRounds: Math.max(1, it.blockRounds ?? 1) } : it,
          ),
        )
      })
      return
    }
    // Déplacer un exercice — si c'était la tête d'un bloc, le suivant hérite du bloc
    setItems((p) => {
      const from = p.findIndex((x) => x.uid === aId)
      let to = p.findIndex((x) => x.uid === oId)
      if (to === -1 && oId.startsWith('blk-')) to = p.findIndex((x) => 'blk-' + x.uid === oId)
      if (from === -1 || to === -1) return p
      let list = [...p]
      const moved = list[from]
      if (moved.blockBreak || from === 0) {
        const next = list[from + 1]
        if (next && !next.blockBreak) {
          list[from + 1] = { ...next, blockBreak: from > 0, blockRounds: moved.blockRounds ?? 1 }
        }
        list[from] = { ...moved, blockBreak: false, blockRounds: undefined }
      }
      list = arrayMove(list, from, to)
      if (list[0]?.blockBreak) list[0] = { ...list[0], blockBreak: false }
      return list
    })
  }

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
            ...(cycleOwner.repeat.onDays?.length ? { onDays: cycleOwner.repeat.onDays } : {}),
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
    await updateSession(ownerId, {
      repeat: {
        everyDays,
        startDate,
        ...(intervalKind === 'weekdays' && onDays.length ? { onDays: [...onDays].sort((a, b) => a - b) } : {}),
        steps: cleanSteps.map((ids) => ({ ids })),
      },
    })
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
          repeat: {
            everyDays: s.repeat.everyDays,
            startDate: s.repeat.startDate,
            ...(s.repeat.onDays?.length ? { onDays: s.repeat.onDays } : {}),
            steps: kept.map((ids) => ({ ids })),
          },
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
      items: hasItems ? items.map(({ uid: _uid, ...rest }) => rest) : [],
      // Mesures, liens et notes ne s'éditent plus ici : on conserve l'existant
      metrics: existing?.metrics ?? [],
      links: existing?.links ?? [],
      notes: existing?.notes ?? '',
      group: group.trim(),
      sortOrder: existing?.sortOrder ?? maxOrder + 1,
      createdAt: existing?.createdAt ?? Date.now(),
      ...(category === 'hiit' ? { workSec, restSec, rounds } : {}),
      ...(category === 'etirements' ? { restSec: stretchRest, rounds: stretchRounds } : {}),
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
    // Avec des exercices à composer, l'écran passe en deux colonnes dès `lg` :
    // formulaire à gauche, banque d'exercices en volet permanent à droite —
    // l'espace desktop sert à composer au lieu de rester vide (audit août 2026).
    <div
      className={
        hasItems
          ? // Pas de `items-start` : l'aside doit s'étirer sur toute la hauteur de la
            // colonne formulaire, sinon son panneau sticky n'a aucune course pour coller
            'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-6 lg:pr-6'
          : 'mx-auto max-w-lg'
      }
    >
      <div className="min-w-0">
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
                  {CATEGORY_META[c].label}
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
                    (days.includes(d) ? 'bg-sage-500 text-onaccent shadow-sm' : 'bg-sage-100 text-sage-700')
                  }
                >
                  {letter}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <Seg
                options={[
                  { value: 'every' as const, label: 'Tous les X jours' },
                  { value: 'weekdays' as const, label: 'Jours de semaine' },
                ]}
                value={intervalKind}
                onChange={setIntervalKind}
              />
              {intervalKind === 'every' ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm font-semibold text-ink-soft">
                  <span>Tous les</span>
                  <MiniNum value={everyDays} onChange={setEveryDays} min={1} max={30} />
                  <span>jour{everyDays > 1 ? 's' : ''}</span>
                </div>
              ) : (
                <div>
                  <div className="flex gap-1.5">
                    {DAY_LETTER.map((letter, d) => (
                      <button
                        key={d}
                        type="button"
                        title={DAY_NAMES[d]}
                        onClick={() => toggleOnDay(d)}
                        className={
                          'h-10 flex-1 rounded-xl text-sm font-extrabold transition-colors ' +
                          (onDays.includes(d) ? 'bg-sage-500 text-onaccent shadow-sm' : 'bg-sage-100 text-sage-700')
                        }
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-ink-soft/70">
                    L'alternance se pose sur ces jours — pratique pour éviter les jours de course.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm font-semibold text-ink-soft">
                <span>À partir du</span>
                <input
                  type="date"
                  aria-label="Date de départ du cycle"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value || todayStr())}
                  className="rounded-lg border border-sand bg-shoal px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-sage-400"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-soft">
                    Rotation <span className="text-ink-soft/50">— on recommence après le dernier jour</span>
                  </p>
                  <button
                    type="button"
                    onClick={addStep}
                    className="flex items-center gap-0.5 text-xs font-extrabold text-sage-600 active:text-sage-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> jour
                  </button>
                </div>
                <div className="mt-1.5 space-y-1.5">
                  {steps.map((st, si) => (
                    <div key={si} className="rounded-xl bg-surface px-3 py-2 shadow-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="w-6 shrink-0 text-[11px] font-extrabold uppercase text-ink-soft/60">
                          J{si + 1}
                        </span>
                        {st.map((sid) => {
                          if (sid === selfKey) {
                            return (
                              <span key={sid} className="rounded-full bg-sage-500 px-2.5 py-1 text-xs font-extrabold text-onaccent">
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
                              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${meta.soft} ${meta.text}`}
                            >
                              <CategoryIcon category={x.category} className="h-3 w-3" /> {x.name}
                              <X className="h-3 w-3 opacity-50" />
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          aria-label={`Ajouter une séance au jour ${si + 1}`}
                          onClick={() => setAddingDay(addingDay === si ? null : si)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-100 text-sage-700 active:bg-sage-200"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        {!st.includes(selfKey) && steps.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Retirer le jour ${si + 1}`}
                            onClick={() => removeStep(si)}
                            className="ml-auto px-0.5 text-ink-soft/40"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {addingDay === si && (
                        <div className="mt-2">
                          <Select
                            value=""
                            onChange={(v) => {
                              if (v) {
                                addToStep(si, v)
                                setAddingDay(null)
                              }
                            }}
                          >
                            <option value="">Choisir une séance…</option>
                            {sessions
                              .filter((s) => s.id !== existing?.id && !usedIds.has(s.id))
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </Select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Field>

        {category === 'hiit' && (
          <div className="rounded-md border border-hairline bg-glass p-3.5 backdrop-blur-lg">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="mb-1 text-xs font-bold text-ink-soft">Effort</p>
                <Stepper value={workSec} onChange={setWorkSec} min={5} step={5} suffix="s" small />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold text-ink-soft">Repos</p>
                <Stepper value={restSec} onChange={setRestSec} min={0} step={5} suffix="s" small />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold text-ink-soft">Tours</p>
                <Stepper value={rounds} onChange={setRounds} min={1} small />
              </div>
            </div>
          </div>
        )}

        {category === 'etirements' && (
          <div className="space-y-3 rounded-md border border-hairline bg-glass p-3.5 backdrop-blur-lg">
            {!hasBreaks && (
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-extrabold" title="Refaire toute la routine à la suite">
                  <Repeat className="h-4 w-4 text-etirements" /> Tours de la routine
                </p>
                <Stepper value={stretchRounds} onChange={setStretchRounds} min={1} max={10} small />
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-extrabold">
                <Timer className="h-4 w-4 text-etirements" /> Transition entre postures
              </p>
              <Stepper value={stretchRest} onChange={setStretchRest} min={0} step={5} suffix="s" small />
            </div>
          </div>
        )}

        {category === 'muscu' && !hasBreaks && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-glass p-3.5 backdrop-blur-lg">
            <p
              className="flex items-center gap-2 text-sm font-extrabold"
              title="Refaire toute la liste d'exercices à la suite"
            >
              <Repeat className="h-4 w-4 text-muscu" /> Tours du circuit
            </p>
            <Stepper value={muscuRounds} onChange={setMuscuRounds} min={1} max={10} small />
          </div>
        )}

        {hasItems && (
          <Field label={category === 'etirements' ? 'Postures de la routine' : 'Exercices de la séance'}>
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              modifiers={[followCursor]}
              // Les cartes se replient au dragStart : il faut re-mesurer les cibles en continu,
              // sinon dnd-kit calcule les échanges sur les hauteurs des cartes dépliées
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
              onDragStart={(e) => setDragId(String(e.active.id))}
              onDragCancel={() => setDragId(null)}
              onDragEnd={(e) => {
                setDragId(null)
                onDragEnd(e)
              }}
            >
              <SortableContext items={blocksArr.map((b) => 'blk-' + b[0].uid)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {blocksArr.map((blk, bi) => (
                    <SortableItem key={'blk-' + blk[0].uid} uid={'blk-' + blk[0].uid}>
                      {(blockDrag) => (
                        <div className="space-y-2">
                          {hasBreaks && (
                            <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 ${catMeta.soft}`}>
                              <p className={`flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase ${catMeta.text}`}>
                                <button
                                  type="button"
                                  aria-label={`Déplacer le bloc ${bi + 1}`}
                                  {...blockDrag.attributes}
                                  {...blockDrag.listeners}
                                  className="-ml-1 cursor-grab touch-none active:cursor-grabbing"
                                >
                                  <GripVertical className="h-3.5 w-3.5" />
                                </button>
                                <LayoutGrid className="h-3.5 w-3.5" /> Bloc {bi + 1} — tours
                              </p>
                              <div className="flex items-center gap-1.5">
                                <Stepper
                                  small
                                  value={items[blockStarts[bi]]?.blockRounds ?? 1}
                                  onChange={(v) => setItem(blockStarts[bi], { blockRounds: v })}
                                  min={1}
                                  max={10}
                                />
                                {bi > 0 && (
                                  <button
                                    type="button"
                                    aria-label="Fusionner avec le bloc précédent"
                                    title="Fusionner avec le bloc précédent"
                                    onClick={() => setItem(blockStarts[bi], { blockBreak: false })}
                                    className="px-1 text-ink-soft/50"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          <SortableContext items={blk.map((x) => x.uid)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                              {blk.map((it, ii) => {
                                const idx = blockStarts[bi] + ii
                                const ex = exOf(it.exerciseId)
                                const isSec = ex?.measure === 'sec'
                                return (
                                  <SortableItem key={it.uid} uid={it.uid}>
                                    {(drag) => (
                                      <div>
                    <div className={'rounded-md border border-hairline bg-glass backdrop-blur-lg ' + (dragId ? 'px-3 py-1' : 'p-3')}>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Réordonner ${ex?.name ?? 'cet exercice'}`}
                          {...drag.attributes}
                          {...drag.listeners}
                          className="-ml-1.5 flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-ink-soft/40 active:cursor-grabbing"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <p className="min-w-0 flex-1 truncate py-1 text-[15px] font-extrabold text-ink">{ex?.name ?? '—'}</p>
                        {ex && subtypesOf(ex)[0] && (
                          <span className="max-w-24 shrink-0 truncate text-[11px] font-bold text-ink-soft/60">
                            {subtypesOf(ex)[0]}
                          </span>
                        )}
                        {it.comment === undefined && (
                          <button
                            type="button"
                            aria-label="Ajouter un commentaire"
                            onClick={() => setItem(idx, { comment: '' })}
                            className="px-0.5 text-ink-soft/40"
                          >
                            <MessageSquarePlus className="h-4 w-4" />
                          </button>
                        )}
                        <button type="button" aria-label="Retirer" onClick={() => removeItem(idx)} className="px-0.5 text-ink-soft/40">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {!dragId && category === 'muscu' && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1 text-xs font-bold text-ink-soft">
                          <MiniNum
                            value={it.sets ?? 3}
                            onChange={(v) => {
                              const patch: Partial<SessionItem> = { sets: v }
                              if (it.targets) patch.targets = setTargetsOf({ ...it, sets: v })
                              setItem(idx, patch)
                            }}
                            min={1}
                            max={12}
                          />
                          <span className="text-ink-soft/60">×</span>
                          {it.targets ? (
                            setTargetsOf(it).map((t, s) => (
                              <MiniNum
                                key={s}
                                value={t}
                                onChange={(v) =>
                                  setItem(idx, { targets: setTargetsOf(it).map((x, j) => (j === s ? v : x)) })
                                }
                                min={1}
                              />
                            ))
                          ) : (
                            <MiniNum value={it.target ?? 10} onChange={(v) => setItem(idx, { target: v })} min={1} />
                          )}
                          <button
                            type="button"
                            title="Basculer répétitions / secondes"
                            onClick={() => ex && void updateExercise(ex.id, { measure: isSec ? 'reps' : 'sec' })}
                            className="rounded-md bg-sage-100 px-2 py-1 text-[11px] font-extrabold text-sage-700 active:bg-sage-200"
                          >
                            {isSec ? 'sec' : 'reps'}
                          </button>
                          <button
                            type="button"
                            aria-label="Varier les séries"
                            title={
                              it.targets
                                ? 'Revenir à des séries identiques'
                                : 'Varier l’objectif de chaque série (ex. 30 / 20 / 15)'
                            }
                            onClick={() =>
                              setItem(
                                idx,
                                it.targets
                                  ? { targets: undefined, target: setTargetsOf(it)[0] }
                                  : { targets: setTargetsOf(it) },
                              )
                            }
                            className={
                              'rounded-md px-1.5 py-1 ' +
                              (it.targets ? 'bg-sage-500 text-onaccent' : 'bg-sage-100 text-sage-700 active:bg-sage-200')
                            }
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </button>
                          <span className="ml-auto flex items-center gap-1.5" title="Repos entre séries">
                            <Timer className="h-3.5 w-3.5 text-ink-soft/60" />
                            <MiniNum value={it.restSec ?? 60} onChange={(v) => setItem(idx, { restSec: v })} max={600} />
                            <span>s</span>
                          </span>
                        </div>
                      )}

                      {!dragId && category === 'etirements' && (
                        <div className="mt-2 flex items-center gap-1.5 pl-1 text-xs font-bold text-ink-soft">
                          {/* Séries de la posture : 2 × 30 s pour un étirement fait des deux côtés */}
                          <MiniNum
                            value={it.sets ?? 1}
                            onChange={(v) => setItem(idx, { sets: v })}
                            min={1}
                            max={6}
                          />
                          <span>×</span>
                          {!ex || isSec ? (
                            <>
                              <MiniNum
                                value={it.durationSec ?? 30}
                                onChange={(v) => setItem(idx, { durationSec: v })}
                                min={5}
                              />
                              <span>s</span>
                            </>
                          ) : (
                            <>
                              <MiniNum value={it.target ?? 10} onChange={(v) => setItem(idx, { target: v })} min={1} />
                              <span>répétitions</span>
                            </>
                          )}
                          <button
                            type="button"
                            title="Basculer secondes / répétitions (modifie l'exercice)"
                            onClick={() => ex && void updateExercise(ex.id, { measure: isSec ? 'reps' : 'sec' })}
                            className="ml-auto rounded-md bg-sage-100 px-2 py-1 text-[11px] font-extrabold text-sage-700 active:bg-sage-200"
                          >
                            {isSec ? 'sec' : 'reps'}
                          </button>
                        </div>
                      )}

                      {!dragId && it.comment !== undefined && (
                        <input
                          type="text"
                          value={it.comment}
                          onChange={(e) => setItem(idx, { comment: e.target.value })}
                          onBlur={() => {
                            // Laissé vide → le champ se replie en bouton [+], et rien n'est persisté
                            if (!it.comment?.trim()) setItem(idx, { comment: undefined })
                          }}
                          autoFocus={it.comment === ''}
                          placeholder="Commentaire (tempo, consigne…)"
                          className={smallInput + ' mt-2 w-full py-2'}
                        />
                      )}
                    </div>

                    {!dragId && canBlocks && idx < items.length - 1 && !items[idx + 1].blockBreak && (
                      <div className="-my-0.5 flex justify-center gap-1.5">
                        {category === 'muscu' && (
                          <button
                            type="button"
                            onClick={() => setItem(idx, { linkNext: !it.linkNext })}
                            className={
                              'relative z-10 flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold transition-colors ' +
                              (it.linkNext ? 'bg-muscu text-onaccent shadow-sm' : 'bg-sage-100 text-ink-soft')
                            }
                          >
                            <Link2 className="h-3 w-3" />
                            {it.linkNext ? 'Superset — enchaîné sans repos' : 'superset'}
                          </button>
                        )}
                        {!it.linkNext && (
                          <button
                            type="button"
                            title="Couper la séance ici : la suite forme un bloc avec ses propres tours"
                            onClick={() => {
                              setItem(idx + 1, { blockBreak: true, blockRounds: items[idx + 1].blockRounds ?? 1 })
                              setItem(idx, { linkNext: false })
                            }}
                            className="relative z-10 flex items-center gap-1 rounded-full bg-sage-100 px-3 py-1 text-[11px] font-extrabold text-ink-soft"
                          >
                            <LayoutGrid className="h-3 w-3" /> nouveau bloc
                          </button>
                        )}
                      </div>
                    )}
                                      </div>
                                    )}
                                  </SortableItem>
                                )
                              })}
                            </div>
                          </SortableContext>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
              {/* La vignette qui suit le doigt : compacte et opaque, elle ne cache plus la liste */}
              <DragOverlay>
                {dragId &&
                  (() => {
                    if (dragId.startsWith('blk-')) {
                      const bi = blocksArr.findIndex((b) => 'blk-' + b[0].uid === dragId)
                      if (bi === -1) return null
                      return (
                        <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 shadow-xl backdrop-blur-lg ${catMeta.soft}`}>
                          <p className={`flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase ${catMeta.text}`}>
                            <GripVertical className="h-3.5 w-3.5" />
                            <LayoutGrid className="h-3.5 w-3.5" /> Bloc {bi + 1} · {blocksArr[bi].length} exo
                            {blocksArr[bi].length > 1 ? 's' : ''}
                          </p>
                        </div>
                      )
                    }
                    const it = items.find((x) => x.uid === dragId)
                    const ex = it && exOf(it.exerciseId)
                    return (
                      <div className="flex items-center gap-1.5 rounded-md border border-hairline bg-shoal px-3 py-1 shadow-xl">
                        <GripVertical className="h-4 w-4 shrink-0 text-ink-soft/40" />
                        <p className="min-w-0 flex-1 truncate py-1 text-[15px] font-extrabold text-ink">{ex?.name ?? '—'}</p>
                      </div>
                    )
                  })()}
              </DragOverlay>
            </DndContext>
            <div className="mt-2 space-y-2">
              {/* Sur mobile, le sélecteur s'ouvre en Sheet ; sur desktop il est déjà là, en volet */}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full rounded-sm border border-hairline bg-glass-sunken px-4 py-3 text-left text-sm text-ink/50 backdrop-blur-lg active:bg-glass lg:hidden"
              >
                {category === 'etirements' ? '+ Ajouter ou créer une posture…' : '+ Ajouter ou créer un exercice…'}
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
        </div>
      </div>

      {hasItems && (
        <aside className="hidden lg:block lg:pt-[4.5rem]">
          {/* Sticky : la banque reste sous les yeux pendant tout le défilement du formulaire */}
          <div className={'sticky top-5 flex max-h-[calc(100dvh-8rem)] flex-col p-4 ' + glassCard}>
            <Eyebrow className="mb-2.5 text-ink/50">— Banque d'exercices</Eyebrow>
            <ExercisePicker
              exercises={catExercises}
              category={category}
              counts={itemCounts}
              onAdd={appendItem}
              onCreate={(d) => void quickCreate(d)}
            />
          </div>
        </aside>
      )}

      <Sheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={category === 'etirements' ? 'Ajouter des postures' : 'Ajouter des exercices'}
      >
        {/* Hauteur bornée : la recherche reste en tête, seule la liste défile */}
        <div className="flex max-h-[62dvh] min-h-[45dvh] flex-col">
          <ExercisePicker
            exercises={catExercises}
            category={category}
            counts={itemCounts}
            onAdd={appendItem}
            onCreate={(d) => void quickCreate(d)}
          />
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(false)}
          className="mt-4 w-full rounded-sm bg-sage-500 py-3 font-mono text-[11px] font-bold tracking-[0.14em] uppercase text-onaccent"
        >
          Terminé
        </button>
      </Sheet>

      <FormActions
        onSave={() => void save()}
        saveDisabled={!name.trim()}
        onDuplicate={existing ? () => void duplicate() : undefined}
        onDelete={existing ? () => void del() : undefined}
      />
    </div>
  )
}
