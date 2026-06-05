import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Kameraad Haarsnijder',
  description: 'Online afsprakensysteem voor Kameraad Haarsnijder',
}

export function generateStaticParams() {
  return [{ locale: 'nl' }, { locale: 'en' }, { locale: 'fr' }]
}

type Props = {
  children: ReactNode
  params: { locale: string }
}

export default async function LocaleLayout({ children, params: { locale } }: Props) {
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className="bg-dark-950 text-gold-400">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
