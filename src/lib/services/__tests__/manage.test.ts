import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Appointment, Barber, Service, Customer } from '../../db/types'

// ─── Module mocks (vi.hoisted so factories can reference these vars) ───────────

const {
  mockDb,
  mockGetSetting,
  mockGetSettings,
  mockGetActiveWindows,
  mockGetBlockedSlotsInRange,
  mockGetNonCancelledAppointmentsInRange,
  mockGetSlotsForBarber,
  mockOnBookingCancelled,
  mockOnBookingRescheduled,
} = vi.hoisted(() => ({
  mockDb: vi.fn(),
  mockGetSetting: vi.fn(),
  mockGetSettings: vi.fn(),
  mockGetActiveWindows: vi.fn(),
  mockGetBlockedSlotsInRange: vi.fn(),
  mockGetNonCancelledAppointmentsInRange: vi.fn(),
  mockGetSlotsForBarber: vi.fn(),
  mockOnBookingCancelled: vi.fn().mockResolvedValue(undefined),
  mockOnBookingRescheduled: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../db/index', () => ({ default: mockDb }))
vi.mock('../../db/queries/settings', () => ({
  getSetting: mockGetSetting,
  getSettings: mockGetSettings,
}))
vi.mock('../../db/queries/availability', () => ({
  getActiveWindows: mockGetActiveWindows,
  getBlockedSlotsInRange: mockGetBlockedSlotsInRange,
  getNonCancelledAppointmentsInRange: mockGetNonCancelledAppointmentsInRange,
}))
vi.mock('../availability', () => ({ getSlotsForBarber: mockGetSlotsForBarber }))
vi.mock('../email-hooks', () => ({
  onBookingCancelled: mockOnBookingCancelled,
  onBookingRescheduled: mockOnBookingRescheduled,
}))

import {
  canModify,
  cancelAppointment,
  rescheduleAppointment,
} from '../manage'

// ─── Fixed clock ──────────────────────────────────────────────────────────────

// 2026-06-10 12:00 UTC
const NOW = new Date('2026-06-10T12:00:00.000Z')
const H = 3_600_000

// ─── Factories ────────────────────────────────────────────────────────────────

let _seq = 0
function uid(p = 'x') { return `${p}-${++_seq}` }

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: uid('appt'),
    barber_id: 'barber-1',
    service_id: 'service-1',
    customer_id: 'customer-1',
    start_at: new Date(NOW.getTime() + 48 * H).toISOString(),
    end_at: new Date(NOW.getTime() + 48 * H + 30 * 60_000).toISOString(),
    status: 'confirmed',
    customer_notes: null,
    admin_notes: null,
    cancel_token: 'tok-cancel',
    reschedule_token: 'tok-reschedule',
    cancelled_at: null,
    cancellation_reason: null,
    ics_sequence: 0,
    created_at: new Date(NOW.getTime() - 72 * H).toISOString(),
    updated_at: new Date(NOW.getTime() - 72 * H).toISOString(),
    ...overrides,
  }
}

function makeCustomer(): Customer {
  return {
    id: 'customer-1',
    first_name: 'Jan',
    last_name: 'Jansen',
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
    email_missing: false,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  }
}

function makeBarber(): Barber {
  return {
    id: 'barber-1',
    slug: 'test-barber',
    name: 'Test Barber',
    bio_nl: null, bio_en: null, bio_fr: null, bio_es: null, bio_le: null,
    photo_url: null,
    email: null,
    is_active: true,
    sort_order: 1,
    created_at: NOW.toISOString(),
  }
}

function makeService(): Service {
  return {
    id: 'service-1',
    slug: 'knippen',
    name_nl: 'Knippen',
    name_en: 'Haircut',
    name_fr: null, name_es: null, name_le: null,
    description_nl: null, description_en: null, description_fr: null,
    description_es: null, description_le: null,
    price_cents: 2500,
    duration_min: 30,
    color: '#C9A24B',
    is_active: true,
    is_walk_in: false,
    sort_order: 1,
    created_at: NOW.toISOString(),
  }
}

// Set up the db mock to return appointment then customer/barber/service in the
// order that loadDetail calls them (customers, barbers, services in parallel).
function setupDbForAppointment(appt: Appointment) {
  const customer = makeCustomer()
  const barber = makeBarber()
  const service = makeService()
  // First call: SELECT * FROM appointments WHERE cancel/reschedule_token
  mockDb.mockResolvedValueOnce([appt])
  // Parallel: customers, barbers, services
  mockDb.mockResolvedValueOnce([customer])
  mockDb.mockResolvedValueOnce([barber])
  mockDb.mockResolvedValueOnce([service])
  return { customer, barber, service }
}

// ─── canModify ────────────────────────────────────────────────────────────────

describe('canModify', () => {
  const WINDOW = 24 // hours

  it('allows modification when now is strictly before start_at − window', () => {
    // start_at = NOW + 25h → deadline = NOW + 1h → now (NOW) < deadline ✓
    const appt = makeAppointment({ start_at: new Date(NOW.getTime() + 25 * H).toISOString() })
    expect(canModify(appt, NOW, WINDOW)).toBe(true)
  })

  it('blocks modification when now === start_at − window (boundary: strict less-than)', () => {
    // start_at = NOW + 24h → deadline = NOW → now (NOW) is NOT < deadline
    const appt = makeAppointment({ start_at: new Date(NOW.getTime() + 24 * H).toISOString() })
    expect(canModify(appt, NOW, WINDOW)).toBe(false)
  })

  it('blocks modification when now is 1ms past the deadline', () => {
    // start_at = NOW + 24h − 1ms → deadline = NOW − 1ms → now > deadline
    const appt = makeAppointment({
      start_at: new Date(NOW.getTime() + 24 * H - 1).toISOString(),
    })
    expect(canModify(appt, NOW, WINDOW)).toBe(false)
  })

  it('blocks modification when appointment is in the past', () => {
    const appt = makeAppointment({ start_at: new Date(NOW.getTime() - H).toISOString() })
    expect(canModify(appt, NOW, WINDOW)).toBe(false)
  })

  it('allows modification 1ms before the deadline', () => {
    // deadline = NOW → now must be < NOW → use NOW − 1ms as "now"
    const appt = makeAppointment({ start_at: new Date(NOW.getTime() + 24 * H).toISOString() })
    const oneMilliBefore = new Date(NOW.getTime() - 1)
    expect(canModify(appt, oneMilliBefore, WINDOW)).toBe(true)
  })
})

// ─── cancelAppointment ────────────────────────────────────────────────────────

describe('cancelAppointment — idempotent (FR-031)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ALREADY_CANCELLED when appointment is already cancelled', async () => {
    const appt = makeAppointment({ status: 'cancelled', cancelled_at: NOW.toISOString() })
    setupDbForAppointment(appt)

    const result = await cancelAppointment('tok-cancel', NOW)
    expect(result).toEqual({ ok: false, code: 'ALREADY_CANCELLED' })
    // No DB update should have been attempted
    // The db mock was called 4 times (lookup + 3 deps) — not a 5th for UPDATE
    expect(mockDb).toHaveBeenCalledTimes(4)
  })
})

