import db from '../db/index'
import { getBulkCandidates, type BulkCandidate } from '../db/queries/customers'
import { getTransport } from '../email/transport'
import { writeAudit, AUDIT } from './audit'
import { assertCan } from '../auth/permissions'
import type { AdminActor } from './actor'
import type { SupportedLocale } from '../../emails/render'

// Bulk / marketing email (FR-063). Owner-only (bulk.email). Reuses the existing
// transport (DryRun when no RESEND_API_KEY); the marketing message is built
// inline here (per-locale subject/body + one-click unsubscribe + List-Unsubscribe
// header) so we don't have to touch the Phase-2 template layer. Every send is
// logged to email_log per recipient. The opt-out exclusion is PURE + testable.

const BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const LOCALES: SupportedLocale[] = ['nl', 'en', 'fr', 'es', 'le']

export type RecipientFilter = 'all' | 'marketing'
export type BulkType = 'marketing'

// ─── Pure recipient selection (FR-063 / §7) ─────────────────────────────────

// Rules: email_missing customers are ALWAYS excluded (no real address); and for
// a marketing send (type==='marketing', or the 'marketing' filter) only
// marketing_opt_in=true customers are kept — the opt-in filter is FORCED for
// marketing regardless of the chosen filter, so an opted-out customer can never
// be selected. Exported for unit testing against a mocked recipient set.
export function selectBulkRecipients<T extends { marketing_opt_in: boolean; email_missing: boolean }>(
  customers: T[],
  opts: { filter: RecipientFilter; type: BulkType },
): T[] {
  const forceOptIn = opts.type === 'marketing' || opts.filter === 'marketing'
  return customers.filter((c) => {
    if (c.email_missing) return false
    if (forceOptIn && !c.marketing_opt_in) return false
    return true
  })
}

// ─── Preview ────────────────────────────────────────────────────────────────

export interface RecipientPreview {
  recipients: { id: string; email: string }[]
  count: number
}

export async function previewRecipients(opts: {
  filter: RecipientFilter
  type?: BulkType
}): Promise<RecipientPreview> {
  const candidates = await getBulkCandidates()
  const selected = selectBulkRecipients(candidates, {
    filter: opts.filter,
    type: opts.type ?? 'marketing',
  })
  return {
    recipients: selected.map((c) => ({ id: c.id, email: c.email })),
    count: selected.length,
  }
}

// ─── Message rendering (inline, self-contained) ─────────────────────────────

type LocaleCopy = Partial<Record<SupportedLocale, string>>

function pickCopy(copy: LocaleCopy, locale: SupportedLocale): string {
  return copy[locale] ?? copy.nl ?? Object.values(copy)[0] ?? ''
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const UNSUB_LABEL: Record<SupportedLocale, string> = {
  nl: 'Uitschrijven',
  en: 'Unsubscribe',
  fr: 'Se désabonner',
  es: 'Darse de baja',
  le: 'Uitschrijven',
}

function buildMessage(
  candidate: BulkCandidate,
  subject: string,
  body: string,
): { subject: string; html: string; text: string; unsubscribeUrl?: string } {
  const locale = (LOCALES.includes(candidate.preferred_language as SupportedLocale)
    ? candidate.preferred_language
    : 'nl') as SupportedLocale
  const unsubscribeUrl = candidate.unsubscribe_token
    ? `${BASE_URL}/${locale}/voorkeuren/${candidate.unsubscribe_token}`
    : undefined
  const unsubLabel = UNSUB_LABEL[locale]

  const bodyHtml = escapeHtml(body).replace(/\n/g, '<br>')
  const footerHtml = unsubscribeUrl
    ? `<hr><p style="font-size:12px;color:#666"><a href="${unsubscribeUrl}">${unsubLabel}</a></p>`
    : ''
  const html = `<div>${bodyHtml}${footerHtml}</div>`
  const text = unsubscribeUrl ? `${body}\n\n${unsubLabel}: ${unsubscribeUrl}` : body

  return { subject, html, text, unsubscribeUrl }
}

// ─── Send ────────────────────────────────────────────────────────────────────

export interface SendBulkInput {
  subjectByLocale: LocaleCopy
  bodyByLocale: LocaleCopy
  type?: BulkType
  filter?: RecipientFilter
  testToSelf?: boolean
  actorEmail: string
}

export interface SendBulkResult {
  sent: number
  failed: number
  recipientCount: number
}

export async function sendBulk(input: SendBulkInput, actor: AdminActor): Promise<SendBulkResult> {
  assertCan(actor.role, 'bulk.email') // owner-only; throws ForbiddenError otherwise

  const type: BulkType = input.type ?? 'marketing'
  const filter: RecipientFilter = input.filter ?? 'marketing'
  const transport = getTransport()

  // testToSelf: a single dry message to the actor; no DB recipients, no log spam.
  if (input.testToSelf) {
    const subject = pickCopy(input.subjectByLocale, 'nl')
    const body = pickCopy(input.bodyByLocale, 'nl')
    await transport.send({
      to: input.actorEmail,
      subject: `[TEST] ${subject}`,
      html: `<div>${escapeHtml(body).replace(/\n/g, '<br>')}</div>`,
      text: body,
      type,
    })
    await writeAudit({
      actor: actor.email,
      action: AUDIT.BULK_EMAIL,
      payload: { type, filter, recipient_count: 1, test: true },
    })
    return { sent: 1, failed: 0, recipientCount: 1 }
  }

  const candidates = await getBulkCandidates()
  const recipients = selectBulkRecipients(candidates, { filter, type })

  let sent = 0
  let failed = 0
  // Sequential — respects Resend throttling conceptually and keeps ordering for
  // the email_log audit trail.
  for (const c of recipients) {
    const subject = pickCopy(input.subjectByLocale, c.preferred_language as SupportedLocale)
    const body = pickCopy(input.bodyByLocale, c.preferred_language as SupportedLocale)
    const msg = buildMessage(c, subject, body)
    const headers: Record<string, string> | undefined = msg.unsubscribeUrl
      ? {
          'List-Unsubscribe': `<${msg.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : undefined

    try {
      await transport.send({
        to: c.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        type,
        headers,
      })
      await db`
        INSERT INTO email_log (appointment_id, customer_id, email_type, to_email, subject, sent_at, status)
        VALUES (NULL, ${c.id}, ${type}, ${c.email}, ${msg.subject}, NOW(), 'sent')
      `
      sent++
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await db`
        INSERT INTO email_log (appointment_id, customer_id, email_type, to_email, subject, sent_at, status, error_message)
        VALUES (NULL, ${c.id}, ${type}, ${c.email}, ${msg.subject}, NOW(), 'failed', ${errMsg})
      `
      failed++
    }
  }

  await writeAudit({
    actor: actor.email,
    action: AUDIT.BULK_EMAIL,
    payload: { type, filter, recipient_count: recipients.length },
  })

  return { sent, failed, recipientCount: recipients.length }
}
