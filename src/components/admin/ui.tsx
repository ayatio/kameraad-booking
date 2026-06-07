import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

// Presentational primitives composed from the Gate-A design tokens (no hooks →
// usable from server and client trees). Paper ground, ink text, gold accents,
// Oswald display caps for labels, slab-edged cards.

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-line-paper bg-paper shadow-1', className)}>
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[1.6rem] uppercase tracking-display text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-[60ch] text-[0.9rem] text-smoke">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-ink hover:bg-gold-bright border border-gold disabled:opacity-50',
  secondary: 'bg-paper text-ink border border-line-paper hover:border-gold disabled:opacity-50',
  ghost: 'bg-transparent text-fg2 hover:text-ink hover:bg-paper-2 border border-transparent',
  danger: 'bg-red-700 text-white hover:bg-red-800 border border-red-700 disabled:opacity-50',
}

export function Button({
  variant = 'secondary',
  className,
  children,
  ...props
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-[0.82rem] font-display uppercase tracking-display transition-colors duration-200 ease-out disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block font-display text-[0.66rem] uppercase tracking-eyebrow text-smoke">
        {label}
      </span>
      {children}
      {hint && !error ? <span className="mt-1 block text-[0.78rem] text-smoke">{hint}</span> : null}
      {error ? (
        <span className="mt-1 block text-[0.78rem] text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  )
}

const FIELD_BASE =
  'w-full rounded-md border border-line-paper bg-white px-3 py-2 text-[0.92rem] text-ink outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold/40 disabled:bg-paper-2 disabled:text-smoke'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(FIELD_BASE, props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(FIELD_BASE, 'cursor-pointer', props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(FIELD_BASE, 'min-h-[88px] resize-y', props.className)} />
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-[0.88rem] text-ink disabled:opacity-50"
    >
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-pill border transition-colors duration-200',
          checked ? 'border-gold bg-gold' : 'border-line-paper bg-paper-2',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-1 transition-all duration-200',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  )
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-gold/15 text-gold-deep border-gold/40',
  completed: 'bg-emerald-600/12 text-emerald-800 border-emerald-600/30',
  cancelled: 'bg-stone/20 text-smoke border-line-paper',
  no_show: 'bg-red-600/12 text-red-800 border-red-600/30',
  pending: 'bg-paper-2 text-fg2 border-line-paper',
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[0.7rem] font-display uppercase tracking-display',
        STATUS_STYLES[status] ?? STATUS_STYLES.pending,
      )}
    >
      {label}
    </span>
  )
}

export function Alert({ kind, children }: { kind: 'success' | 'error' | 'info'; children: ReactNode }) {
  const styles =
    kind === 'success'
      ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-900'
      : kind === 'error'
        ? 'border-red-600/40 bg-red-600/10 text-red-900'
        : 'border-gold/40 bg-gold/10 text-gold-deep'
  return (
    <div className={cn('rounded-md border px-3.5 py-2.5 text-[0.86rem]', styles)} role="status">
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line-paper bg-paper-2/40 px-4 py-10 text-center text-[0.9rem] text-smoke">
      {children}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.85rem] text-smoke" aria-live="polite">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line-paper border-t-gold" />
      {label}
    </span>
  )
}
