import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOfferedSlots } from '@/lib/services/slots'

const querySchema = z.object({
  barberId: z.string().min(1),
  service: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request', issues: parsed.error.issues }, { status: 400 })
  }

  const { barberId, service, from, to } = parsed.data

  try {
    const slots = await getOfferedSlots({
      barberId,
      serviceSlug: service,
      fromDate: from,
      toDate: to,
      now: new Date(),
    })
    return NextResponse.json({ slots })
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err) {
      const code = (err as { code: string }).code
      if (
        code === 'SERVICE_NOT_FOUND' ||
        code === 'INACTIVE_SERVICE' ||
        code === 'WALK_IN_SERVICE' ||
        code === 'BARBER_NOT_FOUND'
      ) {
        return NextResponse.json({ error: err.message, code }, { status: 400 })
      }
    }
    throw err
  }
}
