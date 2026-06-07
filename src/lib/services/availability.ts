// Pure, framework-free. All computation in Europe/Brussels (FR-010).
// Walk-in services are excluded by the CALLER (FR-019/D11); this engine never special-cases them.

// ─── Input / output types ─────────────────────────────────────────────────────

export interface AvailabilityWindow {
  barberId: string
  dayOfWeek: number // 0=Sun, 1=Mon … 6=Sat
  startTime: string // 'HH:MM'
  endTime: string // 'HH:MM'
}

export interface BlockedSlot {
  barberId: string | null // null = all barbers (D9)
  startAt: Date
  endAt: Date
}

// Caller passes only non-cancelled appointments (FR-012).
export interface BusyAppointment {
  barberId: string
  startAt: Date
  endAt: Date
}

export interface EngineSettings {
  bufferMin: number // D5
  minLeadTimeHours: number // D7
  bookingHorizonDays: number // D7
}

export interface Slot {
  startAtUtc: Date
  endAtUtc: Date // customer-visible end = start + durationMin (buffer NOT included)
  localLabel: string // 'HH:MM' in Europe/Brussels
  localDate: string // 'YYYY-MM-DD' in Europe/Brussels
  barberId: string
}

export interface AnyBarberSlot extends Slot {
  candidateBarberIds: string[]
}

// ─── Brussels timezone helpers (exported for tests and other services) ─────────

// Build a reliable Brussels formatter using formatToParts to avoid locale quirks.
function makeBrusselsFmt(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

const _brusselsFmt = makeBrusselsFmt()

function fmtBrusselsRaw(d: Date): string {
  const p = _brusselsFmt.formatToParts(d)
  const g = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)!.value
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
}

/**
 * Convert a Brussels wall-clock date + time to a UTC instant.
 *
 * FR-015 semantics:
 *  - Spring-forward gap (e.g. 2026-03-29 02:00–02:59): returns null (non-existent time).
 *  - Fall-back ambiguity (e.g. 2026-10-25 02:00–02:59): returns the FIRST occurrence
 *    (the CEST / UTC+2 one, which has the earlier UTC value).
 */
export function brusselsWallTimeToUtc(localDate: string, localTime: string): Date | null {
  const [y, mo, d] = localDate.split('-').map(Number)
  const [h, min] = localTime.split(':').map(Number)

  // Try CEST (+2) first → guarantees first occurrence on fall-back day.
  // Then try CET (+1).
  for (const offsetH of [2, 1]) {
    // Date.UTC handles negative hours correctly (rolls back to previous day).
    const candidate = new Date(Date.UTC(y, mo - 1, d, h - offsetH, min, 0, 0))
    if (fmtBrusselsRaw(candidate) === `${localDate}T${localTime}`) {
      return candidate
    }
  }
  return null // non-existent local time (spring-forward gap)
}

/**
 * Decompose a UTC instant into Brussels local parts.
 */
