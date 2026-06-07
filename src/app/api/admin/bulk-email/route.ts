import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { sendBulk, previewRecipients } from '@/lib/services/admin-bulk-email'

const localeCopy = z
  .object({ nl: z.string(), en: z.string(), fr: z.string(), es: z.string(), le: z.string() })
  .partial()

const schema = z.object({
  preview: z.boolean().optional(),
  filter: z.enum(['all', 'marketing']).optional(),
  subjectByLocale: localeCopy.optional(),
  bodyByLocale: localeCopy.optional(),
  testToSelf: z.boolean().optional(),
})

// POST /api/admin/bulk-email — preview recipients or send (FR-063, owner-only).
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermissionApi('bulk.email')
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
    const { preview, filter, subjectByLocale, bodyByLocale, testToSelf } = parsed.data
    const actor = adminActor(session)

    if (preview) {
      return NextResponse.json(
        await previewRecipients({ filter: filter ?? 'marketing', type: 'marketing' }),
      )
    }

    if (!subjectByLocale || !bodyByLocale) {
      return NextResponse.json({ error: 'subject_body_required' }, { status: 400 })
    }

    const result = await sendBulk(
      {
        subjectByLocale,
        bodyByLocale,
        type: 'marketing',
        filter: filter ?? 'marketing',
        testToSelf,
        actorEmail: actor.email,
      },
      actor,
    )
    return NextResponse.json(result)
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
