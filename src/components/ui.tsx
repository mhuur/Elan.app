import { useEffect, useRef, useState, type ReactNode } from 'react'

export function PageHeader({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between px-5 pt-8 pb-4">
      <div>
        {kicker && <p className="text-xs font-bold uppercase tracking-widest text-sage-500">{kicker}</p>}
        <h1 className="mt-1 text-2xl font-extrabold text-ink first-letter:uppercase">{title}</h1>
      </div>
      {right}
    </header>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
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
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink-soft">{label}</span>
      {children}
    </label>
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

export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="rounded-3xl bg-surface px-6 py-10 text-center shadow-sm">
      <div className="text-4xl">{emoji}</div>
      <p className="mt-3 text-sm font-semibold text-ink-soft">{text}</p>
    </div>
  )
}
