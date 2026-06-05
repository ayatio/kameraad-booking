import { getSettings } from '../db/queries/settings'
import { getServiceBySlug } from '../db/queries/services'
import { getActiveBarbers, getBarberServiceLinks } from '../db/queries/barbers'
import {
  getActiveWindows,
  getBlockedSlotsInRange,
  getNonCancelledAppointmentsInRange,
} from '../db/queries/availability'
import {
  getSlotsForBarber,
  getSlotsAnyBarber,
  firstSlotPerDay,
  type Slot,
  type AnyBarberSlot,
  type EngineSettings,
} from './availability'

export class WalkInServiceError extends Error {
  readonly code = 'WALK_IN_SERVICE' as const
  constructor(slug: string) {
    super(`Service "${slug}" is walk-in and cannot be booked online.`)
  }
}

export class InactiveServiceError extends Error {
  readonly code = 'INACTIVE_SERVICE' as const
  constructor(slug: string) {
    super(`Service "${slug}" is not available.`)
  }
}

export class ServiceNotFoundError extends Error {
  readonly code = 'SERVICE_NOT_FOUND' as const
  constructor(slug: string) {
    super(`Service "${slug}" not found.`)
  }
}

export class BarberNotFoundError extends Error {
  readonly code = 'BARBER_NOT_FOUND' as const
  constructor(id: string) {
    super(`Barber "${id}" not found or not active.`)
  }
}

function buildEngineSettings(raw: Record<string, unknown>): EngineSettings {
  return {
    bufferMin: Number(raw['buffer_min'] ?? 0),
    minLeadTimeHours: Number(raw['min_lead_time_hours'] ?? 2),
    bookingHorizonDays: Number(raw['booking_horizon_days'] ?? 56),
  }
}

function dateRangeUtc(fromDate: string, toDate: string): { fromUtc: Date; toUtc: Date } {
  // Expand to full UTC days covering all of Brussels time on those calendar dates.
  // Brussels is UTC+1 (CET) or UTC+2 (CEST) — subtract 3h from start for safety, add 27h to end.
  const [fy, fm, fd] = fromDate.split('-').map(Number)
  const [ty, tm, td] = toDate.split('-').map(Number)
  const fromUtc = new Date(Date.UTC(fy, fm - 1, fd) - 3 * 3_600_000)
  const toUtc = new Date(Date.UTC(ty, tm - 1, td) + 27 * 3_600_000)
  return { fromUtc, toUtc }
}

export interface GetOfferedSlotsParams {
  barberId: string | 'any'
  serviceSlug: string
  fromDate: string
  toDate: string
  now: Date
}

export type OfferedSlot = Slot | AnyBarberSlot

export async function getOfferedSlots(
  params: GetOfferedSlotsParams,
): Promise<OfferedSlot[]> {
  const { barberId, serviceSlug, fromDate, toDate, now } = params

  const service = await getServiceBySlug(serviceSlug)
  if (!service) throw new ServiceNotFoundError(serviceSlug)
  if (!service.is_active) throw new InactiveServiceError(serviceSlug)
  if (service.is_walk_in) throw new WalkInServiceError(serviceSlug)

  const [settingsRaw, allBarbers, barberServiceLinks] = await Promise.all([
    getSettings(),
    getActiveBarbers(),
    getBarberServiceLinks(),
  ])

  const settings = buildEngineSettings(settingsRaw)
  const { fromUtc, toUtc } = dateRangeUtc(fromDate, toDate)

  if (barberId === 'any') {
    const serviceBarberIds = barberServiceLinks
      .filter((bs) => bs.service_id === service.id)
      .map((bs) => bs.barber_id)
    const activeIds = allBarbers.map((b) => b.id).filter((id) => serviceBarberIds.includes(id))
    if (activeIds.length === 0) return []

    const [windows, blocks, appointments] = await Promise.all([
      getActiveWindows(activeIds),
      getBlockedSlotsInRange(fromUtc, toUtc, activeIds),
      getNonCancelledAppointmentsInRange(fromUtc, toUtc, activeIds),
    ])

    return getSlotsAnyBarber({
      barberIds: activeIds,
      durationMin: service.duration_min,
      dateRange: { fromDate, toDate },
      now,
      windows,
      blocks,
      appointments,
      settings,
    })
  }

  const barber = allBarbers.find((b) => b.id === barberId)
  if (!barber) throw new BarberNotFoundError(barberId)

  const offersService = barberServiceLinks.some(
    (bs) => bs.barber_id === barberId && bs.service_id === service.id,
  )
  if (!offersService) return []

  const [windows, blocks, appointments] = await Promise.all([
    getActiveWindows([barberId]),
    getBlockedSlotsInRange(fromUtc, toUtc, [barberId]),
    getNonCancelledAppointmentsInRange(fromUtc, toUtc, [barberId]),
  ])

  return getSlotsForBarber({
    barberId,
    durationMin: service.duration_min,
    dateRange: { fromDate, toDate },
    now,
    windows,
    blocks,
    appointments,
    settings,
  })
}

export async function getFirstSlotPerDay(params: {
  serviceSlug: string
  fromDate: string
  days: number
  now: Date
}): Promise<Record<string, Slot | null>> {
  const { serviceSlug, fromDate, days, now } = params

  const service = await getServiceBySlug(serviceSlug)
  if (!service) throw new ServiceNotFoundError(serviceSlug)
  if (!service.is_active) throw new InactiveServiceError(serviceSlug)
  if (service.is_walk_in) throw new WalkInServiceError(serviceSlug)

  const [settingsRaw, allBarbers, barberServiceLinks] = await Promise.all([
    getSettings(),
    getActiveBarbers(),
    getBarberServiceLinks(),
  ])

  const settings = buildEngineSettings(settingsRaw)

  const serviceBarberIds = barberServiceLinks
    .filter((bs) => bs.service_id === service.id)
    .map((bs) => bs.barber_id)
  const activeIds = allBarbers.map((b) => b.id).filter((id) => serviceBarberIds.includes(id))
  if (activeIds.length === 0) {
    const result: Record<string, Slot | null> = {}
    for (let i = 0; i < days; i++) {
      const [y, m, d] = fromDate.split('-').map(Number)
      const dt = new Date(Date.UTC(y, m - 1, d + i))
      result[dt.toISOString().slice(0, 10)] = null
    }
    return result
  }

  const toDate = (() => {
    const [y, m, d] = fromDate.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
  })()
  const { fromUtc, toUtc } = dateRangeUtc(fromDate, toDate)

  const [windows, blocks, appointments] = await Promise.all([
    getActiveWindows(activeIds),
    getBlockedSlotsInRange(fromUtc, toUtc, activeIds),
    getNonCancelledAppointmentsInRange(fromUtc, toUtc, activeIds),
  ])

  return firstSlotPerDay({
    barberIds: activeIds,
    durationMin: service.duration_min,
    fromDate,
    days,
    now,
    windows,
    blocks,
    appointments,
    settings,
  })
}
