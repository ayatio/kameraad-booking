import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse } from '@/lib/auth/api'
import { previewBlockConflicts } from '@/lib/services/admin-availability'

const schema = z.object({
  barberId: z.string().min(1).nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
})

// POST /api/admin/blocks/preview-conflicts — D10: list confirmed appointments
// that a prospective block would hit, WITHOUT inserting anything.
export async function POST(req: NextRequest) {
  try {
    await requirePermissionApi('hours.own')
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 })
    }
    const conflicts = await previewBlockConflicts({
      barberId: parsed.data.barberId,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
    })
    return NextResponse.json({ conflicts })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
