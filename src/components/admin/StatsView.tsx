'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/components/admin/api'
import { PageHeader, Card, Button, Select, TextInput, Alert, Spinner } from '@/components/admin/ui'
import { formatMoney, todayBrussels } from '@/components/admin/format'

type Range = 'day' | 'week' | 'month' | 'custom'

interface Totals {
  bookings: number
  completed: number
  cancelled: number
  noShows: number
  revenueCents: number | null
}
interface BarberRow {
  barberId: string
  barberName: string
  bookings: number
  completed: number
  cancelled: number
  noShows: number
  revenueCents: number | null
}
interface ServiceRow {
  serviceId: string
  serviceName: string
  bookings: number
  completed: number
  revenueCents: number | null
}
interface StatsResult {
  totals: Totals
  perBarber: BarberRow[]
  perService: ServiceRow[]
}

export function StatsView({ isOwner }: { isOwner: boolean }) {
  const t = useTranslations('admin')
  const [range, setRange] = useState<Range>('week')
  const [from, setFrom] = useState(todayBrussels())
  const [to, setTo] = useState(todayBrussels())
  const [data, setData] = useState<StatsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const toParam = range === 'custom' ? `&to=${to}` : ''
    const res = await apiGet<StatsResult>(`/api/admin/stats?range=${range}&from=${from}${toParam}`)
    if (res.ok && res.data) setData(res.data)
    else setError(true)
    setLoading(false)
  }, [range, from, to])

  useEffect(() => {
    load()
  }, [load])

  const tiles = data
    ? [
        { label: t('stats.bookings'), value: String(data.totals.bookings) },
        { label: t('stats.completed'), value: String(data.totals.completed) },
        { label: t('stats.cancelled'), value: String(data.totals.cancelled) },
        { label: t('stats.noShows'), value: String(data.totals.noShows) },
        ...(data.totals.revenueCents !== null
          ? [{ label: t('stats.revenue'), value: formatMoney(data.totals.revenueCents) }]
          : []),
      ]
    : []

  return (
    <div>
      <PageHeader title={t('stats.title')} description={isOwner ? undefined : t('stats.ownOnly')} />

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <span className="mb-1 block font-display text-[0.62rem] uppercase tracking-eyebrow text-smoke">
              {t('stats.range')}
            </span>
            <Select value={range} onChange={(e) => setRange(e.target.value as Range)}>
              <option value="day">{t('stats.day')}</option>
              <option value="week">{t('stats.week')}</option>
              <option value="month">{t('stats.month')}</option>
              <option value="custom">{t('stats.custom')}</option>
            </Select>
          </div>
          <div className="w-44">
            <span className="mb-1 block font-display text-[0.62rem] uppercase tracking-eyebrow text-smoke">
              {t('stats.from')}
            </span>
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          {range === 'custom' ? (
            <div className="w-44">
              <span className="mb-1 block font-display text-[0.62rem] uppercase tracking-eyebrow text-smoke">
                {t('stats.to')}
              </span>
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          ) : null}
          <Button variant="primary" onClick={load}>
            {t('stats.apply')}
          </Button>
        </div>
      </Card>

      {error ? (
        <Alert kind="error">{t('common.error')}</Alert>
      ) : loading && !data ? (
        <Spinner label={t('common.loading')} />
      ) : data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {tiles.map((tile) => (
              <Card key={tile.label} className="p-4">
                <div className="font-display text-[0.62rem] uppercase tracking-eyebrow text-smoke">
                  {tile.label}
                </div>
                <div className="mt-1 font-serif text-[1.7rem] text-ink">{tile.value}</div>
              </Card>
            ))}
          </div>

          <h2 className="mb-2 font-display text-[0.85rem] uppercase tracking-display text-ink">
            {t('stats.perBarber')}
          </h2>
          <Card className="mb-6 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[0.85rem]">
              <thead>
                <tr className="border-b border-line-paper font-display text-[0.62rem] uppercase tracking-display text-smoke">
                  <th className="px-4 py-2.5">{t('stats.barber')}</th>
                  <th className="px-4 py-2.5 text-right">{t('stats.bookings')}</th>
                  <th className="px-4 py-2.5 text-right">{t('stats.completed')}</th>
                  <th className="px-4 py-2.5 text-right">{t('stats.cancelled')}</th>
                  <th className="px-4 py-2.5 text-right">{t('stats.noShows')}</th>
                  {data.totals.revenueCents !== null ? (
                    <th className="px-4 py-2.5 text-right">{t('stats.revenue')}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {data.perBarber.map((b) => (
                  <tr key={b.barberId} className="border-b border-line-paper/60">
                    <td className="px-4 py-2 text-ink">{b.barberName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{b.bookings}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{b.completed}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{b.cancelled}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{b.noShows}</td>
                    {data.totals.revenueCents !== null ? (
                      <td className="px-4 py-2 text-right tabular-nums">{formatMoney(b.revenueCents)}</td>
                    ) : null}
                  </tr>
                ))}
                {data.perBarber.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-smoke" colSpan={6}>
                      {t('common.noResults')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>

          <h2 className="mb-2 font-display text-[0.85rem] uppercase tracking-display text-ink">
            {t('stats.perService')}
          </h2>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[0.85rem]">
              <thead>
                <tr className="border-b border-line-paper font-display text-[0.62rem] uppercase tracking-display text-smoke">
                  <th className="px-4 py-2.5">{t('stats.service')}</th>
                  <th className="px-4 py-2.5 text-right">{t('stats.bookings')}</th>
                  <th className="px-4 py-2.5 text-right">{t('stats.completed')}</th>
                  {data.totals.revenueCents !== null ? (
                    <th className="px-4 py-2.5 text-right">{t('stats.revenue')}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {data.perService.map((s) => (
                  <tr key={s.serviceId} className="border-b border-line-paper/60">
                    <td className="px-4 py-2 text-ink">{s.serviceName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.bookings}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.completed}</td>
                    {data.totals.revenueCents !== null ? (
                      <td className="px-4 py-2 text-right tabular-nums">{formatMoney(s.revenueCents)}</td>
                    ) : null}
                  </tr>
                ))}
                {data.perService.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-smoke" colSpan={4}>
                      {t('common.noResults')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </div>
  )
}
