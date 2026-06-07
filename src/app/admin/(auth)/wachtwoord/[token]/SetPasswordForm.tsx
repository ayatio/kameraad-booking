'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Field, TextInput, Button, Alert } from '@/components/admin/ui'
import { setPasswordAction } from '../../../actions'

const MIN_LEN = 10

export function SetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('admin')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_LEN) {
      setError(t('password.tooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('password.mismatch'))
      return
    }
    setBusy(true)
    try {
      const res = await setPasswordAction(token, password)
      if (res.ok) {
        setDone(true)
        return
      }
      setError(res.code === 'WEAK' ? t('password.tooShort') : t('password.invalidBody'))
    } catch {
      setError(t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert kind="success">{t('password.successBody')}</Alert>
        <Link
          href="/admin/login"
          className="inline-flex items-center justify-center rounded-md bg-gold px-4 py-2 font-display text-[0.82rem] uppercase tracking-display text-ink hover:bg-gold-bright"
        >
          {t('password.toLogin')}
        </Link>
      </div>
    )
  }

  const strong = password.length >= MIN_LEN

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      <Field
        label={t('password.password')}
        htmlFor="pw"
        hint={t('password.hint')}
        error={password.length > 0 && !strong ? t('password.tooShort') : null}
      >
        <TextInput
          id="pw"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label={t('password.confirm')} htmlFor="pw2">
        <TextInput
          id="pw2"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full">
        {busy ? t('password.submitting') : t('password.submit')}
      </Button>
    </form>
  )
}
