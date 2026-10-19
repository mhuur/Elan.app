import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Copy, Trash2, X } from 'lucide-react'
import { CATEGORY_META, type Category } from '../types'
import { CATEGORY_PICTO, PICTO, Picto, type PictoName } from './icons'

/* ── Charte 21KM ─────────────────────────────────────────────────────────────
 * Primitives de la planche « Composants » du canevas (docs/maquettes/21km/). Fond clair,
 * cartes blanches à contour 1 px, boutons en pilule, Archivo en casse normale. Elles
 * sont volontairement peu paramétrables : c'est ce qui garde les écrans cohérents.
 * Les noms hérités de la charte « bord de mer » (`glassCard`, `Eyebrow`…) sont gardés
 * pour ne pas réécrire tous les appels ; seul leur rendu a changé.
 */

/** Pictogramme seul d'une catégorie — la couleur vient du parent */
export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  return <Picto name={CATEGORY_PICTO[category]} className={className ?? 'h-4 w-4'} />
}

/**
 * Anneau de catégorie : pictogramme dans un anneau de la couleur de la catégorie.
 * Prévue = fond teinté, trait à 35 % ; faite = disque plein, pictogramme blanc ;
 * `progress` (0–1) dessine l'arc d'avancement par-dessus l'anneau prévu.
 * `muted` : jour passé non fait (gris).
 */
export function CategoryRing({
  category,
  picto,
  hex,
  tint,
  size = 48,
  done,
  progress,
  muted,
  missed,
  stroke = 3,
  className,
}: {
  category?: Category
  picto?: PictoName
  hex?: string
  tint?: string
  size?: number
  done?: boolean
  progress?: number
  muted?: boolean
  /** Jour passé, prévue mais non faite : anneau gris en pointillés */
  missed?: boolean
  stroke?: number
  /** Taille par classes (ex. `h-[30px] w-[30px] lg:h-10 lg:w-10`) au lieu de `size` */
  className?: string
}) {
  const meta = category ? CATEGORY_META[category] : undefined
  const c = hex ?? meta?.hex ?? '#0E1116'
  const t = tint ?? meta?.tint ?? '#ECEEF2'
  const name = picto ?? (category ? CATEGORY_PICTO[category] : 'grille')
  const r = 24 - stroke / 2 - 0.5
  const len = 2 * Math.PI * r
  const disc = missed ? '#FFFFFF' : muted ? '#F4F5F7' : done ? c : t
  const ic = missed ? '#626A78' : muted ? '#A3AAB6' : done ? '#FFFFFF' : c
  const line = missed ? '#8A919C' : muted ? '#DDE1E7' : c
  return (
    <svg
      width={className ? undefined : size}
      height={className ? undefined : size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={'shrink-0 ' + (className ?? '')}
    >
      <circle
        cx="24"
        cy="24"
        r={r}
        fill={disc}
        stroke={line}
        strokeWidth={stroke}
        strokeOpacity={done || muted || missed ? 1 : 0.35}
        strokeDasharray={missed ? '6 5' : undefined}
      />
      {!done && !muted && !missed && progress != null && progress > 0 && (
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={c}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - Math.min(1, progress))}
          transform="rotate(-90 24 24)"
        />
      )}
      <g transform="translate(12 12)" fill="none" stroke={ic} strokeWidth={size <= 36 || className ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d={PICTO[name]} />
      </g>
    </svg>
  )
}

/** Sur-titre : « Aujourd'hui », « Demain », « Semaine 6 sur 13 » — 14 px, texte accent */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={'text-sm leading-5 font-semibold ' + (className ?? 'text-sage-700')}>{children}</p>
}

/** Titre d'écran (Titre 1 : 28/34, 800 ; 30 sur bureau) */
export function DisplayTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={'font-extrabold text-ink ' + (className ?? 'text-[28px] leading-[34px] lg:text-[30px]')}>{children}</h1>
}

