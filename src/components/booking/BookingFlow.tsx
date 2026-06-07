'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { BarberWithServices } from '@/lib/db/queries/barbers'
import type { Service } from '@/lib/db/types'
import StepBarber from './StepBarber'
import StepService from './StepService'
import StepSlot from './StepSlot'
import StepDetails from './StepDetails'
import Confirmation from './Confirmation'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  note: string
  cancellationAccepted: boolean
  privacyAccepted: boolean
}

type Step = 1 | 2 | 3 | 4 | 'done'

interface State {
  step: Step
  // Picks (preserved across back-nav per FR-027)
  barberId: string | null
  barberName: string | null
  serviceSlug: string | null
  serviceName: string | null
  servicePriceCents: number | null
  serviceDurationMin: number | null
  selectedDate: string | null
  slotUtc: string | null
  slotTimeLabel: string | null
  // Confirmed booking (after submit)
  confirmedBarberName: string | null
  confirmedSlotDate: string | null
  confirmedSlotTime: string | null
  // Form (preserved across back-nav per FR-027)
  form: FormData
  // UI
  isMobileOpen: boolean
  isSubmitting: boolean
  submitError: string | null
}

interface Props {
  barbers: BarberWithServices[]
  services: Service[]
  locale: string
  cancellationWindowHours: number
  bookingHorizonDays: number
  // FR-020 / FR-022: query-param preselection (server passes as slug/value)
  initialBarberSlug?: string
  initialServiceSlug?: string
  initialDate?: string
}

const emptyForm: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  note: '',
  cancellationAccepted: false,
  privacyAccepted: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localizedServiceName(service: Service, locale: string): string {
  if (locale === 'nl') return service.name_nl
  if (locale === 'en') return service.name_en
  if (locale === 'fr') return service.name_fr ?? service.name_nl
  if (locale === 'es') return service.name_es ?? service.name_nl
  if (locale === 'le') return service.name_le ?? service.name_nl
  return service.name_nl
}

function formatPrice(cents: number): string {
  const euros = cents / 100
  return `€${Number.isInteger(euros) ? euros.toString() : euros.toFixed(2)}`
}

