import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse } from '@/lib/auth/api'
import { searchCustomers } from '@/lib/services/admin-crm'

// GET /api/admin/customers?q=&sort=last_visit|name — CRM search (FR-057).
export async function GET(req: NextRequest) {
  try {
    await requirePermissionApi('crm.view')
    const sp = req.nextUrl.searchParams
    const q = sp.get('q') ?? undefined
    const sortParam = sp.get('sort')
    const sort = sortParam === 'name' ? 'name' : 'last_visit'
    return NextResponse.json({ customers: await searchCustomers({ q, sort }) })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
