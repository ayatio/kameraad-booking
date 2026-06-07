'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { SettingsValues } from '@/lib/services/admin-settings'
import { apiGet, apiPut, apiPost } from '@/components/admin/api'
import { PageHeader, Card, Button, Field, TextInput, Select, Alert, Spinner, StatusBadge } from '@/components/admin/ui'

const KEYS: (keyof SettingsValues)[] = [
  'cancellation_window_hours',
  'buffer_min',
  'min_lead_time_hours',
  'booking_horizon_days',
  'rebooking_weeks',
]

interface AdminUserLite {
  id: string
  email: string
  role: 'owner' | 'barber'
  barber_id: string | null
  has_password: boolean
  locked_until: string | null
}

export function SettingsEditor({ initial }: { initial: SettingsValues }) {
  const t = useTranslations('admin')
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(KEYS.map((k) => [k, String(initial[k])])),
  )
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  async function save() {
    setBusy(true)
    setNotice(null)
    setErrors([])
    const body = Object.fromEntries(KEYS.map((k) => [k, Number(form[k])]))
    const res = await apiPut<{ errors?: string[] }>('/api/admin/settings', body)
    setBusy(false)
    if (res.ok) setNotice(t('settings.saved'))
    else if (res.status === 422 && res.data?.errors) setErrors(res.data.errors)
    else setErrors([t('common.error')])
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} />

      {errors.length > 0 ? (
        <div className="mb-4">
          <Alert kind="error">
            <ul className="list-disc pl-4">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      ) : null}

      <Card className="mb-8 max-w-xl p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {KEYS.map((k) => (
            <Field key={k} label={t(`settings.${k}`)}>
              <TextInput
                inputMode="numeric"
                value={form[k]}
                onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        <div className="mt-5">
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? t('common.saving') : t('settings.save')}
          </Button>
        </div>
      </Card>

      <AdminUsers />
    </div>
  )
}

function AdminUsers() {
  const t = useTranslations('admin')
  const [users, setUsers] = useState<AdminUserLite[] | null>(null)
  const [barbers, setBarbers] = useState<{ id: string; name: string }[]>([])
  const [email, setEmail] = useState('')
  const [barberId, setBarberId] = useState('')
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    const res = await apiGet<{ users: AdminUserLite[]; barbers: { id: string; name: string }[] }>(
      '/api/admin/users',
    )
    if (res.ok && res.data) {
      setUsers(res.data.users)
      setBarbers(res.data.barbers)
      setBarberId((prev) => prev || res.data!.barbers[0]?.id || '')
    } else {
      setUsers([])
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function invite() {
    setBusy(true)
    setError(null)
    setLink(null)
    setCopied(false)
    const res = await apiPost<{ link: string }>('/api/admin/users', { email: email.trim(), barberId })
    setBusy(false)
    if (res.status === 201 && res.data?.link) {
      setLink(res.data.link)
      setEmail('')
      load()
    } else if (res.status === 409) {
      setError(t('users.emailInUse'))
    } else {
      setError(t('common.error'))
    }
  }

  const barberName = new Map(barbers.map((b) => [b.id, b.name]))
  function statusFor(u: AdminUserLite): { key: string; label: string } {
    if (u.locked_until && new Date(u.locked_until).getTime() > Date.now())
      return { key: 'no_show', label: t('users.statusLocked') }
    if (!u.has_password) return { key: 'pending', label: t('users.statusPending') }
    return { key: 'completed', label: t('users.statusActive') }
  }

  return (
    <div>
      <h2 className="mb-3 font-display text-[1.1rem] uppercase tracking-display text-ink">
        {t('users.title')}
      </h2>

      {users === null ? (
        <Spinner label={t('common.loading')} />
      ) : (
        <Card className="mb-6 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[0.86rem]">
            <thead>
              <tr className="border-b border-line-paper font-display text-[0.66rem] uppercase tracking-display text-smoke">
                <th className="px-4 py-3">{t('users.email')}</th>
                <th className="px-4 py-3">{t('users.role')}</th>
                <th className="px-4 py-3">{t('users.barber')}</th>
                <th className="px-4 py-3">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const st = statusFor(u)
                return (
                  <tr key={u.id} className="border-b border-line-paper/60">
                    <td className="px-4 py-2.5 text-ink">{u.email}</td>
                    <td className="px-4 py-2.5 text-fg2">{t(`role.${u.role}`)}</td>
                    <td className="px-4 py-2.5 text-fg2">
                      {u.barber_id ? barberName.get(u.barber_id) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={st.key} label={st.label} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="max-w-xl p-5">
        <h3 className="mb-4 font-display text-[0.8rem] uppercase tracking-display text-ink">
          {t('users.invite')}
        </h3>
        {error ? (
          <div className="mb-3">
            <Alert kind="error">{error}</Alert>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('users.inviteEmail')}>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t('users.inviteBarber')}>
            <Select value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button variant="primary" className="mt-4" onClick={invite} disabled={busy || !email.trim() || !barberId}>
          {busy ? t('users.inviting') : t('users.sendInvite')}
        </Button>

        {link ? (
          <div className="mt-4 rounded-md border border-gold/40 bg-gold/10 p-3">
            <div className="mb-1 font-display text-[0.66rem] uppercase tracking-eyebrow text-gold-deep">
              {t('users.linkTitle')}
            </div>
            <p className="mb-2 text-[0.78rem] text-fg2">{t('users.linkBody')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-paper px-2 py-1.5 text-[0.72rem] text-ink">
                {link}
              </code>
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(link).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  )
                }}
              >
                {copied ? t('users.copied') : t('users.copy')}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
