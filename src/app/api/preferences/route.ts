import { NextRequest, NextResponse } from 'next/server'
import { getCustomerByUnsubscribeToken, updateCustomerPreferences } from '@/lib/db/queries/customers'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const token = typeof input.token === 'string' ? input.token : null

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const customer = await getCustomerByUnsubscribeToken(token)
  if (!customer) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const reminders = typeof input.reminders === 'boolean' ? input.reminders : customer.reminder_opt_in
  const rebooking = typeof input.rebooking === 'boolean' ? input.rebooking : customer.rebooking_opt_in
  const marketing = typeof input.marketing === 'boolean' ? input.marketing : customer.marketing_opt_in

  await updateCustomerPreferences(customer.id, { reminders, rebooking, marketing })

  return NextResponse.json({ ok: true })
}
