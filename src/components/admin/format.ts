// Shared formatting + Brussels-time helpers for the admin UI (NL-only v1).
// Pure — safe to import from both server and client components.

const TZ = 'Europe/Brussels'

// €X,XX (Dutch comma decimal). cents → string.
export function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  return '€' + (cents / 100).toFixed(2).replace('.', ',')
}

// Brussels-local 'HH:MM' for a UTC ISO instant.
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('nl-BE', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

// Brussels-local 'YYYY-MM-DD' for a UTC ISO instant.
export function isoLocalDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

// Minutes from local midnight (Brussels) for a UTC ISO instant — for timeline
// positioning on the day view.
export function minutesFromMidnight(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return h * 60 + m
}

// Human Dutch date, e.g. "ma 7 jun 2026".
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('nl-BE', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`
}

// Format a 'YYYY-MM-DD' (calendar) string in Dutch without a timezone shift.
export function formatLocalDateStr(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat('nl-BE', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dt)
}

// ─── 'YYYY-MM-DD' calendar math (UTC-anchored, DST-safe) ─────────────────────

export function todayBrussels(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function addDaysStr(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// Monday-based start of the week containing `localDate`.
export function weekStartStr(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0=Sun..6=Sat
  const deltaToMonday = (dow + 6) % 7
  return addDaysStr(localDate, -deltaToMonday)
}

export function weekdayIndex(localDate: string): number {
  const [y, m, d] = localDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

// Build the [from, to) ISO instants for a Brussels calendar day, as the listBlocks
// API expects ISO datetimes. Uses a generous ±UTC margin then the server filters.
export function localDateToUtcRange(localDate: string, days = 1): { from: string; to: string } {
  const [y, m, d] = localDate.split('-').map(Number)
  const from = new Date(Date.UTC(y, m - 1, d, -3)) // pad for CET/CEST
  const to = new Date(Date.UTC(y, m - 1, d + days, 3))
  return { from: from.toISOString(), to: to.toISOString() }
}

export function monthLabel(year: number, month: number): string {
  const dt = new Date(Date.UTC(year, month - 1, 1, 12))
  return new Intl.DateTimeFormat('nl-BE', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(dt)
}

// Build a 'YYYY-MM-DDTHH:MM' local Brussels wall-time → UTC ISO. Used by the
// manual-booking / block editors where the admin types wall-clock time. We
// resolve the UTC instant by probing both candidate offsets.
export function brusselsLocalToUtcIso(localDate: string, time: string): string {
  const [y, mo, d] = localDate.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  // Guess at UTC+1, then correct using the actual Brussels offset at that guess.
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi))
  const offsetMin = brusselsOffsetMinutes(guess)
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - offsetMin * 60_000).toISOString()
}

function brusselsOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = dtf.formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((asUtc - at.getTime()) / 60_000)
}
