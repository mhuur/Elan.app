import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Bike, Copy, Dumbbell, Flame, Footprints, StretchHorizontal, Trash2, type LucideIcon } from 'lucide-react'
import type { Category } from '../types'

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  running: Footprints,
  velo: Bike,
  muscu: Dumbbell,
  hiit: Flame,
  etirements: StretchHorizontal,
}

/** Icône Lucide d'une catégorie — la couleur vient du parent (classe `text-*` de CATEGORY_META) */
export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = CATEGORY_ICONS[category]
  return <Icon className={className ?? 'h-4 w-4'} strokeWidth={2.25} />
}

export function PageHeader({ kicker, title, right, onBack }: { kicker?: string; title: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <header className={'flex justify-between px-5 pt-8 pb-4 ' + (onBack ? 'items-center' : 'items-end')}>
      <div className={onBack ? 'flex items-center gap-3' : ''}>
        {onBack && (
          <button type="button" aria-label="Retour" onClick={onBack} className="rounded-full bg-surface p-2.5 shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        <div>
          {kicker && <p className="text-[11px] font-extrabold uppercase tracking-widest text-sage-500">{kicker}</p>}
          <h1 className={(kicker ? 'mt-1 ' : '') + (onBack ? 'text-xl' : 'text-2xl') + ' font-extrabold text-ink first-letter:uppercase'}>
            {title}
          </h1>
        </div>
      </div>
      {right}
    </header>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-surface px-5 pt-3 pb-10 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-sand" />
        {title && <h2 className="mb-4 text-lg font-extrabold">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink-soft">{label}</p>
      {children}
    </div>
  )
}

/** Liste déroulante au style commun de l'app (`bare` = sans cadre, pour les listes compactes) */
export function Select({
  value,
  onChange,
  children,
  className,
  bare,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  className?: string
  bare?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        (bare
          ? 'bg-transparent py-1 text-[15px] font-extrabold text-ink outline-none '
          : 'rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-bold outline-none focus:border-sage-400 ') +
        (className ?? 'w-full')
      }
    >
      {children}
    </select>
  )
}

const normTxt = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * Champ texte avec suggestions filtrées au fil de la saisie (remplace les murs de chips).
 * `onCreate` ajoute une entrée « + Créer “texte” » quand rien ne correspond exactement.
 * `group` (optionnel, options pré-triées par groupe) ajoute des en-têtes de section.
 */
export function Combobox({
  value,
  onChange,
  options,
  onSelect,
  onCreate,
  placeholder,
  small,
}: {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string; hint?: string; group?: string }[]
  onSelect: (id: string) => void
  onCreate?: (text: string) => void
  placeholder?: string
  small?: boolean
}) {
  const [open, setOpen] = useState(false)
  const q = normTxt(value.trim())
  const filtered = q
    ? options.filter((o) => normTxt(o.label).includes(q) || (o.group && normTxt(o.group).includes(q)))
    : options
  const hasExact = options.some((o) => normTxt(o.label) === q)
  const canCreate = !!onCreate && q.length > 0 && !hasExact
  const showPanel = open && (filtered.length > 0 || canCreate)

  const pick = (id: string) => {
    onSelect(id)
    setOpen(false)
  }
  const create = () => {
    onCreate?.(value.trim())
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const m = filtered.find((o) => normTxt(o.label) === q) ?? (filtered.length === 1 ? filtered[0] : undefined)
            if (m) pick(m.id)
            else if (canCreate) create()
            else setOpen(false)
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        className={
          small
            ? 'w-full rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-soft/60 focus:border-sage-400'
            : inputCls
        }
      />
      {showPanel && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={(e) => {
              e.preventDefault()
              setOpen(false)
            }}
          />
          <div className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-sand bg-surface py-1 shadow-xl">
            {filtered.slice(0, 40).map((o, i, arr) => (
              <Fragment key={o.id}>
                {o.group && o.group !== arr[i - 1]?.group && (
                  <p className="bg-sage-50 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-sage-700">
                    {o.group}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => pick(o.id)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left active:bg-sage-50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-[11px] font-semibold text-ink-soft">{o.hint}</span>}
                </button>
              </Fragment>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={create}
                className="w-full px-4 py-2.5 text-left text-sm font-extrabold text-sage-600 active:bg-sage-50"
              >
                + Créer « {value.trim()} »
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl border border-sand bg-surface px-4 py-3 text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-soft/60 focus:border-sage-400'

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

export function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className={inputCls} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

export function NumInput({ value, onChange, placeholder, suffix }: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string; suffix?: string }) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        className={inputCls + (suffix ? ' pr-14' : '')}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
      {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-soft">{suffix}</span>}
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 990, step = 1, suffix, small }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; small?: boolean }) {
  // Le chiffre est saisissable directement, en plus des boutons − / +
  const [text, setText] = useState(String(value))
  const editingRef = useRef(false)
  useEffect(() => {
    if (!editingRef.current) setText(String(value))
  }, [value])
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const commit = (t: string) => {
    const n = Number(t.replace(',', '.'))
    if (t.trim() !== '' && !Number.isNaN(n)) onChange(clamp(n))
  }
  const btn = small
    ? 'h-8 w-8 shrink-0 rounded-full bg-sage-100 text-base font-extrabold text-sage-700 active:bg-sage-200'
    : 'h-11 w-11 shrink-0 rounded-full bg-sage-100 text-xl font-extrabold text-sage-700 active:bg-sage-200'
  return (
    <div className="inline-flex items-center gap-1">
      <button type="button" aria-label="Diminuer" className={btn} onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <div className="flex items-baseline">
        <input
          type="text"
          inputMode="decimal"
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
          className={
            (small ? 'w-9 text-sm' : 'w-12 text-lg') +
            ' rounded-lg border border-transparent bg-transparent text-center font-extrabold tabular-nums outline-none focus:border-sage-300 focus:bg-surface'
          }
        />
        {suffix && <span className="text-xs font-bold text-ink-soft">{suffix}</span>}
      </div>
      <button type="button" aria-label="Augmenter" className={btn} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </div>
  )
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full px-4 py-2 text-sm font-bold transition-colors ' +
        (active ? 'bg-sage-500 text-white shadow-sm' : 'bg-sage-100 text-sage-700 active:bg-sage-200')
      }
    >
      {children}
    </button>
  )
}

export function Seg<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-2xl bg-sage-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            'flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors ' +
            (o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-sage-700')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PrimaryButton({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-2xl bg-sage-500 px-5 py-4 text-base font-extrabold text-white shadow-md shadow-sage-500/25 active:bg-sage-600 disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function GhostButton({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'w-full rounded-2xl px-5 py-3.5 text-base font-bold ' +
        (danger ? 'text-hiit active:bg-hiit/10' : 'bg-sage-100 text-sage-700 active:bg-sage-200')
      }
    >
      {children}
    </button>
  )
}

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-24 right-5 z-40 rounded-full bg-sage-500 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-sage-500/30 active:bg-sage-600"
    >
      {label}
    </button>
  )
}

