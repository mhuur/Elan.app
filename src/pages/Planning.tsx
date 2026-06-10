import { useState } from 'react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Session } from '../types'
import { DAY_NAMES, mondayIndex } from '../lib/dates'
import { PageHeader, Sheet } from '../components/ui'
import { summarizeSession } from '../lib/format'

export default function Planning() {
  const { sessions, updateSession } = useData()
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const todayIdx = mondayIndex()

  const perWeek = sessions.reduce((a, s) => a + s.days.length, 0)

  const addToDay = async (s: Session, day: number) => {
    setAddingDay(null)
    await updateSession(s.id, { days: [...s.days, day].sort((a, b) => a - b) })
  }

  const removeFromDay = (s: Session, day: number) => {
    if (!window.confirm(`Retirer « ${s.name} » du ${DAY_NAMES[day].toLowerCase()} ?`)) return
    void updateSession(s.id, { days: s.days.filter((d) => d !== day) })
  }

  const candidates = addingDay === null ? [] : sessions.filter((s) => !s.days.includes(addingDay))

  return (
    <div>
      <PageHeader kicker="Semaine type" title="Planning" />
      <p className="-mt-2 px-5 pb-4 text-xs font-semibold text-ink-soft">
        Votre routine se répète chaque semaine : ajoutez vos séances aux jours voulus.
        {perWeek > 0 && (
          <span className="ml-1 text-sage-600">
            {perWeek} séance{perWeek > 1 ? 's' : ''} / semaine.
          </span>
        )}
      </p>

      <div className="space-y-3 px-5">
        {DAY_NAMES.map((name, day) => {
          const daySessions = sessions.filter((s) => s.days.includes(day))
          const isToday = day === todayIdx
          return (
            <div key={day} className={'rounded-3xl bg-surface p-4 shadow-sm ' + (isToday ? 'ring-2 ring-sage-300' : '')}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold">
                  {name}
                  {isToday && (
                    <span className="ml-2 rounded-full bg-sage-100 px-2 py-0.5 text-[10px] font-extrabold text-sage-700">
                      aujourd'hui
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={() => setAddingDay(day)}
                  className="rounded-full bg-sage-100 px-3 py-1.5 text-xs font-extrabold text-sage-700 active:bg-sage-200"
                >
                  + Ajouter
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {daySessions.length === 0 && <p className="text-xs font-semibold text-ink-soft/50">Repos 🌙</p>}
                {daySessions.map((s) => {
                  const meta = CATEGORY_META[s.category]
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => removeFromDay(s, day)}
                      title="Retirer de ce jour"
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${meta.soft} ${meta.text}`}
                    >
                      {meta.emoji} {s.name}
                      <span className="opacity-50">✕</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <Sheet
        open={addingDay !== null}
        onClose={() => setAddingDay(null)}
        title={addingDay !== null ? `Ajouter au ${DAY_NAMES[addingDay].toLowerCase()}` : undefined}
      >
        <div className="space-y-1.5">
          {candidates.map((s) => {
            const meta = CATEGORY_META[s.category]
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => void addToDay(s, addingDay!)}
                className="flex w-full items-center gap-3 rounded-2xl bg-sage-50 px-4 py-3 text-left active:bg-sage-100"
              >
                <span className="text-xl">{meta.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{s.name}</span>
                  <span className="block truncate text-xs font-semibold text-ink-soft">{summarizeSession(s)}</span>
                </span>
              </button>
            )
          })}
          {candidates.length === 0 && (
            <p className="py-4 text-center text-sm font-semibold text-ink-soft">
              Toutes vos séances sont déjà sur ce jour.
              <br />
              Créez-en de nouvelles dans l'onglet Exercices.
            </p>
          )}
        </div>
      </Sheet>
    </div>
  )
}