describe('cancelAppointment — window enforcement (FR-034)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns OUTSIDE_WINDOW when now >= start_at − window', async () => {
    // start_at = NOW + 24h → exactly at the deadline → NOT modifiable
    const appt = makeAppointment({ start_at: new Date(NOW.getTime() + 24 * H).toISOString() })
    setupDbForAppointment(appt)
    mockGetSetting.mockResolvedValue(24)
    // UPDATE call should NOT happen
    mockDb.mockResolvedValue([]) // fallback for any extra calls

    const result = await cancelAppointment('tok-cancel', NOW)
    expect(result).toEqual({ ok: false, code: 'OUTSIDE_WINDOW', windowHours: 24 })
  })

  it('returns ok when strictly inside the window', async () => {
    // start_at = NOW + 25h → 1h before deadline → modifiable
    const appt = makeAppointment({ start_at: new Date(NOW.getTime() + 25 * H).toISOString() })
    setupDbForAppointment(appt)
    mockGetSetting.mockResolvedValue(24)
    mockDb.mockResolvedValue([]) // UPDATE call

    const result = await cancelAppointment('tok-cancel', NOW)
    expect(result).toEqual({ ok: true })
    expect(mockOnBookingCancelled).toHaveBeenCalledOnce()
  })

  it('returns NOT_FOUND for unknown token', async () => {
    mockDb.mockResolvedValueOnce([]) // SELECT returns empty

    const result = await cancelAppointment('unknown-token', NOW)
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND' })
  })
})

