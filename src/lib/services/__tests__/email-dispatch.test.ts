import { describe, it, expect } from 'vitest'
import { runDispatch } from '../email-dispatch'
import type { DispatchDb, CandidateRow, SendFn } from '../email-dispatch'
import type { Appointment, Customer, Barber, Service } from '../../db/types'

// ─── Fixed clock ───────────────────────────────────────────────────────────────

// 2026-06-06 10:00 UTC
const NOW = new Date('2026-06-06T10:00:00.000Z')

const H1 = 60 * 60 * 1000
const H24 = 24 * H1
const DAY = H24
const WEEK = 7 * DAY

// ─── Factories ────────────────────────────────────────────────────────────────

let _seq = 0
function uid(prefix = 'id') {
  return `${prefix}-${++_seq}`
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: uid('appt'),
    barber_id: 'barber-1',
    service_id: 'service-1',
    customer_id: 'customer-1',
    start_at: new Date(NOW.getTime() + 23 * H1).toISOString(),
    end_at: new Date(NOW.getTime() + 23.5 * H1).toISOString(),
    status: 'confirmed',
    customer_notes: null,
    admin_notes: null,
    cancel_token: null,
    reschedule_token: null,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: new Date(NOW.getTime() - 48 * H1).toISOString(),
    updated_at: new Date(NOW.getTime() - 48 * H1).toISOString(),
    ...overrides,
  }
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer-1',
    first_name: 'Jan',
    last_name: 'Janssen',
    email: 'jan@example.com',
    phone: null,
    notes: null,
    marketing_opt_in: false,
    rebooking_opt_in: true,
    reminder_opt_in: true,
    preferred_language: 'nl',
    no_show_count: 0,
    consent_given_at: null,
    unsubscribe_token: null,
    created_at: new Date(NOW.getTime() - 48 * H1).toISOString(),
    updated_at: new Date(NOW.getTime() - 48 * H1).toISOString(),
    ...overrides,
  }
}

function makeBarber(overrides: Partial<Barber> = {}): Barber {
  return {
    id: 'barber-1',
    slug: 'test-barber',
    name: 'Test Barber',
    bio_nl: null,
    bio_en: null,
    bio_fr: null,
    bio_es: null,
    bio_le: null,
    photo_url: null,
    email: null,
    is_active: true,
    sort_order: 1,
    created_at: new Date(NOW.getTime() - 48 * H1).toISOString(),
    ...overrides,
  }
}

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'service-1',
    slug: 'test-service',
    name_nl: 'Knippen',
    name_en: 'Haircut',
    name_fr: null,
    name_es: null,
    name_le: null,
    description_nl: null,
    description_en: null,
    description_fr: null,
    price_cents: 2500,
    duration_min: 30,
    color: '#000000',
    is_active: true,
    is_walk_in: false,
    sort_order: 1,
    created_at: new Date(NOW.getTime() - 48 * H1).toISOString(),
    ...overrides,
  }
}

function makeRow(
  apptOverrides: Partial<Appointment> = {},
  customerOverrides: Partial<Customer> = {},
): CandidateRow {
  return {
    appointment: makeAppointment(apptOverrides),
    customer: makeCustomer(customerOverrides),
    barber: makeBarber(),
    service: makeService(),
  }
}

// ─── Fake DispatchDb ──────────────────────────────────────────────────────────

class FakeDb implements DispatchDb {
  private rows: CandidateRow[] = []
  private _rebookingWeeks = 5

  add(row: CandidateRow): this {
    this.rows.push(row)
    return this
  }

  setRebookingWeeks(n: number): this {
    this._rebookingWeeks = n
    return this
  }

  async getReminderCandidates(
    type: 'reminder_24h' | 'reminder_2h',
    now: Date,
  ): Promise<CandidateRow[]> {
    const windowMs = type === 'reminder_24h' ? H24 : 2 * H1
    const windowEnd = new Date(now.getTime() + windowMs)
    return this.rows.filter(({ appointment: a }) => {
      const startMs = new Date(a.start_at).getTime()
      const createdMs = new Date(a.created_at).getTime()
      return (
        a.status === 'confirmed' &&
        startMs > now.getTime() &&
        startMs <= windowEnd.getTime() &&
        createdMs <= startMs - windowMs
      )
    })
  }

