// Email template renderer — pure string generation, no react-dom/server (Next.js App Router compat)

import type { CardRow, EmailCta } from './layout'

// Locale message imports (JSON)
import nlMsg from '../../messages/nl.json'
import enMsg from '../../messages/en.json'
import frMsg from '../../messages/fr.json'
import esMsg from '../../messages/es.json'
import leMsg from '../../messages/le.json'

export type EmailType =
  | 'confirmation'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'cancellation'
  | 'reschedule'
  | 'rebooking'
  | 'marketing'

export type SupportedLocale = 'nl' | 'en' | 'fr' | 'es' | 'le'

export interface RenderParams {
  type: EmailType
  locale: SupportedLocale
  firstName: string
  barber?: string
  service?: string
  date?: string
  time?: string
  price?: string
  hours?: string
  cancelUrl?: string
  rescheduleUrl?: string
  bookingUrl?: string
  unsubscribeUrl?: string
}

export interface RenderResult {
  subject: string
  html: string
  text: string
}

type LooseRecord = Record<string, Record<string, string>>

const msgsByLocale: Record<SupportedLocale, LooseRecord> = {
  nl: nlMsg as unknown as LooseRecord,
  en: enMsg as unknown as LooseRecord,
  fr: frMsg as unknown as LooseRecord,
  es: esMsg as unknown as LooseRecord,
  le: leMsg as unknown as LooseRecord,
}

function interp(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`)
}

function get(emails: LooseRecord, type: string, key: string): string {
  return emails?.[type]?.[key] ?? ''
}

function getCardLabels(emails: LooseRecord): Record<string, string> {
  return (emails?.card as unknown as Record<string, string> | undefined) ?? {}
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Color / style constants ──────────────────────────────────────────────────
const INK = '#16140F'
const PAPER = '#F6F1E7'
const PAPER2 = '#EDE6D6'
const GOLD = '#C9A24B'
const GOLD_DEEP = '#9A7B33'
const GOLD_PALE = '#E8D29F'
const SMOKE = '#8A857B'
const DARK_MUTED = '#8F897C'
const FG2 = '#4A453C'
const LINE = 'rgba(22,20,15,0.14)'

const FD = "'Arial Narrow',Arial,sans-serif"
const FS = "Georgia,'Times New Roman',serif"
const FB = 'Helvetica,Arial,sans-serif'

function renderCardRow(row: CardRow, last: boolean): string {
  const border = last ? '' : `border-bottom:1px solid ${LINE};`
  return `<tr>
    <td style="padding:13px 0;font-family:${FD};text-transform:uppercase;letter-spacing:.12em;font-size:11px;color:${SMOKE};${border}">${esc(row.key)}</td>
    <td style="padding:13px 0;font-size:14px;font-weight:500;color:${INK};text-align:right;${border}">${esc(row.value)}</td>
  </tr>`
}

function renderCta(cta: EmailCta): string {
  const bg = cta.ghost ? 'transparent' : GOLD
  const color = cta.ghost ? GOLD_DEEP : '#1a160c'
  const border = cta.ghost ? `border:1px solid ${GOLD};` : ''
  return `<div style="text-align:center;margin-bottom:8px;">
    <a href="${esc(cta.url)}" style="display:inline-block;font-family:${FD};text-transform:uppercase;letter-spacing:.14em;font-size:13px;font-weight:600;background-color:${bg};color:${color};padding:15px 34px;border-radius:999px;text-decoration:none;${border}">${esc(cta.label)}</a>
  </div>`
}

function renderHtml(params: {
  lang: string
  preview?: string
  eyebrow: string
  heading: string
  body: string
  card?: CardRow[]
  ctas?: EmailCta[]
  footerAddress: string
  unsubscribeUrl?: string
  unsubscribeLabel?: string
}): string {
  const { lang, preview, eyebrow, heading, body, card, ctas, footerAddress, unsubscribeUrl, unsubscribeLabel } = params

  const previewHtml = preview
    ? `<div aria-hidden="true" style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;color:${PAPER2};">${esc(preview)}</div>`
    : ''

  const cardHtml = card && card.length > 0
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${LINE};border-radius:4px;margin-bottom:28px;">
        <tbody><tr><td style="padding:0 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tbody>${card.map((r, i) => renderCardRow(r, i === card.length - 1)).join('\n')}</tbody>
          </table>
        </td></tr></tbody>
      </table>`
    : ''

  const ctasHtml = ctas && ctas.length > 0 ? ctas.map(renderCta).join('\n') : ''

  const footerUnsubHtml = unsubscribeUrl
    ? ` &middot; <a href="${esc(unsubscribeUrl)}" style="color:${GOLD_PALE};text-decoration:none;">${esc(unsubscribeLabel ?? 'Afmelden')}</a>`
    : ''

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:${PAPER2};font-family:${FB};">
${previewHtml}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${PAPER2};">
<tbody><tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:${PAPER};">
    <tbody>
      <tr>
        <td style="background-color:${INK};text-align:center;padding:26px 20px;">
          <span style="font-family:${FD};text-transform:uppercase;letter-spacing:.18em;font-size:16px;font-weight:600;color:${GOLD};display:inline-block;">KAMERAAD HAARSNIJDER</span>
        </td>
      </tr>
      <tr>
        <td style="background-color:${PAPER};padding:40px 40px 32px;">
          <p style="margin:0 0 8px;font-family:${FD};text-transform:uppercase;letter-spacing:.24em;font-size:11px;color:${GOLD_DEEP};text-align:center;">${esc(eyebrow)}</p>
          <h1 style="margin:0 0 16px;font-family:${FS};font-weight:400;font-size:32px;line-height:1.2;color:${INK};text-align:center;">${esc(heading)}</h1>
          <p style="margin:0 auto 28px;font-size:14px;line-height:1.65;color:${FG2};text-align:center;max-width:42ch;display:block;">${esc(body)}</p>
          ${cardHtml}
          ${ctasHtml}
        </td>
      </tr>
      <tr>
        <td style="background-color:${INK};text-align:center;padding:24px 20px;">
          <p style="margin:0;font-size:11px;color:${DARK_MUTED};line-height:1.7;font-family:${FB};">${esc(footerAddress)}${footerUnsubHtml}</p>
        </td>
      </tr>
    </tbody>
  </table>
</td></tr></tbody>
</table>
</body>
</html>`
}

