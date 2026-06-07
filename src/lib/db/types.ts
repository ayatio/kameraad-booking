// TypeScript interfaces matching the post-002 schema.
// uuid and timestamptz are represented as string.
// Numeric columns (int, smallint) are number.

export interface Barber {
  id: string
  slug: string
  name: string
  bio_nl: string | null
  bio_en: string | null
  bio_fr: string | null
  bio_es: string | null
  bio_le: string | null
  photo_url: string | null
  email: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Service {
  id: string
  slug: string
  name_nl: string
  name_en: string
  name_fr: string | null
  name_es: string | null
  name_le: string | null
  description_nl: string | null
  description_en: string | null
  description_fr: string | null
  description_es: string | null
  description_le: string | null
  price_cents: number
  duration_min: number
  color: string
  is_active: boolean
  is_walk_in: boolean
  sort_order: number
  created_at: string
}

export interface BarberService {
  barber_id: string
  service_id: string
}

export interface Availability {
  id: string
  barber_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export interface BlockedSlot {
  id: string
  barber_id: string | null
  start_at: string
  end_at: string
  reason: string | null
  created_at: string
}

export interface Customer {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  notes: string | null
  marketing_opt_in: boolean
  rebooking_opt_in: boolean
  reminder_opt_in: boolean
  preferred_language: 'nl' | 'en' | 'fr' | 'es' | 'le'
  no_show_count: number
  consent_given_at: string | null
  unsubscribe_token: string | null
  email_missing: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  barber_id: string
  service_id: string
  customer_id: string
  start_at: string
  end_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'completed'
  customer_notes: string | null
  admin_notes: string | null
  cancel_token: string | null
  reschedule_token: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  ics_sequence: number
  created_at: string
  updated_at: string
}

export interface EmailLog {
  id: string
  appointment_id: string | null
  customer_id: string | null
  email_type: string
  to_email: string
  subject: string
  sent_at: string
  status: string
  error_message: string | null
}

export interface Setting {
  key: string
  value: unknown
  updated_at: string
}

export interface AuditLog {
  id: string
  actor: string
  action: string
  payload: unknown
  created_at: string
}

export interface AdminUser {
  id: string
  email: string
  password_hash: string | null
  role: 'owner' | 'barber'
  barber_id: string | null
  set_password_token: string | null
  set_password_expires_at: string | null
  failed_login_count: number
  locked_until: string | null
  last_failed_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Content {
  id: string
  key: string
  title_nl: string | null
  title_en: string | null
  title_fr: string | null
  title_es: string | null
  title_le: string | null
  text_nl: string | null
  text_en: string | null
  text_fr: string | null
  text_es: string | null
  text_le: string | null
  is_active: boolean
  updated_at: string
  updated_by: string | null
}