function formatSlotDate(dateStr: string, locale: string, dow: string[], months: string[]): string {
  const [, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(dateStr + 'T12:00:00Z')
  const dayOfWeekEn = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(dt)
  const dowIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayOfWeekEn)
  const dowLabel = dow[dowIdx] ?? dayOfWeekEn
  const monthLabel = months[m - 1] ?? ''
  return `${dowLabel} ${d} ${monthLabel}`
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BookingFlow({
  barbers,
  services,
  locale,
  cancellationWindowHours,
  bookingHorizonDays,
  initialBarberSlug,
  initialServiceSlug,
  initialDate,
}: Props) {
  const t = useTranslations('booking')
  const dow = t.raw('dow') as string[]
  const months = t.raw('months') as string[]

  // Build initial state from preselection query params (FR-020, FR-022)
  const [state, setState] = useState<State>(() => {
    const preBarber = initialBarberSlug
      ? barbers.find((b) => b.slug === initialBarberSlug) ?? null
      : null
    const preServiceObj = initialServiceSlug
      ? services.find((s) => s.slug === initialServiceSlug && s.is_active && !s.is_walk_in) ?? null
      : null
    const preServiceName = preServiceObj ? localizedServiceName(preServiceObj, locale) : null

    let initialStep: Step = 1
    if (preBarber && preServiceObj) initialStep = 3
    else if (preBarber) initialStep = 2

    return {
      step: initialStep,
      barberId: preBarber?.id ?? null,
      barberName: preBarber?.name ?? null,
      serviceSlug: preServiceObj?.slug ?? null,
      serviceName: preServiceName,
      servicePriceCents: preServiceObj?.price_cents ?? null,
      serviceDurationMin: preServiceObj?.duration_min ?? null,
      selectedDate: initialDate ?? null,
      slotUtc: null,
      slotTimeLabel: null,
      confirmedBarberName: null,
      confirmedSlotDate: null,
      confirmedSlotTime: null,
      form: emptyForm,
      isMobileOpen: false,
      isSubmitting: false,
      submitError: null,
    }
  })

  // Body class for mobile wizard
  useEffect(() => {
    if (state.isMobileOpen) {
      document.body.classList.add('bk-open')
    } else {
      document.body.classList.remove('bk-open')
    }
    return () => document.body.classList.remove('bk-open')
  }, [state.isMobileOpen])

  // Esc to close mobile wizard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.isMobileOpen) {
        setState((prev) => ({ ...prev, isMobileOpen: false }))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.isMobileOpen])

  // ─── Selection handlers ────────────────────────────────────────────────────

  const selectBarber = useCallback((barberId: string, barberName: string) => {
    setState((prev) => ({
      ...prev,
      step: 2,
      barberId,
      barberName,
      // Clear downstream picks
      serviceSlug: null,
      serviceName: null,
      servicePriceCents: null,
      serviceDurationMin: null,
      selectedDate: null,
      slotUtc: null,
      slotTimeLabel: null,
      submitError: null,
    }))
  }, [])

  const selectService = useCallback(
    (serviceSlug: string, serviceName: string, priceCents: number, durationMin: number) => {
      setState((prev) => ({
        ...prev,
        step: 3,
        serviceSlug,
        serviceName,
        servicePriceCents: priceCents,
        serviceDurationMin: durationMin,
        selectedDate: null,
        slotUtc: null,
        slotTimeLabel: null,
        submitError: null,
      }))
    },
    [],
  )

  const selectDate = useCallback((date: string) => {
    setState((prev) => ({
      ...prev,
      selectedDate: date,
      slotUtc: null,
      slotTimeLabel: null,
    }))
  }, [])

  const selectSlot = useCallback((date: string, utc: string, timeLabel: string) => {
    setState((prev) => ({
      ...prev,
      step: 4,
      selectedDate: date,
      slotUtc: utc,
      slotTimeLabel: timeLabel,
      submitError: null,
    }))
  }, [])

  const openStep = useCallback((targetStep: 1 | 2 | 3 | 4) => {
    setState((prev) => ({ ...prev, step: targetStep, submitError: null }))
  }, [])

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.step === 'done') return { ...prev, step: 4 }
      if (typeof prev.step === 'number' && prev.step > 1) {
        return { ...prev, step: (prev.step - 1) as 1 | 2 | 3 | 4 }
      }
      // Step 1 back = close mobile wizard
      return { ...prev, isMobileOpen: false }
    })
  }, [])

  const updateForm = useCallback((field: keyof FormData, value: string | boolean) => {
    setState((prev) => ({ ...prev, form: { ...prev.form, [field]: value } }))
  }, [])

  const reset = useCallback(() => {
    setState({
      step: 1,
      barberId: null,
      barberName: null,
      serviceSlug: null,
      serviceName: null,
      servicePriceCents: null,
      serviceDurationMin: null,
      selectedDate: null,
      slotUtc: null,
      slotTimeLabel: null,
      confirmedBarberName: null,
      confirmedSlotDate: null,
      confirmedSlotTime: null,
      form: emptyForm,
      isMobileOpen: false,
      isSubmitting: false,
      submitError: null,
    })
  }, [])

  // ─── Submit ────────────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    const { barberId, serviceSlug, slotUtc, form } = state
    if (!barberId || !serviceSlug || !slotUtc) return

    setState((prev) => ({ ...prev, isSubmitting: true, submitError: null }))

    try {
      const body = {
        barberId,
        serviceSlug,
        startAtUtc: slotUtc,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        note: form.note.trim() || undefined,
        locale,
        cancellationPolicyAccepted: form.cancellationAccepted as true,
        privacyAccepted: form.privacyAccepted as true,
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.status === 201) {
        const data = (await res.json()) as {
          appointmentId: string
          summary: { barberId: string; startAt: string }
        }
        // Resolve assigned barber name (FR-016)
        const assignedBarber = barbers.find((b) => b.id === data.summary.barberId)
        const assignedName = assignedBarber?.name ?? state.barberName ?? ''
        setState((prev) => ({
          ...prev,
          step: 'done',
          confirmedBarberName: assignedName,
          confirmedSlotDate: prev.selectedDate,
          confirmedSlotTime: prev.slotTimeLabel,
          isSubmitting: false,
        }))
        return
      }

      if (res.status === 409) {
        // FR-018: slot taken, show error (refreshed slots handled by re-fetch in StepSlot)
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          slotUtc: null,
          slotTimeLabel: null,
          step: 3,
          submitError: t('error.slotTaken'),
        }))
        return
      }

      const errData = (await res.json().catch(() => ({}))) as Record<string, unknown>
      const msg = typeof errData.error === 'string' ? errData.error : t('error.generic')
      setState((prev) => ({ ...prev, isSubmitting: false, submitError: msg }))
    } catch {
      setState((prev) => ({ ...prev, isSubmitting: false, submitError: t('error.generic') }))
    }
  }, [state, locale, barbers, t])

  // ─── Accordion helpers ─────────────────────────────────────────────────────

  function isDone(n: 1 | 2 | 3 | 4): boolean {
    if (n === 1) return state.barberId !== null
    if (n === 2) return state.serviceSlug !== null
    if (n === 3) return state.slotUtc !== null
    return state.step === 'done'
  }

  function stepClass(n: 1 | 2 | 3 | 4): string {
    if (state.step === n) return 'bk-step is-open'
    if (isDone(n)) return 'bk-step is-done'
    return 'bk-step is-locked'
  }

  // ─── Derived display values ────────────────────────────────────────────────

  const barberPickLabel =
    state.barberId === 'any' ? t('noPreferenceLow') : state.barberName ?? ''

  const servicePickLabel = (() => {
    if (!state.serviceName || !state.servicePriceCents) return ''
    return `${state.serviceName} ${formatPrice(state.servicePriceCents)}`
  })()

  const slotPickLabel = (() => {
    if (!state.selectedDate || !state.slotTimeLabel) return ''
    return `${formatSlotDate(state.selectedDate, locale, dow, months)} · ${state.slotTimeLabel}`
  })()

  // Service IDs available for step 2 filtering
  const selectedBarberServiceIds: string[] | null = (() => {
    if (state.barberId === 'any' || state.barberId === null) return null
    const barber = barbers.find((b) => b.id === state.barberId)
    return barber?.service_ids ?? null
  })()

  // ─── Step 4 display values ─────────────────────────────────────────────────

  const confirmBarberDisplay =
    state.barberId === 'any'
      ? t('noPreference')
      : state.barberName ?? t('noPreference')

  const confirmSlotDate = state.selectedDate
    ? formatSlotDate(state.selectedDate, locale, dow, months)
    : ''

  // ─── Render ────────────────────────────────────────────────────────────────

  const currentStepNum = typeof state.step === 'number' ? state.step : 0

  return (
    <>
      {/* Mobile open button — hidden at >680px, shown at ≤680px */}
      <button
        type="button"
        className="bk-open-btn"
        onClick={() => setState((prev) => ({ ...prev, isMobileOpen: true }))}
        aria-haspopup="dialog"
      >
        {t('openButton')}
      </button>

      {/* Booking card — always visible at >680px; popup wizard at ≤680px when open */}
      <div
        className="bk-card bg-paper rounded-lg shadow-3 p-[clamp(26px,3vw,42px)]"
        role={state.isMobileOpen ? 'dialog' : undefined}
        aria-modal={state.isMobileOpen ? true : undefined}
        aria-label={t('title')}
      >
        {/* Mobile modal bar (hidden on desktop) */}
        <div className="bk-modalbar">
          <button
            type="button"
            className="w-10 h-10 rounded-full grid place-content-center text-ink text-[1.15rem] border-none bg-transparent cursor-pointer hover:bg-paper-2 active:bg-paper-2 transition-colors"
            onClick={goBack}
            aria-label={t('back')}
          >
            ←
          </button>
          {/* Progress dots */}
          <div className="flex gap-[7px] flex-1 justify-center" aria-hidden="true">
            {([1, 2, 3, 4] as const).map((n) => (
              <span
                key={n}
                className={`h-[7px] rounded-full transition-all duration-300 ${
                  n === currentStepNum
                    ? 'w-[22px] bg-gold rounded-[4px]'
                    : isDone(n)
                    ? 'w-[7px] bg-gold-deep'
                    : 'w-[7px] bg-line-paper'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            className="w-10 h-10 rounded-full grid place-content-center text-ink text-[1.15rem] border-none bg-transparent cursor-pointer hover:bg-paper-2 active:bg-paper-2 transition-colors"
            onClick={() => setState((prev) => ({ ...prev, isMobileOpen: false }))}
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>

        {/* Walk-in info band */}
        <div className="flex items-center gap-3 mb-6 px-4 py-3.5 rounded-md bg-gradient-to-r from-gold/[0.16] to-gold/[0.06] border border-gold/40">
          <span className="shrink-0 w-2 h-2 rounded-full bg-gold-deep animate-pulse" />
          <p className="text-[0.92rem] text-fg2 leading-snug">
            <strong className="text-ink font-semibold">{t('walkIn.title')}</strong>
            {' — '}
            {t('walkInBand')}
          </p>
        </div>

        {/* Flow — steps or confirmation */}
        {state.step === 'done' ? (
          <Confirmation
            serviceName={state.serviceName ?? ''}
            barberName={state.confirmedBarberName ?? confirmBarberDisplay}
            slotDate={state.confirmedSlotDate ? formatSlotDate(state.confirmedSlotDate, locale, dow, months) : ''}
            slotTime={state.confirmedSlotTime ?? ''}
            onReset={reset}
          />
        ) : (
          <div className="bk-flow">
            {/* Step 1 — Barber */}
            <div className={stepClass(1)}>
              <div
                className="bk-h"
                onClick={() => isDone(1) && openStep(1)}
                role={isDone(1) && state.step !== 1 ? 'button' : undefined}
                tabIndex={isDone(1) && state.step !== 1 ? 0 : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (isDone(1) && state.step !== 1) openStep(1)
                  }
                }}
              >
                <span className="bk-n">01</span>
                <span>{t('step.barber')}</span>
                <span className="bk-pick">{barberPickLabel}</span>
              </div>
              <div className="bk-body">
                <StepBarber
                  barbers={barbers}
                  locale={locale}
                  selectedBarberId={state.barberId}
                  onSelect={selectBarber}
                />
              </div>
            </div>

            {/* Step 2 — Service */}
            <div className={stepClass(2)}>
              <div
                className="bk-h"
                onClick={() => isDone(2) && openStep(2)}
                role={isDone(2) && state.step !== 2 ? 'button' : undefined}
                tabIndex={isDone(2) && state.step !== 2 ? 0 : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (isDone(2) && state.step !== 2) openStep(2)
                  }
                }}
              >
                <span className="bk-n">02</span>
                <span>{t('step.service')}</span>
                <span className="bk-pick">{servicePickLabel}</span>
              </div>
              <div className="bk-body">
                <StepService
                  services={services}
                  locale={locale}
                  selectedBarberServiceIds={selectedBarberServiceIds}
                  selectedServiceSlug={state.serviceSlug}
                  onSelect={selectService}
                />
              </div>
            </div>

            {/* Step 3 — Slot */}
            <div className={stepClass(3)}>
              <div
                className="bk-h"
                onClick={() => isDone(3) && openStep(3)}
                role={isDone(3) && state.step !== 3 ? 'button' : undefined}
                tabIndex={isDone(3) && state.step !== 3 ? 0 : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (isDone(3) && state.step !== 3) openStep(3)
                  }
                }}
              >
                <span className="bk-n">03</span>
                <span>{t('step.slot')}</span>
                <span className="bk-pick">{slotPickLabel}</span>
              </div>
              <div className="bk-body">
                {state.step === 3 && state.barberId && state.serviceSlug && (
                  <StepSlot
                    barberId={state.barberId}
                    serviceSlug={state.serviceSlug}
                    horizonDays={bookingHorizonDays}
                    locale={locale}
                    selectedDate={state.selectedDate}
                    selectedSlotUtc={state.slotUtc}
                    onDateChange={selectDate}
                    onSlotSelect={selectSlot}
                  />
                )}
                {/* Show slot-taken error when returning to step 3 after 409 */}
                {state.step === 3 && state.submitError && (
                  <p className="text-[0.86rem] text-red-600 mt-3" role="alert">
                    {state.submitError}
                  </p>
                )}
              </div>
            </div>

            {/* Step 4 — Details */}
            <div className={stepClass(4)}>
              <div className="bk-h">
                <span className="bk-n">04</span>
                <span>{t('step.details')}</span>
              </div>
              <div className="bk-body">
                {state.step === 4 &&
                  state.serviceSlug &&
                  state.serviceName &&
                  state.slotUtc && (
                    <StepDetails
                      form={state.form}
                      locale={locale}
                      cancellationWindowHours={cancellationWindowHours}
                      serviceSlug={state.serviceSlug}
                      serviceName={state.serviceName}
                      barberName={confirmBarberDisplay}
                      slotDate={confirmSlotDate}
                      slotTime={state.slotTimeLabel ?? ''}
                      isSubmitting={state.isSubmitting}
                      error={state.step === 4 ? state.submitError : null}
                      onChange={updateForm}
                      onSubmit={submit}
                    />
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
