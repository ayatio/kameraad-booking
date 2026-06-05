import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export default function HomePage() {
  const t = useTranslations('common')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold text-gold-600">{t('appName')}</h1>
      <p className="text-lg text-dark-300 italic">{t('tagline')}</p>
      <p className="max-w-prose text-center text-gold-400">{t('homeIntro')}</p>
      <LanguageSwitcher />
    </main>
  )
}
