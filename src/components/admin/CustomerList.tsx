'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/components/admin/api'
import { PageHeader, Card, TextInput, Select, EmptyState, Spinner } from '@/components/admin/ui'
import { formatLocalDateStr } from '@/components/admin/format'

interface Row {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  no_show_count: number
  total_appointments: number
  last_appointment_at: string | null
  email_missing: boolean
}

export function CustomerList() {
  const t = useTranslations('admin')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'last_visit' | 'name'>('last_visit')
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    const handle = setTimeout(async () => {
      setRows(null)
      const res = await apiGet<{ customers: Row[] }>(
        `/api/admin/customers?q=${encodeURIComponent(q)}&sort=${sort}`,
      )
      setRows(res.ok && res.data ? res.data.customers : [])
    }, 250)
    return () => clearTimeout(handle)
  }, [q, sort])

  return (
    <div>
      <PageHeader title={t('customers.title')} />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[240px] flex-1">
          <TextInput
            placeholder={t('customers.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('customers.search')}
          />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as 'last_visit' | 'name')} className="max-w-[200px]">
          <option value="last_visit">{t('customers.sortLastVisit')}</option>
          <option value="name">{t('customers.sortName')}</option>
        </Select>
      </div>

      {rows === null ? (
        <Spinner label={t('common.loading')} />
      ) : rows.length === 0 ? (
        <EmptyState>{t('customers.none')}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[0.86rem]">
            <thead>
              <tr className="border-b border-line-paper font-display text-[0.66rem] uppercase tracking-display text-smoke">
                <th className="px-4 py-3">{t('customers.name')}</th>
                <th className="px-4 py-3">{t('customers.email')}</th>
                <th className="px-4 py-3">{t('customers.phone')}</th>
                <th className="px-4 py-3 text-right">{t('customers.visits')}</th>
                <th className="px-4 py-3 text-right">{t('customers.noShows')}</th>
                <th className="px-4 py-3">{t('customers.lastVisit')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-line-paper/60 hover:bg-paper-2/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/klanten/${c.id}`} className="font-medium text-ink hover:text-gold-deep">
                      {c.first_name} {c.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-fg2">
                    {c.email_missing ? <span className="text-stone">—</span> : c.email}
                  </td>
                  <td className="px-4 py-2.5 text-fg2">{c.phone ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.total_appointments}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.no_show_count}</td>
                  <td className="px-4 py-2.5 text-fg2">
                    {c.last_appointment_at ? formatLocalDateStr(c.last_appointment_at.slice(0, 10)) : t('customers.never')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
