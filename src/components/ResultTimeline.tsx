import { Check, TriangleAlert } from 'lucide-react'
import { CATEGORY_META, type Category } from '../types'
import type { SetGroup, SetStatus } from '../lib/timeline'

/**
 * Timeline de saisie/correction du réalisé : tap sur une ligne = curseur « je me suis
 * arrêté ici » (géré par le parent), icône à droite = bascule « mal réalisée ».
 */
export default function ResultTimeline({
  groups,
  status,
  category,
  onTap,
  onFlag,
}: {
  groups: SetGroup[]
  status: SetStatus[]
  category: Category
  onTap: (gi: number) => void
  onFlag: (gi: number) => void
}) {
  const offsets: number[] = []
  let acc = 0
  for (const g of groups) {
    offsets.push(acc)
    acc += g.rows.length
  }
  return (
    <>
      {groups.map((g, giIdx) => (
        <div key={giIdx} className="overflow-hidden rounded-2xl bg-sage-50">
          {g.header && (
            <p
              className={`px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-wider ${CATEGORY_META[category].soft} ${CATEGORY_META[category].text}`}
            >
              {g.header}
            </p>
          )}
          {g.rows.map((row, ri) => {
            const gi = offsets[giIdx] + ri
            const st = status[gi]
            return (
              <div
                key={ri}
                className={'flex items-center gap-1 pr-2 ' + (ri > 0 || g.header ? 'border-t border-surface' : '')}
              >
                <button
                  type="button"
                  onClick={() => onTap(gi)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-2.5 text-left"
                >
                  <span
                    className={
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ' +
                      (st === 'ok'
                        ? 'bg-sage-500 text-onaccent'
                        : st === 'flag'
                          ? 'bg-amber-400 text-onaccent'
                          : 'border-2 border-sand text-transparent')
                    }
                  >
                    {st === 'flag' ? (
                      <TriangleAlert className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-bold ${st === 'no' ? 'text-ink-soft/40 line-through' : ''}`}
                    >
                      {row.name}
                      {row.setLabel && (
                        <span className={st === 'no' ? '' : 'font-semibold text-ink-soft'}> · {row.setLabel}</span>
                      )}
                    </span>
                    {row.sub && (
                      <span className="block truncate text-[11px] font-semibold text-ink-soft/60">{row.sub}</span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-xs font-extrabold ${
                      st === 'no' ? 'text-ink-soft/40' : st === 'flag' ? 'text-amber-400' : 'text-ink-soft'
                    }`}
                  >
                    {st === 'no' ? 'non faite' : st === 'flag' ? 'mal réalisée' : `${row.value} ${row.unit}`}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={st === 'flag' ? 'Annuler mal réalisée' : 'Marquer mal réalisée'}
                  onClick={() => onFlag(gi)}
                  disabled={st === 'no'}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    st === 'flag' ? 'text-amber-500' : st === 'no' ? 'text-ink-soft/15' : 'text-ink-soft/35 active:text-amber-500'
                  }`}
                >
                  <TriangleAlert className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}
