'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Field, TextInput, Button, Alert } from '@/components/admin/ui'
import { loginAction } from '../../actions'

export function LoginForm() {
  const t = useTranslations('admin')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<'invalid' | 'locked' | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await loginAction(email, password)
      if (res.ok) {
        router.replace('/admin')
        router.refresh()
        return
      }
      setError(res.reason)
      setBusy(false)
    } catch {
      setError('invalid')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? (
        <Alert kind="error">{error === 'locked' ? t('login.errorLocked') : t('login.errorInvalid')}</Alert>
      ) : null}
      <Field label={t('login.email')} htmlFor="email">
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label={t('login.password')} htmlFor="password">
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full">
        {busy ? t('login.submitting') : t('login.submit')}
      </Button>
    </form>
  )
}
