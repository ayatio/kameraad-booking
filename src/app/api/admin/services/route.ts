import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse } from '@/lib/auth/api'
import { listAllServices } from '@/lib/services/admin-services'

// GET /api/admin/services — full list incl. inactive + walk-in (FR-061 editor).
export async function GET() {
  try {
    await requirePermissionApi('services.edit')
    return NextResponse.json({ services: await listAllServices() })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
