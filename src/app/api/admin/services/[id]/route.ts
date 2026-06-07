import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { updateService } from '@/lib/services/admin-services'

const patchSchema = z.object({
  name_nl: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  name_fr: z.string().nullable().optional(),
  name_es: z.string().nullable().optional(),
  name_le: z.string().nullable().optional(),
  description_nl: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  description_fr: z.string().nullable().optional(),
  description_es: z.string().nullable().optional(),
  description_le: z.string().nullable().optional(),
  price_cents: z.number().int().min(0).optional(),
  duration_min: z.number().int().min(1).optional(),
  color: z.string().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

// PATCH /api/admin/services/[id] — edit a service (FR-061, owner-only).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermissionApi('services.edit')
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

    const result = await updateService(params.id, parsed.data, adminActor(session))
    if (result.ok) return NextResponse.json({ service: result.service })
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
