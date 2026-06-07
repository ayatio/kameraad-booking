import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { getBanner, updateBanner } from '@/lib/services/admin-content'

// GET /api/admin/banner — current banner row (all locales) for the editor.
export async function GET() {
  try {
    await requireAdminApi()
    return NextResponse.json({ banner: await getBanner() })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}

const localeMap = z
  .object({
    nl: z.string().nullable(),
    en: z.string().nullable(),
    fr: z.string().nullable(),
    es: z.string().nullable(),
    le: z.string().nullable(),
  })
  .partial()

const putSchema = z.object({
  titles: localeMap,
  texts: localeMap,
  isActive: z.boolean(),
})

// PUT /api/admin/banner — edit the banner (FR-062, owner-only).
export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermissionApi('content.banner')
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 })
    }
    const banner = await updateBanner(parsed.data, adminActor(session))
    return NextResponse.json({ banner })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
