import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import {
  getCustomerDetail,
  updateCustomerNotes,
  updateCustomerOptins,
} from '@/lib/services/admin-crm'

// GET /api/admin/customers/[id] — detail + appointment history (FR-057).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermissionApi('crm.view')
    const detail = await getCustomerDetail(params.id)
    if (!detail) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}

const patchSchema = z.object({
  notes: z.string().max(5000).nullable().optional(),
  optins: z
    .object({
      marketing_opt_in: z.boolean(),
      rebooking_opt_in: z.boolean(),
      reminder_opt_in: z.boolean(),
    })
    .optional(),
})

// PATCH /api/admin/customers/[id] — update notes and/or opt-ins (crm.edit).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermissionApi('crm.edit')
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 })
    }
    const actor = adminActor(session)

    let found = false
    if (parsed.data.notes !== undefined) {
      const r = await updateCustomerNotes(params.id, parsed.data.notes, actor)
      found = found || r !== null
    }
    if (parsed.data.optins) {
      const r = await updateCustomerOptins(params.id, parsed.data.optins, actor)
      found = found || r !== null
    }
    if (parsed.data.notes === undefined && !parsed.data.optins) {
      return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
    }
    if (!found) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
