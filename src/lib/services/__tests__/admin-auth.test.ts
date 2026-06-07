import { describe, it, expect } from 'vitest'
import bcrypt from 'bcryptjs'
import {
  decideLogin,
  hashPassword,
  validatePasswordStrength,
  type LoginState,
  type LoginDecision,
} from '../admin-auth'

// ─── Fixed clock helpers ──────────────────────────────────────────────────────

const T0 = new Date('2026-06-07T12:00:00.000Z')
const MIN = 60 * 1000
const at = (mins: number) => new Date(T0.getTime() + mins * MIN)

const FRESH: LoginState = {
  failedLoginCount: 0,
  lastFailedLoginAt: null,
  lockedUntil: null,
  hasPassword: true,
}

// Mirror what the DB layer would persist, to thread state across attempts
// (the pure function never mutates — verifyCredentials writes the result).
function applyPersist(prev: LoginState, decision: LoginDecision): LoginState {
  const p = decision.persist
  switch (p.kind) {
    case 'reset':
      return { ...prev, failedLoginCount: 0, lastFailedLoginAt: null, lockedUntil: null }
    case 'record':
      return {
        ...prev,
        failedLoginCount: p.failedLoginCount,
        lastFailedLoginAt: p.lastFailedLoginAt,
      }
    case 'lock':
      return {
        ...prev,
        failedLoginCount: p.failedLoginCount,
        lastFailedLoginAt: p.lastFailedLoginAt,
        lockedUntil: p.lockedUntil,
      }
    case 'none':
      return prev
  }
}

describe('decideLogin — lockout state machine (FR-043)', () => {
  it('4 wrong passwords then a 5th within 15 min locks the account', () => {
    let state = FRESH
    // Attempts 1..4 — each within a minute of the last, all "invalid".
    for (let i = 1; i <= 4; i++) {
      const d = decideLogin(state, false, at(i))
      expect(d.result).toEqual({ ok: false, reason: 'invalid' })
      expect(d.persist.kind).toBe('record')
      state = applyPersist(state, d)
      expect(state.failedLoginCount).toBe(i)
      expect(state.lockedUntil).toBeNull()
    }
    // 5th attempt → lock.
    const d5 = decideLogin(state, false, at(5))
    expect(d5.result).toEqual({ ok: false, reason: 'locked' })
    expect(d5.persist.kind).toBe('lock')
    state = applyPersist(state, d5)
    expect(state.failedLoginCount).toBe(5)
    expect(state.lockedUntil).toEqual(new Date(at(5).getTime() + 15 * MIN))
  })

  it('a failure AFTER the 15-min window resets the count to 1', () => {
    let state = FRESH
    // Build up 3 failures.
    for (let i = 1; i <= 3; i++) {
      state = applyPersist(state, decideLogin(state, false, at(i)))
    }
    expect(state.failedLoginCount).toBe(3)

    // Next failure >15 min after the last → window elapsed → counts as #1.
    const d = decideLogin(state, false, at(3 + 16))
    expect(d.result).toEqual({ ok: false, reason: 'invalid' })
    expect(d.persist.kind).toBe('record')
    state = applyPersist(state, d)
    expect(state.failedLoginCount).toBe(1)
  })

  it('does not lock until the 5th failure stays within the rolling window', () => {
    let state = FRESH
    // 4 failures spaced 16 min apart → window resets every time, never locks.
    for (let i = 0; i < 4; i++) {
      const d = decideLogin(state, false, at(i * 16))
      expect(d.result).toEqual({ ok: false, reason: 'invalid' })
      state = applyPersist(state, d)
      expect(state.failedLoginCount).toBe(1)
      expect(state.lockedUntil).toBeNull()
    }
  })

  it('a locked account rejects even the correct password until lock expires', () => {
    const locked: LoginState = {
      failedLoginCount: 5,
      lastFailedLoginAt: at(5),
      lockedUntil: new Date(at(5).getTime() + 15 * MIN), // unlocks at minute 20
      hasPassword: true,
    }
    // Correct password while still locked → rejected, nothing persisted.
    const during = decideLogin(locked, true, at(10))
    expect(during.result).toEqual({ ok: false, reason: 'locked' })
    expect(during.persist.kind).toBe('none')

    // After lockedUntil passes, correct password succeeds and clears counters.
    const after = decideLogin(locked, true, at(21))
    expect(after.result).toEqual({ ok: true })
    expect(after.persist.kind).toBe('reset')
  })

  it('correct password clears all counters', () => {
    const dirty: LoginState = {
      failedLoginCount: 3,
      lastFailedLoginAt: at(3),
      lockedUntil: null,
      hasPassword: true,
    }
    const d = decideLogin(dirty, true, at(4))
    expect(d.result).toEqual({ ok: true })
    expect(d.persist).toEqual({ kind: 'reset' })
    const next = applyPersist(dirty, d)
    expect(next.failedLoginCount).toBe(0)
    expect(next.lastFailedLoginAt).toBeNull()
    expect(next.lockedUntil).toBeNull()
  })

  it('invite-incomplete account (null hash) → reason no_password, even with a match', () => {
    const noPw: LoginState = { ...FRESH, hasPassword: false }
    // passwordOk can't really be true (dummy compare), but assert both paths.
    expect(decideLogin(noPw, false, at(1)).result).toEqual({
      ok: false,
      reason: 'no_password',
    })
    expect(decideLogin(noPw, true, at(1)).result).toEqual({
      ok: false,
      reason: 'no_password',
    })
    expect(decideLogin(noPw, false, at(1)).persist.kind).toBe('none')
  })

  it('locked check precedes the no_password check', () => {
    const lockedNoPw: LoginState = {
      failedLoginCount: 5,
      lastFailedLoginAt: at(5),
      lockedUntil: new Date(at(5).getTime() + 15 * MIN),
      hasPassword: false,
    }
    expect(decideLogin(lockedNoPw, false, at(6)).result).toEqual({
      ok: false,
      reason: 'locked',
    })
  })
})

describe('hashPassword (FR-040, bcrypt cost 12)', () => {
  it('produces a bcrypt hash at cost 12 that bcrypt.compare accepts', async () => {
    const hash = await hashPassword('correct horse battery')
    expect(hash).toMatch(/^\$2[ab]\$12\$/)
    expect(await bcrypt.compare('correct horse battery', hash)).toBe(true)
    expect(await bcrypt.compare('wrong password!!', hash)).toBe(false)
  })
})

describe('validatePasswordStrength', () => {
  it('requires at least 10 characters', () => {
    expect(validatePasswordStrength('123456789')).toBe(false) // 9
    expect(validatePasswordStrength('1234567890')).toBe(true) // 10
    expect(validatePasswordStrength('a-very-long-passphrase')).toBe(true)
    expect(validatePasswordStrength('')).toBe(false)
  })
})
