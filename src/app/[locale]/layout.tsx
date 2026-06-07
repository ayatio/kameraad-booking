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
  return [
    { locale: 'nl' },
    { locale: 'en' },
    { locale: 'fr' },
    { locale: 'es' },
    { locale: 'le' },
  ]
}

type Props = {
  children: ReactNode
  params: { locale: string }
}

export default async function LocaleLayout({ children, params: { locale } }: Props) {
  const messages = await getMessages()

  // 'le' is the Leuvens dialect — render lang="nl" per HTML spec and design i18n.js behaviour.
  const htmlLang = locale === 'le' ? 'nl' : locale

  return (
    <html lang={htmlLang}>
      <body className="bg-dark-950 text-gold-400">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
