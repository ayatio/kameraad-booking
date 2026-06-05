import type { ReactNode } from 'react'

// The [locale] layout provides the <html> and <body> shell.
// This root layout is required by Next.js but acts as a passthrough.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children as React.JSX.Element
}
