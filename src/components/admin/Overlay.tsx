'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from './ui'

// Keyboard-operable overlay primitives: Esc to close + a simple focus trap that
// keeps Tab within the panel while it is open (accessibility requirement).

function useOverlay(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    document.body.style.overflow = 'hidden'
    // Focus the first focusable element in the panel.
    const t = setTimeout(() => {
      const panel = panelRef.current
      const focusable = panel?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )
      focusable?.focus()
    }, 30)

    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = ''
      clearTimeout(t)
      prevActive?.focus?.()
    }
  }, [open, onClose, panelRef])
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  labelledBy?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useOverlay(open, onClose, panelRef)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-line-paper bg-paper shadow-3"
      >
        <div className="flex items-center justify-between border-b border-line-paper px-5 py-4">
          <h2 className="font-display text-[1.05rem] uppercase tracking-display text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="grid h-8 w-8 place-content-center rounded-full text-ink hover:bg-paper-2"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useOverlay(open, onClose, panelRef)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'absolute right-0 top-0 flex h-full w-full flex-col overflow-y-auto border-l border-line-paper bg-paper shadow-3',
          width,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-paper bg-paper px-5 py-4">
          <h2 className="font-display text-[1.05rem] uppercase tracking-display text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="grid h-8 w-8 place-content-center rounded-full text-ink hover:bg-paper-2"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
