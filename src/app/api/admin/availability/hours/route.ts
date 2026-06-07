import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { getHoursForBarber, setHoursForBarber } from '@/lib/services/admin-availability'

// GET /api/admin/availability/hours?barberId=… — read a barber's weekly hours.
export async function GET(req: NextRequest) {
  try {
    await requireAdminApi()
    const barberId = req.nextUrl.searchParams.get('barberId')
    if (!barberId) return NextResponse.json({ error: 'barberId_required' }, { status: 400 })
    return NextResponse.json({ windows: await getHoursForBarber(barberId) })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}

const putSchema = z.object({
  barberId: z.string().min(1),
  windows: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
      }),
    )
    .max(14), // 7 days × ≤2 windows
})

// PUT /api/admin/availability/hours — replace a barber's weekly hours (FR-054).
export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermissionApi('hours.own') // service enforces own-vs-others
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 })
    }

    const result = await setHoursForBarber(
      parsed.data.barberId,
      parsed.data.windows,
      adminActor(session),
    )
    if (result.ok) return NextResponse.json({ windows: result.windows })
    return NextResponse.json({ error: 'invalid_hours', errors: result.errors }, { status: 422 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
