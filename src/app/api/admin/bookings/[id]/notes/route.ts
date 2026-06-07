import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { updateAdminNotes } from '@/lib/services/admin-bookings'

const bodySchema = z.object({ notes: z.string().max(2000).nullable() })

// PATCH /api/admin/bookings/[id]/notes — edit admin-only notes (FR-050).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermissionApi('booking.manage.own')
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 })
    }
    const result = await updateAdminNotes(params.id, parsed.data.notes, adminActor(session))
    if (result.ok) return NextResponse.json({ appointment: result.appointment })
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
