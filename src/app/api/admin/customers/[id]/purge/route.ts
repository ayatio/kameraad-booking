import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { purgeCustomer } from '@/lib/services/admin-crm'

const schema = z.object({ confirmText: z.string() })

// POST /api/admin/customers/[id]/purge — GDPR permanent delete, owner-only +
// type-to-confirm "VERWIJDER" (FR-058/080..083).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermissionApi('gdpr.delete')
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

    const result = await purgeCustomer(params.id, adminActor(session), parsed.data.confirmText)
    if (result.ok) {
      return NextResponse.json({ ok: true, message: 'Alle gegevens permanent verwijderd' })
    }
    return NextResponse.json({ error: 'confirm_mismatch' }, { status: 400 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
