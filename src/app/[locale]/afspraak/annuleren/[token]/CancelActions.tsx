'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  token: string
}

type Phase = 'idle' | 'confirming' | 'loading' | 'success' | 'error'

export default function CancelActions({ token }: Props) {
  const t = useTranslations('manage.cancel')
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleConfirm() {
    setPhase('loading')
    try {
      const res = await fetch('/api/manage/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json()) as { ok?: boolean; alreadyCancelled?: boolean; error?: string }
      if (data.ok) {
        setPhase('success')
      } else if (res.status === 403) {
        setErrorMsg(t('outsideWindowError'))
        setPhase('error')
      } else {
        setErrorMsg(t('genericError'))
        setPhase('error')
      }
    } catch {
      setErrorMsg(t('genericError'))
      setPhase('error')
    }
  }

  if (phase === 'success') {
    return (
      <div className="flex flex-col gap-3">
        <p
          className="font-serif text-ink"
          style={{ fontSize: '1.15rem', lineHeight: 1.5 }}
        >
          {t('successHeading')}
        </p>
        <p className="text-smoke" style={{ fontSize: '0.92rem', lineHeight: 1.6 }}>
          {t('successBody')}
        </p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <p className="text-smoke" style={{ fontSize: '0.92rem' }}>
        {errorMsg}
      </p>
    )
  }

  if (phase === 'confirming' || phase === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <p
          className="font-display uppercase text-ink"
          style={{ letterSpacing: '0.12em', fontSize: '0.8rem' }}
        >
          {t('confirmQuestion')}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={phase === 'loading'}
            onClick={handleConfirm}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-ink/30 bg-ink text-paper font-display uppercase transition-opacity disabled:opacity-50"
            style={{ letterSpacing: '0.14em', fontSize: '0.78rem' }}
          >
            {phase === 'loading' ? t('loading') : t('confirmDefinitive')}
          </button>
          <button
            type="button"
            disabled={phase === 'loading'}
            onClick={() => setPhase('idle')}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-ink/20 text-smoke font-display uppercase transition-colors hover:border-ink/40 disabled:opacity-50"
            style={{ letterSpacing: '0.14em', fontSize: '0.78rem' }}
          >
            {t('keepButton')}
          </button>
        </div>
      </div>
    )
  }

  // idle
  return (
    <button
      type="button"
      onClick={() => setPhase('confirming')}
      className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-gold text-gold-deep font-display uppercase transition-colors hover:bg-gold/10"
      style={{ letterSpacing: '0.14em', fontSize: '0.78rem' }}
    >
      {t('confirmButton')}
    </button>
  )
}
