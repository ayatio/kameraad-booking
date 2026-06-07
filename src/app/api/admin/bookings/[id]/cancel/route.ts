import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { adminCancel } from '@/lib/services/admin-bookings'

const bodySchema = z.object({
  notify: z.boolean().optional(),
  reason: z.string().max(500).optional(),
})

// POST /api/admin/bookings/[id]/cancel (FR-051).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermissionApi('booking.manage.own')
    let body: unknown = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 })
    }

    const result = await adminCancel(params.id, adminActor(session), parsed.data)
    if (result.ok) return NextResponse.json({ ok: true })
    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ error: 'already_cancelled' }, { status: 409 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
