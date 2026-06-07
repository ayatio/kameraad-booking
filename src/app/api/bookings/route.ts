import { NextRequest, NextResponse } from 'next/server'
import { createBooking } from '@/lib/services/booking'
import { getOfferedSlots } from '@/lib/services/slots'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = await createBooking(body)

  if (result.ok) {
    const appt = result.appointment
    return NextResponse.json(
      {
        appointmentId: appt.id,
        summary: {
          barberId: appt.barber_id,
          serviceId: appt.service_id,
          startAt: appt.start_at,
          endAt: appt.end_at,
          status: appt.status,
        },
      },
      { status: 201 },
    )
  }

  if (result.code === 'VALIDATION_ERROR') {
    return NextResponse.json({ error: 'Validation failed', issues: result.issues }, { status: 400 })
  }

  if (result.code === 'SLOT_TAKEN') {
    // FR-018: return refreshed slots for the same barber+service+day
    let refreshedSlots: unknown[] = []
    try {
      const input = body as Record<string, unknown>
      const barberId = typeof input.barberId === 'string' ? input.barberId : 'any'
      const serviceSlug = typeof input.serviceSlug === 'string' ? input.serviceSlug : ''
      const startAt = typeof input.startAtUtc === 'string' ? input.startAtUtc.slice(0, 10) : ''

      if (serviceSlug && startAt) {
        refreshedSlots = await getOfferedSlots({
          barberId,
          serviceSlug,
          fromDate: startAt,
          toDate: startAt,
          now: new Date(),
        })
      }
    } catch {
      // best effort
    }

    return NextResponse.json(
      { code: 'SLOT_TAKEN', refreshedSlots },
      { status: 409 },
    )
  }

  return NextResponse.json({ error: result.message }, { status: 400 })
}