  async getRebookingCandidates(cutoff: Date): Promise<CandidateRow[]> {
    return this.rows.filter(
      ({ appointment: a }) =>
        a.status === 'completed' && new Date(a.start_at).getTime() <= cutoff.getTime(),
    )
  }

  async getRebookingWeeks(): Promise<number> {
    return this._rebookingWeeks
  }

  async customerHasFutureBooking(customerId: string, after: Date): Promise<boolean> {
    return this.rows.some(
      ({ appointment: a, customer: c }) =>
        c.id === customerId &&
        a.status !== 'cancelled' &&
        a.status !== 'no_show' &&
        new Date(a.start_at).getTime() > after.getTime(),
    )
  }
}

// ─── Fake Send ────────────────────────────────────────────────────────────────

class FakeSend {
  readonly calls: Array<{ type: string; appointmentId: string }> = []
  private sent = new Set<string>()

  get fn(): SendFn {
    return async params => {
      const key = `${params.appointment.id}:${params.type}`
      if (this.sent.has(key)) {
        return { id: key, skipped: true }
      }
      this.sent.add(key)
      this.calls.push({ type: params.type, appointmentId: params.appointment.id })
      return { id: key }
    }
  }
}

// ─── reminder_24h ─────────────────────────────────────────────────────────────

describe('reminder_24h', () => {
  it('sends when appointment starts in 23h with early enough created_at', async () => {
    const db = new FakeDb().add(makeRow())
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_24h).toEqual({ sent: 1, skipped: 0 })
    expect(send.calls).toHaveLength(1)
    expect(send.calls[0].type).toBe('reminder_24h')
  })

  it('does not send when appointment starts in 25h (outside window)', async () => {
    const db = new FakeDb().add(
      makeRow({ start_at: new Date(NOW.getTime() + 25 * H1).toISOString() }),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_24h).toEqual({ sent: 0, skipped: 0 })
    expect(send.calls).toHaveLength(0)
  })

  it('counts as skipped when send returns skipped (already sent)', async () => {
    const send = new FakeSend()
    const db = new FakeDb().add(makeRow())
    // First run sends it
    await runDispatch({ now: NOW, db, send: send.fn })
    // Second run: send returns skipped
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_24h).toEqual({ sent: 0, skipped: 1 })
    // FakeSend only recorded the first call
    expect(send.calls).toHaveLength(1)
  })

  it('skips when booking was created after T−24h (booking made <24h before start)', async () => {
    // start_at in 23h, but created just now → start_at − created_at = 23h < 24h
    const db = new FakeDb().add(
      makeRow({
        start_at: new Date(NOW.getTime() + 23 * H1).toISOString(),
        created_at: NOW.toISOString(), // created_at = now → start_at − created_at = 23h
      }),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_24h).toEqual({ sent: 0, skipped: 0 })
    expect(send.calls).toHaveLength(0)
  })

  it('does not send when start_at is in the past', async () => {
    const db = new FakeDb().add(
      makeRow({ start_at: new Date(NOW.getTime() - H1).toISOString() }),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_24h).toEqual({ sent: 0, skipped: 0 })
    expect(send.calls).toHaveLength(0)
  })

  it('skips when reminder_opt_in is false', async () => {
    const db = new FakeDb().add(makeRow({}, { reminder_opt_in: false }))
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_24h).toEqual({ sent: 0, skipped: 1 })
    expect(send.calls).toHaveLength(0)
  })

  it('ignores cancelled appointments', async () => {
    const db = new FakeDb().add(makeRow({ status: 'cancelled' }))
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_24h).toEqual({ sent: 0, skipped: 0 })
    expect(send.calls).toHaveLength(0)
  })

  it('ignores completed appointments', async () => {
    const db = new FakeDb().add(makeRow({ status: 'completed' }))
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_24h).toEqual({ sent: 0, skipped: 0 })
    expect(send.calls).toHaveLength(0)
  })

  it('ignores no_show appointments', async () => {
    const db = new FakeDb().add(makeRow({ status: 'no_show' }))
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_24h).toEqual({ sent: 0, skipped: 0 })
    expect(send.calls).toHaveLength(0)
  })
})