/** Pastille d'information — jamais une catégorie. `accent` = teinte Volt, texte accent. */
export function Pill({ children, tone = 'plain' }: { children: ReactNode; tone?: 'accent' | 'plain' }) {
  const skin = tone === 'accent' ? 'bg-sage-100 text-sage-700 font-bold' : 'bg-sage-50 text-ink font-semibold'
  return <span className={`inline-flex h-8 items-center rounded-full px-3 text-sm tabular-nums ${skin}`}>{children}</span>
}

/** Carte posée : blanche, contour 1 px (niveau 0), rayon 16 */
export const glassCard = 'rounded-md border border-hairline bg-surface'

/** Bouton icône rond de 44 px (navigation de jour, réglages, fermer) */
export const iconSquare =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-ink transition-transform active:scale-95 active:bg-sage-50 disabled:bg-cream disabled:text-ink-off'

export function PageHeader({ kicker, title, right, onBack }: { kicker?: string; title: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <header className="flex items-center gap-1.5 px-4 pt-4 pb-3 lg:px-10 lg:pt-8">
      {onBack && (
        <button type="button" aria-label="Retour" onClick={onBack} className={iconSquare + ' mr-1.5'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        {kicker && <Eyebrow>{kicker}</Eyebrow>}
        <h1 className={(onBack ? 'text-[22px] leading-7 ' : 'text-[28px] leading-[34px] lg:text-[30px] ') + 'truncate font-extrabold text-ink'}>{title}</h1>
      </div>
      {right}
    </header>
  )
}

/**
 * Volet : du bas sur téléphone (rayon 24 en haut, poignée 40 × 5, voile), colonne de
 * droite de 520 px sans voile sur bureau (≥ lg). `title` est un titre de volet 22/28.
 */
export function Sheet({ open, onClose, title, actions, children }: { open: boolean; onClose: () => void; title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:inset-auto lg:top-0 lg:right-0 lg:bottom-0 lg:w-[520px]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/45 lg:hidden" onClick={onClose} />
      <div className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-surface px-5 pt-2 pb-10 shadow-2xl lg:h-full lg:max-h-none lg:max-w-none lg:rounded-none lg:border-l lg:border-hairline lg:px-7 lg:pt-8 lg:shadow-none">
        <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-hairline-strong lg:hidden" />
        <div className="mb-4 flex items-center gap-3">
          {title && <h2 className="min-w-0 flex-1 text-[22px] leading-7 font-extrabold">{title}</h2>}
          {!title && <div className="flex-1" />}
          {actions}
          <button type="button" aria-label="Fermer" onClick={onClose} className={iconSquare}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
      {children}
    </div>
  )
}

const fieldBase =
  'rounded-sm border border-hairline-strong bg-surface text-ink outline-none focus:border-ink focus:ring-4 focus:ring-sage-100 disabled:bg-cream disabled:text-ink-off'

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
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`h-12 px-3.5 text-base ${fieldBase} ` + (className ?? 'w-full')}>
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
        className={small ? `w-full px-3 py-2.5 text-[15px] ${fieldBase} placeholder:text-ink-mute` : inputCls}
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
          <div className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-sm border border-hairline bg-surface py-1 shadow-lg">
            {filtered.slice(0, 40).map((o, i, arr) => (
              <Fragment key={o.id}>
                {o.group && o.group !== arr[i - 1]?.group && (
                  <p className="bg-cream px-4 py-1.5 text-[13px] font-semibold text-ink-mute">{o.group}</p>
                )}
                <button
                  type="button"
                  onClick={() => pick(o.id)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left active:bg-sage-50"
                >
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-[13px] text-ink-mute">{o.hint}</span>}
                </button>
              </Fragment>
            ))}
            {canCreate && (
              <button type="button" onClick={create} className="min-h-11 w-full px-4 py-2 text-left text-[15px] font-bold text-sage-700 active:bg-sage-50">
                + Créer « {value.trim()} »
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const inputCls = `w-full px-3.5 py-3 text-base ${fieldBase} placeholder:text-ink-mute`

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
        className={inputCls + ' tabular-nums' + (suffix ? ' pr-14' : '')}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
      {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-soft">{suffix}</span>}
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
  const btn =
    (small ? 'h-8 w-8 text-base ' : 'h-10 w-10 text-lg ') +
    'shrink-0 rounded-full border border-hairline bg-surface font-bold text-ink active:scale-95 active:bg-sage-50'
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
            (small ? 'w-8 text-[15px]' : 'w-12 text-lg') +
            ' rounded-xs border border-transparent bg-transparent text-center font-bold tabular-nums outline-none focus:border-ink focus:bg-surface'
          }
        />
        {suffix && <span className="text-sm font-semibold text-ink-soft">{suffix}</span>}
      </div>
      <button type="button" aria-label="Augmenter" className={btn} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </div>
  )
}

/** Pastille cliquable : repos Surface 2, choisie encre */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        'inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition-colors ' +
        (active ? 'bg-ink text-white' : 'bg-sage-50 text-ink active:bg-hairline')
      }
    >
      {children}
    </button>
  )
}

