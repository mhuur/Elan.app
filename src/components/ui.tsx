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

/* ── Charte « bord de mer » ───────────────────────────────────────────────────
 * Les primitives ci-dessous portent le style : titres condensés en capitales,
 * métadonnées en mono interlettré, cartes en verre dépoli sur la photo de fond.
 * Elles sont volontairement peu paramétrables — c'est ce qui garde les écrans
 * cohérents entre eux. Voir le pavé de tête de `src/index.css`.
 */

/** Sur-titre d'écran ou de section — « ● — ÉLAN · JOUR », « — AU JOURNAL » */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={'font-mono text-[10px] tracking-[0.22em] uppercase ' + (className ?? 'text-sage-500')}>{children}</p>
  )
}

/** Titre d'écran : condensé, capitales, énorme. `size` en classe Tailwind de texte. */
export function DisplayTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={'font-display font-black uppercase text-ink ' + (className ?? 'text-6xl leading-[0.84]')}>
      {children}
    </h1>
  )
}

/** Pilule de comptage — `tone: 'accent'` pour le prévu, `'plain'` pour l'acquis */
export function Pill({ children, tone = 'plain' }: { children: ReactNode; tone?: 'accent' | 'plain' }) {
  const skin =
    tone === 'accent'
      ? 'border-sage-500/50 text-sage-700'
      : 'border-hairline-strong bg-glass-soft text-ink'
  return (
    <span className={`rounded-full border px-3 py-[5px] font-mono text-[10px] tracking-[0.16em] uppercase ${skin}`}>
      {children}
    </span>
  )
}

/** Tuile de catégorie : le code court (`ÉTIR`, `VÉLO`…) dans un carré teinté.
 *  Remplace l'icône Lucide sur les cartes de séance — la couleur vient du `hex`
 *  de `CATEGORY_META`, en style inline faute de classe Tailwind dynamique. */
export function CodeTile({ code, hex, className }: { code: string; hex: string; className?: string }) {
  return (
    <div
      className={
        'flex shrink-0 items-center justify-center rounded-xs border font-mono font-bold tracking-[0.08em] uppercase ' +
        // Les codes du plan semi vont jusqu'à « COURSE » : au-delà de 4 signes, on
        // descend d'un cran plutôt que de laisser le texte sortir du carré.
        (code.length > 4 ? 'text-[8px] ' : 'text-[10px] ') +
        (className ?? 'h-12 w-12')
      }
      style={{ backgroundColor: hex + '29', borderColor: hex + '66', color: hex }}
    >
      {code}
    </div>
  )
}

/** Carte en verre dépoli. Le `backdrop-blur` n'est pas optionnel : sans lui, le fond
 *  translucide laisse passer la photo en clair et le texte devient illisible. */
export const glassCard = 'rounded-md border border-hairline bg-glass backdrop-blur-lg'

/** Le petit carré à filet : bouton d'en-tête (réglages, navigation) ou affordance
 *  de fin de carte. Toujours 36 px — c'est la cible tactile minimale de la charte. */
export const iconSquare =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-hairline-strong bg-glass-soft backdrop-blur-lg text-ink'

