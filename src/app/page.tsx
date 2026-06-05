// Locale routing is handled exclusively by /[locale]/* via next-intl middleware.
// The middleware redirects / to the best-match locale before this page renders.
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/nl')
}
