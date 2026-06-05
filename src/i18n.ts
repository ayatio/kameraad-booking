import { getRequestConfig } from 'next-intl/server'

const LOCALES = ['nl', 'en', 'fr', 'es', 'le'] as const

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = (LOCALES as readonly string[]).includes(requested ?? '') ? requested! : 'nl'
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
