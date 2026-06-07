import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { listBlocks, commitBlock } from '@/lib/services/admin-availability'

// GET /api/admin/blocks?barberId=&from=ISO&to=ISO — list blocks in a range.
export async function GET(req: NextRequest) {
  try {
    await requireAdminApi()
    const sp = req.nextUrl.searchParams
    const from = sp.get('from')
    const to = sp.get('to')
    if (!from || !to) return NextResponse.json({ error: 'from_to_required' }, { status: 400 })
    const fromUtc = new Date(from)
    const toUtc = new Date(to)
    if (isNaN(fromUtc.getTime()) || isNaN(toUtc.getTime())) {
      return NextResponse.json({ error: 'invalid_dates' }, { status: 400 })
    }
    const barberIdParam = sp.get('barberId') // omit → all; 'null' → all-barber only
    const barberId =
      barberIdParam === null ? undefined : barberIdParam === 'null' ? null : barberIdParam
    return NextResponse.json({ blocks: await listBlocks({ barberId, fromUtc, toUtc }) })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}

const commitSchema = z.object({
  barberId: z.string().min(1).nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(500).optional().nullable(),
  resolutions: z
    .array(
      z.object({
        appointmentId: z.string().min(1),
        decision: z.enum(['keep', 'cancel_notify']),
      }),
    )
    .optional(),
})

// POST /api/admin/blocks — commit a block with per-conflict resolutions (D10).
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermissionApi('hours.own') // service enforces all-barber=owner-only
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    const parsed = commitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 })
    }

    const outcome = await commitBlock(
      {
        barberId: parsed.data.barberId,
        startAt: new Date(parsed.data.startAt),
        endAt: new Date(parsed.data.endAt),
        reason: parsed.data.reason ?? null,
        resolutions: parsed.data.resolutions,
      },
      adminActor(session),
    )
    if (outcome.ok) return NextResponse.json(outcome.result, { status: 201 })
    return NextResponse.json({ error: 'invalid_range' }, { status: 400 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
