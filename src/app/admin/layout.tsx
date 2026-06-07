import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import nlMessages from '../../../messages/nl.json'
import '../globals.css'

// The admin back-office lives OUTSIDE the [locale] segment and is NL-only in v1
// (FA §6). This layout provides the <html>/<body> shell for /admin/** and forces
// the Dutch message bundle so every client component's useTranslations('admin')
// resolves NL regardless of the visitor's locale.

export const metadata: Metadata = {
  title: 'Kameraad — Beheer',
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <NextIntlClientProvider locale="nl" messages={nlMessages} timeZone="Europe/Brussels">
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