// ─── reminder_2h ──────────────────────────────────────────────────────────────

describe('reminder_2h', () => {
  it('sends when appointment starts in 1.5h with early enough created_at', async () => {
    // start_at = NOW + 1.5h, created_at = NOW - 1h → start_at − created_at = 2.5h ≥ 2h ✓
    const db = new FakeDb().add(
      makeRow({
        start_at: new Date(NOW.getTime() + 1.5 * H1).toISOString(),
        created_at: new Date(NOW.getTime() - H1).toISOString(),
      }),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_2h).toEqual({ sent: 1, skipped: 0 })
    expect(send.calls[0].type).toBe('reminder_2h')
  })

  it('does not send when appointment starts in 3h (outside 2h window)', async () => {
    const db = new FakeDb().add(
      makeRow({
        start_at: new Date(NOW.getTime() + 3 * H1).toISOString(),
        created_at: new Date(NOW.getTime() - 10 * H1).toISOString(),
      }),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_2h).toEqual({ sent: 0, skipped: 0 })
  })

  it('skips when booking was created <2h before start (confirmation-only rule)', async () => {
    // start_at = NOW + 1h, created_at = NOW → start_at − created_at = 1h < 2h
    const db = new FakeDb().add(
      makeRow({
        start_at: new Date(NOW.getTime() + H1).toISOString(),
        created_at: NOW.toISOString(),
      }),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_2h).toEqual({ sent: 0, skipped: 0 })
    expect(send.calls).toHaveLength(0)
  })

  it('does not send when start_at is in the past', async () => {
    const db = new FakeDb().add(
      makeRow({
        start_at: new Date(NOW.getTime() - 30 * 60 * 1000).toISOString(),
        created_at: new Date(NOW.getTime() - 3 * H1).toISOString(),
      }),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_2h).toEqual({ sent: 0, skipped: 0 })
  })

  it('skips when reminder_opt_in is false', async () => {
    const db = new FakeDb().add(
      makeRow(
        {
          start_at: new Date(NOW.getTime() + 1.5 * H1).toISOString(),
          created_at: new Date(NOW.getTime() - H1).toISOString(),
        },
        { reminder_opt_in: false },
      ),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.reminder_2h).toEqual({ sent: 0, skipped: 1 })
  })
})

// ─── rebooking ────────────────────────────────────────────────────────────────

