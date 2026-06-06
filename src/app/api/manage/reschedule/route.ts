import { NextRequest, NextResponse } from 'next/server'
import { rescheduleAppointment } from '@/lib/services/manage'
import { getOfferedSlots } from '@/lib/services/slots'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const token = typeof input.token === 'string' ? input.token : null
  const startAtUtc = typeof input.startAtUtc === 'string' ? input.startAtUtc : null

  if (!token || !startAtUtc) {
    return NextResponse.json({ error: 'token and startAtUtc required' }, { status: 400 })
  }

  const newStart = new Date(startAtUtc)
  if (isNaN(newStart.getTime())) {
    return NextResponse.json({ error: 'Invalid startAtUtc' }, { status: 400 })
  }

  const result = await rescheduleAppointment(token, newStart, new Date())

  if (result.ok) {
    const appt = result.appointment
    return NextResponse.json({
      ok: true,
      appointment: {
        startAt: appt.start_at,
        endAt: appt.end_at,
      },
    })
  }

  if (result.code === 'NOT_FOUND') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  if (result.code === 'ALREADY_CANCELLED') {
    return NextResponse.json({ error: 'ALREADY_CANCELLED' }, { status: 409 })
  }

  if (result.code === 'OUTSIDE_WINDOW') {
    return NextResponse.json(
      { error: 'OUTSIDE_WINDOW', windowHours: result.windowHours },
      { status: 403 },
    )
  }

  if (result.code === 'SLOT_TAKEN') {
    // FR-018 pattern: return refreshed slots for the same barber+service+day
    let refreshedSlots: unknown[] = []
    try {
      const barberId = typeof input.barberId === 'string' ? input.barberId : 'any'
      const serviceSlug = typeof input.serviceSlug === 'string' ? input.serviceSlug : ''
      const fromDate = startAtUtc.slice(0, 10)
      if (serviceSlug && fromDate) {
        refreshedSlots = await getOfferedSlots({
          barberId,
          serviceSlug,
          fromDate,
          toDate: fromDate,
          now: new Date(),
        })
      }
    } catch {
      // best effort
    }
    return NextResponse.json({ error: 'SLOT_TAKEN', refreshedSlots }, { status: 409 })
  }

  return NextResponse.json({ error: 'Unknown error' }, { status: 500 })
}
