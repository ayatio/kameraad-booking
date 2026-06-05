import { describe, it, expect } from 'vitest'
import { pickLocale } from '../pick-locale'

describe('pickLocale', () => {
  it('exact match es → es', () => expect(pickLocale('es')).toBe('es'))
  it('es-ES → es', () => expect(pickLocale('es-ES')).toBe('es'))
  it('fr-BE → fr', () => expect(pickLocale('fr-BE')).toBe('fr'))
  it('en-US → en', () => expect(pickLocale('en-US')).toBe('en'))
  it('le → nl (never auto-select le)', () => expect(pickLocale('le')).toBe('nl'))
  it('null → nl', () => expect(pickLocale(null)).toBe('nl'))
  it('empty string → nl', () => expect(pickLocale('')).toBe('nl'))
  it('garbage → nl', () => expect(pickLocale('zzz-ZZZ,xx')).toBe('nl'))
  it('q-values: lower-q nl loses to higher-q en', () => expect(pickLocale('nl;q=0.5,en;q=0.9')).toBe('en'))
  it('implicit q=1 beats explicit q=0.9', () => expect(pickLocale('fr;q=0.8,en-US,nl;q=0.9')).toBe('en'))
  it('le first then en → en (le never selected)', () => expect(pickLocale('le,en;q=0.9')).toBe('en'))
  it('nl exact match → nl', () => expect(pickLocale('nl')).toBe('nl'))
  it('fr exact match → fr', () => expect(pickLocale('fr')).toBe('fr'))
})
