'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { FormData } from './BookingFlow'

interface Props {
  form: FormData
  locale: string
  cancellationWindowHours: number
  serviceSlug: string
  serviceName: string
  barberName: string
  slotDate: string
  slotTime: string
  isSubmitting: boolean
  error: string | null
  onChange: (field: keyof FormData, value: string | boolean) => void
  onSubmit: () => void
}

function Field({
  label,
  id,
  type = 'text',
  value,
  onChange,
  error,
  required,
  placeholder,
  hint,
}: {
  label: string
  id: string
  type?: string
  value: string
  onChange: (v: string) => void
  error?: string
  required?: boolean
  placeholder?: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="font-display uppercase tracking-[0.1em] text-[0.66rem] text-smoke"
      >
        {label}
        {required && <span className="text-gold-deep ml-1" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={
          id === 'bf-email'
            ? 'email'
            : id === 'bf-phone'
            ? 'tel'
            : id === 'bf-firstName'
            ? 'given-name'
            : id === 'bf-lastName'
            ? 'family-name'
            : undefined
        }
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`border rounded-md px-4 py-3 text-[0.95rem] font-body text-ink bg-white w-full transition-[border-color,box-shadow] duration-200 focus:outline-none focus:border-gold focus:shadow-[0_0_0_3px_rgba(201,162,75,.18)] ${
          error ? 'border-red-400' : 'border-line-paper'
        }`}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        aria-invalid={error ? true : undefined}
      />
      {hint && !error && (
        <span id={`${id}-hint`} className="text-[0.76rem] text-stone">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className="text-[0.78rem] text-red-500" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export default function StepDetails({
  form,
  locale,
  cancellationWindowHours,
  serviceName,
  barberName,
  slotDate,
  slotTime,
  isSubmitting,
  error,
  onChange,
  onSubmit,
}: Props) {
  const t = useTranslations('booking')
  const tf = useTranslations('booking.form')
  const tv = useTranslations('booking.validation')

  // Simple client-side validation state
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({})

  function touch(field: keyof FormData) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function getFieldError(field: keyof FormData): string | undefined {
    if (!touched[field]) return undefined
    const val = form[field]
    if (field === 'firstName' || field === 'lastName') {
      if (typeof val === 'string' && !val.trim()) return tf('required')
    }
    if (field === 'email') {
      if (typeof val === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return tf('emailInvalid')
    }
    if (field === 'phone') {
      if (typeof val === 'string' && !/^(\+32|0)\d[\d\s\-./]{6,14}\d$/.test(val)) return tf('phoneInvalid')
    }
    if (field === 'note') {
      if (typeof val === 'string' && val.length > 500) return tf('noteMaxLength')
    }
    return undefined
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Mark all fields as touched to show validation
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      note: true,
    })
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* Booking summary */}
      <div className="rounded-md bg-paper-2 border border-line-paper px-4 py-3 text-[0.88rem] text-fg2 leading-relaxed mb-1">
        <strong className="text-ink">{serviceName}</strong>
        {' · '}
        {barberName}
        {' · '}
        {slotDate}
        {' · '}
        {slotTime}
      </div>

      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="bf-firstName"
          label={tf('firstName')}
          value={form.firstName}
          required
          onChange={(v) => { onChange('firstName', v); touch('firstName') }}
          error={getFieldError('firstName')}
        />
        <Field
          id="bf-lastName"
          label={tf('lastName')}
          value={form.lastName}
          required
          onChange={(v) => { onChange('lastName', v); touch('lastName') }}
          error={getFieldError('lastName')}
        />
      </div>

      <Field
        id="bf-email"
        label={tf('email')}
        type="email"
        value={form.email}
        required
        onChange={(v) => { onChange('email', v); touch('email') }}
        error={getFieldError('email')}
      />

      <Field
        id="bf-phone"
        label={tf('phone')}
        type="tel"
        value={form.phone}
        required
        onChange={(v) => { onChange('phone', v); touch('phone') }}
        error={getFieldError('phone')}
        hint={tf('phoneHelp')}
      />

      {/* Note */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="bf-note"
          className="font-display uppercase tracking-[0.1em] text-[0.66rem] text-smoke"
        >
          {tf('note')}
        </label>
        <textarea
          id="bf-note"
          rows={3}
          value={form.note}
          maxLength={500}
          placeholder={tf('notePlaceholder')}
          onChange={(e) => { onChange('note', e.target.value); touch('note') }}
          className={`border rounded-md px-4 py-3 text-[0.95rem] font-body text-ink bg-white w-full resize-none transition-[border-color,box-shadow] duration-200 focus:outline-none focus:border-gold focus:shadow-[0_0_0_3px_rgba(201,162,75,.18)] ${
            getFieldError('note') ? 'border-red-400' : 'border-line-paper'
          }`}
        />
        <div className="flex justify-between">
          {getFieldError('note') ? (
            <span className="text-[0.78rem] text-red-500">{getFieldError('note')}</span>
          ) : (
            <span />
          )}
          <span className="text-[0.72rem] text-stone tabular-nums">{form.note.length}/500</span>
        </div>
      </div>

      {/* Checkboxes — FR-023 cancellation, FR-024 privacy */}
      <div className="flex flex-col gap-3 pt-1">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.cancellationAccepted}
            onChange={(e) => onChange('cancellationAccepted', e.target.checked)}
            required
            className="mt-0.5 shrink-0 w-4 h-4 accent-gold-deep cursor-pointer"
          />
          <span className="text-[0.86rem] text-fg2 leading-snug">
            {tv('cancellationPolicy', { hours: cancellationWindowHours })}
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.privacyAccepted}
            onChange={(e) => onChange('privacyAccepted', e.target.checked)}
            required
            className="mt-0.5 shrink-0 w-4 h-4 accent-gold-deep cursor-pointer"
          />
          <span className="text-[0.86rem] text-fg2 leading-snug">
            {tv('privacyConsent')}{' '}
            <a
              href={`/${locale}/privacy`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-gold-deep hover:text-gold transition-colors"
            >
              {t('privacyLinkText')}
            </a>
          </span>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-[0.88rem] text-red-700"
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || !form.cancellationAccepted || !form.privacyAccepted}
        className="w-full font-display uppercase tracking-[0.14em] text-[0.8rem] font-medium bg-gold text-ink border-none rounded-pill px-8 py-4 cursor-pointer transition-[background,transform,opacity] duration-200 hover:enabled:bg-gold-bright active:enabled:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed mt-1"
      >
        {isSubmitting ? t('submitting') : t('confirm')}
      </button>
    </form>
  )
}


