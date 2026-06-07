import { describe, it, expect } from 'vitest'
import { selectBulkRecipients } from '../admin-bulk-email'

// Pure unit test — no DB. FR-063 / §7 opt-out logic on a mocked recipient set.
interface Cand {
  id: string
  marketing_opt_in: boolean
  email_missing: boolean
}

const SET: Cand[] = [
  { id: 'opted-in', marketing_opt_in: true, email_missing: false },
  { id: 'opted-out', marketing_opt_in: false, email_missing: false },
  { id: 'in-but-no-email', marketing_opt_in: true, email_missing: true },
  { id: 'out-and-no-email', marketing_opt_in: false, email_missing: true },
]

describe('selectBulkRecipients (FR-063)', () => {
  it('marketing send FORCES opt-in and excludes email_missing', () => {
    const out = selectBulkRecipients(SET, { filter: 'all', type: 'marketing' })
    // opted-in only — opted-out is dropped even though filter was "all", and the
    // email_missing rows are always dropped.
    expect(out.map((c) => c.id)).toEqual(['opted-in'])
  })

  it("never selects a marketing_opt_in=false recipient (the key acceptance)", () => {
    const out = selectBulkRecipients(SET, { filter: 'marketing', type: 'marketing' })
    expect(out.every((c) => c.marketing_opt_in)).toBe(true)
    expect(out.some((c) => c.id === 'opted-out')).toBe(false)
  })

  it('always excludes email_missing customers', () => {
    const out = selectBulkRecipients(SET, { filter: 'all', type: 'marketing' })
    expect(out.some((c) => c.email_missing)).toBe(false)
  })
})
