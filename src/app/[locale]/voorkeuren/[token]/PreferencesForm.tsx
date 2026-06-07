'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  token: string
  initialReminders: boolean
  initialRebooking: boolean
  initialMarketing: boolean
}

type Phase = 'idle' | 'saving' | 'saved' | 'error'

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled: boolean
}) {
  return (
    <label
      className="flex items-start gap-4 cursor-pointer select-none"
      style={{ opacity: disabled ? 0.6 : 1 }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="mt-0.5 flex-none w-10 h-6 rounded-full border transition-colors duration-200 relative"
        style={{
          background: checked ? 'var(--color-gold, #C9A24B)' : 'transparent',
          borderColor: checked ? 'var(--color-gold, #C9A24B)' : 'rgba(22,20,15,0.25)',
        }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-paper transition-transform duration-200 shadow-sm"
          style={{
            left: checked ? 'calc(100% - 1.35rem)' : '0.1rem',
          }}
        />
      </button>
      <div className="flex flex-col gap-0.5">
        <span className="text-ink" style={{ fontSize: '0.92rem', fontWeight: 500 }}>
          {label}
        </span>
        <span className="text-smoke" style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
          {hint}
        </span>
      </div>
    </label>
  )
}

export default function PreferencesForm({
  token,
  initialReminders,
  initialRebooking,
  initialMarketing,
}: Props) {
  const t = useTranslations('preferences')
  const [reminders, setReminders] = useState(initialReminders)
  const [rebooking, setRebooking] = useState(initialRebooking)
  const [marketing, setMarketing] = useState(initialMarketing)
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave() {
    setPhase('saving')
    try {
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reminders, rebooking, marketing }),
      })
      if (res.ok) {
        setPhase('saved')
      } else {
        setErrorMsg(t('genericError'))
        setPhase('error')
      }
    } catch {
      setErrorMsg(t('genericError'))
      setPhase('error')
    }
  }

  const busy = phase === 'saving'

  return (
    <div className="flex flex-col gap-6">
      <Toggle
        label={t('reminders')}
        hint={t('remindersHint')}
        checked={reminders}
        onChange={setReminders}
        disabled={busy}
      />
      <Toggle
        label={t('rebooking')}
        hint={t('rebookingHint')}
        checked={rebooking}
        onChange={setRebooking}
        disabled={busy}
      />
      <Toggle
        label={t('marketing')}
        hint={t('marketingHint')}
        checked={marketing}
        onChange={setMarketing}
        disabled={busy}
      />

      <div className="flex items-center gap-4 pt-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleSave}
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-gold text-gold-deep font-display uppercase transition-colors hover:bg-gold/10 disabled:opacity-50"
          style={{ letterSpacing: '0.14em', fontSize: '0.78rem' }}
        >
          {busy ? t('saving') : t('saveButton')}
        </button>
        {phase === 'saved' && (
          <span className="text-smoke" style={{ fontSize: '0.82rem' }}>
            {t('savedMessage')}
          </span>
        )}
        {phase === 'error' && (
          <span className="text-smoke" style={{ fontSize: '0.82rem' }}>
            {errorMsg}
          </span>
        )}
      </div>
    </div>
  )
}
