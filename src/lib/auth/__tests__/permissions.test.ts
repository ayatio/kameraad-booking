import { describe, it, expect } from 'vitest'
import {
  can,
  assertCan,
  canActOnBarber,
  ForbiddenError,
  ROLE_PERMISSIONS,
  type Permission,
} from '../permissions'

// Permissions barred to barbers per FA §6.2.
const OWNER_ONLY: Permission[] = [
  'booking.manage.others',
  'hours.others',
  'blocks.allbarber',
  'gdpr.delete',
  'services.edit',
  'bulk.email',
  'stats.shop',
  'content.banner',
  'settings.edit',
  'admin.users.manage',
]

const BARBER_ALLOWED: Permission[] = [
  'calendar.own',
  'calendar.others.read',
  'booking.manage.own',
  'hours.own',
  'crm.view',
  'crm.edit',
  'stats.own',
]

describe('ROLE_PERMISSIONS / can', () => {
  it('owner can do everything (every barber-allowed + every owner-only)', () => {
    for (const p of [...BARBER_ALLOWED, ...OWNER_ONLY]) {
      expect(can('owner', p)).toBe(true)
    }
  })

  it('barber can do exactly the allowed set', () => {
    for (const p of BARBER_ALLOWED) {
      expect(can('barber', p)).toBe(true)
    }
    expect(ROLE_PERMISSIONS.barber.size).toBe(BARBER_ALLOWED.length)
  })

  it('barber cannot do any owner-only capability', () => {
    for (const p of OWNER_ONLY) {
      expect(can('barber', p)).toBe(false)
    }
  })

  it('owner permission set is a strict superset of barber', () => {
    for (const p of ROLE_PERMISSIONS.barber) {
      expect(ROLE_PERMISSIONS.owner.has(p)).toBe(true)
    }
    expect(ROLE_PERMISSIONS.owner.size).toBeGreaterThan(ROLE_PERMISSIONS.barber.size)
  })
})

describe('assertCan', () => {
  it('does not throw when allowed', () => {
    expect(() => assertCan('barber', 'crm.view')).not.toThrow()
    expect(() => assertCan('owner', 'gdpr.delete')).not.toThrow()
  })

  it('throws ForbiddenError with status 403 when not allowed', () => {
    try {
      assertCan('barber', 'gdpr.delete')
      throw new Error('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError)
      expect((err as ForbiddenError).status).toBe(403)
      expect((err as ForbiddenError).name).toBe('ForbiddenError')
    }
  })
})

describe('canActOnBarber', () => {
  const OWNER = 'owner' as const
  const BARBER = 'barber' as const
  const A = 'barber-A'
  const B = 'barber-B'

  it('owner may always manage and read any barber', () => {
    expect(canActOnBarber({ role: OWNER, actorBarberId: null, targetBarberId: A, action: 'manage' })).toBe(true)
    expect(canActOnBarber({ role: OWNER, actorBarberId: null, targetBarberId: B, action: 'read' })).toBe(true)
  })

  it('barber may manage and read their own data', () => {
    expect(canActOnBarber({ role: BARBER, actorBarberId: A, targetBarberId: A, action: 'manage' })).toBe(true)
    expect(canActOnBarber({ role: BARBER, actorBarberId: A, targetBarberId: A, action: 'read' })).toBe(true)
  })

  it("barber may READ but not MANAGE another barber's data", () => {
    expect(canActOnBarber({ role: BARBER, actorBarberId: A, targetBarberId: B, action: 'read' })).toBe(true)
    expect(canActOnBarber({ role: BARBER, actorBarberId: A, targetBarberId: B, action: 'manage' })).toBe(false)
  })

  it('barber with no barber_id cannot manage anyone, may still read others', () => {
    expect(canActOnBarber({ role: BARBER, actorBarberId: null, targetBarberId: A, action: 'manage' })).toBe(false)
    expect(canActOnBarber({ role: BARBER, actorBarberId: null, targetBarberId: A, action: 'read' })).toBe(true)
  })
})
