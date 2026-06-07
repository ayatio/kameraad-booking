'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog } from '@/components/admin/Overlay'
import { Button, Field, TextInput, Select, Alert, cn } from '@/components/admin/ui'
import { apiGet, apiPost } from '@/components/admin/api'
import { todayBrussels } from '@/components/admin/format'
import type { BarberLite, ServiceLite, ActorLite } from './types'

type SlotRow = { startAtUtc: string; localLabel: string; localDate: string }

export function ManualBookingDialog({
  open,
  barbers,
  services,
  actor,
  onClose,
  onCreated,
}: {
  open: boolean
  barbers: BarberLite[]
  services: ServiceLite[]
  actor: ActorLite
  onClose: () => void
  onCreated: () => void
}) {
  const t = useTranslations('admin')

  // Barbers a barber-role actor may book for: only themselves.
  const selectableBarbers = useMemo(
    () => (actor.role === 'owner' ? barbers : barbers.filter((b) => b.id === actor.barberId)),
    [actor, barbers],
  )

  const [barberId, setBarberId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(todayBrussels())
  const [slots, setSlots] = useState<SlotRow[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotUtc, setSlotUtc] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setBarberId(selectableBarbers[0]?.id ?? '')
      setServiceId('')
      setDate(todayBrussels())
      setSlots(null)
      setSlotUtc(null)
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setNote('')
      setError(null)
      setBusy(false)
    }
  }, [open, selectableBarbers])

  const barber = barbers.find((b) => b.id === barberId)
  const offeredServices = useMemo(
    () =>
      services.filter(
        (s) => s.is_active && !s.is_walk_in && (!barber || barber.service_ids.includes(s.id)),
      ),
    [services, barber],
  )
  const service = services.find((s) => s.id === serviceId)

  async function fetchSlots() {
    if (!barberId || !service) {
      setError(t('manual.selectBarberService'))
      return
    }
    setError(null)
    setSlotsLoading(true)
    setSlots(null)
    setSlotUtc(null)
    const res = await apiGet<{ slots: SlotRow[] }>(
      `/api/slots?barberId=${encodeURIComponent(barberId)}&service=${encodeURIComponent(service.slug)}&from=${date}&to=${date}`,
    )
    setSlots(res.ok && res.data ? res.data.slots : [])
    setSlotsLoading(false)
  }

  async function submit() {
    if (!barberId || !service || !slotUtc) {
      setError(t('manual.selectBarberService'))
      return
    }
    setBusy(true)
    setError(null)
    const res = await apiPost<Record<string, unknown>>('/api/admin/bookings', {
      barberId,
      serviceSlug: service.slug,
      startAtUtc: slotUtc,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      locale: 'nl',
    })
    setBusy(false)
    if (res.status === 201) {
      onCreated()
      return
    }
    if (res.status === 409) setError(t('drawer.slotTaken'))
    else {
      const msg = typeof res.data?.message === 'string' ? res.data.message : t('common.error')
      setError(msg)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('manual.title')}>
      <div className="flex flex-col gap-4">
        {error ? <Alert kind="error">{error}</Alert> : null}

        <Field label={t('manual.barber')}>
          <Select
            value={barberId}
            disabled={actor.role !== 'owner'}
            onChange={(e) => {
              setBarberId(e.target.value)
              setServiceId('')
              setSlots(null)
              setSlotUtc(null)
            }}
          >
            {selectableBarbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('manual.service')}>
          <Select
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value)
              setSlots(null)
              setSlotUtc(null)
            }}
          >
            <option value="">—</option>
            {offeredServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_nl}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label={t('manual.date')}>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Button variant="secondary" onClick={fetchSlots} disabled={!service}>
            {t('manual.pickSlot')}
          </Button>
        </div>

        {slotsLoading ? (
          <span className="text-[0.82rem] text-smoke">{t('common.loading')}</span>
        ) : slots ? (
          slots.length > 0 ? (
            <div className="grid grid-cols-4 gap-1.5">
              {slots.map((s) => (
                <button
                  key={s.startAtUtc}
                  type="button"
                  onClick={() => setSlotUtc(s.startAtUtc)}
                  className={cn(
                    'rounded-md border py-2 text-center text-[0.82rem] transition-colors',
                    slotUtc === s.startAtUtc
                      ? 'border-gold bg-gold/15 font-semibold text-gold-deep'
                      : 'border-line-paper bg-white text-ink hover:border-gold',
                  )}
                >
                  {s.localLabel}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[0.82rem] text-smoke">{t('manual.noSlots')}</span>
          )
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('manual.firstName')}>
            <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label={t('manual.lastName')}>
            <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>
        <Field label={`${t('manual.email')} (${t('common.optional')})`} hint={t('manual.emailHint')}>
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={`${t('manual.phone')} (${t('common.optional')})`}>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={`${t('manual.note')} (${t('common.optional')})`}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={busy || !slotUtc || !firstName.trim() || !lastName.trim()}
          >
            {busy ? t('manual.creating') : t('manual.create')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
