import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { getSettingsValues, updateSettingsValues } from '@/lib/services/admin-settings'

// GET /api/admin/settings — current §2 values (any admin may read).
export async function GET() {
  try {
    await requireAdminApi()
    return NextResponse.json({ values: await getSettingsValues() })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}

// PUT /api/admin/settings — update the §2 keys (owner-only, validated + audited).
export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermissionApi('settings.edit')
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    const result = await updateSettingsValues(
      (body ?? {}) as Record<string, unknown>,
      adminActor(session),
    )
    if (result.ok) return NextResponse.json({ values: result.values })
    return NextResponse.json({ error: 'invalid_settings', errors: result.errors }, { status: 422 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
