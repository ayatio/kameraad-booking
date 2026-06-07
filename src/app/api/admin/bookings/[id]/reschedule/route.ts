import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { adminReschedule } from '@/lib/services/admin-bookings'

const bodySchema = z.object({
  newStartAtUtc: z.string().datetime(),
  overrideLeadTime: z.boolean().optional(),
})

// POST /api/admin/bookings/[id]/reschedule (FR-050).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

    const result = await adminReschedule(
      params.id,
      new Date(parsed.data.newStartAtUtc),
      adminActor(session),
      { overrideLeadTime: parsed.data.overrideLeadTime },
    )
    if (result.ok) return NextResponse.json({ appointment: result.appointment })
    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (result.code === 'SLOT_TAKEN') return NextResponse.json({ error: 'slot_taken' }, { status: 409 })
    return NextResponse.json({ error: 'already_cancelled' }, { status: 409 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
