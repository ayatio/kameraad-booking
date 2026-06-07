'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Service } from '@/lib/db/types'
import { apiPatch } from '@/components/admin/api'
import { Dialog } from '@/components/admin/Overlay'
import { PageHeader, Card, Button, Field, TextInput, Textarea, Toggle, Alert, cn } from '@/components/admin/ui'
import { formatMoney } from '@/components/admin/format'

function centsToEuro(cents: number): string {
  return (cents / 100).toFixed(2)
}
function euroToCents(value: string): number {
  return Math.round(parseFloat(value.replace(',', '.')) * 100)
}

export function ServicesEditor({ initialServices }: { initialServices: Service[] }) {
  const t = useTranslations('admin')
  const [services, setServices] = useState(initialServices)
  const [editing, setEditing] = useState<Service | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div>
      <PageHeader title={t('services.title')} description={t('services.provisional')} />

      {error ? (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      ) : null}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[0.86rem]">
          <thead>
            <tr className="border-b border-line-paper font-display text-[0.66rem] uppercase tracking-display text-smoke">
              <th className="px-4 py-3">{t('services.name')}</th>
              <th className="px-4 py-3 text-right">{t('services.price')}</th>
              <th className="px-4 py-3 text-right">{t('services.duration')}</th>
              <th className="px-4 py-3">{t('services.color')}</th>
              <th className="px-4 py-3">{t('services.active')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b border-line-paper/60">
                <td className="px-4 py-2.5 font-medium text-ink">
                  {s.name_nl}
                  {s.is_walk_in ? (
                    <span className="ml-2 rounded-pill bg-paper-2 px-2 py-0.5 text-[0.62rem] uppercase text-smoke">
                      {t('services.walkIn')}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(s.price_cents)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{s.duration_min}</td>
                <td className="px-4 py-2.5">
                  <span
                    className="inline-block h-4 w-8 rounded-sm border border-line-paper align-middle"
                    style={{ backgroundColor: s.color }}
                    title={s.color}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn('text-[0.78rem]', s.is_active ? 'text-emerald-700' : 'text-stone')}>
                    {s.is_active ? t('common.yes') : t('common.no')}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" onClick={() => { setEditing(s); setError(null); setNotice(null) }}>
                    {t('services.edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editing ? (
        <ServiceDialog
          service={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
            setEditing(null)
            setNotice(t('services.saved'))
          }}
          onError={() => {
            setEditing(null)
            setError(t('common.error'))
          }}
        />
      ) : null}
    </div>
  )
}

function ServiceDialog({
  service,
  onClose,
  onSaved,
  onError,
}: {
  service: Service
  onClose: () => void
  onSaved: (s: Service) => void
  onError: () => void
}) {
  const t = useTranslations('admin')
  const [form, setForm] = useState({
    name_nl: service.name_nl,
    name_en: service.name_en,
    name_fr: service.name_fr ?? '',
    name_es: service.name_es ?? '',
    name_le: service.name_le ?? '',
    description_nl: service.description_nl ?? '',
    description_en: service.description_en ?? '',
    price: centsToEuro(service.price_cents),
    duration_min: String(service.duration_min),
    color: service.color,
    is_active: service.is_active,
    sort_order: String(service.sort_order),
  })
  const [busy, setBusy] = useState(false)

  const set = (k: keyof typeof form, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }))

  async function save() {
    setBusy(true)
    const res = await apiPatch<{ service: Service }>(`/api/admin/services/${service.id}`, {
      name_nl: form.name_nl,
      name_en: form.name_en,
      name_fr: form.name_fr.trim() || null,
      name_es: form.name_es.trim() || null,
      name_le: form.name_le.trim() || null,
      description_nl: form.description_nl.trim() || null,
      description_en: form.description_en.trim() || null,
      price_cents: euroToCents(form.price),
      duration_min: Number(form.duration_min),
      color: form.color,
      is_active: form.is_active,
      sort_order: Number(form.sort_order),
    })
    setBusy(false)
    if (res.ok && res.data?.service) onSaved(res.data.service)
    else onError()
  }

  return (
    <Dialog open onClose={onClose} title={service.name_nl}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('services.name')}>
            <TextInput value={form.name_nl} onChange={(e) => set('name_nl', e.target.value)} />
          </Field>
          <Field label={t('services.nameEn')}>
            <TextInput value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </Field>
          <Field label={t('services.nameFr')}>
            <TextInput value={form.name_fr} onChange={(e) => set('name_fr', e.target.value)} />
          </Field>
          <Field label={t('services.nameEs')}>
            <TextInput value={form.name_es} onChange={(e) => set('name_es', e.target.value)} />
          </Field>
          <Field label={t('services.nameLe')}>
            <TextInput value={form.name_le} onChange={(e) => set('name_le', e.target.value)} />
          </Field>
        </div>
        <Field label={t('services.descNl')}>
          <Textarea value={form.description_nl} onChange={(e) => set('description_nl', e.target.value)} />
        </Field>
        <Field label={t('services.descEn')}>
          <Textarea value={form.description_en} onChange={(e) => set('description_en', e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('services.price')}>
            <TextInput inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </Field>
          <Field label={t('services.duration')}>
            <TextInput inputMode="numeric" value={form.duration_min} onChange={(e) => set('duration_min', e.target.value)} />
          </Field>
          <Field label={t('services.sort')}>
            <TextInput inputMode="numeric" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-between">
          <Field label={t('services.color')}>
            <input
              type="color"
              value={form.color}
              onChange={(e) => set('color', e.target.value)}
              className="h-9 w-16 cursor-pointer rounded-md border border-line-paper bg-white"
              aria-label={t('services.color')}
            />
          </Field>
          <Toggle checked={form.is_active} onChange={(v) => set('is_active', v)} label={t('services.active')} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? t('common.saving') : t('services.save')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
