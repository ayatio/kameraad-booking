'use client'

import { useTranslations } from 'next-intl'
import type { AdminAppointmentRow } from '@/lib/db/queries/admin-calendar'
import { addDaysStr, isoLocalDate, formatTime, todayBrussels } from '@/components/admin/format'
import { cn } from '@/components/admin/ui'
import type { BarberLite, ServiceLite } from './types'

const DOW = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

export function WeekView({
  weekStart,
  columns,
  appointments,
  serviceById,
  onSelect,
}: {
  weekStart: string
  columns: BarberLite[]
  appointments: AdminAppointmentRow[]
  serviceById: Map<string, ServiceLite>
  onSelect: (appt: AdminAppointmentRow) => void
}) {
  const t = useTranslations('admin')
  const columnIds = new Set(columns.map((b) => b.id))
  const barberName = new Map(columns.map((b) => [b.id, b.name]))
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i))
  const today = todayBrussels()
  const multi = columns.length > 1

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day, idx) => {
        const dayAppts = appointments
          .filter((a) => columnIds.has(a.barber_id) && isoLocalDate(a.start_at) === day)
          .sort((a, b) => a.start_at.localeCompare(b.start_at))
        const [, , d] = day.split('-')
        return (
          <div
            key={day}
            className={cn(
              'rounded-lg border bg-paper p-2',
              day === today ? 'border-gold' : 'border-line-paper',
            )}
          >
            <div className="mb-2 flex items-baseline justify-between px-1">
              <span className="font-display text-[0.7rem] uppercase tracking-display text-ink">
                {DOW[idx]} {Number(d)}
              </span>
              <span className="text-[0.66rem] text-smoke">{dayAppts.length}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {dayAppts.length === 0 ? (
                <span className="px-1 py-2 text-[0.7rem] text-stone">—</span>
              ) : (
                dayAppts.map((a) => {
                  const color = serviceById.get(a.service_id)?.color ?? '#C9A24B'
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect(a)}
                      className="rounded-sm border-l-[3px] bg-paper-2/60 px-2 py-1 text-left hover:bg-paper-2"
                      style={{
                        borderLeftColor: color,
                        opacity: a.status === 'cancelled' ? 0.6 : 1,
                      }}
                    >
                      <div className="text-[0.7rem] font-semibold text-ink">
                        {formatTime(a.start_at)}
                      </div>
                      <div className="truncate text-[0.66rem] text-fg2">
                        {a.customer_first_name} {a.customer_last_name}
                      </div>
                      {multi ? (
                        <div className="truncate text-[0.6rem] text-smoke">
                          {barberName.get(a.barber_id)}
                        </div>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
