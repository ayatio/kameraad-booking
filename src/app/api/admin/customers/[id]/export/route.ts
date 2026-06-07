import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { exportCustomerJson } from '@/lib/services/admin-crm'

// GET /api/admin/customers/[id]/export — GDPR data export, owner-only (FR-059).
// Returns the full JSON as a downloadable attachment.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermissionApi('gdpr.delete') // export = owner-only (FR-059)
    const data = await exportCustomerJson(params.id, adminActor(session))
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="customer-${params.id}.json"`,
      },
    })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
