import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kameraad Haarsnijder',
  description: 'Online afsprakensysteem voor Kameraad Haarsnijder',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body className="bg-dark-950 text-gold-400">{children}</body>
    </html>
  )
}
