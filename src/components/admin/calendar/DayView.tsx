'use client'

import { useTranslations } from 'next-intl'
import type { AdminAppointmentRow } from '@/lib/db/queries/admin-calendar'
import type { BlockedSlot } from '@/lib/db/types'
import { minutesFromMidnight, formatTime } from '@/components/admin/format'
import { EmptyState } from '@/components/admin/ui'
import type { BarberLite, ServiceLite } from './types'

const START_HOUR = 8
const END_HOUR = 20
const PX_PER_MIN = 1.1
const TOTAL_MIN = (END_HOUR - START_HOUR) * 60

function topPx(iso: string): number {
  const m = minutesFromMidnight(iso) - START_HOUR * 60
  return Math.max(0, Math.min(TOTAL_MIN, m)) * PX_PER_MIN
}
function heightPx(startIso: string, endIso: string): number {
  const startM = Math.max(START_HOUR * 60, minutesFromMidnight(startIso))
  let endM = minutesFromMidnight(endIso)
  if (endM <= startM) endM = TOTAL_MIN + START_HOUR * 60 // overnight guard
  const dur = Math.min(END_HOUR * 60, endM) - startM
  return Math.max(22, dur * PX_PER_MIN)
}

export function DayView({
  date,
  columns,
  appointments,
  blocks,
  serviceById,
  onSelect,
}: {
  date: string
  columns: BarberLite[]
  appointments: AdminAppointmentRow[]
  blocks: BlockedSlot[]
  serviceById: Map<string, ServiceLite>
  onSelect: (appt: AdminAppointmentRow) => void
}) {
  const t = useTranslations('admin')
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

  if (columns.length === 0) return <EmptyState>{t('calendar.noAppointments')}</EmptyState>

  return (
    <div className="overflow-x-auto rounded-lg border border-line-paper bg-paper">
      <div className="min-w-[640px]">
        {/* Column headers */}
        <div
          className="grid border-b border-line-paper"
          style={{ gridTemplateColumns: `52px repeat(${columns.length}, minmax(0,1fr))` }}
        >
          <div />
          {columns.map((b) => (
            <div
              key={b.id}
              className="truncate border-l border-line-paper px-2 py-2 text-center font-display text-[0.72rem] uppercase tracking-display text-ink"
            >
              {b.name}
            </div>
          ))}
        </div>

        {/* Timeline body */}
        <div
          className="grid"
          style={{ gridTemplateColumns: `52px repeat(${columns.length}, minmax(0,1fr))` }}
        >
          {/* Hour gutter */}
          <div className="relative" style={{ height: TOTAL_MIN * PX_PER_MIN }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[0.66rem] tabular-nums text-smoke"
                style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {columns.map((b) => {
            const colAppts = appointments.filter((a) => a.barber_id === b.id)
            const colBlocks = blocks.filter((bl) => bl.barber_id === null || bl.barber_id === b.id)
            return (
              <div
                key={b.id}
                className="relative border-l border-line-paper"
                style={{ height: TOTAL_MIN * PX_PER_MIN }}
              >
                {/* Hour grid lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-line-paper/60"
                    style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }}
                  />
                ))}

                {/* Blocked periods (hatched) */}
                {colBlocks.map((bl) => (
                  <div
                    key={bl.id}
                    title={bl.reason ?? t('calendar.blocked')}
                    className="absolute inset-x-1 rounded-sm border border-stone/50"
                    style={{
                      top: topPx(bl.start_at),
                      height: heightPx(bl.start_at, bl.end_at),
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(138,133,123,.16) 0, rgba(138,133,123,.16) 6px, transparent 6px, transparent 12px)',
                    }}
                  >
                    <span className="px-1.5 text-[0.6rem] uppercase tracking-display text-smoke">
                      {t('calendar.blocked')}
                    </span>
                  </div>
                ))}

                {/* Appointments */}
                {colAppts.map((a) => {
                  const color = serviceById.get(a.service_id)?.color ?? '#C9A24B'
                  const cancelled = a.status === 'cancelled'
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect(a)}
                      className="absolute inset-x-1 overflow-hidden rounded-sm border-l-[3px] px-1.5 py-1 text-left shadow-1 transition-shadow hover:shadow-2"
                      style={{
                        top: topPx(a.start_at),
                        height: heightPx(a.start_at, a.end_at),
                        borderLeftColor: color,
                        backgroundColor: cancelled ? 'rgba(184,178,166,.18)' : `${color}22`,
                        opacity: cancelled ? 0.6 : 1,
                      }}
                    >
                      <div className="truncate text-[0.7rem] font-semibold text-ink">
                        {formatTime(a.start_at)} {a.customer_first_name} {a.customer_last_name}
                      </div>
                      <div className="truncate text-[0.66rem] text-fg2">{a.service_name_nl}</div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
