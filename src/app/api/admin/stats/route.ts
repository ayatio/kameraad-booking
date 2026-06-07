import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth/session'
import { adminErrorResponse } from '@/lib/auth/api'
import { assertCan } from '@/lib/auth/permissions'
import { getStats } from '@/lib/services/admin-stats'

const querySchema = z.object({
  range: z.enum(['day', 'week', 'month', 'custom']),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

// GET /api/admin/stats?range=&from=&to=&barberId=&scope=
// Role-scoped: owner → shop-wide incl. revenue (stats.shop) or own; barber →
// own only, no revenue (stats.own), barberIds forced to their own id.
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdminApi()
    const sp = req.nextUrl.searchParams
    const parsed = querySchema.safeParse({
      range: sp.get('range') ?? undefined,
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'bad_request', issues: parsed.error.issues }, { status: 400 })
    }

    const { role, barberId } = session.user
    let scope: 'shop' | 'own'
    let barberIds: string[] | undefined

    if (role === 'owner') {
      scope = sp.get('scope') === 'own' ? 'own' : 'shop'
      const requested = sp.getAll('barberId').filter((v) => v && v !== 'all')
      barberIds = requested.length > 0 ? requested : undefined
    } else {
      // Barber: own scope only, locked to their own id (no shop revenue).
      scope = 'own'
      barberIds = barberId ? [barberId] : []
    }

    // Enforce the permission matching the resolved scope (FR-060).
    assertCan(role, scope === 'shop' ? 'stats.shop' : 'stats.own')

    const stats = await getStats({
      range: parsed.data.range,
      from: parsed.data.from,
      to: parsed.data.to,
      barberIds,
      scope,
    })
    return NextResponse.json(stats)
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
