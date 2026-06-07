import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { deleteBlock } from '@/lib/services/admin-availability'

// DELETE /api/admin/blocks/[id] — remove a block (all-barber blocks owner-only).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermissionApi('hours.own') // service enforces all-barber=owner-only
    const result = await deleteBlock(params.id, adminActor(session))
    if (result.ok) return NextResponse.json({ ok: true })
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