function buildText(params: {
  eyebrow: string
  heading: string
  body: string
  card?: CardRow[]
  ctas?: EmailCta[]
  footerAddress: string
  unsubscribeUrl?: string
  unsubscribeLabel?: string
}): string {
  const lines: string[] = [
    'KAMERAAD HAARSNIJDER',
    '',
    params.eyebrow.toUpperCase(),
    '',
    params.heading,
    '',
    params.body,
  ]
  if (params.card && params.card.length > 0) {
    lines.push('', '---')
    for (const row of params.card) lines.push(`${row.key}: ${row.value}`)
    lines.push('---')
  }
  if (params.ctas && params.ctas.length > 0) {
    lines.push('')
    for (const cta of params.ctas) lines.push(`${cta.label}: ${cta.url}`)
  }
  lines.push('', params.footerAddress)
  if (params.unsubscribeUrl) {
    lines.push(`${params.unsubscribeLabel ?? 'Afmelden'}: ${params.unsubscribeUrl}`)
  }
  return lines.join('\n')
}

export function renderTemplate(params: RenderParams): RenderResult {
  const {
    type, locale, firstName, barber, service, date, time, price, hours,
    cancelUrl, rescheduleUrl, bookingUrl, unsubscribeUrl,
  } = params

  const msgs = msgsByLocale[locale] ?? msgsByLocale.nl
  const emails: LooseRecord = (msgs.emails as unknown as LooseRecord) ?? {}
  const card = getCardLabels(emails)
  const footer: Record<string, string> = (emails.footer as unknown as Record<string, string> | undefined) ?? {}

  const vars: Record<string, string | undefined> = {
    firstName, barber, service, date, time, price, hours, link: bookingUrl,
  }

  const subject = interp(get(emails, type, 'subject'), vars)
  const eyebrow = get(emails, type, 'eyebrow')
  const heading = get(emails, type, 'heading')
  const body = interp(get(emails, type, 'body'), vars)
  const footerAddress = footer.address ?? 'Parijsstraat 29 · 3000 Leuven · België'
  const unsubscribeLabel = footer.unsubscribeLabel

  const lang = locale === 'le' ? 'nl' : locale

  const hasAppointment = !!(service && barber && date && time && price)

  const appointmentCard: CardRow[] | undefined =
    hasAppointment && type !== 'rebooking' && type !== 'marketing'
      ? [
          { key: card.service ?? 'Dienst', value: service! },
          { key: card.barber ?? 'Barbier', value: barber! },
          { key: card.date ?? 'Datum', value: date! },
          { key: card.time ?? 'Tijd', value: time! },
          { key: card.price ?? 'Prijs', value: price! },
        ]
      : undefined

  const ctas: EmailCta[] = []

  switch (type) {
    case 'confirmation':
      if (cancelUrl) ctas.push({ label: get(emails, type, 'cancelLabel'), url: cancelUrl, ghost: true })
      if (rescheduleUrl) ctas.push({ label: get(emails, type, 'rescheduleLabel'), url: rescheduleUrl, ghost: true })
      break
    case 'reminder_24h':
    case 'reminder_2h':
      if (cancelUrl) ctas.push({ label: get(emails, type, 'cancelLabel'), url: cancelUrl, ghost: true })
      break
    case 'cancellation':
      if (bookingUrl) ctas.push({ label: get(emails, type, 'rebookCta'), url: bookingUrl })
      break
    case 'reschedule':
      if (cancelUrl) ctas.push({ label: get(emails, type, 'cancelLabel'), url: cancelUrl, ghost: true })
      if (rescheduleUrl) ctas.push({ label: get(emails, type, 'rescheduleLabel'), url: rescheduleUrl, ghost: true })
      break
    case 'rebooking':
      if (bookingUrl) ctas.push({ label: get(emails, type, 'cta'), url: bookingUrl })
      break
    case 'marketing':
      if (bookingUrl) ctas.push({ label: get(emails, type, 'cta'), url: bookingUrl })
      break
  }

  const renderParams = {
    lang,
    preview: `${heading} — ${footerAddress}`,
    eyebrow,
    heading,
    body,
    card: appointmentCard,
    ctas: ctas.length > 0 ? ctas : undefined,
    footerAddress,
    unsubscribeUrl: type === 'marketing' || type === 'rebooking' ? unsubscribeUrl : undefined,
    unsubscribeLabel,
  }

  return {
    subject,
    html: renderHtml(renderParams),
    text: buildText(renderParams),
  }
}
