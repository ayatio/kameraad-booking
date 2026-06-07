import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { Resend } from 'resend'

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
  type?: string
  ics?: { filename: string; content: string; method: string }
  headers?: Record<string, string>
}

export interface EmailTransport {
  send(msg: OutgoingEmail): Promise<{ id: string }>
}

const OUTBOX_DIR = path.join(process.cwd(), '.email-outbox')
const FROM = 'Kameraad Haarsnijder <afspraak@kameraadhaarsnijder.be>'

class DryRunTransport implements EmailTransport {
  async send(msg: OutgoingEmail): Promise<{ id: string }> {
    await mkdir(OUTBOX_DIR, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const label = msg.type ?? 'email'
    const base = `${ts}-${label}`
    const meta = {
      from: FROM,
      to: msg.to,
      subject: msg.subject,
      type: msg.type,
      headers: msg.headers,
      ics: msg.ics ? { filename: msg.ics.filename, method: msg.ics.method } : undefined,
    }
    await Promise.all([
      writeFile(path.join(OUTBOX_DIR, `${base}.json`), JSON.stringify(meta, null, 2)),
      writeFile(path.join(OUTBOX_DIR, `${base}.html`), msg.html),
    ])
    const id = `dry-${ts}-${label}`
    console.log(`[email:dry-run] to=${msg.to} subject="${msg.subject}" → .email-outbox/${base}.{json,html}`)
    return { id }
  }
}

class ResendTransport implements EmailTransport {
  private readonly resend: Resend

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY)
  }

  async send(msg: OutgoingEmail): Promise<{ id: string }> {
    const attachments = msg.ics
      ? [
          {
            filename: msg.ics.filename,
            content: Buffer.from(msg.ics.content),
            contentType: `text/calendar; method=${msg.ics.method}; charset=UTF-8`,
          },
        ]
      : undefined

    const { data, error } = await this.resend.emails.send({
      from: FROM,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments,
      headers: msg.headers,
    })

    if (error) throw new Error(`Resend: ${error.message}`)
    if (!data) throw new Error('Resend returned no data')
    return { id: data.id }
  }
}

let _instance: EmailTransport | undefined

export function getTransport(): EmailTransport {
  if (!_instance) {
    _instance = process.env.RESEND_API_KEY ? new ResendTransport() : new DryRunTransport()
  }
  return _instance
}

export function _setTransportForTesting(t: EmailTransport): void {
  _instance = t
}
