export interface AvailabilityWindow {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

export function validateWindows(windows: AvailabilityWindow[]): ValidationResult {
  const errors: string[] = []

  // Validate each window individually: start must be before end
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]
    if (w.startTime >= w.endTime) {
      errors.push(
        `Window ${i + 1} (day ${w.dayOfWeek}): startTime ${w.startTime} must be before endTime ${w.endTime}`,
      )
    }
  }

  // Group by dayOfWeek and check for overlaps within each day
  const byDay = new Map<number, Array<{ idx: number; w: AvailabilityWindow }>>()
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]
    if (!byDay.has(w.dayOfWeek)) byDay.set(w.dayOfWeek, [])
    byDay.get(w.dayOfWeek)!.push({ idx: i, w })
  }

  for (const entries of byDay.values()) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i]
        const b = entries[j]
        // Two intervals [aStart, aEnd) and [bStart, bEnd) overlap iff aStart < bEnd && bStart < aEnd
        if (a.w.startTime < b.w.endTime && b.w.startTime < a.w.endTime) {
          errors.push(
            `Windows ${a.idx + 1} and ${b.idx + 1} overlap on day ${a.w.dayOfWeek}: ` +
              `${a.w.startTime}-${a.w.endTime} overlaps ${b.w.startTime}-${b.w.endTime}`,
          )
        }
      }
    }
  }

  return { ok: errors.length === 0, errors }
}
