import type { Appointment } from '../db/types'

// Stub — overwrite this module when the email layer lands (Phase 2).
export async function onBookingConfirmed(_appointment: Appointment): Promise<void> {
  // no-op
}