export function PageHeader({ kicker, title, right, onBack }: { kicker?: string; title: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <header className={'flex justify-between px-5 pt-8 pb-4 ' + (onBack ? 'items-center' : 'items-end')}>
      <div className={onBack ? 'flex items-center gap-3' : ''}>
        {onBack && (
          <button type="button" aria-label="Retour" onClick={onBack} className={iconSquare}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          {kicker && <Eyebrow>— {kicker}</Eyebrow>}
          <h1
            className={
              (kicker ? 'mt-2.5 ' : '') +
              (onBack ? 'text-2xl ' : 'text-[min(13vw,52px)] leading-[0.86] ') +
              'font-display font-black uppercase tracking-tight text-ink'
            }
          >
            {title}
          </h1>
        </div>
      </div>
      {right}
    </header>
  )
}

export function Sheet({ open, onClose, title, actions, children }: { open: boolean; onClose: () => void; title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-abysse/70" onClick={onClose} />
      {/* Fond `cream` (et non `surface`) : les cartes `bg-surface` des contenus doivent
          rester visibles par-dessus — c'est le piège d'empilement du thème sombre. */}
      <div className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border-t border-hairline bg-cream/95 px-5 pt-3 pb-10 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline-strong" />
        {(title || actions) && (
          <div className="mb-4 flex items-center gap-2.5">
            {title && <h2 className="min-w-0 flex-1 font-display text-2xl leading-none font-bold uppercase">{title}</h2>}
            {actions}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink/60">{label}</p>
      {children}
    </div>
  )
}

/** Liste déroulante au style commun de l'app */
export function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        'rounded-sm border border-hairline bg-glass-sunken px-3 py-2.5 text-sm font-bold outline-none backdrop-blur-lg focus:border-sage-500 ' +
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
            ? 'w-full rounded-sm border border-hairline bg-glass-sunken px-3 py-2.5 text-sm font-semibold text-ink outline-none backdrop-blur-lg placeholder:font-normal placeholder:text-ink/40 focus:border-sage-500'
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
          {/* Panneau OPAQUE (`bg-shoal`) et non en verre : il se superpose à du texte,
              que le flou seul ne suffirait pas à masquer. */}
          <div className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-sm border border-hairline-strong bg-shoal py-1 shadow-xl">
            {filtered.slice(0, 40).map((o, i, arr) => (
              <Fragment key={o.id}>
                {o.group && o.group !== arr[i - 1]?.group && (
                  <p className="bg-sage-50 px-4 py-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-sage-700">
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
  'w-full rounded-sm border border-hairline bg-glass-sunken px-4 py-3 text-base font-semibold text-ink outline-none backdrop-blur-lg placeholder:font-normal placeholder:text-ink/40 focus:border-sage-500'

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
  // Carrés à filet (le moule d'`iconSquare`), plus les ronds pleins de la charte de juin
  const btn = small
    ? 'h-7 w-7 shrink-0 rounded-sm border border-hairline-strong bg-glass-soft text-sm font-extrabold text-ink active:bg-glass'
    : 'h-9 w-9 shrink-0 rounded-sm border border-hairline-strong bg-glass-soft text-lg font-extrabold text-ink active:bg-glass'
  return (
    <div className="inline-flex items-center gap-1.5">
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
            (small ? 'w-7 font-mono text-[13px]' : 'w-12 text-lg') +
            ' rounded-sm border border-transparent bg-transparent text-center font-bold tabular-nums outline-none focus:border-sage-500 focus:bg-glass-sunken'
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
      aria-pressed={active}
      onClick={onClick}
      className={
        'rounded-full border px-3 py-[5px] font-mono text-[10px] tracking-[0.12em] uppercase transition-colors ' +
        (active ? 'border-ink bg-ink text-onaccent' : 'border-hairline-strong text-ink/70 active:bg-glass')
      }
    >
      {children}
    </button>
  )
}

/** `compact` : rail de 34 px (fiche séance) au lieu de 44 — les segments pleine hauteur
 *  « prenaient toute la place » sur un formulaire dense (audit sept. 2026). En compact,
 *  trois options doivent tenir sur 322 px : texte 9 px sous `sm`, et `short` (libellé
 *  abrégé pour mobile) quand le plein ne rentre pas — `aria-label` garde le nom complet. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { value: T; label: string; short?: string }[]
  value: T
  onChange: (v: T) => void
  compact?: boolean
}) {
  return (
    <div className="flex rounded-sm border border-hairline bg-glass-soft p-[3px] backdrop-blur-lg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-label={o.short ? o.label : undefined}
          onClick={() => onChange(o.value)}
          className={
            // Actif = aplat écume : sur fond sombre, une pastille « plus claire que son
            // rail » est la seule façon de lire la sélection (l'ombre, elle, ne se voit plus).
            'flex-1 rounded-xs font-mono font-bold uppercase transition-colors ' +
            (compact
              ? 'px-2 py-[7px] text-[9px] tracking-[0.1em] whitespace-nowrap sm:px-3 sm:text-[10px] sm:tracking-[0.14em] '
              : 'px-3 py-2.5 text-[10px] tracking-[0.14em] ') +
            (o.value === value ? 'bg-ink text-onaccent' : 'text-ink/60')
          }
        >
          {o.short ? (
            <>
              <span className="sm:hidden">{o.short}</span>
              <span className="hidden sm:inline">{o.label}</span>
            </>
          ) : (
            o.label
          )}
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
      className="w-full rounded-sm bg-ink px-5 py-4 font-mono text-[11px] font-bold tracking-[0.16em] uppercase text-onaccent active:bg-sage-700 disabled:opacity-40"
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
        'w-full rounded-sm border px-5 py-3.5 font-mono text-[11px] font-bold tracking-[0.16em] uppercase ' +
        (danger
          ? 'border-hiit/40 text-hiit active:bg-hiit/10'
          : 'border-hairline-strong bg-glass-soft text-ink backdrop-blur-lg active:bg-glass')
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
      // Le seul aplat chaud de la charte : la création se repère à sa couleur, pas à sa taille
      className="fixed right-5 bottom-24 z-40 rounded-sm bg-flare px-[18px] py-3.5 font-mono text-[11px] font-bold tracking-[0.14em] uppercase text-flare-ink shadow-[0_12px_28px_rgb(216_69_47/0.45)] active:brightness-90"
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
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-hairline-strong bg-glass-soft backdrop-blur-lg active:bg-glass'
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-cream/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-5 py-2.5">
        {onDelete && (
          // Teinte danger : la destruction ne doit pas ressembler à « Dupliquer »
          <button
            type="button"
            aria-label="Supprimer"
            title="Supprimer"
            onClick={onDelete}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-hiit/40 text-hiit active:bg-hiit/10"
          >
            <Trash2 className="h-5 w-5" />
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
          className="h-12 flex-1 rounded-sm bg-ink font-mono text-[11px] font-bold tracking-[0.16em] uppercase text-onaccent active:bg-sage-700 disabled:opacity-40"
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}

export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className={`px-6 py-10 text-center ${glassCard}`}>
      <div className="text-3xl">{emoji}</div>
      <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.12em] uppercase text-ink/65">{text}</p>
    </div>
  )
}
