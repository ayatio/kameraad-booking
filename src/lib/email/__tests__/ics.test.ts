import { describe, it, expect } from 'vitest'
import { buildIcs } from '../ics'

const BASE = {
  method: 'REQUEST' as const,
  sequence: 0,
  uid: 'appt-abc-123',
  summary: 'Knippen — Kameraad Haarsnijder',
  dtstart: '2026-06-10T10:00:00Z',
  dtend: '2026-06-10T10:30:00Z',
}

describe('buildIcs', () => {
  it('produces CRLF line endings throughout', () => {
    const ics = buildIcs(BASE)
    // Every line break must be \r\n
    expect(ics).not.toMatch(/(?<!\r)\n/)
    // And no bare \r
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\r/)
  })

  it('ends with CRLF', () => {
    const ics = buildIcs(BASE)
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('contains required calendar properties', () => {
    const ics = buildIcs(BASE)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('METHOD:REQUEST')
  })

  it('contains required VEVENT properties', () => {
    const ics = buildIcs(BASE)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('UID:appt-abc-123@kameraadhaarsnijder.be')
    expect(ics).toContain('SEQUENCE:0')
    expect(ics).toContain('DTSTART;TZID=Europe/Brussels:')
    expect(ics).toContain('DTEND;TZID=Europe/Brussels:')
  })

  it('contains SUMMARY with the given text', () => {
    const ics = buildIcs(BASE)
    expect(ics).toContain('SUMMARY:Knippen — Kameraad Haarsnijder')
  })

  it('contains LOCATION', () => {
    const ics = buildIcs(BASE)
    expect(ics).toContain('LOCATION:Parijsstraat 29')
  })

  it('contains VTIMEZONE Europe/Brussels with both STANDARD and DAYLIGHT', () => {
    const ics = buildIcs(BASE)
    expect(ics).toContain('BEGIN:VTIMEZONE')
    expect(ics).toContain('TZID:Europe/Brussels')
    expect(ics).toContain('BEGIN:STANDARD')
    expect(ics).toContain('BEGIN:DAYLIGHT')
    expect(ics).toContain('TZNAME:CET')
    expect(ics).toContain('TZNAME:CEST')
  })

  it('CANCEL method sets STATUS:CANCELLED and METHOD:CANCEL', () => {
    const ics = buildIcs({ ...BASE, method: 'CANCEL', sequence: 1 })
    expect(ics).toContain('METHOD:CANCEL')
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics).toContain('SEQUENCE:1')
  })

  it('does NOT include STATUS:CANCELLED for REQUEST', () => {
    const ics = buildIcs(BASE)
    expect(ics).not.toContain('STATUS:CANCELLED')
  })

  it('escapes commas in LOCATION', () => {
    const ics = buildIcs(BASE)
    // Location contains a comma after the street — must be escaped
    expect(ics).toContain('Parijsstraat 29\\, 3000 Leuven')
  })

  it('escapes semicolons in SUMMARY if present', () => {
    const ics = buildIcs({ ...BASE, summary: 'Coupe; Barbe' })
    expect(ics).toContain('SUMMARY:Coupe\\; Barbe')
  })

  it('folds lines that exceed 75 octets', () => {
    const longUid = 'a'.repeat(80)
    const ics = buildIcs({ ...BASE, uid: longUid })
    const lines = ics.split('\r\n')
    for (const line of lines) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
    }
  })

  it('formats dtstart in Europe/Brussels local time', () => {
    // 2026-06-10T10:00:00Z = 12:00 CEST (UTC+2 in summer)
    const ics = buildIcs({ ...BASE, dtstart: '2026-06-10T10:00:00Z', dtend: '2026-06-10T10:30:00Z' })
    expect(ics).toContain('DTSTART;TZID=Europe/Brussels:20260610T120000')
    expect(ics).toContain('DTEND;TZID=Europe/Brussels:20260610T123000')
  })

  it('formats dtstart in CET (winter) correctly', () => {
    // 2026-01-05T09:00:00Z = 10:00 CET (UTC+1 in winter)
    const ics = buildIcs({ ...BASE, dtstart: '2026-01-05T09:00:00Z', dtend: '2026-01-05T09:30:00Z' })
    expect(ics).toContain('DTSTART;TZID=Europe/Brussels:20260105T100000')
  })

  // FR-071: the persistent appointments.ics_sequence is passed straight through,
  // so a SECOND reschedule (ics_sequence bumped 0→1→2) emits SEQUENCE:2 — the
  // Phase-2 hardcoded "1" would have regressed here.
  it('honors an arbitrary bumped sequence (second reschedule → SEQUENCE:2)', () => {
    const ics = buildIcs({ ...BASE, method: 'REQUEST', sequence: 2 })
    expect(ics).toContain('SEQUENCE:2')
    expect(ics).not.toContain('SEQUENCE:1')
  })

  it('a CANCEL carries the current sequence (never regresses below last REQUEST)', () => {
    const ics = buildIcs({ ...BASE, method: 'CANCEL', sequence: 2 })
    expect(ics).toContain('METHOD:CANCEL')
    expect(ics).toContain('SEQUENCE:2')
    expect(ics).toContain('STATUS:CANCELLED')
  })
})
