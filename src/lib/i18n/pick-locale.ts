const DETECTABLE = ['nl', 'en', 'fr', 'es'] as const
type DetectableLocale = (typeof DETECTABLE)[number]

export function pickLocale(acceptLanguageHeader: string | null): DetectableLocale {
  if (!acceptLanguageHeader) return 'nl'

  const entries = acceptLanguageHeader
    .split(',')
    .flatMap(part => {
      const trimmed = part.trim()
      const qIdx = trimmed.indexOf(';q=')
      const lang = qIdx === -1 ? trimmed : trimmed.slice(0, qIdx)
      const q = qIdx === -1 ? 1 : parseFloat(trimmed.slice(qIdx + 3))
      return isNaN(q) || !lang.trim() ? [] : [{ lang: lang.trim().toLowerCase(), q }]
    })
    .sort((a, b) => b.q - a.q)

  for (const { lang } of entries) {
    const base = lang.split('-')[0] as DetectableLocale
    if ((DETECTABLE as readonly string[]).includes(base)) return base
  }

  return 'nl'
}
