'use client'

import { cn } from '@/components/admin/ui'
import { todayBrussels } from '@/components/admin/format'

const DOW = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

// Per-day appointment counts; click a day → day view (FR-048).
export function MonthView({
  anchorDate,
  counts,
  onPickDay,
}: {
  anchorDate: string
  counts: { local_date: string; count: number }[]
  onPickDay: (date: string) => void
}) {
  const [y, m] = anchorDate.split('-').map(Number)
  const countByDate = new Map(counts.map((c) => [c.local_date, c.count]))
  const today = todayBrussels()

  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-lg border border-line-paper bg-paper p-3">
      <div className="mb-2 grid grid-cols-7 gap-1">
        {DOW.map((d) => (
          <div key={d} className="py-1 text-center font-display text-[0.62rem] uppercase tracking-display text-smoke">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`x${i}`} />
          const count = countByDate.get(date) ?? 0
          const d = Number(date.split('-')[2])
          return (
            <button
              key={date}
              type="button"
              onClick={() => onPickDay(date)}
              className={cn(
                'flex min-h-[64px] flex-col items-start rounded-md border p-1.5 text-left transition-colors hover:border-gold',
                date === today ? 'border-gold bg-gold/5' : 'border-line-paper bg-paper',
              )}
            >
              <span className="text-[0.78rem] font-semibold text-ink">{d}</span>
              {count > 0 ? (
                <span className="mt-auto inline-flex items-center rounded-pill bg-gold/15 px-1.5 py-0.5 text-[0.62rem] font-semibold text-gold-deep">
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
