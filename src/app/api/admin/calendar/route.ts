import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth/session'
import { adminErrorResponse } from '@/lib/auth/api'
import { getDayView, getWeekView, getMonthCounts } from '@/lib/services/admin-calendar'

// GET /api/admin/calendar?view=day|week|month&date=YYYY-MM-DD&barberId=…&includeCancelled=0|1
//
// Read is allowed for ALL admins (owner: all barbers; a barber may READ others'
// calendars per §6.2) — so we guard with requireAdminApi only, no permission
// assert. The write guard lives on the booking-mutation routes.
//
// `barberId` may be repeated (?barberId=a&barberId=b) or omitted/all → no filter.

const querySchema = z.object({
  view: z.enum(['day', 'week', 'month']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeCancelled: z.enum(['0', '1']).optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requireAdminApi()

    const sp = req.nextUrl.searchParams
    const parsed = querySchema.safeParse({
      view: sp.get('view') ?? undefined,
      date: sp.get('date') ?? undefined,
      includeCancelled: sp.get('includeCancelled') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'bad_request', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const { view, date, includeCancelled } = parsed.data

    const rawBarberIds = sp.getAll('barberId').filter((v) => v && v !== 'all')
    const barberIds = rawBarberIds.length > 0 ? rawBarberIds : undefined
    const withCancelled = includeCancelled === '1'

    if (view === 'day') {
      return NextResponse.json(
        await getDayView({ date, barberIds, includeCancelled: withCancelled }),
      )
    }
    if (view === 'week') {
      return NextResponse.json(
        await getWeekView({ weekStartDate: date, barberIds, includeCancelled: withCancelled }),
      )
    }
    const [y, m] = date.split('-').map(Number)
    return NextResponse.json({ counts: await getMonthCounts({ year: y, month: m, barberIds }) })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
