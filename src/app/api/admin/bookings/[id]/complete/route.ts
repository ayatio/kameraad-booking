import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { markCompleted } from '@/lib/services/admin-bookings'

// POST /api/admin/bookings/[id]/complete — mark completed (FR-053).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermissionApi('booking.manage.own')
    const result = await markCompleted(params.id, adminActor(session), new Date())
    if (result.ok) return NextResponse.json({ appointment: result.appointment })
    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (result.code === 'TOO_EARLY') {
      return NextResponse.json({ error: 'too_early', message: 'Nog niet gestart.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'invalid_state' }, { status: 409 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
