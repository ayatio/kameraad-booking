import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { adminCreateManualBooking } from '@/lib/services/admin-bookings'

// POST /api/admin/bookings — manual (walk-in/phone) booking (FR-052).
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermissionApi('booking.manage.own')
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const result = await adminCreateManualBooking(body, adminActor(session))
    if (result.ok) {
      return NextResponse.json({ appointment: result.appointment }, { status: 201 })
    }
    if (result.code === 'VALIDATION_ERROR') {
      return NextResponse.json({ error: 'validation', issues: result.issues }, { status: 400 })
    }
    if (result.code === 'SLOT_TAKEN') {
      return NextResponse.json({ error: 'slot_taken' }, { status: 409 })
    }
    return NextResponse.json({ error: 'service_error', message: result.message }, { status: 400 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
