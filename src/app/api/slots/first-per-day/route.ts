import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getFirstSlotPerDay } from '@/lib/services/slots'

const querySchema = z.object({
  service: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.coerce.number().int().min(1).max(90).default(14),
})

export async function GET(req: NextRequest) {
  const raw = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = querySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request', issues: parsed.error.issues }, { status: 400 })
  }

  const { service, from, days } = parsed.data

  try {
    const slots = await getFirstSlotPerDay({
      serviceSlug: service,
      fromDate: from,
      days,
      now: new Date(),
    })
    return NextResponse.json({ slots })
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err) {
      const code = (err as { code: string }).code
      if (
        code === 'SERVICE_NOT_FOUND' ||
        code === 'INACTIVE_SERVICE' ||
        code === 'WALK_IN_SERVICE'
      ) {
        return NextResponse.json({ error: err.message, code }, { status: 400 })
      }
    }
    throw err
  }
}
