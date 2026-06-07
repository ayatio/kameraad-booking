import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
vi.mock('../../db/index', () => ({
  default: vi.fn(),
}))

// Mock transport
vi.mock('../transport', () => ({
  getTransport: vi.fn(),
  _setTransportForTesting: vi.fn(),
}))

import type { Appointment, Barber, Customer, Service } from '../../db/types'
import { getTransport } from '../transport'
import { sendAppointmentEmail } from '../send'

const mockCustomer: Customer = {
  id: 'cust-1',
  first_name: 'Pieter',
  last_name: 'Janssen',
  email: 'pieter@example.com',
  phone: null,
  notes: null,
  marketing_opt_in: true,
  rebooking_opt_in: true,
  reminder_opt_in: true,
  preferred_language: 'nl',
  no_show_count: 0,
  consent_given_at: '2026-01-01T00:00:00Z',
  unsubscribe_token: 'unsub-token-xyz',
  email_missing: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockBarber: Barber = {
  id: 'barber-1',
  slug: 'adil',
  name: 'Adil',
  bio_nl: null,
  bio_en: null,
  bio_fr: null,
  bio_es: null,
  bio_le: null,
  photo_url: null,
  email: null,
  is_active: true,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00Z',
}

const mockService: Service = {
  id: 'svc-1',
  slug: 'knippen',
  name_nl: 'Knippen',
  name_en: 'Haircut',
  name_fr: 'Coupe',
  name_es: 'Corte',
  name_le: 'Knippe',
  description_nl: null,
  description_en: null,
  description_fr: null,
  description_es: null,
  description_le: null,
  price_cents: 2400,
  duration_min: 30,
  color: '#C9A24B',
  is_active: true,
  is_walk_in: false,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00Z',
}

const mockAppointment: Appointment = {
  id: 'appt-1',
  barber_id: 'barber-1',
  service_id: 'svc-1',
  customer_id: 'cust-1',
  start_at: '2026-06-10T10:00:00Z',
  end_at: '2026-06-10T10:30:00Z',
  status: 'confirmed',
  customer_notes: null,
  admin_notes: null,
  cancel_token: 'cancel-token',
  reschedule_token: 'reschedule-token',
  cancelled_at: null,
  cancellation_reason: null,
  ics_sequence: 0,
  created_at: '2026-06-09T10:00:00Z',
  updated_at: '2026-06-09T10:00:00Z',
}

describe('sendAppointmentEmail', () => {
  let mockDbFn: ReturnType<typeof vi.fn>
  let mockSend: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()

    mockSend = vi.fn().mockResolvedValue({ id: 'transport-id-001' })
    vi.mocked(getTransport).mockReturnValue({ send: mockSend })

    // Setup db mock: first call (existing check) returns empty, second call (log insert) succeeds
    mockDbFn = vi.fn()
    const { default: db } = await import('../../db/index')
    vi.mocked(db).mockImplementation(mockDbFn as unknown as typeof db)
  })

  it('returns skipped:true when email_log already has a sent row', async () => {
    // Simulate already-sent: first db call returns a row
    mockDbFn.mockResolvedValueOnce([{ id: 'log-existing' }])

    const result = await sendAppointmentEmail({
      type: 'confirmation',
      appointment: mockAppointment,
      customer: mockCustomer,
      barber: mockBarber,
      service: mockService,
    })

    expect(result.skipped).toBe(true)
    expect(result.id).toBe('log-existing')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('catches 23505 unique violation on log insert and returns skipped:true', async () => {
    // First call (check existing) returns empty → proceed
    mockDbFn.mockResolvedValueOnce([])
    // Second call (settings for hours) — not needed for confirmation
    // Third call (log insert) throws 23505
    mockDbFn.mockRejectedValueOnce({ code: '23505' })

    const result = await sendAppointmentEmail({
      type: 'confirmation',
      appointment: mockAppointment,
      customer: mockCustomer,
      barber: mockBarber,
      service: mockService,
    })

    expect(result.skipped).toBe(true)
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('logs status=failed and re-throws when transport.send fails', async () => {
    mockDbFn.mockResolvedValueOnce([]) // existing check
    mockSend.mockRejectedValueOnce(new Error('Network error'))
    mockDbFn.mockResolvedValueOnce([]) // failure log insert

    await expect(
      sendAppointmentEmail({
        type: 'confirmation',
        appointment: mockAppointment,
        customer: mockCustomer,
        barber: mockBarber,
        service: mockService,
      }),
    ).rejects.toThrow('Network error')

    // The failure log INSERT should have been called
    const calls = mockDbFn.mock.calls
    const logCall = calls.find((c) => {
      const sql = String(c[0])
      return sql.includes('failed')
    })
    expect(logCall).toBeDefined()
  })
})
