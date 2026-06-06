import { runDispatch } from '@/lib/services/email-dispatch'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const counts = await runDispatch({ now: new Date() })
  return Response.json({ ok: true, counts })
}
