import db from '../db/index'
import type { Appointment, Barber, Customer, Service } from '../db/types'
import { buildIcs } from './ics'
import { getTransport } from './transport'
import type { OutgoingEmail } from './transport'
import { renderTemplate } from '../../emails/render'
import type { EmailType, SupportedLocale } from '../../emails/render'

export type { EmailType, SupportedLocale }

const SENDER = 'afspraak@kameraadhaarsnijder.be'
const BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const FOOTER_ADDRESS = 'Parijsstraat 29 · 3000 Leuven · België'

export interface SendEmailParams {
  type: EmailType
  appointment: Appointment
  customer: Customer
  barber: Barber
  service: Service
  sequence?: number
}

export interface SendEmailResult {
  id: string
  skipped?: boolean
}

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as Record<string, unknown>)['code'] === '23505'
  )
}

function formatDate(isoString: string, locale: SupportedLocale): string {
  const date = new Date(isoString)
  const lang = locale === 'le' ? 'nl-BE' : locale === 'es' ? 'es' : `${locale}-BE`
  return new Intl.DateTimeFormat(lang, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Brussels',
  }).format(date)
}

function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat('nl-BE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Brussels',
    hour12: false,
  }).format(new Date(isoString))
}

function getServiceName(service: Service, locale: SupportedLocale): string {
  switch (locale) {
    case 'en': return service.name_en
    case 'fr': return service.name_fr ?? service.name_nl
    case 'es': return service.name_es ?? service.name_nl
    case 'le': return service.name_le ?? service.name_nl
    default: return service.name_nl
  }
}

function buildUrls(
  appointment: Appointment,
  customer: Customer,
  locale: SupportedLocale,
): { cancelUrl?: string; rescheduleUrl?: string; bookingUrl: string; unsubscribeUrl?: string } {
  return {
    cancelUrl: appointment.cancel_token
      ? `${BASE_URL}/${locale}/afspraak/annuleren/${appointment.cancel_token}`
      : undefined,
    rescheduleUrl: appointment.reschedule_token
      ? `${BASE_URL}/${locale}/afspraak/verzetten/${appointment.reschedule_token}`
      : undefined,
    bookingUrl: `${BASE_URL}/${locale}`,
    unsubscribeUrl: customer.unsubscribe_token
      ? `${BASE_URL}/${locale}/voorkeuren/${customer.unsubscribe_token}`
      : undefined,
  }
}

export async function sendAppointmentEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const { type, appointment, customer, barber, service, sequence = 0 } = params
  const locale = (customer.preferred_language ?? 'nl') as SupportedLocale

  // Idempotency check — if already sent, skip silently
  const existing = await db<{ id: string }[]>`
    SELECT id FROM email_log
    WHERE appointment_id = ${appointment.id}
      AND email_type   = ${type}
      AND status       = 'sent'
    LIMIT 1
  `
  if (existing.length > 0) return { id: existing[0].id, skipped: true }

  const urls = buildUrls(appointment, customer, locale)
  const serviceName = getServiceName(service, locale)
  const date = formatDate(appointment.start_at, locale)
  const time = formatTime(appointment.start_at)
  const price = `€${Math.round(service.price_cents / 100)}`

  // Fetch cancellation window for reminder copy
  let hours: string | undefined
  if (type === 'reminder_24h' || type === 'reminder_2h') {
    const row = await db<{ value: unknown }[]>`
      SELECT value FROM settings WHERE key = 'cancellation_window_hours' LIMIT 1
    `
    hours = row.length > 0 ? String(row[0].value) : '24'
  }

  const { subject, html, text } = renderTemplate({
    type,
    locale,
    firstName: customer.first_name,
    barber: barber.name,
    service: serviceName,
    date,
    time,
    price,
    hours,
    ...urls,
  })

  // Build ICS attachment. SEQUENCE now comes from the persistent
  // appointments.ics_sequence (migration 004 / FR-071): confirmation is always 0,
  // each reschedule increments it, and the cancellation carries whatever the
  // current value is so a CANCEL never regresses below the last REQUEST
  // (RFC 5545 §3.8.7.4). The caller passes the row's `ics_sequence` via `sequence`.
  const icsSummary = `${serviceName} — Kameraad Haarsnijder`
  let ics: OutgoingEmail['ics'] | undefined
  if (type === 'confirmation') {
    ics = {
      filename: 'kameraad-afspraak.ics',
      content: buildIcs({ method: 'REQUEST', sequence, uid: appointment.id, summary: icsSummary, dtstart: appointment.start_at, dtend: appointment.end_at }),
      method: 'REQUEST',
    }
  } else if (type === 'reschedule') {
    ics = {
      filename: 'kameraad-afspraak.ics',
      content: buildIcs({ method: 'REQUEST', sequence, uid: appointment.id, summary: icsSummary, dtstart: appointment.start_at, dtend: appointment.end_at }),
      method: 'REQUEST',
    }
  } else if (type === 'cancellation') {
    ics = {
      filename: 'kameraad-annulering.ics',
      content: buildIcs({ method: 'CANCEL', sequence, uid: appointment.id, summary: icsSummary, dtstart: appointment.start_at, dtend: appointment.end_at }),
      method: 'CANCEL',
    }
  }

  // List-Unsubscribe for opt-in email types (FR-072)
  const headers: Record<string, string> = {}
  if (urls.unsubscribeUrl && (type === 'marketing' || type === 'rebooking')) {
    headers['List-Unsubscribe'] = `<${urls.unsubscribeUrl}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }

  const transport = getTransport()

  // Attempt send — log failure and re-throw
  let sendId: string
  try {
    const result = await transport.send({
      to: customer.email,
      subject,
      html,
      text,
      type,
      ics,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    })
    sendId = result.id
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db`
      INSERT INTO email_log
        (appointment_id, customer_id, email_type, to_email, subject, sent_at, status, error_message)
      VALUES
        (${appointment.id}, ${customer.id}, ${type}, ${customer.email}, ${subject}, NOW(), 'failed', ${msg})
    `
    throw err
  }

  // Log success — catch unique violation (23505) as already-sent no-op
  try {
    await db`
      INSERT INTO email_log
        (appointment_id, customer_id, email_type, to_email, subject, sent_at, status)
      VALUES
        (${appointment.id}, ${customer.id}, ${type}, ${customer.email}, ${subject}, NOW(), 'sent')
    `
  } catch (err) {
    if (isPgUniqueViolation(err)) return { id: sendId, skipped: true }
    throw err
  }

  return { id: sendId }
}