/** Onglets segmentés : rail Surface 2, segment choisi blanc ombré. `compact` : 36 px au
 *  lieu de 44 (formulaires denses). `short` : libellé abrégé sous `sm`, le nom complet
 *  reste dans `aria-label`. */
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
    <div className="flex gap-1 rounded-full bg-sage-50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-label={o.short ? o.label : undefined}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={
            'flex-1 rounded-full px-2 whitespace-nowrap text-ink transition-colors ' +
            (compact ? 'min-h-9 text-sm ' : 'min-h-11 text-[15px] ') +
            (o.value === value ? 'bg-surface font-bold shadow-sm' : 'font-semibold active:bg-hairline')
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

/** Bouton principal : pilule Volt de 52 px, texte encre 17 px gras */
export const primaryCls =
  'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-sage-500 px-6 text-[17px] font-bold text-onaccent transition-transform active:scale-[0.97] active:bg-sage-600 disabled:bg-[#e3e6eb] disabled:text-[#8a919c]'
/** Bouton secondaire : pilule à contour encre 1,5 px */
export const secondaryCls =
  'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-[1.5px] border-ink bg-transparent px-5 py-3 text-[17px] leading-[22px] font-bold text-ink transition-transform active:scale-[0.97] active:bg-sage-50 disabled:border-hairline-strong disabled:text-[#8a919c]'

export function PrimaryButton({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={'w-full ' + primaryCls}>
      {children}
    </button>
  )
}

export function GhostButton({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={'w-full ' + (danger ? secondaryCls.replace('border-ink', 'border-flare').replace('text-ink', 'text-flare') : secondaryCls)}
    >
      {children}
    </button>
  )
}

/** Bouton de création flottant (« + Programme ») : pilule Volt */
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={'fixed right-4 bottom-24 z-40 shadow-lg lg:right-10 lg:bottom-8 ' + primaryCls}>
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
  const round = 'flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border active:scale-95 '
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] lg:left-[232px]">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3 lg:max-w-[62rem]">
        {onDelete && (
          <button type="button" aria-label="Supprimer" title="Supprimer" onClick={onDelete} className={round + 'border-flare/40 text-flare active:bg-flare/10'}>
            <Trash2 className="h-5 w-5" />
          </button>
        )}
        {onDuplicate && (
          <button type="button" aria-label="Dupliquer" title="Dupliquer" onClick={onDuplicate} className={round + 'border-hairline text-ink active:bg-sage-50'}>
            <Copy className="h-5 w-5" />
          </button>
        )}
        <button type="button" onClick={onSave} disabled={saveDisabled} className={'flex-1 ' + primaryCls}>
          Enregistrer
        </button>
      </div>
    </div>
  )
}

export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-8 text-center ${glassCard}`}>
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-50 text-3xl">{emoji}</span>
      <p className="max-w-80 text-base leading-6 text-ink-soft">{text}</p>
    </div>
  )
}
