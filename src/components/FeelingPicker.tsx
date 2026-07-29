import { FEELINGS } from '../types'

/** Sélecteur de ressenti (RPE) : 5 smileys, tap pour choisir / re-tap pour désélectionner */
export default function FeelingPicker({
  value,
  onChange,
}: {
  value?: number
  onChange: (v: number | undefined) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-ink-soft">Difficulté ressentie</p>
      <div className="flex gap-1.5">
        {FEELINGS.map((f) => {
          const active = value === f.value
          return (
            <button
              key={f.value}
              type="button"
              aria-label={f.label}
              aria-pressed={active}
              title={f.label}
              onClick={() => onChange(active ? undefined : f.value)}
              className={
                'flex-1 rounded-xl py-2 text-2xl transition ' +
                // Sur l'ardoise, un emoji trop transparent vire au sale : on garde
                // l'inactif nettement plus lisible qu'en charte claire.
                (active ? 'bg-sage-100 ring-1 ring-sage-400' : 'opacity-55 active:opacity-80')
              }
            >
              {f.emoji}
            </button>
          )
        })}
      </div>
    </div>
  )
}
