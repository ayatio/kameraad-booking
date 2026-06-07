import type { ReactNode } from 'react'

// Centered brand lockup + card used by the login and set-password screens.
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-serif text-[2rem] leading-none text-gold-pale">Kameraad</div>
          <div className="mt-1 font-display text-[0.7rem] uppercase tracking-eyebrow text-gold/70">
            Haarsnijder · Beheer
          </div>
        </div>
        <div className="rounded-lg border border-ink-3 bg-paper p-7 shadow-3">
          <h1 className="font-display text-[1.2rem] uppercase tracking-display text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-[0.85rem] text-smoke">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  )
}