export function utcToBrusselsParts(d: Date): {
  date: string
  time: string
  hour: number
  minute: number
  dayOfWeek: number
} {
  const s = fmtBrusselsRaw(d)
  const [datePart, timePart] = s.split('T')
  const [h, m] = timePart.split(':').map(Number)
  const [y, mo, day] = datePart.split('-').map(Number)
  // Day of week from the Brussels local date string (midnight never crosses a DST boundary).
  const dow = new Date(Date.UTC(y, mo - 1, day)).getUTCDay()
  return { date: datePart, time: timePart, hour: h, minute: m, dayOfWeek: dow }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Add `days` to a 'YYYY-MM-DD' string; JS Date.UTC handles month overflow.
function addDays(localDate: string, days: number): string {
  const [y, mo, d] = localDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

// Brussels local date for a UTC instant.
function brusselsDate(d: Date): string {
  return fmtBrusselsRaw(d).slice(0, 10)
}

// Day of week (0=Sun) from a 'YYYY-MM-DD' string.
function dateStringDow(localDate: string): number {
  const [y, mo, d] = localDate.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
}

// Inclusive upper bound: (today in Brussels) + bookingHorizonDays (FR-014).
function horizonDate(now: Date, bookingHorizonDays: number): string {
  return addDays(brusselsDate(now), bookingHorizonDays)
}

// Two half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap iff aStart < bEnd && bStart < aEnd.
// Touching boundaries ([a,b) meets [b,c)) do NOT conflict per FR-012.
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}

// ─── Core per-day slot generator (single barber) ──────────────────────────────

function getSlotsForDate(
  barberId: string,
  localDate: string,
  durationMin: number,
  windows: AvailabilityWindow[],
  blocks: BlockedSlot[],
  appointments: BusyAppointment[],
  settings: EngineSettings,
  now: Date,
  minLeadTimeMs: number,
): Slot[] {
  const { bufferMin } = settings
  const dow = dateStringDow(localDate)
  const dayWindows = windows.filter((w) => w.barberId === barberId && w.dayOfWeek === dow)
  if (dayWindows.length === 0) return []

  const occupancyMin = durationMin + bufferMin
  const slots: Slot[] = []

  for (const win of dayWindows) {
    const winStartMin = parseTime(win.startTime)
    const winEndMin = parseTime(win.endTime)

    // FR-011: first 15-min grid point at or after window start.
    const firstGrid = Math.ceil(winStartMin / 15) * 15

    for (let gridMin = firstGrid; gridMin + occupancyMin <= winEndMin; gridMin += 15) {
      const localTime = formatTime(gridMin)

      // FR-015: skip non-existent times (spring-forward gap).
      const startUtc = brusselsWallTimeToUtc(localDate, localTime)
      if (!startUtc) continue

      // FR-013: reject candidates earlier than now + minLeadTimeHours.
      if (startUtc.getTime() < now.getTime() + minLeadTimeMs) continue

      // Customer-visible end time (buffer NOT included per D6).
      const endUtcCustomer = new Date(startUtc.getTime() + durationMin * 60_000)
      // Occupancy end used for conflict checks.
      const endUtcOccupancy = new Date(startUtc.getTime() + occupancyMin * 60_000)

      // FR-012: reject if any block overlaps the candidate's occupancy interval.
      const blocked = blocks.some(
        (b) =>
          (b.barberId === null || b.barberId === barberId) &&
          overlaps(startUtc, endUtcOccupancy, b.startAt, b.endAt),
      )
      if (blocked) continue

      // FR-012: reject if any appointment's occupancy [start_at, end_at + bufferMin) overlaps.
      const busy = appointments.some(
        (a) =>
          a.barberId === barberId &&
          overlaps(
            startUtc,
            endUtcOccupancy,
            a.startAt,
            new Date(a.endAt.getTime() + bufferMin * 60_000),
          ),
      )
      if (busy) continue

      slots.push({
        startAtUtc: startUtc,
        endAtUtc: endUtcCustomer,
        localLabel: localTime,
        localDate,
        barberId,
      })
    }
  }

  return slots
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * FR-011..015: All offered slots for one barber over a date range.
 */
export function getSlotsForBarber(params: {
  barberId: string
  durationMin: number
  dateRange: { fromDate: string; toDate: string }
  now: Date
  windows: AvailabilityWindow[]
  blocks: BlockedSlot[]
  appointments: BusyAppointment[]
  settings: EngineSettings
}): Slot[] {
  const { barberId, durationMin, dateRange, now, windows, blocks, appointments, settings } = params
  const horizon = horizonDate(now, settings.bookingHorizonDays)
  // FR-014: clamp toDate to horizon.
  const toDate = dateRange.toDate <= horizon ? dateRange.toDate : horizon
  const minLeadTimeMs = settings.minLeadTimeHours * 3_600_000
  const result: Slot[] = []

  let cur = dateRange.fromDate
  while (cur <= toDate) {
    result.push(
      ...getSlotsForDate(
        barberId,
        cur,
        durationMin,
        windows,
        blocks,
        appointments,
        settings,
        now,
        minLeadTimeMs,
      ),
    )
    cur = addDays(cur, 1)
  }

  return result
}

/**
 * FR-016: Union of slots across multiple barbers.
 * A local time is offered if ≥1 barber is free; one AnyBarberSlot per distinct local time.
 */
export function getSlotsAnyBarber(params: {
  barberIds: string[]
  durationMin: number
  dateRange: { fromDate: string; toDate: string }
  now: Date
  windows: AvailabilityWindow[]
  blocks: BlockedSlot[]
  appointments: BusyAppointment[]
  settings: EngineSettings
}): AnyBarberSlot[] {
  const { barberIds, ...rest } = params
  const byLocalKey = new Map<string, AnyBarberSlot>()

  for (const barberId of barberIds) {
    const slots = getSlotsForBarber({ ...rest, barberId })
    for (const slot of slots) {
      const key = `${slot.localDate}T${slot.localLabel}`
      const existing = byLocalKey.get(key)
      if (existing) {
        existing.candidateBarberIds.push(barberId)
      } else {
        byLocalKey.set(key, { ...slot, barberId, candidateBarberIds: [barberId] })
      }
    }
  }

  return Array.from(byLocalKey.values()).sort(
    (a, b) => a.startAtUtc.getTime() - b.startAtUtc.getTime(),
  )
}

/**
 * FR-016: Assign one barber from candidates for a slot.
 * Fewest appointments that day wins; tie broken by sort_order (lower = higher priority).
 */
export function assignBarber(params: {
  localDate: string
  startAtUtc: Date
  candidateBarberIds: string[]
  dayAppointmentCounts: Record<string, number>
  sortOrder: Record<string, number>
}): string {
  const { candidateBarberIds, dayAppointmentCounts, sortOrder } = params
  return [...candidateBarberIds].sort((a, b) => {
    const countDiff = (dayAppointmentCounts[a] ?? 0) - (dayAppointmentCounts[b] ?? 0)
    if (countDiff !== 0) return countDiff
    return (sortOrder[a] ?? 0) - (sortOrder[b] ?? 0)
  })[0]
}

/**
 * FR-017a: First available slot for a barber scanning forward from now up to the horizon.
 */
export function firstAvailableSlot(params: {
  barberId: string
  durationMin: number
  now: Date
  windows: AvailabilityWindow[]
  blocks: BlockedSlot[]
  appointments: BusyAppointment[]
  settings: EngineSettings
}): Slot | null {
  const { now, settings } = params
  const horizon = horizonDate(now, settings.bookingHorizonDays)
  const minLeadTimeMs = settings.minLeadTimeHours * 3_600_000

  let cur = brusselsDate(now)
  while (cur <= horizon) {
    const slots = getSlotsForDate(
      params.barberId,
      cur,
      params.durationMin,
      params.windows,
      params.blocks,
      params.appointments,
      settings,
      now,
      minLeadTimeMs,
    )
    if (slots.length > 0) return slots[0]
    cur = addDays(cur, 1)
  }

  return null
}

/**
 * FR-017b: Per-day earliest slot across barbers (powers homepage preview).
 */
export function firstSlotPerDay(params: {
  barberIds: string[]
  durationMin: number
  fromDate: string
  days: number
  now: Date
  windows: AvailabilityWindow[]
  blocks: BlockedSlot[]
  appointments: BusyAppointment[]
  settings: EngineSettings
}): Record<string, Slot | null> {
  const { barberIds, durationMin, fromDate, days, now, windows, blocks, appointments, settings } =
    params
  const horizon = horizonDate(now, settings.bookingHorizonDays)
  const minLeadTimeMs = settings.minLeadTimeHours * 3_600_000
  const result: Record<string, Slot | null> = {}

  for (let i = 0; i < days; i++) {
    const localDate = addDays(fromDate, i)
    if (localDate > horizon) {
      result[localDate] = null
      continue
    }

    let earliest: Slot | null = null
    for (const barberId of barberIds) {
      const slots = getSlotsForDate(
        barberId,
        localDate,
        durationMin,
        windows,
        blocks,
        appointments,
        settings,
        now,
        minLeadTimeMs,
      )
      if (slots.length > 0 && (!earliest || slots[0].startAtUtc < earliest.startAtUtc)) {
        earliest = slots[0]
      }
    }

    result[localDate] = earliest
  }

  return result
}
