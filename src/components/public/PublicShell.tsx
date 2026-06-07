import type { ReactNode } from 'react'
import { PublicHeader } from './PublicHeader'
import { PublicFooter } from './PublicFooter'

// Marketing chrome wrapper imported by the 5 public pages. Booking, admin and
// token pages render standalone and must NOT be double-wrapped with this.
export function PublicShell({ locale, children }: { locale: string; children: ReactNode }) {
  return (
    <div className="pub">
      <PublicHeader locale={locale} />
      <main id="main">{children}</main>
      <PublicFooter locale={locale} />
    </div>
  )
}
