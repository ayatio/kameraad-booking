import { z } from 'zod'

const LOCALES = ['nl', 'en', 'fr', 'es', 'le'] as const

// Accept Belgian formats: 04xx xxxxxx, +32 4xx xxxxxx, 0xx xxx xxxx, +32 x xxx xxxx
// E.164 format (+32…) or local 0… form, digits and spaces/hyphens stripped.
const phoneRegex = /^(\+32|0)\d[\d\s\-./]{6,14}\d$/

export const bookingInputSchema = z.object({
  barberId: z.string().min(1),
  serviceSlug: z.string().min(1),
  startAtUtc: z.string().datetime(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(phoneRegex, 'Invalid phone number (use Belgian or E.164 format)'),
  note: z.string().max(500).optional(),
  locale: z.enum(LOCALES),
  cancellationPolicyAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
})

export type BookingInput = z.infer<typeof bookingInputSchema>
