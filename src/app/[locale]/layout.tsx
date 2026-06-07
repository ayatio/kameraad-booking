import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Playfair_Display, Oswald, Hanken_Grotesk } from 'next/font/google'
import '../globals.css'

// Gate-A type system (docs/design/gate-a/colors_and_type.css):
//   Playfair Display — editorial serif for display + headings (--font-serif)
//   Oswald           — condensed label/eyebrow/nav/button face (--font-display)
//   Hanken Grotesk   — body (--font-body)
// next/font self-hosts + swaps (no render-blocking webfont; FR-103). The CSS
// custom properties below are consumed by tailwind.config.ts (font-serif/
// display/body) and the .km-* classes in globals.css.
const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-playfair',
})

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-oswald',
})

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-hanken',
})

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
    <html lang={htmlLang} className={`${playfair.variable} ${oswald.variable} ${hanken.variable}`}>
      <body className="font-body">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
