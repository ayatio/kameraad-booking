// RBAC permission matrix — FA §6.2 (D3 Balanced).
// Pure, framework-free: no Next.js / DB imports. The single source of truth for
// "what can this role do". Route handlers and server actions call `assertCan`
// per privileged action (FR-044); `canActOnBarber` adds the own-vs-others data
// scope a barber is constrained to.

export type Role = 'owner' | 'barber'

// One entry per capability row of the FA §6.2 matrix.
export type Permission =
  | 'calendar.own' // own calendar (day/week/month) + own bookings
  | 'calendar.others.read' // view other barbers' calendars (read-only)
  | 'booking.manage.own' // reschedule/cancel/notes/no-show/complete own bookings
  | 'booking.manage.others' // same on other barbers' bookings (owner only)
  | 'hours.own' // edit own opening hours + own blocked periods
  | 'hours.others' // edit others' hours (owner only)
  | 'blocks.allbarber' // create all-barber blocks (owner only)
  | 'crm.view' // customer CRM: search, view
  | 'crm.edit' // customer CRM: edit, notes
  | 'gdpr.delete' // GDPR permanent delete (owner only)
  | 'services.edit' // services & prices editor (owner only)
  | 'bulk.email' // bulk/marketing email (owner only)
  | 'stats.own' // statistics: own bookings/no-shows
  | 'stats.shop' // statistics: shop-wide + revenue (owner only)
  | 'content.banner' // content (banner) editor (owner only)
  | 'settings.edit' // settings (§2 keys) editor (owner only)
  | 'admin.users.manage' // admin-user management (owner only)

// Every permission, in declaration order — owner gets all of these.
const ALL_PERMISSIONS: readonly Permission[] = [
  'calendar.own',
  'calendar.others.read',
  'booking.manage.own',
  'booking.manage.others',
  'hours.own',
  'hours.others',
  'blocks.allbarber',
  'crm.view',
  'crm.edit',
  'gdpr.delete',
  'services.edit',
  'bulk.email',
  'stats.own',
  'stats.shop',
  'content.banner',
  'settings.edit',
  'admin.users.manage',
]

// Barber's allowed set per FA §6.2. Explicitly EXCLUDES: booking.manage.others,
// hours.others, blocks.allbarber, gdpr.delete, services.edit, bulk.email,
// stats.shop, content.banner, settings.edit, admin.users.manage.
const BARBER_PERMISSIONS: readonly Permission[] = [
  'calendar.own',
  'calendar.others.read',
  'booking.manage.own',
  'hours.own',
  'crm.view',
  'crm.edit',
  'stats.own',
]

export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: new Set(ALL_PERMISSIONS),
  barber: new Set(BARBER_PERMISSIONS),
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission)
}

// Thrown by `assertCan` when a role lacks a permission. `.status = 403` so route
// handlers can map it directly to an HTTP response.
export class ForbiddenError extends Error {
  readonly status = 403
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

// Per-action server-side check (FR-044). Throws ForbiddenError when not allowed.
export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError(`Role '${role}' lacks permission '${permission}'`)
  }
}

// Data-scope check for "own vs others" (a barber may only act on their OWN
// bookings/hours, but may READ other barbers' calendars).
//   owner            → always true
//   barber, own      → true
//   barber, others   → true only when action === 'read'
export function canActOnBarber(opts: {
  role: Role
  actorBarberId: string | null
  targetBarberId: string
  action: 'manage' | 'read'
}): boolean {
  const { role, actorBarberId, targetBarberId, action } = opts
  if (role === 'owner') return true
  // barber acting on their own data
  if (actorBarberId !== null && actorBarberId === targetBarberId) return true
  // barber on someone else's data: reading a calendar is allowed, managing is not
  return action === 'read'
}
