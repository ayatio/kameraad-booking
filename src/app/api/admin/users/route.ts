import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth/session'
import { adminErrorResponse, adminActor } from '@/lib/auth/api'
import { listAdminUsers, EmailInUseError } from '@/lib/db/queries/admin-users'
import { getActiveBarbers } from '@/lib/db/queries/barbers'
import { createInvite } from '@/lib/services/admin-auth'
import { buildSetPasswordLink } from '@/lib/services/admin-auth-email'
import { writeAudit, AUDIT } from '@/lib/services/audit'

// GET /api/admin/users — admin-user list + barbers for linking (owner-only).
export async function GET() {
  try {
    await requirePermissionApi('admin.users.manage')
    const [users, barbers] = await Promise.all([listAdminUsers(), getActiveBarbers()])
    // Never leak password hashes / tokens to the client.
    const safeUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      barber_id: u.barber_id,
      has_password: u.password_hash !== null,
      locked_until: u.locked_until,
      created_at: u.created_at,
    }))
    return NextResponse.json({
      users: safeUsers,
      barbers: barbers.map((b) => ({ id: b.id, name: b.name })),
    })
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}

const inviteSchema = z.object({
  email: z.string().email(),
  barberId: z.string().min(1),
})

// POST /api/admin/users — invite a barber; returns the set-password link so the
// owner can copy it (email is dry-run without a Resend key). FR-041.
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermissionApi('admin.users.manage')
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 })
    }
    try {
      const { token } = await createInvite({
        email: parsed.data.email,
        barberId: parsed.data.barberId,
      })
      await writeAudit({
        actor: adminActor(session).email,
        action: AUDIT.ADMIN_INVITE,
        payload: { email_invited: true, barber_id: parsed.data.barberId },
      })
      return NextResponse.json({ link: buildSetPasswordLink(token) }, { status: 201 })
    } catch (err) {
      if (err instanceof EmailInUseError) {
        return NextResponse.json({ error: 'email_in_use' }, { status: 409 })
      }
      throw err
    }
  } catch (err) {
    const mapped = adminErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