describe('rebooking', () => {
  it('sends when appointment was completed 36 days ago and rebooking_weeks=5 (35d cutoff)', async () => {
    const db = new FakeDb().add(
      makeRow(
        { status: 'completed', start_at: new Date(NOW.getTime() - 36 * DAY).toISOString() },
        { id: uid('c') },
      ),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.rebooking).toEqual({ sent: 1, skipped: 0 })
    expect(send.calls[0].type).toBe('rebooking')
  })

  it('does not send when appointment was completed 28 days ago and rebooking_weeks=5 (35d cutoff)', async () => {
    const db = new FakeDb().add(
      makeRow({ status: 'completed', start_at: new Date(NOW.getTime() - 28 * DAY).toISOString() }),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.rebooking).toEqual({ sent: 0, skipped: 0 })
  })

  it('sends when rebooking_weeks changes from 5 to 3 (same appointment now in range)', async () => {
    // 28 days ago: not due at 5w, due at 3w
    const db = new FakeDb()
      .add(
        makeRow(
          { status: 'completed', start_at: new Date(NOW.getTime() - 28 * DAY).toISOString() },
          { id: uid('c') },
        ),
      )
      .setRebookingWeeks(3)
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.rebooking).toEqual({ sent: 1, skipped: 0 })
  })

  it('does not send when rebooking_weeks=5 but is sent when set to 3 (live setting read)', async () => {
    const db = new FakeDb().add(
      makeRow(
        { status: 'completed', start_at: new Date(NOW.getTime() - 28 * DAY).toISOString() },
        { id: uid('c') },
      ),
    )
    const send5 = new FakeSend()
    const counts5 = await runDispatch({ now: NOW, db, send: send5.fn })
    expect(counts5.rebooking.sent).toBe(0)

    db.setRebookingWeeks(3)
    const send3 = new FakeSend()
    const counts3 = await runDispatch({ now: NOW, db, send: send3.fn })
    expect(counts3.rebooking.sent).toBe(1)
  })

  it('skips when rebooking_opt_in is false', async () => {
    const db = new FakeDb().add(
      makeRow(
        { status: 'completed', start_at: new Date(NOW.getTime() - 36 * DAY).toISOString() },
        { id: uid('c'), rebooking_opt_in: false },
      ),
    )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.rebooking).toEqual({ sent: 0, skipped: 1 })
    expect(send.calls).toHaveLength(0)
  })

  it('skips when customer has a future non-cancelled appointment', async () => {
    const customerId = uid('c')
    const db = new FakeDb()
      .add(
        makeRow(
          {
            id: uid('appt'),
            status: 'completed',
            start_at: new Date(NOW.getTime() - 36 * DAY).toISOString(),
            customer_id: customerId,
          },
          { id: customerId },
        ),
      )
      // Future confirmed appointment for the same customer
      .add(
        makeRow(
          {
            id: uid('appt'),
            status: 'confirmed',
            start_at: new Date(NOW.getTime() + 7 * DAY).toISOString(),
            created_at: new Date(NOW.getTime() - 10 * DAY).toISOString(),
            customer_id: customerId,
          },
          { id: customerId },
        ),
      )
    const send = new FakeSend()
    const counts = await runDispatch({ now: NOW, db, send: send.fn })
    expect(counts.rebooking).toEqual({ sent: 0, skipped: 1 })
  })
})

// ─── Idempotency ──────────────────────────────────────────────────────────────

describe('idempotency — double run', () => {
  it('reminder_24h: two runs produce exactly 1 send (second run skips via fake unique-index)', async () => {
    const db = new FakeDb().add(makeRow())
    const send = new FakeSend()

    const run1 = await runDispatch({ now: NOW, db, send: send.fn })
    expect(run1.reminder_24h).toEqual({ sent: 1, skipped: 0 })

    const run2 = await runDispatch({ now: NOW, db, send: send.fn })
    expect(run2.reminder_24h).toEqual({ sent: 0, skipped: 1 })

    // Only one actual send call recorded
    expect(send.calls).toHaveLength(1)
  })

  it('rebooking: two runs produce exactly 1 send', async () => {
    const db = new FakeDb().add(
      makeRow(
        { status: 'completed', start_at: new Date(NOW.getTime() - 36 * DAY).toISOString() },
        { id: uid('c') },
      ),
    )
    const send = new FakeSend()

    const run1 = await runDispatch({ now: NOW, db, send: send.fn })
    expect(run1.rebooking).toEqual({ sent: 1, skipped: 0 })

    const run2 = await runDispatch({ now: NOW, db, send: send.fn })
    expect(run2.rebooking).toEqual({ sent: 0, skipped: 1 })

    expect(send.calls).toHaveLength(1)
  })

  it('multiple appointments: each sent exactly once across two runs', async () => {
    const cId1 = uid('c')
    const cId2 = uid('c')
    const db = new FakeDb()
      .add(makeRow({ id: uid('appt'), customer_id: cId1 }, { id: cId1 }))
      .add(makeRow({ id: uid('appt'), customer_id: cId2 }, { id: cId2 }))
    const send = new FakeSend()

    const run1 = await runDispatch({ now: NOW, db, send: send.fn })
    expect(run1.reminder_24h.sent).toBe(2)

    const run2 = await runDispatch({ now: NOW, db, send: send.fn })
    expect(run2.reminder_24h.sent).toBe(0)
    expect(run2.reminder_24h.skipped).toBe(2)

    expect(send.calls).toHaveLength(2)
  })
})
