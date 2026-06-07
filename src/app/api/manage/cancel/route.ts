import { NextRequest, NextResponse } from 'next/server'
import { cancelAppointment } from '@/lib/services/manage'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const token =
    typeof (body as Record<string, unknown>).token === 'string'
      ? ((body as Record<string, unknown>).token as string)
      : null

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const result = await cancelAppointment(token, new Date())

  if (result.ok) {
    return NextResponse.json({ ok: true })
  }

  if (result.code === 'NOT_FOUND') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  if (result.code === 'ALREADY_CANCELLED') {
    return NextResponse.json({ ok: true, alreadyCancelled: true })
  }

  if (result.code === 'OUTSIDE_WINDOW') {
    return NextResponse.json(
      { error: 'OUTSIDE_WINDOW', windowHours: result.windowHours },
      { status: 403 },
    )
  }

  return NextResponse.json({ error: 'Unknown error' }, { status: 500 })
}