/** Barre d'action fixée en bas des formulaires : Enregistrer + actions secondaires en icônes */
export function FormActions({
  onSave,
  saveDisabled,
  onDuplicate,
  onDelete,
}: {
  onSave: () => void
  saveDisabled?: boolean
  onDuplicate?: () => void
  onDelete?: () => void
}) {
  const iconBtn =
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-lg shadow-sm active:bg-sage-100'
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sand bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-5 py-2.5">
        {onDelete && (
          <button type="button" aria-label="Supprimer" title="Supprimer" onClick={onDelete} className={iconBtn}>
            <Trash2 className="h-5 w-5 text-ink-soft" />
          </button>
        )}
        {onDuplicate && (
          <button type="button" aria-label="Dupliquer" title="Dupliquer" onClick={onDuplicate} className={iconBtn}>
            <Copy className="h-5 w-5 text-ink-soft" />
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className="h-12 flex-1 rounded-2xl bg-sage-500 text-base font-extrabold text-white shadow-md shadow-sage-500/25 active:bg-sage-600 disabled:opacity-40"
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}

export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="rounded-3xl bg-surface px-6 py-10 text-center shadow-sm">
      <div className="text-4xl">{emoji}</div>
      <p className="mt-3 text-sm font-semibold text-ink-soft">{text}</p>
    </div>
  )
}