// ─── rescheduleAppointment — window uses ORIGINAL start (FR-032) ──────────────

describe('rescheduleAppointment — window uses ORIGINAL start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns OUTSIDE_WINDOW based on ORIGINAL start even when new slot is far in the future', async () => {
    // Original start is only 20h away (inside 24h window → NOT modifiable)
    const originalStart = new Date(NOW.getTime() + 20 * H)
    const appt = makeAppointment({ start_at: originalStart.toISOString() })
    setupDbForAppointment(appt)

    mockGetSettings.mockResolvedValue({ cancellation_window_hours: 24 })
    // New slot is 48h away (would be fine if window applied to new slot)
    const newStart = new Date(NOW.getTime() + 48 * H)

    const result = await rescheduleAppointment('tok-reschedule', newStart, NOW)
    expect(result).toEqual({ ok: false, code: 'OUTSIDE_WINDOW', windowHours: 24 })
  })

  it('returns NOT_FOUND for unknown reschedule token', async () => {
    mockDb.mockResolvedValueOnce([]) // SELECT returns empty

    const newStart = new Date(NOW.getTime() + 48 * H)
    const result = await rescheduleAppointment('bad-token', newStart, NOW)
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('proceeds when original start IS within the modifiable window', async () => {
    // Original start 48h away → modifiable (24h window)
    const originalStart = new Date(NOW.getTime() + 48 * H)
    const appt = makeAppointment({ start_at: originalStart.toISOString() })
    setupDbForAppointment(appt)

    mockGetSettings.mockResolvedValue({
      cancellation_window_hours: 24,
      buffer_min: 0,
      min_lead_time_hours: 2,
      booking_horizon_days: 56,
    })

    // Slot engine returns the new slot as available
    const newStart = new Date(NOW.getTime() + 72 * H)
    mockGetActiveWindows.mockResolvedValue([])
    mockGetBlockedSlotsInRange.mockResolvedValue([])
    mockGetNonCancelledAppointmentsInRange.mockResolvedValue([])
    mockGetSlotsForBarber.mockReturnValue([
      { startAtUtc: newStart, localDate: '2026-06-13', localLabel: '10:00', barberId: 'barber-1' },
    ])

    const updatedAppt = { ...appt, start_at: newStart.toISOString() }
    mockDb.mockResolvedValueOnce([updatedAppt]) // UPDATE RETURNING

    const result = await rescheduleAppointment('tok-reschedule', newStart, NOW)
    expect(result).toMatchObject({ ok: true })
    expect(mockOnBookingRescheduled).toHaveBeenCalledOnce()
  })

  it('returns SLOT_TAKEN when engine does not offer the requested slot', async () => {
    const originalStart = new Date(NOW.getTime() + 48 * H)
    const appt = makeAppointment({ start_at: originalStart.toISOString() })
    setupDbForAppointment(appt)

    mockGetSettings.mockResolvedValue({ cancellation_window_hours: 24 })
    mockGetActiveWindows.mockResolvedValue([])
    mockGetBlockedSlotsInRange.mockResolvedValue([])
    mockGetNonCancelledAppointmentsInRange.mockResolvedValue([])
    // Slot engine returns no matching slot
    mockGetSlotsForBarber.mockReturnValue([])

    const newStart = new Date(NOW.getTime() + 72 * H)
    const result = await rescheduleAppointment('tok-reschedule', newStart, NOW)
    expect(result).toEqual({ ok: false, code: 'SLOT_TAKEN' })
  })
})
